import {syntheticCanvas,noiseCanvas,toBlob,exifJpeg,sampleCorners,colorsMatch,cornerOrder} from './browser-fixtures.mjs';
import {createImageSession,createBrowserAdapters,probeBrowserCapabilities} from './product-fixture/js/image-session.mjs';
import {qualityCandidates} from './product-fixture/js/core/target-size.mjs';
const wait=async(test,ms=15000)=>{const end=performance.now()+ms;while(!test()){if(performance.now()>end) throw Error('CASE_TIMEOUT');await new Promise(yes=>setTimeout(yes,10));}};
const assert=(condition,label)=>{if(!condition) throw Error(label);};
async function loadProduct(){const frame=document.getElementById('product');frame.src=document.getElementById('language').value==='en'?'./product-fixture/en/index.html':'./product-fixture/index.html';await new Promise(yes=>frame.onload=yes);const w=frame.contentWindow,d=w.document;await wait(()=>d.documentElement.dataset.state==='idle'||d.documentElement.dataset.state==='error'||d.documentElement.dataset.state==='unsupported');assert(d.documentElement.dataset.state==='idle','BROWSER_CAPABILITY_GATE');return {w,d,frame};}
async function runProducts(){
  const report={date:new Date().toISOString(),ua:navigator.userAgent,platform:navigator.platform,language:document.getElementById('language').value,cases:[]};
  const status=document.getElementById('status');status.textContent='RUNNING actual product DOM and codecs';document.getElementById('run-products').disabled=true;
  try {
    if(navigator.userAgentData) report.fullVersion=await navigator.userAgentData.getHighEntropyValues(['fullVersionList','platformVersion','architecture']);
    const {w,d,frame}=await loadProduct();const el=id=>d.getElementById(id);
    const urls=new Map(),bitmaps=new Set();let created=0,closed=0,decodeCalls=0,networkCalls=0,storageWrites=0;
    const createURL=w.URL.createObjectURL.bind(w.URL),revokeURL=w.URL.revokeObjectURL.bind(w.URL);
    w.URL.createObjectURL=blob=>{const url=createURL(blob);urls.set(url,blob);created++;return url;};w.URL.revokeObjectURL=url=>{urls.delete(url);revokeURL(url);};
    const decode=w.createImageBitmap.bind(w);w.createImageBitmap=async(...args)=>{decodeCalls++;const bitmap=await decode(...args);bitmaps.add(bitmap);const close=bitmap.close.bind(bitmap);bitmap.close=()=>{if(bitmaps.delete(bitmap)) closed++;close();};return bitmap;};
    const nativeBlob=w.HTMLCanvasElement.prototype.toBlob;
    const nativeFetch=w.fetch.bind(w);w.fetch=(...args)=>{networkCalls++;return nativeFetch(...args);};
    const nativeOpen=w.XMLHttpRequest.prototype.open;w.XMLHttpRequest.prototype.open=function(...args){networkCalls++;return nativeOpen.apply(this,args);};
    const nativeStore=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(...args){storageWrites++;return nativeStore.apply(this,args);};
    const nativeIDB=w.IDBFactory.prototype.open;w.IDBFactory.prototype.open=function(...args){storageWrites++;return nativeIDB.apply(this,args);};
    const initialHTTP=w.performance.getEntriesByType('resource').filter(r=>r.name.startsWith('http')).map(r=>r.name);
    const select=async(blob,name='synthetic.png')=>{const input=new w.DataTransfer();input.items.add(new w.File([blob],name,{type:blob.type}));el('file').files=input.files;el('file').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>['ready','error'].includes(d.documentElement.dataset.state));};
    const change=(id,value)=>{el(id).value=value;el(id).dispatchEvent(new w.Event(['size','quality'].includes(id)?'input':'change',{bubbles:true}));};
    const generate=async()=>{el('generate').click();await wait(()=>['success','error'].includes(d.documentElement.dataset.state));assert(d.documentElement.dataset.state==='success','GENERATE_FAILED');await el('result-image').decode();return urls.get(el('result-image').getAttribute('src'));};
    const resultCanvas=()=>{const img=el('result-image');const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;canvas.getContext('2d').drawImage(img,0,0);return canvas;};
    const run=async(id,kind,fn)=>{try{const evidence=await fn();report.cases.push({id,kind,pass:true,evidence});}catch(error){report.cases.push({id,kind,pass:false,error:error.message});}document.getElementById('report').textContent=JSON.stringify(report,null,2);};
    const canvas=syntheticCanvas();const png=await toBlob(canvas,'image/png'),jpeg=await toBlob(canvas,'image/jpeg',.95);canvas.width=canvas.height=1;
    await run('IM-09','actual product EXIF decode + PNG encode',async()=>{
      const orientations=[];
      for(let orientation=1;orientation<=8;orientation++){await select(exifJpeg(jpeg,orientation),'synthetic.jpg');assert(d.documentElement.dataset.state==='ready','EXIF_LOAD');change('size','2400');const blob=await generate();const output=resultCanvas();const pass=output.width===(orientation>=5?1600:2400)&&output.height===(orientation>=5?2400:1600)&&colorsMatch(sampleCorners(output),cornerOrder[orientation-1]);orientations.push({orientation,width:output.width,height:output.height,pass,mime:blob.type});output.width=output.height=1;assert(pass,'EXIF_DOUBLE_OR_WRONG_ROTATION');el('clear').click();}
      return orientations;
    });
    await run('IM-10','actual product PNG alpha',async()=>{await select(png);change('size','2400');const blob=await generate();const c=resultCanvas(),ctx=c.getContext('2d');const alpha=ctx.getImageData(1200,800,1,1).data[3],half=ctx.getImageData(1110,710,1,1).data[3];assert(blob.type==='image/png'&&alpha===0&&half>=126&&half<=129,'PNG_ALPHA');assert(el('quality-field').hidden,'PNG_QUALITY_HIDDEN');c.width=c.height=1;return {mime:blob.type,bytes:blob.size,alpha,half};});
    await run('IM-11','actual JPEG white composite',async()=>{change('format','image/jpeg');assert(!el('jpeg-note').hidden,'JPEG_NOTICE');const blob=await generate();const c=resultCanvas();const white=[...c.getContext('2d').getImageData(1200,800,1,1).data];assert(blob.type==='image/jpeg'&&white.slice(0,3).every(n=>n>=250)&&white[3]===255,'JPEG_WHITE');c.width=c.height=1;return {mime:blob.type,bytes:blob.size,white};});
    await run('WEBP','actual WebP encoder + alpha',async()=>{assert(!el('webp-option').disabled,'WEBP_UNAVAILABLE');change('format','image/webp');const blob=await generate();const c=resultCanvas();const alpha=c.getContext('2d').getImageData(1200,800,1,1).data[3];assert(blob.type==='image/webp'&&alpha===0,'WEBP_ALPHA');c.width=c.height=1;return {mime:blob.type,alpha};});
    await run('IM-12','mock unsupported WebP fallback through actual PNG encoder',async()=>{w.HTMLCanvasElement.prototype.toBlob=function(callback,mime,quality){return nativeBlob.call(this,callback,mime==='image/webp'?'image/png':mime,quality);};try{change('format','image/webp');const blob=await generate();assert(blob.type==='image/png'&&!el('fallback').hidden,'MIME_FALLBACK');let downloadName;const nativeClick=w.HTMLAnchorElement.prototype.click;w.HTMLAnchorElement.prototype.click=function(){downloadName=this.download;};try{el('download').click();}finally{w.HTMLAnchorElement.prototype.click=nativeClick;}assert(downloadName==='image-2400x1600.png','FALLBACK_FILENAME');return {mime:blob.type,downloadName,notice:el('fallback').textContent};}finally{w.HTMLCanvasElement.prototype.toBlob=nativeBlob;}});
    await run('IM-13','actual settings invalidation',async()=>{const old=el('result-image').getAttribute('src');change('size','1200');assert(el('download').disabled&&el('result-summary').hidden&&!el('result-image').hasAttribute('src')&&!urls.has(old),'STALE_DOWNLOAD');return {activeURLs:urls.size};});
    await run('IM-14','mock delayed callbacks + actual encoder',async()=>{change('format','image/png');const pending=[];w.HTMLCanvasElement.prototype.toBlob=function(callback,...args){nativeBlob.call(this,blob=>pending.push(()=>callback(blob)),...args);};try{el('generate').click();await wait(()=>pending.length===1);assert(!el('cancel').hidden&&el('file').disabled&&el('fields').disabled,'BUSY_CONTROLS');el('cancel').click();assert(d.documentElement.dataset.state==='ready'&&el('download').disabled,'CANCEL_READY');el('generate').click();await wait(()=>pending.length===2);pending[1]();await wait(()=>d.documentElement.dataset.state==='success');const current=el('result-image').getAttribute('src');const count=created;pending[0]();await new Promise(yes=>setTimeout(yes,30));assert(el('result-image').getAttribute('src')===current&&created===count,'LATE_RESULT');return {staleCreatedURLs:0,activeURLs:urls.size};}finally{w.HTMLCanvasElement.prototype.toBlob=nativeBlob;}});
    await run('IM-15','actual 10 ownership cleanup cycles; JS heap sampled if exposed',async()=>{el('clear').click();const heap=[];for(let cycle=0;cycle<10;cycle++){await select(png);await generate();el('clear').click();assert(urls.size===0&&bitmaps.size===0&&!el('result-image').hasAttribute('src')&&el('file').value===''&&el('filename').textContent===''&&el('preview').width===1&&el('preview').height===1,'RESOURCE_LEAK');heap.push(w.performance.memory?.usedJSHeapSize??null);}return {cycles:10,activeURLs:urls.size,activeBitmaps:bitmaps.size,closed,jsHeapSamples:heap,nativeHeap:'NOT_RUN: native bitmap/GC allocation profiling unavailable'};});
    await run('IM-17','actual File name rendered as literal text',async()=>{const name='<img src=x onerror=alert(1)>.png';await select(png,name);assert(el('filename').textContent===name&&el('filename').children.length===0,'FILENAME_INJECTION');await generate();let downloadName;const click=w.HTMLAnchorElement.prototype.click;w.HTMLAnchorElement.prototype.click=function(){downloadName=this.download;};try{el('download').click();}finally{w.HTMLAnchorElement.prototype.click=click;}assert(downloadName==='image-1920x1280.png','FIXED_NAME');return {literal:true,elementCount:0,downloadName};});
    await run('IM-18','mock toBlob(null) / decoder rejection after capability probe',async()=>{w.HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};el('generate').click();await wait(()=>d.documentElement.dataset.state==='error');assert(el('download').disabled&&!el('status').textContent.includes('stack'),'NULL_ERROR');w.HTMLCanvasElement.prototype.toBlob=nativeBlob;const original=w.createImageBitmap;w.createImageBitmap=async()=>{throw Error('synthetic-private-marker');};await select(png);assert(d.documentElement.dataset.state==='error'&&el('download').disabled&&!el('status').textContent.includes('synthetic-private-marker'),'DECODE_ERROR');w.createImageBitmap=original;await select(png);assert(d.documentElement.dataset.state==='ready','ERROR_RECOVERY');return {null:'fixed error',decode:'fixed error',recovery:'ready'};});
    await run('IM-19-layout','real browser 320px reflow / text at 200%',async()=>{const evidence=[];for(const [width,font] of [[320,'100%'],[768,'100%'],[640,'200%']]){frame.width=String(width);d.documentElement.style.fontSize=font;await new Promise(yes=>w.requestAnimationFrame(yes));const viewport=d.documentElement.clientWidth,content=d.documentElement.scrollWidth;assert(content<=viewport,'HORIZONTAL_OVERFLOW');if(width===768){const share=el('drop-zone').getBoundingClientRect().width/d.querySelector('.workspace').getBoundingClientRect().width;assert(share>=.65,'CANVAS_SHARE');}for(const id of ['size','format','generate']){const rect=el(id).getBoundingClientRect();assert(rect.width>0&&rect.height>=44&&rect.right<=viewport,'CONTROL_LAYOUT');}evidence.push({width,font,viewport,content});}frame.width='1200';d.documentElement.style.fontSize='';return evidence;});
    await run('IM-20','actual synthetic DragEvent multi-file + URL rejection',async()=>{const multi=new w.DataTransfer();multi.items.add(new w.File([png],'a.png',{type:'image/png'}));multi.items.add(new w.File([png],'b.png',{type:'image/png'}));d.dispatchEvent(new w.DragEvent('drop',{dataTransfer:multi,bubbles:true,cancelable:true}));assert(d.documentElement.dataset.state==='error'&&el('status').textContent.length>0&&el('download').disabled,'MULTIFILE_DROP');const text=new w.DataTransfer();text.setData('text/uri-list','https://example.invalid/synthetic.png');d.dispatchEvent(new w.DragEvent('drop',{dataTransfer:text,bubbles:true,cancelable:true}));assert(d.documentElement.dataset.state==='error'&&networkCalls===0,'URL_DROP');return {multi:'rejected',url:'rejected',networkCalls};});
    await run('IM-16','actual resource timing observation + network/storage interception',async()=>{const after=w.performance.getEntriesByType('resource').filter(r=>r.name.startsWith('http')).map(r=>r.name);assert(networkCalls===0&&storageWrites===0&&after.length===initialHTTP.length,'PRIVACY_TRAFFIC');el('clear').click();return {initialSameOriginResources:initialHTTP.length,afterHTTPResources:after.length,networkAPICalls:networkCalls,storageWrites,activeURLs:urls.size};});
    report.resourceTotals={created,closed,decodeCalls,activeURLs:urls.size,activeBitmaps:bitmaps.size};
    report.manual={keyboardNativeFileChooser:'NOT_RUN',physicalMobile:'NOT_RUN',screenReader:'NOT_RUN',fullBrowserZoom:'NOT_RUN; 200% text tested separately'};
    report.pass=report.cases.every(item=>item.pass);
  } catch(error) {report.pass=false;report.error=error.message;}
  document.getElementById('report').textContent=JSON.stringify(report,null,2);status.textContent=report.pass?'PASS: product browser cases':'FAIL: product browser cases';document.getElementById('run-products').disabled=false;
}

