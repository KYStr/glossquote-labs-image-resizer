import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImageHeader, MAX_FILE_BYTES } from '../public/js/core/image-header.mjs';
import { pngHeader, jpegHeader, chunk } from './fixtures/image-builders.mjs';
test('bounded PNG and baseline/progressive JPEG dimensions', () => {
  assert.deepEqual(inspectImageHeader(pngHeader(4000,3000)).value, { format: 'png', encodedWidth: 4000, encodedHeight: 3000 });
  for (const marker of [0xc0,0xc2]) assert.deepEqual(inspectImageHeader(jpegHeader(2400,1600,{ marker })).value, { format: 'jpeg', encodedWidth: 2400, encodedHeight: 1600 });
  assert.equal(inspectImageHeader(new Uint8Array(MAX_FILE_BYTES + 1)).code, 'FILE_TOO_LARGE');
  assert.equal(inspectImageHeader(new Uint8Array()).code, 'EMPTY_FILE');
  assert.equal(inspectImageHeader(Buffer.from('GIF89a')).code, 'FORMAT_UNSUPPORTED');
  assert.equal(inspectImageHeader(pngHeader(1,1,{ animation: true })).code, 'FORMAT_UNSUPPORTED');
  for (const marker of [0xc1,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]) assert.equal(inspectImageHeader(jpegHeader(1,1,{ marker })).code, 'FORMAT_UNSUPPORTED');
  assert.equal(inspectImageHeader(jpegHeader(1,1,{ precision: 12 })).code, 'FORMAT_UNSUPPORTED');
});
test('every truncated boundary and invalid chunk/segment fails closed without throwing', () => {
  for (const bytes of [pngHeader(), jpegHeader()]) for (let end = 1; end < bytes.length; end++) assert.equal(inspectImageHeader(bytes.subarray(0,end)).ok, false, `truncated ${end}`);
  const badLength = pngHeader(); badLength.writeUInt32BE(0xffffffff,8); assert.equal(inspectImageHeader(badLength).code, 'IMAGE_CORRUPT');
  const duplicate = Buffer.concat([pngHeader().subarray(0,33), chunk('IHDR', Buffer.alloc(13)), pngHeader().subarray(33)]); assert.equal(inspectImageHeader(duplicate).ok, false);
  assert.equal(inspectImageHeader(Buffer.concat([pngHeader(),Buffer.from([0])])).ok, false);
  const badSegment = jpegHeader(); badSegment.writeUInt16BE(65535,4); assert.equal(inspectImageHeader(badSegment).code, 'IMAGE_CORRUPT');
  assert.equal(inspectImageHeader(null).ok, false);
  let seed = 9;
  for (let n = 0; n < 500; n++) { const bytes = new Uint8Array(n % 127); for (let i = 0; i < bytes.length; i++) { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; bytes[i] = seed & 255; } assert.doesNotThrow(() => inspectImageHeader(bytes)); }
});
