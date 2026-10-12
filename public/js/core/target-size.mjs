const fail = code => ({ ok:false, code });
const units = Object.freeze({ kB:1000, KiB:1024, bytes:1 });
const baseQualities = Object.freeze([100,95,90,85,80,70,60,50,40,25,10,1]);
export const TARGET_DEADLINE_MS = 30_000;
export function normalizeTargetSize(raw, unit) {
  if (typeof raw !== 'string' || raw.length > 16 || typeof unit !== 'string' || !Object.hasOwn(units,unit)) return fail('TARGET_SIZE_INVALID');
  const text = raw.replace(/^[\t\n\v\f\r ]+|[\t\n\v\f\r ]+$/g,'');
  if (!/^[0-9]{1,8}$/.test(text)) return fail('TARGET_SIZE_INVALID');
  const bytes = Number(text) * units[unit];
  return Number.isSafeInteger(bytes) && bytes >= 1 && bytes <= 10_485_760 ? {ok:true,value:bytes} : fail('TARGET_SIZE_INVALID');
}
export const normalizeTargetBytes = raw => normalizeTargetSize(raw,'bytes');
export function qualityCandidates(quality) {
  if (!Number.isInteger(quality) || quality < 1 || quality > 100) return fail('QUALITY_INVALID');
  return {ok:true,value:Object.freeze([quality,...baseQualities.filter(candidate=>candidate<quality)])};
}
