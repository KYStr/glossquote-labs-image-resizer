export const MAX_FILE_BYTES = 10_485_760;
const fail = code => ({ ok: false, code });
const corrupt = () => fail('IMAGE_CORRUPT');
const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
export function inspectImageHeader(bytes) {
  if (!(bytes instanceof Uint8Array)) return corrupt();
  if (!bytes.length) return fail('EMPTY_FILE');
  if (bytes.length > MAX_FILE_BYTES) return fail('FILE_TOO_LARGE');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (pngSignature.every((value, i) => bytes[i] === value)) {
    let offset = 8; let width; let height; let sawData = false;
    while (offset < bytes.length) {
      if (offset + 12 > bytes.length) return corrupt();
      const length = view.getUint32(offset);
      if (length > bytes.length - offset - 12) return corrupt();
      const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
      if (!/^[A-Za-z]{4}$/.test(type)) return corrupt();
      if (offset === 8) {
        if (type !== 'IHDR' || length !== 13) return corrupt();
        width = view.getUint32(offset + 8); height = view.getUint32(offset + 12);
        const depth = bytes[offset + 16]; const color = bytes[offset + 17];
        const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
        if (!width || !height || !depths[color]?.includes(depth) || bytes[offset + 18] !== 0 || bytes[offset + 19] !== 0 || bytes[offset + 20] > 1) return corrupt();
      } else if (type === 'IHDR') return corrupt();
      if (type === 'acTL') return fail('FORMAT_UNSUPPORTED');
      if (type === 'IDAT') sawData = true;
      offset += length + 12;
      if (type === 'IEND') {
        if (length !== 0 || !sawData || offset !== bytes.length) return corrupt();
        return { ok: true, value: { format: 'png', encodedWidth: width, encodedHeight: height } };
      }
    }
    return corrupt();
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2; let width; let height;
    while (offset < bytes.length) {
      if (bytes[offset++] !== 0xff) return corrupt();
      while (bytes[offset] === 0xff) offset++;
      if (offset >= bytes.length) return corrupt();
      const marker = bytes[offset++];
      if ([0x00, 0xd8, 0xd9].includes(marker) || marker >= 0xd0 && marker <= 0xd7 || marker === 0x01) return corrupt();
      if (offset + 2 > bytes.length) return corrupt();
      const length = view.getUint16(offset);
      if (length < 2 || length > bytes.length - offset) return corrupt();
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        if (![0xc0, 0xc2].includes(marker)) return fail('FORMAT_UNSUPPORTED');
        if (length < 8 || bytes[offset + 2] !== 8) return fail('FORMAT_UNSUPPORTED');
        const components = bytes[offset + 7];
        if (![1, 3, 4].includes(components) || length !== 8 + 3 * components || width !== undefined) return corrupt();
        height = view.getUint16(offset + 3); width = view.getUint16(offset + 5);
        if (!width || !height) return corrupt();
      }
      if (marker === 0xda) {
        const components = bytes[offset + 2];
        if (width === undefined || length < 6 || length !== 6 + 2 * components || components < 1 || components > 4 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return corrupt();
        return { ok: true, value: { format: 'jpeg', encodedWidth: width, encodedHeight: height } };
      }
      offset += length;
    }
    return corrupt();
  }
  // A truncated signature of a recognized container is damaged, not a new format.
  if (bytes[0] === 137 || bytes[0] === 0xff) return corrupt();
  return fail('FORMAT_UNSUPPORTED');
}
