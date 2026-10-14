const labels = {kdRatio:'KD Ratio',lavBtrKills:'LAV/BTR Kills',lavBtrPlayerKills:'LAV/BTR Player Kills',lavBtrAiKills:'LAV/BTR AI Kills',aiKills:'AI Kills',totalAIKills:'Total AI Kills',deathsToAI:'Deaths to AI',fiaAiKills:'FIA AI Kills',otherTeamAiKills:'Other Team AI Kills',deathsToFiaAi:'Deaths to FIA AI',deathsToOtherTeamAi:'Deaths to Team AI',deathsOther:'Other Deaths'};
export const label = key => labels[key] || key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/\b(lav|btr|ai|kd)\b/gi,s=>s.toUpperCase()).replace(/^./,c=>c.toUpperCase());
export function dateTime(input) {
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',hour12:true});
}
export const roundLabel = r => `${r.id} - ${r.matchName || r.map || 'Unknown scenario'} - ${dateTime(r.completedAt)}`;
export function value(key, v) {
  if (v === undefined || v === null) return '—';
  if (key === 'completedAt') return dateTime(v);
  if (typeof v !== 'number') return String(v);
  if (['durationSeconds','timeConnected','longestLife'].includes(key)) return `${Math.floor(v/3600)}h ${Math.floor(v%3600/60)}m`;
  if (key === 'longestKill') return `${v.toLocaleString()} m`;
  return v.toLocaleString(undefined,{maximumFractionDigits:2});
}
export function sections(players) {
  const result = new Map();
  for (const player of players) for (const [category, stats] of Object.entries(player?.overall || {})) {
    if (!stats || typeof stats !== 'object' || Array.isArray(stats)) continue;
    if (!result.has(category)) result.set(category,new Set());
    for (const [key,v] of Object.entries(stats)) if (typeof v === 'number') result.get(category).add(key);
  }
  return result;
}
export function relationships(player, key) {
  if (!Array.isArray(player?.[key])) return [];
  return player[key].filter(e=>e && typeof e.player==='string' && Number.isSafeInteger(e.kills) && e.kills>0).slice(0,5);
}
