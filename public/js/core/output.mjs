const fail = code => ({ ok:false, code });
const extensions = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' };
export function normalizeQuality(text) {
  if (typeof text !== 'string' || text.length > 16 || !/^[0-9]+$/.test(text)) return fail('QUALITY_INVALID');
  const value = Number(text);
  if (!Number.isInteger(value) || value < 1 || value > 100) return fail('QUALITY_INVALID');
  return { ok:true, value:value / 100 };
}
export function resolveOutput(requestedMime,actualMime,width,height) {
  if (!Object.hasOwn(extensions,requestedMime) || !Object.hasOwn(extensions,actualMime)) return fail('ENCODE_FAILED');
  const fallback = requestedMime === 'image/webp' && actualMime === 'image/png';
  if (requestedMime !== actualMime && !fallback) return fail('ENCODE_FAILED');
  if (![width,height].every(n => Number.isInteger(n) && n > 0 && n <= 4000) || width * height > 8_000_000) return fail('ENCODE_FAILED');
  const extension = extensions[actualMime];
  return { ok:true, value:{ mime:actualMime, extension, filename:`image-${width}x${height}.${extension}`, notice:fallback?'FORMAT_FALLBACK':null } };
}
