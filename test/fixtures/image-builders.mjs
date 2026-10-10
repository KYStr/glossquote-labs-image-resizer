import { deflateSync } from 'node:zlib';
export function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type); const result = Buffer.alloc(12 + data.length);
  result.writeUInt32BE(data.length); name.copy(result, 4); data.copy(result, 8);
  result.writeUInt32BE(crc32(result.subarray(4, 8 + data.length)), 8 + data.length);
  return result;
}
// Large dimensions below describe parser-only containers, never decoder fixtures.
export function pngHeader(width = 1, height = 1, { animation = false } = {}) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), ...(animation ? [chunk('acTL', Buffer.alloc(8))] : []), chunk('IDAT', deflateSync(Buffer.from([0,255,0,0,255]))), chunk('IEND')]);
}
export function jpegHeader(width = 1, height = 1, { marker = 0xc0, precision = 8 } = {}) {
  const sof = Buffer.from([255,marker,0,11,precision,0,0,0,0,1,1,17,0]);
  sof.writeUInt16BE(height,5); sof.writeUInt16BE(width,7);
  return Buffer.concat([Buffer.from([255,216]), sof, Buffer.from([255,218,0,8,1,1,0,0,63,0,0,255,217])]);
}
export function pngImage(width=2400,height=1600) {
  if(![width,height].every(n=>Number.isInteger(n)&&n>0&&n<=2400)||width*height>3_840_000) throw Error('FIXTURE_LIMIT');
  const raw=Buffer.alloc((width*4+1)*height),colors=[[220,40,40,255],[20,180,60,255],[30,80,220,255],[240,200,30,255]];
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {const index=y*(width*4+1)+1+x*4;const color=Math.abs(x-width/2)<50&&Math.abs(y-height/2)<50?[0,0,0,0]:colors[(y>=height/2?2:0)+(x>=width/2?1:0)];raw.set(color,index);}
  const header=pngHeader(width,height).subarray(0,33);
  return Buffer.concat([header,chunk('IDAT',deflateSync(raw)),chunk('IEND')]);
}
