import { MAX_FILE_BYTES } from './image-header.mjs';
const fail = code => ({ ok: false, code });
export function validateSource({ size, width, height } = {}) {
  if (!Number.isSafeInteger(size) || size < 0) return fail('IMAGE_CORRUPT');
  if (size === 0) return fail('EMPTY_FILE');
  if (size > MAX_FILE_BYTES) return fail('FILE_TOO_LARGE');
  if (![width,height].every(n => Number.isInteger(n) && n >= 1 && n <= 8192) || width * height > 12_000_000) return fail('IMAGE_TOO_LARGE');
  return { ok: true, value: { size, width, height } };
}
export function deriveDimensions({ width, height, mode, value } = {}) {
  if (![width,height].every(n => Number.isInteger(n) && n >= 1 && n <= 8192) || width * height > 12_000_000) return fail('SIZE_INVALID');
  if (!['long-edge','width','height'].includes(mode) || typeof value !== 'string' || value.length > 16 || !/^[0-9]+$/.test(value)) return fail('SIZE_INVALID');
  const edge = Number(value);
  const basis = mode === 'width' ? width : mode === 'height' ? height : Math.max(width,height);
  if (!Number.isInteger(edge) || edge < 1 || edge > 4000 || edge > basis) return fail('SIZE_INVALID');
  // Integer numerator <= 65,544,192: exact positive half-up without a rounded ratio.
  const rounded = size => Math.max(1,Math.floor((2 * size * edge + basis) / (2 * basis)));
  const w = rounded(width); const h = rounded(height);
  if (w > width || h > height || w > 4000 || h > 4000 || w * h > 8_000_000) return fail('SIZE_INVALID');
  return { ok: true, value: { width:w, height:h } };
}
