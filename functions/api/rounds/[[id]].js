const MAX_BYTES = 256 * 1024;
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}
});

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BYTES) throw new Error('too_large');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('invalid_json');
  let size = 0, body = '';
  const decoder = new TextDecoder();
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) { await reader.cancel(); throw new Error('too_large'); }
    body += decoder.decode(value, {stream:true});
  }
  try { return JSON.parse(body + decoder.decode()); } catch { throw new Error('invalid_json'); }
}

async function authorized(provided, expected) {
  if (typeof provided !== 'string' || provided.length > 4096) return false;
  const hash = s => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const [a,b] = await Promise.all([hash(provided),hash(expected)]);
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let difference = 0;
  for (let i=0; i<aa.length; i++) difference |= aa[i] ^ bb[i];
  return difference === 0;
}

export function validatePayload(p) {
  if (!object(p) || p.schemaVersion !== 1 || !text(p.roundId, 160)) return false;
  const r = p.round;
  if (object(r) && r.map === undefined && typeof r.mapName === 'string') { r.map = r.mapName; delete r.mapName; }
  if (!object(r) || !text(r.map, 120) || !text(r.winner, 40) || !Number.isSafeInteger(r.durationSeconds) || r.durationSeconds < 0) return false;
  // Arma emits a Unix timestamp; normalize once to UTC for storage and public reads.
  if (!r.completedAt && Number.isSafeInteger(r.completedAtUnix) && r.completedAtUnix > 0 && r.completedAtUnix < 4102444800)
    r.completedAt = new Date(r.completedAtUnix * 1000).toISOString();
  if (typeof r.completedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(r.completedAt) || !Number.isFinite(Date.parse(r.completedAt))) return false;
  r.completedAt = new Date(r.completedAt).toISOString();
  if (!object(p.players) || Object.keys(p.players).length < 1 || Object.keys(p.players).length > 256) return false;
  for (const [name, player] of Object.entries(p.players)) {
    if (!text(name,120) || !object(player) || !object(player.overall)) return false;
    for (const bucket of ['overall','US','USSR']) {
      if (player[bucket] === undefined) continue;
      if (!object(player[bucket])) return false;
      for (const stats of Object.values(player[bucket])) {
        if (!object(stats) || Object.values(stats).some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0)) return false;
      }
    }
  }
  if (p.roundSummary !== undefined && !object(p.roundSummary)) return false;
  if (p.leaderboards !== undefined) {
    if (!object(p.leaderboards)) return false;
    for (const board of Object.values(p.leaderboards)) {
      if (!Array.isArray(board) || board.length > 3 || board.some(e => !object(e) || !Object.hasOwn(p.players,e.player) || typeof e.value !== 'number' || !Number.isFinite(e.value) || e.value < 0)) return false;
    }
  }
  // Auth belongs only in the envelope, never the public snapshot.
  if (Object.hasOwn(p,'authToken') || Object.hasOwn(p,'payloadJson')) return false;
  return true;
}

export async function onRequest({request, env, params}) {
  const parts = params.id ? (Array.isArray(params.id) ? params.id : [params.id]) : [];
  if (parts.length > 1) return reply({error:'not_found'},404);
  const id = parts[0];
  if (!env.DB) return reply({error:'database_not_configured'},503);
  try {
    if (request.method === 'GET' && id !== undefined) {
      if (!/^[1-9]\d{0,14}$/.test(id)) return reply({error:'invalid_id'},400);
      const row = await env.DB.prepare('SELECT payload FROM rounds WHERE id = ?').bind(Number(id)).first();
      return row ? reply(JSON.parse(row.payload)) : reply({error:'not_found'},404);
    }
    if (request.method === 'GET') {
      const offset = new URL(request.url).searchParams.get('offset') || '0';
      if (!/^\d{1,7}$/.test(offset)) return reply({error:'invalid_offset'},400);
      const {results} = await env.DB.prepare('SELECT id, map, winner, completed_at AS completedAt, duration_seconds AS durationSeconds FROM rounds ORDER BY completed_at DESC, id DESC LIMIT 101 OFFSET ?').bind(Number(offset)).all();
      return reply({rounds:results.slice(0,100), nextOffset:results.length > 100 ? Number(offset)+100 : null});
    }
    if (request.method !== 'POST' || id !== undefined) return reply({error:'method_not_allowed'},405);
    if (!env.UPLOAD_TOKEN || env.UPLOAD_TOKEN.length < 32) return reply({error:'upload_not_configured'},503);
    const envelope = await readBody(request);
    if (!object(envelope) || !await authorized(envelope.authToken, env.UPLOAD_TOKEN)) return reply({error:'unauthorized'},401);
    let payload = envelope.payload;
    if (typeof envelope.payloadJson === 'string') {
      try { payload = JSON.parse(envelope.payloadJson); } catch { return reply({error:'invalid_payload_json'},400); }
    }
    if (!validatePayload(payload)) return reply({error:'invalid_payload'},400);
    const serialized = JSON.stringify(payload), r = payload.round;
    const result = await env.DB.prepare('INSERT INTO rounds (round_key, completed_at, map, winner, duration_seconds, schema_version, payload) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(round_key) DO NOTHING')
      .bind(payload.roundId,r.completedAt,r.map,r.winner,r.durationSeconds,payload.schemaVersion,serialized).run();
    const row = await env.DB.prepare('SELECT id, payload FROM rounds WHERE round_key = ?').bind(payload.roundId).first();
    if (!row) throw new Error('storage_failed');
    if (row.payload !== serialized) return reply({error:'round_id_conflict'},409);
    return reply({ok:true, id:row.id, roundId:payload.roundId, duplicate:result.meta.changes === 0},result.meta.changes ? 201 : 200);
  } catch (e) {
    if (e.message === 'too_large') return reply({error:'payload_too_large'},413);
    if (e.message === 'invalid_json') return reply({error:'invalid_json'},400);
    console.error('[WebStats] Request failed; check D1 binding and migration.');
    return reply({error:'storage_error'},500);
  }
}
