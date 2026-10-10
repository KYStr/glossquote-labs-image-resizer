export const colors = [[220,40,40],[20,180,60],[30,80,220],[240,200,30]];
export const cornerOrder = [[0,1,2,3],[1,0,3,2],[3,2,1,0],[2,3,0,1],[0,2,1,3],[2,0,3,1],[3,1,2,0],[1,3,0,2]];
export function syntheticCanvas(width = 2400, height = 1600) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  colors.forEach((color,i) => { ctx.fillStyle = `rgb(${color.join(',')})`; ctx.fillRect(i % 2 * width/2, Math.floor(i/2) * height/2, width/2, height/2); });
  ctx.clearRect(width/2-50,height/2-50,100,100); ctx.clearRect(width/2-100,height/2-100,40,40); ctx.fillStyle = 'rgba(200,80,40,.5)'; ctx.fillRect(width/2-100,height/2-100,40,40);
  return canvas;
}
export const toBlob = (canvas,mime,quality) => new Promise((yes,no) => canvas.toBlob(blob => blob?.size ? yes(blob) : no(new Error('ENCODE_FAILED')),mime,quality));
export function exifJpeg(jpeg,orientation) {
  const segment = new Uint8Array(36); segment.set([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0]); segment[28] = orientation;
  return new Blob([jpeg.slice(0,2),segment,jpeg.slice(2)],{ type:'image/jpeg' });
}
export function sampleCorners(canvas) {
  const ctx = canvas.getContext('2d');
  return [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y]) => [...ctx.getImageData(Math.floor(canvas.width*x),Math.floor(canvas.height*y),1,1).data]);
}
export function colorsMatch(samples,order) { return samples.every((sample,i) => sample.slice(0,3).every((value,c) => Math.abs(value-colors[order[i]][c]) < 30)); }
async function run() {
  const report = { date:'2026-10-10', userAgent:navigator.userAgent, platform:navigator.platform, orientation:[], png:null, jpeg:null, webp:null };
  const status = document.getElementById('status'); status.textContent = 'Running real Canvas and createImageBitmap gate';
  document.getElementById('orientations').replaceChildren();
  try {
    const source = syntheticCanvas(); const jpeg = await toBlob(source,'image/jpeg',.95);
    for (let orientation = 1; orientation <= 8; orientation++) {
      const bitmap = await createImageBitmap(exifJpeg(jpeg,orientation),{ imageOrientation:'from-image' });
      const canvas = document.createElement('canvas'); canvas.width=bitmap.width; canvas.height=bitmap.height;
      canvas.getContext('2d').drawImage(bitmap,0,0); const samples=sampleCorners(canvas);
      const swapped = orientation >= 5;
      const pass = bitmap.width === (swapped?1600:2400) && bitmap.height === (swapped?2400:1600) && colorsMatch(samples,cornerOrder[orientation-1]);
      report.orientation.push({ orientation,width:bitmap.width,height:bitmap.height,samples,pass }); bitmap.close();
      const figure = document.createElement('figure'); const caption=document.createElement('figcaption'); caption.textContent=`EXIF ${orientation}: ${pass?'PASS':'FAIL'}; expected corner indexes ${cornerOrder[orientation-1].join(',')}`;
      const thumbnail=document.createElement('canvas'); thumbnail.width=swapped?120:180; thumbnail.height=swapped?180:120; thumbnail.getContext('2d').drawImage(canvas,0,0,thumbnail.width,thumbnail.height); figure.append(caption,thumbnail); document.getElementById('orientations').append(figure); canvas.width=canvas.height=1;
    }
    const png=await toBlob(source,'image/png'); const pngBitmap=await createImageBitmap(png); const check=document.createElement('canvas'); check.width=2400;check.height=1600; const ctx=check.getContext('2d');ctx.drawImage(pngBitmap,0,0);
    const alpha=ctx.getImageData(1200,800,1,1).data[3]; report.png={ mime:png.type,bytes:png.size,alpha,pass:png.type==='image/png'&&alpha===0 }; pngBitmap.close();
    ctx.fillStyle='#ffffff';ctx.fillRect(0,0,2400,1600);ctx.drawImage(source,0,0); const whiteJpeg=await toBlob(check,'image/jpeg',.85); const jpgBitmap=await createImageBitmap(whiteJpeg);ctx.clearRect(0,0,2400,1600);ctx.drawImage(jpgBitmap,0,0); const white=[...ctx.getImageData(1200,800,1,1).data]; report.jpeg={ mime:whiteJpeg.type,bytes:whiteJpeg.size,white,pass:whiteJpeg.type==='image/jpeg'&&white.slice(0,3).every(n=>n>=250)&&white[3]===255 };jpgBitmap.close();
    const probe=document.createElement('canvas');probe.width=probe.height=1; const webp=await toBlob(probe,'image/webp',.85);report.webp={ mime:webp.type,supported:webp.type==='image/webp',pass:['image/png','image/webp'].includes(webp.type) }; source.width=source.height=check.width=check.height=1;
    report.pass=report.orientation.length===8&&report.orientation.every(r=>r.pass)&&report.png.pass&&report.jpeg.pass&&report.webp.pass;
  } catch { report.pass=false;report.error='BROWSER_GATE_FAILED'; }
  document.getElementById('report').textContent=JSON.stringify(report,null,2);status.textContent=report.pass?'PASS: eight orientations and PNG/JPEG actual codecs':'FAIL: required feasibility gate';
}
if (typeof document !== 'undefined' && document.getElementById('run')) {
  document.getElementById('run').addEventListener('click',run);
  for (const [id,mime,ext] of [['png','image/png','png'],['jpeg','image/jpeg','jpg']]) document.getElementById(id).addEventListener('click',async()=>{const canvas=syntheticCanvas();const blob=await toBlob(canvas,mime,.95);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`synthetic-2400x1600.${ext}`;a.click();canvas.width=canvas.height=1;setTimeout(()=>URL.revokeObjectURL(url),10000);});
}
