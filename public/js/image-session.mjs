import { inspectImageHeader, MAX_FILE_BYTES } from './core/image-header.mjs';
import { deriveDimensions, validateSource } from './core/dimensions.mjs';
import { normalizeQuality, resolveOutput } from './core/output.mjs';
import { normalizeTargetSize, qualityCandidates, TARGET_DEADLINE_MS } from './core/target-size.mjs';

export function nextJob(id) { if (!Number.isSafeInteger(id) || id < 0 || id === Number.MAX_SAFE_INTEGER) throw new Error('JOB_ID_EXHAUSTED'); return id + 1; }
export async function probeBrowserCapabilities() {
  if (typeof createImageBitmap !== 'function' || typeof HTMLCanvasElement.prototype.toBlob !== 'function') return {supported:false,webp:false};
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=24;
  const ctx=canvas.getContext('2d');if(!ctx) return {supported:false,webp:false};
  const colors=[[220,40,40],[20,180,60],[30,80,220],[240,200,30]];
  const orders=[[0,1,2,3],[1,0,3,2],[3,2,1,0],[2,3,0,1],[0,2,1,3],[2,0,3,1],[3,1,2,0],[1,3,0,2]];
  const blobOf=(target,mime)=>new Promise(resolve=>target.toBlob(resolve,mime,.95));
  const check=document.createElement('canvas');let bitmap=null;
  try {
    colors.forEach((color,i)=>{ctx.fillStyle=`rgb(${color.join(',')})`;ctx.fillRect(i%2*16,Math.floor(i/2)*12,16,12);});
    const jpeg=await blobOf(canvas,'image/jpeg');if(!jpeg?.size||jpeg.type!=='image/jpeg') return {supported:false,webp:false};
    for(let orientation=1;orientation<=8;orientation++) {
      const segment=new Uint8Array(36);segment.set([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0]);segment[28]=orientation;
      const file=new Blob([jpeg.slice(0,2),segment,jpeg.slice(2)],{type:'image/jpeg'});
      bitmap=await createImageBitmap(file,{imageOrientation:'from-image'});
      const swapped=orientation>=5;
      if(bitmap.width!==(swapped?24:32)||bitmap.height!==(swapped?32:24)) return {supported:false,webp:false};
      check.width=bitmap.width;check.height=bitmap.height;const checkCtx=check.getContext('2d');checkCtx.drawImage(bitmap,0,0);
      const positions=[[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
      const pass=positions.every(([x,y],i)=>{const pixel=checkCtx.getImageData(Math.floor(x*check.width),Math.floor(y*check.height),1,1).data;return colors[orders[orientation-1][i]].every((value,c)=>Math.abs(value-pixel[c])<35);});
      bitmap.close();bitmap=null;if(!pass) return {supported:false,webp:false};
    }
    canvas.width=canvas.height=1;const png=await blobOf(canvas,'image/png');if(!png?.size||png.type!=='image/png') return {supported:false,webp:false};
    const webp=await blobOf(canvas,'image/webp');return {supported:true,webp:webp?.size>0&&webp.type==='image/webp'};
  } catch { return {supported:false,webp:false}; }
  finally {bitmap?.close();canvas.width=canvas.height=check.width=check.height=1;}
}
export function createBrowserAdapters() {
  let canvas=null; let owner=null;
  return {
    decode:file=>createImageBitmap(file,{imageOrientation:'from-image'}),
    encode:(bitmap,{width,height,mime,quality,jobId})=>{
      const target=document.createElement('canvas');canvas=target;owner=jobId;target.width=width;target.height=height;
      const ctx=target.getContext('2d');if(!ctx) return Promise.reject(new Error('ENCODE_FAILED'));
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      if(mime==='image/jpeg') {ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);} else ctx.clearRect(0,0,width,height);
      ctx.drawImage(bitmap,0,0,width,height);
      return new Promise(resolve=>{if(mime==='image/png') target.toBlob(resolve,mime);else target.toBlob(resolve,mime,quality);});
    },
    releaseExport:jobId=>{if(canvas && (jobId===undefined || owner===jobId)){canvas.width=canvas.height=1;canvas=null;owner=null;}},
    createURL:blob=>URL.createObjectURL(blob),revokeURL:url=>URL.revokeObjectURL(url)
  };
}
export function createImageSession({ decode, encode, releaseExport = () => {}, createURL, revokeURL, onChange = () => {}, webp = false,
  clock = () => performance.now(), setTimer = (callback,delay) => setTimeout(callback,delay), clearTimer = timer => clearTimeout(timer) }) {
  let activeId = 0; let bitmap = null; let source = null; let output = null; let activeJob = null;
  let status = 'idle'; let code = null; let notice = null; let metrics = null;
  const defaults = value => ({ mode:'long-edge',value,mime:'image/png',quality:'85',targetEnabled:false,targetRaw:'',targetUnit:'kB' });
  let settings = defaults('1920');
  const dimensions = () => source ? deriveDimensions({ width:source.width, height:source.height, mode:settings.mode, value:settings.value }) : { ok:false, code:'SIZE_INVALID' };
  const quality = () => settings.mime === 'image/png' ? { ok:true, value:undefined } : normalizeQuality(settings.quality);
  const target = () => settings.targetEnabled ? normalizeTargetSize(settings.targetRaw,settings.targetUnit) : {ok:true,value:null};
  const snapshot = () => ({ id:activeId,status,code,notice,source:source?{...source}:null,output:output?{...output}:null,
    settings:{...settings},dimensions:dimensions(),quality:quality(),target:target(),metrics:metrics?{...metrics}:null });
  const emit = () => onChange(snapshot());
  const releaseResult = () => { if (output) revokeURL(output.url); output=null; notice=null;metrics=null; };
  const releaseSource = () => { if (bitmap) bitmap.close(); bitmap=null; source=null; };
  const current = job => activeJob===job && activeId===job.id;
  const cancelTimer = job => { if(job.timer!==null) {clearTimer(job.timer);job.timer=null;} };
  const elapsed = job => Math.max(0,clock()-job.started);
  const releaseJobExport = job => {if(job.exportLive){releaseExport(job.id);job.exportLive=false;}};
  function stopJob(job,reason) {
    if(!current(job)) return;
    cancelTimer(job);releaseJobExport(job);job.reason=reason;job.stop({kind:'stopped',code:reason});activeJob=null;
  }
  const invalidate = () => { if(activeJob) stopJob(activeJob,'CANCELLED');activeId=nextJob(activeId); };
  const clear = () => { invalidate();releaseResult();releaseSource();settings=defaults('1920');status='idle';code=null;emit(); };
  const error = errorCode => { code=errorCode;status='error';emit();return {ok:false,code:errorCode}; };
  async function select(files) {
    clear();
    if (!files || files.length !== 1) return error(files?.length>1?'MULTIPLE_FILES':'FORMAT_UNSUPPORTED');
    const file=files[0];
    if (!Number.isSafeInteger(file?.size) || file.size<0 || typeof file.arrayBuffer!=='function') return error('FORMAT_UNSUPPORTED');
    if (file.size===0) return error('EMPTY_FILE');
    if (file.size>MAX_FILE_BYTES) return error('FILE_TOO_LARGE');
    const id=activeId;status='checking';emit();
    try {
      const buffer=await file.arrayBuffer();
      if (id!==activeId) return {ok:false,code:'CANCELLED'};
      if (!(buffer instanceof ArrayBuffer) || buffer.byteLength!==file.size) return error('IMAGE_CORRUPT');
      const header=inspectImageHeader(new Uint8Array(buffer));
      if (!header.ok) return error(header.code);
      const gate=validateSource({size:file.size,width:header.value.encodedWidth,height:header.value.encodedHeight});
      if (!gate.ok) return error(gate.code);
      status='decoding';emit();
      const decoded=await decode(file);
      if (id!==activeId) { decoded?.close();return {ok:false,code:'CANCELLED'}; }
      const oriented=validateSource({size:file.size,width:decoded?.width,height:decoded?.height});
      const sameShape=decoded && (decoded.width===gate.value.width&&decoded.height===gate.value.height || decoded.width===gate.value.height&&decoded.height===gate.value.width);
      if (!oriented.ok || !sameShape) {decoded?.close();return error(oriented.ok?'IMAGE_CORRUPT':oriented.code);}
      bitmap=decoded;source={name:typeof file.name==='string'?file.name:'',format:header.value.format,size:file.size,width:decoded.width,height:decoded.height};
      settings=defaults(String(Math.min(Math.max(decoded.width,decoded.height),1920)));
      status='ready';code=null;emit();return {ok:true};
    } catch { if(id===activeId) return error('IMAGE_CORRUPT');return {ok:false,code:'CANCELLED'}; }
  }
  function update(changes) {
    if (!source || ['encoding','checking','decoding'].includes(status)) return false;
    if (!changes || Object.keys(changes).some(key=>!['mode','value','mime','quality','targetEnabled','targetRaw','targetUnit'].includes(key))) return false;
    if (Object.hasOwn(changes,'mime') && (!['image/png','image/jpeg','image/webp'].includes(changes.mime) || changes.mime==='image/webp'&&!webp)) return false;
    if (Object.hasOwn(changes,'targetEnabled') && typeof changes.targetEnabled!=='boolean') return false;
    invalidate();releaseResult();settings={...settings,...changes};status='ready';code=null;emit();return true;
  }
  async function generate() {
    if (!bitmap || ['encoding','checking','decoding'].includes(status)) return {ok:false,code:'ENCODE_FAILED'};
    const dims=dimensions();const q=quality();const limit=target();
    if (!dims.ok || !q.ok || !limit.ok) {releaseResult();return error(!dims.ok?dims.code:!q.ok?q.code:limit.code);}
    const frozen=Object.freeze({...settings});
    const candidates=frozen.mime==='image/png' ? [null] : frozen.targetEnabled ? qualityCandidates(Number(frozen.quality)).value : [Number(frozen.quality)];
    invalidate();releaseResult();
    const job={id:activeId,bitmap,dims:Object.freeze({...dims.value}),settings:frozen,targetBytes:limit.value,started:clock(),timer:null,stop:null,exportLive:false,reason:null};
    job.interrupt=new Promise(resolve=>{job.stop=resolve;});activeJob=job;status='encoding';code=null;
    if(frozen.targetEnabled) metrics={attempts:0,minBytes:null,minQuality:null,lastBytes:null,lastQuality:null,elapsedMs:0,targetBytes:limit.value};
    const timedOut = () => frozen.targetEnabled && elapsed(job)>=TARGET_DEADLINE_MS;
    const failJob = reason => {
      if(!current(job)) return {ok:false,code:job.reason??'CANCELLED'};
      if(metrics) metrics.elapsedMs=elapsed(job);
      stopJob(job,reason);activeId=nextJob(activeId);return error(reason);
    };
    if(frozen.targetEnabled) job.timer=setTimer(()=>{if(current(job)) failJob('ENCODE_TIMEOUT');},TARGET_DEADLINE_MS);
    emit();
    for(const candidate of candidates) {
      if(!current(job)) return {ok:false,code:job.reason??'CANCELLED'};
      if(timedOut()) return failJob('ENCODE_TIMEOUT');
      if(metrics) {metrics.attempts++;metrics.lastQuality=candidate;metrics.lastBytes=null;metrics.elapsedMs=elapsed(job);}
      let pending;job.exportLive=true;
      try {pending=Promise.resolve(encode(job.bitmap,{...job.dims,mime:frozen.mime,quality:candidate===null?undefined:candidate/100,jobId:job.id})).then(blob=>({kind:'blob',blob}),()=>({kind:'error'}));}
      catch {pending=Promise.resolve({kind:'error'});}
      emit();
      const settled=await Promise.race([pending,job.interrupt]);
      if(settled.kind==='stopped') return {ok:false,code:settled.code};
      if(!current(job)) return {ok:false,code:job.reason??'CANCELLED'};
      if(timedOut()) return failJob('ENCODE_TIMEOUT');
      // Only the current owner may release an export; late A cannot touch B.
      releaseJobExport(job);
      const blob=settled.blob;
      if(settled.kind==='error' || !blob || !Number.isSafeInteger(blob.size) || blob.size<=0) return failJob('ENCODE_FAILED');
      const resolved=resolveOutput(frozen.mime,blob.type,job.dims.width,job.dims.height);
      if(!resolved.ok) return failJob(resolved.code);
      const actualQuality=resolved.value.mime==='image/png'?null:candidate;
      notice=resolved.value.notice;
      if(metrics) {
        metrics.lastBytes=blob.size;metrics.lastQuality=actualQuality;metrics.elapsedMs=elapsed(job);
        if(metrics.minBytes===null || blob.size<metrics.minBytes) {metrics.minBytes=blob.size;metrics.minQuality=actualQuality;}
      }
      if(!frozen.targetEnabled || blob.size<=job.targetBytes) {
        if(!current(job)) return {ok:false,code:job.reason??'CANCELLED'};
        if(timedOut()) return failJob('ENCODE_TIMEOUT');
        try {const url=createURL(blob);output={...resolved.value,...job.dims,bytes:blob.size,url,...(frozen.targetEnabled?{quality:actualQuality,targetBytes:job.targetBytes}: {})};}
        catch {return failJob('ENCODE_FAILED');}
        cancelTimer(job);activeJob=null;status='success';code=null;emit();return {ok:true};
      }
      emit();
      if(resolved.value.mime==='image/png') return failJob('TARGET_NOT_MET');
    }
    return failJob('TARGET_NOT_MET');
  }
  function cancel() {
    if (!['checking','decoding','encoding'].includes(status)) return;
    invalidate();releaseResult();code=null;notice='CANCELLED';
    if (status==='encoding') status='ready'; else { releaseSource();status='idle'; }
    emit();
  }
  function reject(errorCode) { clear();return error(['MULTIPLE_FILES','FORMAT_UNSUPPORTED','BROWSER_UNSUPPORTED'].includes(errorCode)?errorCode:'FORMAT_UNSUPPORTED'); }
  return {select,update,generate,cancel,clear,reject,snapshot,sourceBitmap:()=>bitmap};
}
