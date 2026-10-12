export const label = key => key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/([A-Z])([A-Z][a-z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
export function value(key, v) {
  if (v === undefined || v === null) return '—';
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