// U09 uses actual browser adapters. Only explicitly named callback barriers are simulated.
let targetReport=null,targetNoise=null,targetPlans=null,targetCapabilities=null,targetActive=null;
const targetFactories=[],targetProofs=new Map(),targetProofURLs=new Set(),targetProofTimers=new Set();
const targetElement=id=>document.getElementById(id);
const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const shaBlob=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),byte=>byte.toString(16).padStart(2,'0')).join('');
function updateTargetReport() {
  if(!targetReport) return;
  targetElement('target-report').textContent=JSON.stringify(targetReport,null,2);
  targetElement('target-summary').replaceChildren();
  for(const item of targetReport.cases) {
    const row=document.createElement('li');const e=item.evidence;
    row.textContent=`${item.pass?'PASS':'FAIL'} ${item.id}: ${item.pass?JSON.stringify(e?.summary??e):item.error}`;
    targetElement('target-summary').append(row);
  }
}
async function targetCase(id,kind,run) {
  targetElement('target-status').textContent=`RUNNING ${id}`;
  try {targetReport.cases.push({id,kind,pass:true,evidence:await run()});}
  catch(error) {targetReport.cases.push({id,kind,pass:false,error:error.message});throw error;}
  finally {updateTargetReport();}
}
function nativeTargetSession({hook=null}={}) {
  const adapters=createBrowserAdapters(),urls=new Map(),bitmaps=new Set(),timers=new Map(),allTimers=[],canvases=[],attempts=[],releases=[];
  let created=0,closed=0,maxTimers=0,maxBitmaps=0;const f={};
  f.session=createImageSession({...adapters,webp:targetCapabilities.webp,
    decode:async file=>{const bitmap=await adapters.decode(file);bitmaps.add(bitmap);maxBitmaps=Math.max(maxBitmaps,bitmaps.size);const close=bitmap.close.bind(bitmap);bitmap.close=()=>{if(bitmaps.delete(bitmap))closed++;close();};return bitmap;},
    encode:(bitmap,options)=>{
      const record={jobId:options.jobId,q:options.quality===undefined?null:Math.round(options.quality*100),width:options.width,height:options.height,requestedMime:options.mime,bytes:null,mime:null,encodeMs:null};attempts.push(record);
      const create=document.createElement;let canvas=null;const started=performance.now();
      document.createElement=function(tag,...args){const node=create.call(this,tag,...args);if(String(tag).toLowerCase()==='canvas'){canvas=node;canvases.push(node);}return node;};
      let pending;try {pending=adapters.encode(bitmap,options);}finally{document.createElement=create;}
      return Promise.resolve(pending).then(blob=>{record.encodeMs=performance.now()-started;record.bytes=blob?.size??null;record.mime=blob?.type??null;return hook?hook(blob,{...options},record,canvas):blob;});
    },
    releaseExport:id=>{releases.push(id);adapters.releaseExport(id);},
    createURL:blob=>{const url=adapters.createURL(blob);urls.set(url,blob);created++;return url;},revokeURL:url=>{urls.delete(url);adapters.revokeURL(url);},
    setTimer:(callback,delay)=>{const entry={id:null,callback:null};entry.callback=()=>{timers.delete(entry.id);callback();};entry.id=setTimeout(entry.callback,delay);timers.set(entry.id,entry);allTimers.push(entry);maxTimers=Math.max(maxTimers,timers.size);return entry.id;},
    clearTimer:id=>{timers.delete(id);clearTimeout(id);},
    onChange:state=>{if(targetActive===f)targetElement('target-feedback').textContent=`${state.status}; attempts ${state.metrics?.attempts??0}; result URLs ${urls.size}`;}
  });
  f.attempts=attempts;f.canvases=canvases;f.releases=releases;f.allTimers=allTimers;
  f.blob=()=>{const output=f.session.snapshot().output;return output?urls.get(output.url):null;};
  f.counts=()=>({createdURLs:created,closedBitmaps:closed,activeURLs:urls.size,activeBitmaps:bitmaps.size,activeExportCanvases:canvases.filter(canvas=>canvas.width!==1||canvas.height!==1).length,activeTimers:timers.size,maxTimers,maxBitmaps});
  f.select=async(blob,changes={})=>{assert(blob.size<=10485760,'FIXTURE_FILE_LIMIT');assert((await f.session.select([new File([blob],'synthetic-gate-image',{type:blob.type})])).ok,'NATIVE_SELECT');assert(f.session.update({mode:'long-edge',value:'800',targetEnabled:true,targetRaw:'10485760',targetUnit:'bytes',...changes}),'SETTINGS_UPDATE');};
  f.clear=()=>{f.session.clear();const c=f.counts();assert(c.activeURLs===0&&c.activeBitmaps===0&&c.activeExportCanvases===0&&c.activeTimers===0,'NATIVE_OWNERSHIP_CLEAR');};
  targetFactories.push(f);return f;
}
async function decodeTargetBlob(blob,positions=[]) {
  const bitmap=await createImageBitmap(blob);const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  try {const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);return {width:bitmap.width,height:bitmap.height,mime:blob.type,bytes:blob.size,pixels:positions.map(([x,y])=>[...ctx.getImageData(x,y,1,1).data]),corners:sampleCorners(canvas)};}
  finally {bitmap.close();canvas.width=canvas.height=1;}
}
async function prepareTargetPlan(mime) {
  const bitmap=await createImageBitmap(targetNoise);const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
  const measures=[];const started=performance.now();
  try {
    canvas.getContext('2d').drawImage(bitmap,0,0);
    for(const q of qualityCandidates(85).value) {
      const blob=await toBlob(canvas,mime,q/100),decoded=await decodeTargetBlob(blob);
      assert(blob.type===mime&&decoded.width===800&&decoded.height===600,'PREPARATION_CODEC');measures.push({q,mime:blob.type,bytes:blob.size,width:decoded.width,height:decoded.height});
    }
  }finally{bitmap.close();canvas.width=canvas.height=1;}
  const candidate=measures.slice(1).find(row=>row.bytes<measures[0].bytes);assert(candidate,'LOWER_NATIVE_CANDIDATE_REQUIRED');
  return {mime,target:candidate.bytes,preparationMeasures:measures,preparationMs:performance.now()-started};
}
async function keepTargetProof(mime,blob,decoded) {
  targetProofs.set(mime,{blob,expected:{mime,bytes:blob.size,width:decoded.width,height:decoded.height,sha256:await shaBlob(blob)}});
  targetElement(mime==='image/jpeg'?'download-target-jpeg':'download-target-webp').disabled=false;
}
async function runTargetNative() {
  targetElement('run-target').disabled=true;targetElement('run-products').disabled=true;targetElement('load-demo').disabled=true;
  targetReport={task:'U09-TARGET-SIZE-GATE-20261013',startedAt:new Date().toISOString(),userAgent:navigator.userAgent,platform:navigator.platform,cases:[],downloads:{},pass:false,stage:'AUTO_RUNNING'};
  const started=performance.now();
  try {
    if(navigator.userAgentData)targetReport.fullVersion=await navigator.userAgentData.getHighEntropyValues(['fullVersionList','platformVersion','architecture']);
    await targetCase('capability-probe','native existing EXIF1–8/PNG/JPEG/WebP probe',async()=>{targetCapabilities=await probeBrowserCapabilities();assert(targetCapabilities.supported&&targetCapabilities.webp,'REQUIRED_NATIVE_CAPABILITY');return targetCapabilities;});
    const noise=noiseCanvas();targetNoise=await toBlob(noise,'image/png');noise.width=noise.height=1;assert(targetNoise.size<=10485760,'NOISE_PNG_LIMIT');
    targetPlans={};
    for(const mime of ['image/jpeg','image/webp']) {
      await targetCase(`native-retry-${mime}`,'native preparation and session; no fake blobs',async()=>{
        const plan=await prepareTargetPlan(mime);targetPlans[mime]=plan;const f=nativeTargetSession();
        try {await f.select(targetNoise,{mime,targetRaw:String(plan.target)});const begin=performance.now();assert((await f.session.generate()).ok,'NATIVE_RETRY_RESULT');const durationMs=performance.now()-begin;
          const state=f.session.snapshot(),blob=f.blob(),decoded=await decodeTargetBlob(blob);assert(state.metrics.attempts>=2&&state.metrics.attempts<=9,'NATIVE_RETRY_ATTEMPTS');assert(blob.size<=plan.target&&decoded.width===800&&decoded.height===600&&blob.type===mime,'NATIVE_EXACT_RESULT');
          assert(f.counts().activeURLs===1&&f.counts().activeTimers===0&&f.counts().activeExportCanvases===0,'SUCCESS_OWNERSHIP');await keepTargetProof(mime,blob,decoded);
          const evidence={summary:{attempts:state.metrics.attempts,targetBytes:plan.target,bytes:blob.size,width:decoded.width,height:decoded.height,durationMs},fixture:{mime:'image/png',bytes:targetNoise.size,width:800,height:600,seed:'19c0ffee'},preparation:plan,attempts:f.attempts,metrics:state.metrics,decoded,counts:f.counts()};f.clear();evidence.afterClear=f.counts();return evidence;
        }finally{f.clear();}
      });
    }
    const big=syntheticCanvas(4000,2000),bigPNG=await toBlob(big,'image/png');big.width=big.height=1;
    for(const mime of ['image/jpeg','image/webp']) await targetCase(`native-8MP-bound-${mime}`,'native 4000x2000 q99 target1',async()=>{
      const f=nativeTargetSession();try {await f.select(bigPNG,{value:'4000',mime,quality:'99',targetRaw:'1'});const begin=performance.now();const result=await f.session.generate(),durationMs=performance.now()-begin,state=f.session.snapshot();
        assert(!result.ok&&['TARGET_NOT_MET','ENCODE_TIMEOUT'].includes(result.code),'8MP_BOUNDED_FAILURE');assert(state.metrics.attempts<=12&&state.output===null&&f.counts().createdURLs===0&&f.counts().activeTimers===0,'8MP_NO_URL');assert(state.dimensions.value.width===4000&&state.dimensions.value.height===2000&&state.source!==null,'8MP_SOURCE_RETAINED');
        const evidence={summary:{code:state.code,attempts:state.metrics.attempts,durationMs,width:4000,height:2000},fixtureBytes:bigPNG.size,attempts:f.attempts,metrics:state.metrics,counts:f.counts()};f.clear();evidence.afterClear=f.counts();return evidence;
      }finally{f.clear();}
    });
    const alphaCanvas=syntheticCanvas(320,240),alphaPNG=await toBlob(alphaCanvas,'image/png');alphaCanvas.width=alphaCanvas.height=1;
    await targetCase('native-PNG-exact-boundary','native PNG S/S-1; ordinary path and alpha',async()=>{
      const f=nativeTargetSession();try {await f.select(alphaPNG,{value:'320',mime:'image/png',quality:'NaN',targetEnabled:false,targetRaw:'invalid'});await f.session.generate();const size=f.blob().size;
        f.session.update({targetEnabled:true,targetRaw:String(size)});assert((await f.session.generate()).ok,'PNG_EXACT_EQUALITY');const decoded=await decodeTargetBlob(f.blob(),[[160,120],[70,30]]);assert(decoded.pixels[0][3]===0&&decoded.pixels[1][3]>=126&&decoded.pixels[1][3]<=129,'PNG_ALPHA');assert(f.session.snapshot().metrics.attempts===1,'PNG_ONCE');
        f.session.update({targetRaw:String(size-1)});assert((await f.session.generate()).code==='TARGET_NOT_MET','PNG_ONE_BYTE_OVER');assert(f.session.snapshot().metrics.attempts===1&&f.counts().activeURLs===0,'PNG_FAILURE_NO_URL');assert(f.attempts.every(row=>row.q===null),'PNG_QUALITY_IGNORED');
        return {summary:{bytes:size,equal:'success',oneLess:'TARGET_NOT_MET',alpha:decoded.pixels.map(pixel=>pixel[3])},attempts:f.attempts,decoded};
      }finally{f.clear();}
    });
    for(const mime of ['image/jpeg','image/webp']) await targetCase(`native-alpha-${mime}`,'native ordinary and target codec paths',async()=>{
      const f=nativeTargetSession();try {await f.select(alphaPNG,{value:'320',mime,targetEnabled:false,targetRaw:'invalid'});assert((await f.session.generate()).ok,'ORDINARY_CODEC');assert(f.attempts.length===1&&f.session.snapshot().metrics===null,'ORDINARY_ONCE');f.session.update({targetEnabled:true,targetRaw:'10485760'});assert((await f.session.generate()).ok,'TARGET_CODEC');const decoded=await decodeTargetBlob(f.blob(),[[160,120],[70,30]]);
        if(mime==='image/jpeg')assert(decoded.pixels[0].slice(0,3).every(n=>n>=250)&&decoded.pixels[0][3]===255,'JPEG_WHITE');else assert(decoded.pixels[0][3]===0&&decoded.pixels[1][3]>=126&&decoded.pixels[1][3]<=129,'WEBP_ALPHA');return {summary:{mime,bytes:decoded.bytes,pixels:decoded.pixels},attempts:f.attempts,decoded};
      }finally{f.clear();}
    });
    await targetCase('native-PNG-fallback','native PNG codec with explicitly forced WebP fallback',async()=>{
      const original=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(callback,mime,q){return original.call(this,callback,mime==='image/webp'?'image/png':mime,q);};const f=nativeTargetSession();
      try {await f.select(alphaPNG,{value:'320',mime:'image/webp',targetEnabled:false});await f.session.generate();const size=f.blob().size;f.session.update({targetEnabled:true,targetRaw:String(size)});assert((await f.session.generate()).ok,'FALLBACK_EQUAL');const success=f.session.snapshot();assert(success.output.filename==='image-320x240.png'&&success.notice==='FORMAT_FALLBACK'&&success.metrics.attempts===1,'FALLBACK_RESULT');const decoded=await decodeTargetBlob(f.blob(),[[160,120],[70,30]]);
        f.session.update({targetRaw:String(size-1)});await f.session.generate();const failure=f.session.snapshot();assert(failure.code==='TARGET_NOT_MET'&&failure.notice==='FORMAT_FALLBACK'&&failure.output===null&&failure.metrics.attempts===1,'FALLBACK_STOP');return {summary:{actualMime:'image/png',bytes:size,equal:'success',oneLess:'TARGET_NOT_MET',attemptsPerTarget:1},attempts:f.attempts,decoded};
      }finally{f.clear();HTMLCanvasElement.prototype.toBlob=original;}
    });
    await targetCase('native-target-EXIF1-8','native decode and target PNG encode all orientations',async()=>{
      const c=syntheticCanvas(640,480),jpeg=await toBlob(c,'image/jpeg',.95);c.width=c.height=1;const f=nativeTargetSession(),orientations=[];
      try {for(let orientation=1;orientation<=8;orientation++) {await f.select(exifJpeg(jpeg,orientation),{value:'640',mime:'image/png'});assert((await f.session.generate()).ok,'EXIF_TARGET');const decoded=await decodeTargetBlob(f.blob());const swapped=orientation>=5;assert(decoded.width===(swapped?480:640)&&decoded.height===(swapped?640:480)&&colorsMatch(decoded.corners,cornerOrder[orientation-1]),'EXIF_ORIENTATION');orientations.push({orientation,width:decoded.width,height:decoded.height,bytes:decoded.bytes,mime:decoded.mime,corners:decoded.corners});f.clear();}return {summary:{orientations:8,pass:true},orientations,attempts:f.attempts,afterClear:f.counts()};}
      finally{f.clear();}
    });
    await targetCase('native-30s-deadline','real 30s timer; native blob with explicitly delayed callback',async()=>{
      let deliver=null;const f=nativeTargetSession({hook:blob=>new Promise(resolve=>{deliver=()=>resolve(blob);})});
      try {await f.select(alphaPNG,{value:'320',mime:'image/jpeg',quality:'1'});const begin=performance.now();const generation=f.session.generate();await wait(()=>deliver!==null);const nativeReadyMs=performance.now()-begin;const result=await generation,durationMs=performance.now()-begin,state=f.session.snapshot();
        assert(result.code==='ENCODE_TIMEOUT'&&state.code==='ENCODE_TIMEOUT'&&state.output===null&&state.source!==null,'REAL_TIMEOUT');assert(durationMs>=30000&&f.counts().activeTimers===0&&f.counts().activeURLs===0&&f.counts().activeExportCanvases===0,'TIMEOUT_CLEANUP');deliver();await nextFrame();assert(f.session.snapshot().code==='ENCODE_TIMEOUT'&&f.counts().createdURLs===0,'LATE_NATIVE_BLOB');
        const evidence={summary:{code:state.code,requestedDeadlineMs:30000,observedMs:durationMs,nativeReadyMs},attempts:f.attempts,metrics:state.metrics,counts:f.counts()};f.clear();evidence.afterClear=f.counts();return evidence;
      }finally{deliver?.();f.clear();}
    });
    await targetCase('native-10-lifecycles','native JPEG retries then source/URL/canvas/timer cleanup',async()=>{
      const f=nativeTargetSession(),cycles=[];try {for(let cycle=0;cycle<10;cycle++){await f.select(targetNoise,{mime:'image/jpeg',targetRaw:String(targetPlans['image/jpeg'].target)});assert((await f.session.generate()).ok,'CYCLE_RESULT');const state=f.session.snapshot();assert(state.metrics.attempts>=2,'CYCLE_REAL_RETRY');f.clear();cycles.push({cycle:cycle+1,attempts:state.metrics.attempts,bytes:state.output.bytes,counts:f.counts()});}return {summary:{cycles:10,afterClear:f.counts()},cycles,attempts:f.attempts,nativeMemoryGC:'NOT_RUN; reference counts are not native allocation profiling'};}
      finally{f.clear();}
    });
    await targetCase('native-pagehide-clear','native result followed by actual dispatched pagehide event',async()=>{
      const f=nativeTargetSession(),handler=()=>f.session.clear();try {await f.select(alphaPNG,{value:'320',mime:'image/png'});await f.session.generate();window.addEventListener('pagehide',handler);window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false}));assert(f.session.snapshot().status==='idle'&&f.session.snapshot().settings.targetEnabled===false,'PAGEHIDE_CLEAR');f.clear();return {summary:f.counts(),event:'synthetic pagehide event on test page; not physical navigation/BFCache coverage'};}
      finally{window.removeEventListener('pagehide',handler);f.clear();}
    });
    targetReport.autoElapsedMs=performance.now()-started;targetReport.stage='AWAITING_NATIVE_CANCEL_AND_DOWNLOADS';targetElement('stage-target-cancel').disabled=false;targetElement('target-status').textContent='AUTO PASS — stage cancellation, then verify native downloads';
  }catch(error){targetReport.stage='FAILED';targetReport.error=error.message;targetElement('target-status').textContent=`FAIL ${error.message}`;for(const f of targetFactories)f.clear();}
  updateTargetReport();
}
async function stageTargetCancel() {
  targetElement('stage-target-cancel').disabled=true;let lateA=null,pendingB=null,firstId=null,jobA=null;let attemptA=0;
  const f=nativeTargetSession({hook:(blob,options,record,canvas)=>{
    if(firstId===null)firstId=options.jobId;
    if(options.jobId===firstId&&++attemptA===2)return new Promise(resolve=>{lateA={deliver:()=>resolve(blob),canvas};targetElement('cancel-target').disabled=false;targetElement('target-status').textContent='Candidate 2 is awaiting explicitly delayed native callback — click Cancel target A';});
    if(options.jobId!==firstId)return new Promise(resolve=>{pendingB={deliver:()=>resolve(blob),canvas};});
    return blob;
  }});targetActive=f;
  try {
    await f.select(targetNoise,{mime:'image/jpeg',targetRaw:String(targetPlans['image/jpeg'].target)});jobA=f.session.generate();await wait(()=>lateA!==null);
    targetElement('cancel-target').onclick=async()=>{
      targetElement('cancel-target').disabled=true;const clicked=performance.now();f.session.cancel();const immediateMs=performance.now()-clicked;await nextFrame();const presentedMs=performance.now()-clicked;
      try {
        assert(f.session.snapshot().status==='ready'&&presentedMs<=500&&f.session.snapshot().metrics===null,'CANCEL_FEEDBACK_500MS');assert((await jobA).code==='CANCELLED','CANCEL_PROMISE');const afterCancel=f.counts();assert(afterCancel.activeTimers===0&&afterCancel.activeURLs===0&&afterCancel.activeExportCanvases===0&&afterCancel.activeBitmaps===1,'CANCEL_RESOURCES');
        const oldTimer=f.allTimers[0];f.session.update({targetRaw:'10485760'});const jobB=f.session.generate();await wait(()=>pendingB!==null);const before=f.releases.length;lateA.deliver();oldTimer.callback();await nextFrame();assert(pendingB.canvas.width===800&&pendingB.canvas.height===600&&f.releases.length===before&&f.session.snapshot().status==='encoding'&&f.counts().createdURLs===0,'LATE_A_CANNOT_RELEASE_B');
        pendingB.deliver();assert((await jobB).ok,'B_RESULT');assert(f.attempts.filter(row=>row.jobId===firstId).length===2,'A_NO_CANDIDATE3');const decoded=await decodeTargetBlob(f.blob());assert(decoded.width===800&&decoded.height===600,'B_DECODE');
        targetReport.cases.push({id:'native-cancel-owner-isolation',kind:'native codecs; explicitly delayed A/B callbacks and old timer replay; real CUA click',pass:true,evidence:{summary:{cancelImmediateMs:immediateMs,cancelPresentedMs:presentedMs,Aattempts:2,Bwidth:decoded.width,Bheight:decoded.height},afterCancel,attempts:f.attempts,Bdecoded:decoded,Bcounts:f.counts()}});
        targetElement('clear-target').disabled=false;targetElement('target-status').textContent='Cancel PASS — click Measure clear feedback';updateTargetReport();
      }catch(error){targetReport.cases.push({id:'native-cancel-owner-isolation',pass:false,error:error.message});targetReport.stage='FAILED';targetElement('target-status').textContent=`FAIL ${error.message}`;lateA?.deliver();pendingB?.deliver();f.clear();updateTargetReport();}
    };
    targetElement('clear-target').onclick=async()=>{
      targetElement('clear-target').disabled=true;const clicked=performance.now();f.clear();const immediateMs=performance.now()-clicked;await nextFrame();const presentedMs=performance.now()-clicked;
      const pass=f.session.snapshot().status==='idle'&&presentedMs<=500;targetReport.cases.push({id:'native-clear-feedback',kind:'actual CUA test-control click and next frame',pass,evidence:{summary:{clearImmediateMs:immediateMs,clearPresentedMs:presentedMs,counts:f.counts()}}});targetActive=null;targetElement('finish-target').disabled=false;targetElement('target-status').textContent='Core PASS — verify JPEG/WebP native download files, then finalize';updateTargetReport();
    };
  }catch(error){targetReport.cases.push({id:'native-cancel-owner-isolation',pass:false,error:error.message});targetReport.stage='FAILED';targetElement('target-status').textContent=`FAIL ${error.message}`;lateA?.deliver();pendingB?.deliver();f.clear();updateTargetReport();}
}
function downloadTargetProof(mime) {
  const proof=targetProofs.get(mime);if(!proof)return;
  const url=URL.createObjectURL(proof.blob);targetProofURLs.add(url);const link=document.createElement('a');link.href=url;link.download=mime==='image/jpeg'?'u09-target-800x600.jpg':'u09-target-800x600.webp';link.click();
  const timer=setTimeout(()=>{URL.revokeObjectURL(url);targetProofURLs.delete(url);targetProofTimers.delete(timer);},10000);targetProofTimers.add(timer);
}
async function verifyTargetDownload(mime,file) {
  const proof=targetProofs.get(mime);try {assert(proof&&file,'NATIVE_DOWNLOAD_REQUIRED');const decoded=await decodeTargetBlob(file),hash=await shaBlob(file);assert(file.size===proof.expected.bytes&&hash===proof.expected.sha256&&decoded.width===800&&decoded.height===600,'DOWNLOADED_FILE_BYTES_AND_DECODE');targetReport.downloads[mime]={pass:true,bytes:file.size,width:decoded.width,height:decoded.height,sha256:hash,expected:proof.expected};}
  catch(error){targetReport.downloads[mime]={pass:false,error:error.message};}updateTargetReport();
}
function finishTargetGate() {
  for(const f of targetFactories)f.clear();for(const timer of targetProofTimers)clearTimeout(timer);targetProofTimers.clear();for(const url of targetProofURLs)URL.revokeObjectURL(url);targetProofURLs.clear();targetProofs.clear();targetNoise=null;targetPlans=null;targetActive=null;
  for(const id of ['verify-target-jpeg','verify-target-webp'])targetElement(id).value='';
  targetReport.resourceFinal={sessions:targetFactories.map(f=>f.counts()),fixtureProofURLs:targetProofURLs.size,fixtureProofTimers:targetProofTimers.size,retainedProofBlobs:targetProofs.size};
  targetReport.notRun=['Native memory/GC plateau','Physical mobile/touch and screen reader','Other engines','Full browser zoom/Network/Storage/physical offline','Product target UI (not authorized in this milestone)'];
  targetReport.pass=targetReport.cases.every(row=>row.pass)&&targetReport.cases.some(row=>row.id==='native-clear-feedback')&&['image/jpeg','image/webp'].every(mime=>targetReport.downloads[mime]?.pass);
  targetReport.stage=targetReport.pass?'READY_FOR_PRIMARY_GATE':'FAILED';targetReport.finishedAt=new Date().toISOString();targetElement('target-status').textContent=targetReport.pass?'PASS — READY_FOR_PRIMARY_GATE; all test-owned resources cleared':'FAIL — gate evidence incomplete';targetElement('finish-target').disabled=true;targetElement('download-target-jpeg').disabled=targetElement('download-target-webp').disabled=true;targetElement('run-products').disabled=false;targetElement('load-demo').disabled=false;updateTargetReport();
}
if(typeof document!=='undefined'&&targetElement('run-target')) {
  targetElement('run-target').addEventListener('click',runTargetNative);targetElement('stage-target-cancel').addEventListener('click',stageTargetCancel);targetElement('download-target-jpeg').addEventListener('click',()=>downloadTargetProof('image/jpeg'));targetElement('download-target-webp').addEventListener('click',()=>downloadTargetProof('image/webp'));
  targetElement('verify-target-jpeg').addEventListener('change',event=>verifyTargetDownload('image/jpeg',event.target.files[0]));targetElement('verify-target-webp').addEventListener('change',event=>verifyTargetDownload('image/webp',event.target.files[0]));targetElement('finish-target').addEventListener('click',finishTargetGate);
}

async function runTargetProducts() {
  const report={task:'U09-TARGET-SIZE-UI-20261013',date:new Date().toISOString(),language:targetElement('language').value,cases:[],pass:false};
  targetElement('run-target-ui').disabled=true;targetElement('target-ui-status').textContent='RUNNING actual product target UI';
  let cleanup=null;
  try {
    const {w,d,frame}=await loadProduct(),get=id=>d.getElementById(id),urls=new Map(),bitmaps=new Set(),encodes=[];
    if(navigator.userAgentData)report.fullVersion=await navigator.userAgentData.getHighEntropyValues(['fullVersionList','platformVersion','architecture']);
    const create=w.URL.createObjectURL.bind(w.URL),revoke=w.URL.revokeObjectURL.bind(w.URL),nativeDecode=w.createImageBitmap.bind(w),nativeBlob=w.HTMLCanvasElement.prototype.toBlob;
    let networkCalls=0,storageWrites=0,created=0,maxBitmaps=0;
    w.URL.createObjectURL=blob=>{const url=create(blob);urls.set(url,blob);created++;return url;};w.URL.revokeObjectURL=url=>{urls.delete(url);revoke(url);};
    w.createImageBitmap=async(...args)=>{const bitmap=await nativeDecode(...args);bitmaps.add(bitmap);maxBitmaps=Math.max(maxBitmaps,bitmaps.size);const close=bitmap.close.bind(bitmap);bitmap.close=()=>{bitmaps.delete(bitmap);close();};return bitmap;};
    const loggedBlob=function(callback,mime,q){const canvas=this;return nativeBlob.call(canvas,blob=>{encodes.push({mime:blob?.type??null,bytes:blob?.size??null,q:q===undefined?null:Math.round(q*100),width:canvas.width,height:canvas.height});callback(blob);},mime,q);};w.HTMLCanvasElement.prototype.toBlob=loggedBlob;
    const originalFetch=w.fetch.bind(w);w.fetch=(...args)=>{networkCalls++;return originalFetch(...args);};const originalOpen=w.XMLHttpRequest.prototype.open;w.XMLHttpRequest.prototype.open=function(...args){networkCalls++;return originalOpen.apply(this,args);};const originalStore=w.Storage.prototype.setItem;w.Storage.prototype.setItem=function(...args){storageWrites++;return originalStore.apply(this,args);};const originalIDB=w.IDBFactory.prototype.open;w.IDBFactory.prototype.open=function(...args){storageWrites++;return originalIDB.apply(this,args);};
    const initialHTTP=w.performance.getEntriesByType('resource').filter(row=>row.name.startsWith('http')).length;
    const change=(id,value)=>{const field=get(id);if(field.type==='checkbox')field.checked=value;else field.value=value;field.dispatchEvent(new w.Event(['size','quality','target-size'].includes(id)?'input':'change',{bubbles:true}));};
    const select=async blob=>{const data=new w.DataTransfer();data.items.add(new w.File([blob],'synthetic-product.png',{type:blob.type}));get('file').files=data.files;get('file').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>['ready','error'].includes(d.documentElement.dataset.state));assert(d.documentElement.dataset.state==='ready','PRODUCT_SELECT');};
    const generate=async()=>{get('generate').click();await wait(()=>['success','error'].includes(d.documentElement.dataset.state));if(d.documentElement.dataset.state==='success')await get('result-image').decode();return urls.get(get('result-image').getAttribute('src'))??null;};
    const check=async(id,kind,run)=>{const evidence=await run();report.cases.push({id,kind,pass:true,evidence});targetElement('target-ui-report').textContent=JSON.stringify(report,null,2);};
    cleanup=()=>{w.HTMLCanvasElement.prototype.toBlob=nativeBlob;get('clear').click();};
    const alpha=syntheticCanvas(22,11),smallPNG=await toBlob(alpha,'image/png');alpha.width=alpha.height=1;const noise=noiseCanvas(),noisePNG=await toBlob(noise,'image/png');noise.width=noise.height=1;
    await check('UI-default-and-ordinary','actual DOM/PNG',async()=>{await select(smallPNG);assert(!get('target-enabled').checked&&get('target-size').value===''&&get('target-unit').value==='kB','DEFAULT_TARGET');change('mode','width');change('size','15');const start=encodes.length,blob=await generate();assert(blob&&encodes.length-start===1&&get('result-image').naturalWidth===15&&get('result-image').naturalHeight===8&&get('target-met').hidden,'ORDINARY_GQ01');return {mime:blob.type,bytes:blob.size,width:15,height:8,attempts:1};});
    await check('UI-units-and-invalid','actual controller; synthetic field events',async()=>{
      change('target-enabled',true);assert(get('download').disabled&&get('result-summary').hidden&&get('generate').disabled&&urls.size===0,'EMPTY_ENABLED_INVALIDATES');change('target-size','200');assert(get('target-exact').textContent.includes('200,000'),'KB_EXACT');change('target-unit','KiB');assert(get('target-size').value==='200'&&get('target-exact').textContent.includes('204,800'),'KIB_NO_RAW_CHANGE');
      const start=encodes.length;for(const raw of ['', '0','+1','1.5','1e5','２００','10485761']){change('target-unit','bytes');change('target-size',raw);assert(get('generate').disabled&&get('target-size').getAttribute('aria-invalid')==='true'&&!get('target-size-error').hidden,'INVALID_DISABLED');get('settings').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await Promise.resolve();assert(encodes.length===start&&urls.size===0,'INVALID_ZERO_ENCODE');}
      change('target-enabled',false);assert(!get('generate').disabled&&get('target-fields').hidden,'OFF_IGNORES_DRAFT');const blob=await generate();assert(blob&&encodes.length-start===1,'ORDINARY_WITH_INVALID_DRAFT');return {kB:200000,KiB:204800,rawPreserved:true,invalidEncodes:0,disabledDraftIgnored:true};
    });
    let pngSize;
    await check('UI-PNG-exact-boundary','actual product PNG',async()=>{pngSize=urls.get(get('result-image').getAttribute('src')).size;change('target-enabled',true);change('target-unit','bytes');change('target-size',String(pngSize));let start=encodes.length;const blob=await generate();assert(blob&&blob.size===pngSize&&encodes.length-start===1&&!get('target-met').hidden&&get('target-result-info').textContent.includes('1'),'PNG_EQUALS');change('target-size',String(pngSize-1));start=encodes.length;const failed=await generate();assert(!failed&&encodes.length-start===1&&get('download').disabled&&get('result-summary').hidden&&!get('target-feedback').hidden&&get('target-feedback-info').textContent.includes(String(pngSize))&&urls.size===0,'PNG_ONE_LESS_NO_DOWNLOAD');return {bytes:pngSize,oneLess:pngSize-1,successAttempts:1,failedAttempts:1,feedback:get('target-feedback-info').textContent};});
    for(const mime of ['image/jpeg','image/webp'])await check(`UI-native-retry-${mime}`,'actual product DOM/native codec; target=S-1',async()=>{await select(noisePNG);change('size','800');change('format',mime);const original=await generate();const size=original.size;change('target-enabled',true);change('target-unit','bytes');change('target-size',String(size-1));const start=encodes.length,blob=await generate();assert(blob&&blob.size<=size-1&&encodes.length-start>=2&&get('result-image').naturalWidth===800&&get('result-image').naturalHeight===600&&!get('target-met').hidden,'PRODUCT_NATIVE_RETRY');assert(get('target-result-info').textContent.includes('80')&&!get('quality-field').hidden,'ACTUAL_Q_AND_ATTEMPTS');return {targetBytes:size-1,bytes:blob.size,width:800,height:600,attempts:encodes.slice(start),resultText:get('target-result-info').textContent};});
    await check('UI-setting-invalidation','actual controller and URL revocation',async()=>{for(const [id,value] of [['target-size','200'],['target-unit','kB'],['quality','80'],['format','image/jpeg'],['size','600'],['target-enabled',false]]){const before=encodes.length;change(id,value);assert(get('download').disabled&&get('result-summary').hidden&&!get('result-image').hasAttribute('src')&&urls.size===0&&encodes.length===before,'SETTING_INVALIDATION');if(!get('generate').disabled)await generate();}return {settings:6,automaticEncodes:0};});
    await check('UI-timeout-qualified-blob','native PNG with controlled monotonic clock: deadline before URL',async()=>{await select(smallPNG);change('mode','width');change('size','15');change('target-enabled',true);change('target-unit','bytes');change('target-size','10485760');const descriptor=Object.getOwnPropertyDescriptor(w.performance,'now');let delivered=false,reads=0;Object.defineProperty(w.performance,'now',{configurable:true,value:()=>delivered&&++reads>=3?30000:0});w.HTMLCanvasElement.prototype.toBlob=function(callback,...args){return nativeBlob.call(this,blob=>{delivered=true;callback(blob);},...args);};try{const blob=await generate();const text=get('target-feedback-info').textContent;assert(!blob&&d.documentElement.dataset.state==='error'&&get('download').disabled&&urls.size===0&&!get('target-feedback').hidden,'TIMEOUT_NO_DOWNLOAD');assert(text.includes('30')&&!/exceed|超出|仍超|未達/.test(text),'TIMEOUT_NOT_OVER_LIMIT_ASSERTION');return {targetBytes:10485760,deadline:30000,noURL:true,feedback:text,clock:'Explicitly controlled final-before-URL boundary; not elapsed native timeout'};}finally{if(descriptor)Object.defineProperty(w.performance,'now',descriptor);else delete w.performance.now;w.HTMLCanvasElement.prototype.toBlob=loggedBlob;}});
    await check('UI-timeout-fallback-qualified-blob','actual PNG codec forced for WebP plus controlled deadline before URL',async()=>{await select(smallPNG);change('mode','width');change('size','15');change('format','image/webp');change('target-enabled',true);change('target-unit','bytes');change('target-size','10485760');const descriptor=Object.getOwnPropertyDescriptor(w.performance,'now');let delivered=false,reads=0;Object.defineProperty(w.performance,'now',{configurable:true,value:()=>delivered&&++reads>=3?30000:0});w.HTMLCanvasElement.prototype.toBlob=function(callback,mime,q){return nativeBlob.call(this,blob=>{delivered=true;callback(blob);},'image/png',q);};try{const blob=await generate(),feedback=get('target-feedback-info').textContent,status=get('status').textContent;assert(!blob&&d.documentElement.dataset.state==='error'&&get('download').disabled&&urls.size===0,'FALLBACK_TIMEOUT_NO_DOWNLOAD');assert(status.includes('PNG')&&!/exceed|超出|仍超|未達/.test(status+feedback),'FALLBACK_TIMEOUT_NEUTRAL');return {requested:'image/webp',actual:'image/png',targetBytes:10485760,noURL:true,status,feedback,clock:'Controlled final-before-URL deadline'};}finally{if(descriptor)Object.defineProperty(w.performance,'now',descriptor);else delete w.performance.now;w.HTMLCanvasElement.prototype.toBlob=loggedBlob;}});
    await check('UI-fallback-and-failure','actual PNG codec with explicitly forced WebP MIME substitution',async()=>{await select(smallPNG);change('mode','width');change('size','15');change('format','image/webp');change('target-enabled',true);change('target-unit','bytes');change('target-size','10485760');w.HTMLCanvasElement.prototype.toBlob=function(callback,mime,q){return loggedBlob.call(this,callback,mime==='image/webp'?'image/png':mime,q);};try{const start=encodes.length,blob=await generate();assert(blob.type==='image/png'&&encodes.length-start===1&&!get('fallback').hidden,'FALLBACK_SUCCESS');change('target-size','1');const failed=await generate();assert(!failed&&get('download').disabled&&urls.size===0&&get('status').textContent.includes('PNG')&&!get('target-feedback').hidden,'FALLBACK_FAILURE_NOTICE');return {mime:'image/png',attemptsPerJob:1,failure:get('status').textContent};}finally{w.HTMLCanvasElement.prototype.toBlob=loggedBlob;}});
    await check('UI-cancel-late-isolation','actual product native codecs with explicitly held callbacks; DOM clicks',async()=>{await select(noisePNG);change('size','800');change('format','image/jpeg');const normal=await generate();change('target-enabled',true);change('target-unit','bytes');change('target-size',String(normal.size-1));let count=0;const held=[];w.HTMLCanvasElement.prototype.toBlob=function(callback,...args){const canvas=this;return nativeBlob.call(canvas,blob=>{count++;if(count>=2)held.push({canvas,deliver:()=>callback(blob)});else callback(blob);},...args);};try{get('generate').click();await wait(()=>held.length===1);assert(!get('cancel').hidden&&get('fields').disabled&&get('file').disabled,'BUSY_CONTROLS');const click=performance.now();get('cancel').click();await nextFrame();const feedbackMs=performance.now()-click;report.cancelDiagnostic={readyState:d.documentElement.dataset.state,feedbackMs,activeURLs:urls.size,visibilityState:d.visibilityState,hasFocus:d.hasFocus(),parentVisibilityState:document.visibilityState,parentHasFocus:document.hasFocus(),documentReadyState:d.readyState};targetElement('target-ui-report').textContent=JSON.stringify(report,null,2);assert(d.documentElement.dataset.state==='ready'&&feedbackMs<=500&&urls.size===0,'PRODUCT_CANCEL');change('target-size','10485760');get('generate').click();await wait(()=>held.length===2);held[0].deliver();await nextFrame();assert(held[1].canvas.width===800&&held[1].canvas.height===600&&d.documentElement.dataset.state==='encoding'&&urls.size===0,'LATE_A_B_CANVAS');held[1].deliver();await wait(()=>d.documentElement.dataset.state==='success');assert(count===3&&urls.size===1,'NO_A_THIRD_CANDIDATE');return {cancelNextFrameMs:feedbackMs,Aattempts:2,Battempts:1,BcanvasSurvived:true};}finally{for(const item of held)item.deliver();w.HTMLCanvasElement.prototype.toBlob=loggedBlob;}});
    await check('UI-clear-and-reset','actual clear during native encoding with explicitly delayed callback',async()=>{let deliver;w.HTMLCanvasElement.prototype.toBlob=function(callback,...args){return nativeBlob.call(this,blob=>{deliver=()=>callback(blob);},...args);};try{get('generate').click();await wait(()=>deliver);get('clear').click();assert(d.documentElement.dataset.state==='idle'&&!get('target-enabled').checked&&get('target-size').value===''&&get('target-unit').value==='kB'&&urls.size===0&&bitmaps.size===0,'CLEAR_DEFAULTS');deliver();await nextFrame();assert(d.documentElement.dataset.state==='idle'&&urls.size===0,'CLEAR_LATE_NO_RESULT');return {activeURLs:urls.size,activeBitmaps:bitmaps.size,targetOff:true,unit:'kB'};}finally{deliver?.();w.HTMLCanvasElement.prototype.toBlob=loggedBlob;}});
    await check('UI-compact-keyboard-reflow','actual iframe layout, keyboard focus and 200% text (not full zoom)',async()=>{await select(noisePNG);change('format','image/jpeg');change('target-enabled',true);change('target-size','200');const layouts=[];for(const [width,font] of [[320,'100%'],[768,'100%'],[640,'200%']]){frame.width=String(width);d.documentElement.style.fontSize=font;await new Promise(resolve=>w.requestAnimationFrame(resolve));const content=d.documentElement.scrollWidth,viewport=d.documentElement.clientWidth;assert(content<=viewport,'TARGET_OVERFLOW');for(const id of ['target-enabled','target-size','target-unit','generate']){get(id).focus();assert(d.activeElement===get(id),'TARGET_FOCUS');const rect=get(id).getBoundingClientRect();assert(rect.width>0&&rect.right<=viewport,'TARGET_CONTROL_VISIBLE');}layouts.push({width,font,viewport,content});}frame.width='1200';d.documentElement.style.fontSize='';return layouts;});
    await check('UI-network-storage-clear','actual resource timing and intercepted API counts',async()=>{get('clear').click();const after=w.performance.getEntriesByType('resource').filter(row=>row.name.startsWith('http')).length;assert(networkCalls===0&&storageWrites===0&&after===initialHTTP&&urls.size===0&&bitmaps.size===0,'PRIVACY_OR_CLEANUP');return {initialHTTP,afterHTTP:after,networkCalls,storageWrites,activeURLs:0,activeBitmaps:0,maxBitmaps};});
    report.pass=report.cases.every(row=>row.pass);report.nativeMIME='Real encoder outputs; controlled fallback/callback cases separately labeled';
  }catch(error){report.error=error.message;report.pass=false;}finally{cleanup?.();targetElement('target-ui-report').textContent=JSON.stringify(report,null,2);targetElement('target-ui-status').textContent=report.pass?'PASS: bilingual target product cases':'FAIL: target product cases';targetElement('run-target-ui').disabled=false;}
}
if(typeof document!=='undefined'&&targetElement('run-target-ui'))targetElement('run-target-ui').addEventListener('click',runTargetProducts);

async function diagnoseProductCancel() {
  const button=targetElement('diagnose-cancel'),status=targetElement('cancel-diag-status');button.disabled=true;
  const report={kind:'Diagnostic only: native JPEG, explicitly held callback; original500ms gate unchanged',date:new Date().toISOString(),language:targetElement('language').value,stage:'RUNNING',baseline:null,cancel:null,longTasks:{parent:[],iframe:[]}};
  const publish=()=>{targetElement('cancel-diag-report').textContent=JSON.stringify(report,null,2);};
  let cleanup=null;const observers=[];publish();status.textContent='RUNNING cancel scheduling diagnosis';
  try {
    const {w,d}=await loadProduct(),get=id=>d.getElementById(id),urls=new Set();
    const originalCreate=w.URL.createObjectURL.bind(w.URL),originalRevoke=w.URL.revokeObjectURL.bind(w.URL),nativeBlob=w.HTMLCanvasElement.prototype.toBlob;
    w.URL.createObjectURL=blob=>{const url=originalCreate(blob);urls.add(url);return url;};w.URL.revokeObjectURL=url=>{urls.delete(url);originalRevoke(url);};
    const change=(id,value)=>{if(get(id).type==='checkbox')get(id).checked=value;else get(id).value=value;get(id).dispatchEvent(new w.Event(['size','quality','target-size'].includes(id)?'input':'change',{bubbles:true}));};
    const c=noiseCanvas(),png=await toBlob(c,'image/png');c.width=c.height=1;const dt=new w.DataTransfer();dt.items.add(new w.File([png],'diagnostic-noise.png',{type:'image/png'}));get('file').files=dt.files;get('file').dispatchEvent(new w.Event('change',{bubbles:true}));await wait(()=>d.documentElement.dataset.state==='ready');change('format','image/jpeg');get('generate').click();await wait(()=>d.documentElement.dataset.state==='success');
    const originalSize=Number(get('output-info').textContent.match(/(?:· )([\d,]+) bytes/)?.[1]?.replaceAll(',',''));assert(originalSize>0,'DIAGNOSTIC_SIZE');change('target-enabled',true);change('target-unit','bytes');change('target-size',String(originalSize-1));
    const held=[];let attempts=0;w.HTMLCanvasElement.prototype.toBlob=function(callback,...args){return nativeBlob.call(this,blob=>{attempts++;if(attempts===2)held.push(()=>callback(blob));else callback(blob);},...args);};
    cleanup=()=>{get('clear').click();for(const release of held)release();w.HTMLCanvasElement.prototype.toBlob=nativeBlob;for(const observer of observers)observer.disconnect();};
    for(const [win,key] of [[window,'parent'],[w,'iframe']])if(win.PerformanceObserver?.supportedEntryTypes.includes('longtask')){const observer=new win.PerformanceObserver(list=>{for(const entry of list.getEntries())report.longTasks[key].push({startTime:entry.startTime,duration:entry.duration});});observer.observe({type:'longtask',buffered:false});observers.push(observer);}
    const frameSample=win=>new Promise(resolve=>{const begin=win.performance.now();let finished=false;const timeout=setTimeout(()=>{if(!finished){finished=true;resolve({timeout:true,waitMs:win.performance.now()-begin});}},2000);win.requestAnimationFrame(timestamp=>{if(!finished){finished=true;clearTimeout(timeout);resolve({timestamp,waitMs:win.performance.now()-begin});}});});
    const baseline=async win=>{const samples=[];for(let i=0;i<3;i++)samples.push(await frameSample(win));return {samples,frameIntervalsMs:samples.slice(1).map((row,index)=>row.timestamp!==undefined&&samples[index].timestamp!==undefined?row.timestamp-samples[index].timestamp:null)};};
    get('generate').click();await wait(()=>held.length===1);
    report.before={state:d.documentElement.dataset.state,activeURLs:urls.size,visibilityState:d.visibilityState,hasFocus:d.hasFocus(),parentVisibilityState:document.visibilityState,parentHasFocus:document.hasFocus(),attempts};publish();
    const [parentBaseline,iframeBaseline]=await Promise.all([baseline(window),baseline(w)]);report.baseline={parent:parentBaseline,iframe:iframeBaseline};publish();
    let mutationMs=null;const clickStart=performance.now();const mutationObserver=new MutationObserver(()=>{if(mutationMs===null)mutationMs=performance.now()-clickStart;});mutationObserver.observe(d.documentElement,{attributes:true,attributeFilter:['data-state']});observers.push(mutationObserver);
    get('cancel').click();const clickReturned=performance.now();
    report.cancel={syncClickMs:clickReturned-clickStart,readyStateAtClickReturn:d.documentElement.dataset.state,activeURLsAtClickReturn:urls.size,cancelHiddenAtClickReturn:get('cancel').hidden,feedbackAtClickReturn:get('status').textContent,visibilityState:d.visibilityState,hasFocus:d.hasFocus(),parentVisibilityState:document.visibilityState,parentHasFocus:document.hasFocus()};publish();
    const [parentAfter,iframeAfter]=await Promise.all([frameSample(window),frameSample(w)]);
    report.cancel.parentRAFAfter=parentAfter;report.cancel.iframeRAFAfter=iframeAfter;report.cancel.mutationObserverMs=mutationMs;
    report.cancel.originalComposite500ms=(clickReturned-clickStart+parentAfter.waitMs)<=500&&report.cancel.readyStateAtClickReturn==='ready'&&report.cancel.activeURLsAtClickReturn===0;
    report.cancel.syncDOM500ms=(clickReturned-clickStart)<=500&&report.cancel.readyStateAtClickReturn==='ready'&&report.cancel.activeURLsAtClickReturn===0;
    cleanup();report.afterClear={state:d.documentElement.dataset.state,activeURLs:urls.size,sourcePreviewWidth:get('preview').width,sourcePreviewHeight:get('preview').height};report.stage='MEASURED';status.textContent='MEASURED: sync/DOM, baseline and parent/iframe frame delays recorded; gate not relaxed';
  }catch(error){report.stage='DIAGNOSTIC_FAILED';report.error=error.message;status.textContent=`DIAGNOSTIC_FAILED ${error.message}`;}finally{cleanup?.();publish();button.disabled=false;}
}
if(typeof document!=='undefined'&&targetElement('diagnose-cancel'))targetElement('diagnose-cancel').addEventListener('click',diagnoseProductCancel);
if(typeof document!=='undefined'&&document.getElementById('run-products')){
  document.getElementById('run-products').addEventListener('click',runProducts);
  document.getElementById('load-demo').addEventListener('click',async()=>{const {w,d}=await loadProduct();const c=syntheticCanvas();const blob=await toBlob(c,'image/png');const dt=new w.DataTransfer();dt.items.add(new w.File([blob],'synthetic-2400x1600.png',{type:'image/png'}));const input=d.getElementById('file');input.files=dt.files;input.dispatchEvent(new w.Event('change',{bubbles:true}));c.width=c.height=1;await wait(()=>d.documentElement.dataset.state==='ready');document.getElementById('status').textContent='Synthetic image ready for direct UI verification';});
}

