import test from 'node:test';import assert from 'node:assert/strict';
import {createImageSession,nextJob} from '../public/js/image-session.mjs';import {pngHeader} from './fixtures/image-builders.mjs';
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const file=(width=2400,height=1600)=>new File([pngHeader(width,height)],'<img src=x onerror=alert(1)>.png',{type:'fake/mime'});
function fixture(overrides={}) {
  const calls={closed:0,created:[],revoked:[],decoded:0,released:0};
  const bitmap=(width=2400,height=1600)=>({width,height,close:()=>calls.closed++});
  const session=createImageSession({decode:async()=>{calls.decoded++;return bitmap();},encode:async()=>new Blob(['fake'],{type:'image/png'}),createURL:blob=>{const url=`blob:synthetic-${calls.created.length}`;calls.created.push({url,mime:blob.type});return url;},revokeURL:url=>calls.revoked.push(url),releaseExport:()=>calls.released++,webp:true,...overrides});
  return {session,calls,bitmap};
}
test('bad headers and oversize never decode; defaults, settings and clear release resources',async()=>{
  const {session,calls}=fixture();
  await session.select([new File([],'empty')]);assert.equal(session.snapshot().code,'EMPTY_FILE');
  await session.select([file(),file()]);assert.equal(session.snapshot().code,'MULTIPLE_FILES');
  await session.select([{size:10_485_761,arrayBuffer:()=>{throw Error();}}]);assert.equal(session.snapshot().code,'FILE_TOO_LARGE');
  await session.select([new File(['GIF89a'],'fake.jpg')]);assert.equal(session.snapshot().code,'FORMAT_UNSUPPORTED');
  await session.select([file(4001,3000)]);assert.equal(session.snapshot().code,'IMAGE_TOO_LARGE');assert.equal(calls.decoded,0);
  await session.select([file()]);assert.equal(session.snapshot().settings.value,'1920');assert.deepEqual(session.snapshot().dimensions.value,{width:1920,height:1280});
  session.update({quality:'NaN'});await session.generate();assert.equal(session.snapshot().status,'success'); // PNG ignores quality
  session.update({value:'1200'});assert.equal(session.snapshot().output,null);assert.equal(calls.revoked.length,1);
  session.update({mime:'image/jpeg'});await session.generate();assert.equal(session.snapshot().code,'QUALITY_INVALID');
  session.clear();assert.equal(session.snapshot().source,null);assert.equal(calls.closed,1);assert.equal(session.sourceBitmap(),null);
});
test('IM-14 late A cannot overwrite B or create a stale URL after cancel; source survives encoding cancel',async()=>{
  const a=deferred(),b=deferred();let count=0;
  const {session,calls}=fixture({encode:()=>++count===1?a.promise:b.promise});await session.select([file()]);
  const jobA=session.generate();assert.equal(session.snapshot().status,'encoding');assert.equal(session.update({value:'1'}),false);
  session.cancel();assert.equal(session.snapshot().status,'ready');assert.ok(session.sourceBitmap());assert.equal(session.snapshot().output,null);
  const jobB=session.generate();b.resolve(new Blob(['B'],{type:'image/png'}));await jobB;
  const current=session.snapshot().output.url;a.resolve(new Blob(['A'],{type:'image/png'}));await jobA;
  assert.equal(session.snapshot().output.url,current);assert.equal(calls.created.length,1);session.clear();assert.equal(calls.closed,1);assert.equal(calls.revoked.length,1);
});
test('late bitmap is closed; cancellation during file read skips decode',async()=>{
  const decode=deferred();const {session,calls,bitmap}=fixture({decode:()=>decode.promise});const selecting=session.select([file()]);
  await Promise.resolve();await Promise.resolve();assert.equal(session.snapshot().status,'decoding');session.cancel();decode.resolve(bitmap());await selecting;
  assert.equal(session.snapshot().status,'idle');assert.equal(calls.closed,1);assert.equal(session.snapshot().source,null);
  const read=deferred();const pending=session.select([{size:1,arrayBuffer:()=>read.promise}]);session.cancel();read.resolve(new ArrayBuffer(1));await pending;assert.equal(session.snapshot().status,'idle');
});
test('fallback, null/empty blobs, decode rejection, mismatch and clear while encoding',async()=>{
  const {session}=fixture();await session.select([file()]);session.update({mime:'image/webp'});await session.generate();assert.equal(session.snapshot().output.filename,'image-1920x1280.png');assert.equal(session.snapshot().notice,'FORMAT_FALLBACK');
  for(const result of [null,new Blob([],{type:'image/png'}),new Blob(['x'],{type:'image/jpeg'})]) {const f=fixture({encode:async()=>result});await f.session.select([file()]);await f.session.generate();assert.equal(f.session.snapshot().code,'ENCODE_FAILED');assert.equal(f.session.snapshot().output,null);}
  const bad=fixture({decode:async()=>{throw Error('private exception');}});await bad.session.select([file()]);assert.equal(bad.session.snapshot().code,'IMAGE_CORRUPT');
  const pending=deferred();const f=fixture({encode:()=>pending.promise});await f.session.select([file()]);const generation=f.session.generate();f.session.clear();pending.resolve(new Blob(['x'],{type:'image/png'}));await generation;assert.equal(f.calls.created.length,0);assert.equal(f.session.snapshot().status,'idle');
  assert.equal(nextJob(0),1);assert.throws(()=>nextJob(Number.MAX_SAFE_INTEGER),/JOB_ID_EXHAUSTED/);
});

// These adapters are explicitly FAKE: native codec feasibility is a separate browser gate.
function targetFixture(result=()=>({size:100,type:'image/jpeg'})) {
  let now=0,timerId=0,owner=null;const calls=[],timers=new Map(),allTimers=[],urls=new Set(),released=[],bitmaps=new Set();
  let closed=0,created=0,maxTimers=0;
  const session=createImageSession({webp:true,clock:()=>now,
    setTimer:(callback,delay)=>{assert.equal(delay,30000);const timer={id:++timerId,callback};timers.set(timer.id,timer);allTimers.push(timer);maxTimers=Math.max(maxTimers,timers.size);return timer.id;},
    clearTimer:id=>timers.delete(id),
    decode:async()=>{const bitmap={width:22,height:11,close:()=>{assert.ok(bitmaps.delete(bitmap));closed++;}};bitmaps.add(bitmap);return bitmap;},
    encode:(bitmap,options)=>{owner=options.jobId;calls.push({bitmap,...options});return result(options,calls.length);},
    releaseExport:id=>{if(owner!==null){assert.equal(id,owner,'late owner must never release current canvas');released.push(id);owner=null;}},
    createURL:()=>{const url=`blob:fake-target-${++created}`;urls.add(url);return url;},revokeURL:url=>assert.ok(urls.delete(url))});
  return {session,calls,timers,allTimers,urls,released,bitmaps,
    advance:value=>{now+=value;},fire:timer=>timer.callback(),owner:()=>owner,
    counts:()=>({closed,created,maxTimers,activeTimers:timers.size,activeURLs:urls.size,activeBitmaps:bitmaps.size}),
    select:async(changes={})=>{assert.equal((await session.select([file(22,11)])).ok,true);assert.equal(session.update({mode:'width',value:'15',mime:'image/jpeg',quality:'85',targetEnabled:true,targetRaw:'200',targetUnit:'kB',...changes}),true);}};
}
async function drainUntil(predicate) {for(let i=0;i<30&&!predicate();i++) await Promise.resolve();assert.ok(predicate(),'expected async stage was reached');}
test('U09 FAKE first exact match is serial, retains 15x8 and records numeric metrics only',async()=>{
  let concurrent=0,maxConcurrent=0;
  const f=targetFixture(async(options,index)=>{maxConcurrent=Math.max(maxConcurrent,++concurrent);await Promise.resolve();concurrent--;f.advance(5);return {size:[300000,250000,199999][index-1],type:options.mime};});
  await f.select();assert.deepEqual(await f.session.generate(),{ok:true});
  assert.deepEqual(f.calls.map(call=>call.quality),[.85,.80,.70]);assert.ok(f.calls.every(call=>call.width===15&&call.height===8&&call.bitmap===f.calls[0].bitmap));assert.equal(maxConcurrent,1);
  const state=f.session.snapshot();assert.equal(state.output.bytes,199999);assert.equal(state.output.quality,70);assert.equal(state.metrics.attempts,3);assert.equal(state.metrics.minBytes,199999);assert.equal(state.metrics.minQuality,70);assert.equal(state.metrics.elapsedMs,15);
  assert.ok(Object.values(state.metrics).every(value=>value===null||typeof value==='number'));assert.equal(f.counts().created,1);assert.equal(f.counts().activeTimers,0);assert.equal(f.counts().maxTimers,1);assert.equal(f.owner(),null);
  state.metrics.attempts=100;assert.equal(f.session.snapshot().metrics.attempts,3);f.session.clear();assert.equal(f.counts().activeURLs,0);
});
test('U09 FAKE exact bytes equality succeeds; target+1 retries despite same rounded KiB',async()=>{
  for(const first of [204800,204801]) {
    const f=targetFixture((options,index)=>({size:index===1?first:204799,type:options.mime}));await f.select({targetRaw:'204800',targetUnit:'bytes'});await f.session.generate();
    assert.equal(f.calls.length,first===204800?1:2);assert.equal(f.session.snapshot().output.bytes,first===204800?204800:204799);assert.equal(Math.round(first/1024),200);f.session.clear();
  }
});
test('U09 FAKE nonmonotonic over-limit candidates exhaust exactly nine and retain measured minimum',async()=>{
  const sizes=[500,450,600,350,400,300,310,280,290],f=targetFixture((options,index)=>({size:sizes[index-1],type:options.mime}));
  await f.select({targetRaw:'100',targetUnit:'bytes'});assert.deepEqual(await f.session.generate(),{ok:false,code:'TARGET_NOT_MET'});
  const state=f.session.snapshot();assert.equal(f.calls.length,9);assert.equal(state.metrics.minBytes,280);assert.equal(state.metrics.minQuality,10);assert.equal(state.output,null);assert.ok(f.session.sourceBitmap());assert.equal(f.counts().activeTimers,0);assert.equal(f.counts().created,0);assert.equal(f.owner(),null);f.session.clear();
});
test('U09 FAKE Q99/Q100 never exceed twelve attempts; Q1 is one attempt',async()=>{
  for(const q of [99,100,1]) {const f=targetFixture();await f.select({quality:String(q),targetRaw:'1',targetUnit:'bytes'});await f.session.generate();assert.equal(f.calls.length,q===1?1:12);assert.equal(f.session.snapshot().code,'TARGET_NOT_MET');assert.equal(f.counts().created,0);assert.equal(f.counts().activeTimers,0);f.session.clear();}
});
test('U09 FAKE PNG encodes once without quality; WebP-to-PNG stops on either side of exact target',async()=>{
  for(const mime of ['image/png','image/webp']) for(const target of ['100','99']) {
    const f=targetFixture(()=>({size:100,type:'image/png'}));await f.select({mime,quality:mime==='image/png'?'NaN':'85',targetRaw:target,targetUnit:'bytes'});await f.session.generate();
    const state=f.session.snapshot();assert.equal(f.calls.length,1);assert.equal(f.calls[0].quality,mime==='image/png'?undefined:.85);assert.equal(state.metrics.minQuality,null);assert.equal(state.notice,mime==='image/webp'?'FORMAT_FALLBACK':null);
    if(target==='100') {assert.equal(state.status,'success');assert.equal(state.output.filename,'image-15x8.png');assert.equal(state.output.quality,null);} else {assert.equal(state.code,'TARGET_NOT_MET');assert.equal(state.output,null);assert.equal(f.counts().created,0);}
    assert.equal(f.counts().activeTimers,0);f.session.clear();
  }
});
test('U09 FAKE invalid blob/MIME/encoder failure stops immediately with neutral error',async()=>{
  const invalid=[null,{size:0,type:'image/jpeg'},{size:1.5,type:'image/jpeg'},{size:Number.MAX_SAFE_INTEGER+1,type:'image/jpeg'},{size:100,type:'image/png'},{size:100,type:'text/html'},'throw'];
  for(const value of invalid) {
    const f=targetFixture((options,index)=>{if(index===1)return {size:300000,type:options.mime};if(value==='throw')throw Error('synthetic-private-error');return value;});await f.select();await f.session.generate();
    assert.equal(f.calls.length,2);assert.equal(f.session.snapshot().code,'ENCODE_FAILED');assert.equal(f.session.snapshot().output,null);assert.equal(f.counts().created,0);assert.equal(f.counts().activeTimers,0);assert.ok(!JSON.stringify(f.session.snapshot()).includes('synthetic-private-error'));f.session.clear();
  }
  for(const mime of ['image/png','image/webp']) {const f=targetFixture(()=>({size:10,type:'image/jpeg'}));await f.select({mime});await f.session.generate();assert.equal(f.calls.length,1);assert.equal(f.session.snapshot().code,'ENCODE_FAILED');f.session.clear();}
});
test('U09 FAKE invalid enabled target encodes zero; disabling ignores draft; select/clear reset kB',async()=>{
  const f=targetFixture(()=>({size:10,type:'image/png'}));await f.select({mime:'image/png',targetEnabled:false});await f.session.generate();assert.equal(f.counts().activeURLs,1);
  for(const [raw,unit] of [['','kB'],['200','KB'],['200',undefined],['0','bytes'],['1e5','kB'],['10241','KiB']]) {
    f.session.update({targetEnabled:true,targetRaw:raw,targetUnit:unit});assert.equal(f.session.snapshot().output,null);assert.equal(f.session.snapshot().target.ok,false);await f.session.generate();assert.equal(f.session.snapshot().code,'TARGET_SIZE_INVALID');assert.equal(f.calls.length,1);
  }
  f.session.update({targetEnabled:false});await f.session.generate();assert.equal(f.calls.length,2);assert.equal(f.session.snapshot().metrics,null);assert.equal(f.session.snapshot().settings.targetRaw,'10241');assert.equal(f.session.update({targetEnabled:1}),false);
  await f.session.select([file(22,11)]);assert.equal(f.session.snapshot().settings.targetEnabled,false);assert.equal(f.session.snapshot().settings.targetRaw,'');assert.equal(f.session.snapshot().settings.targetUnit,'kB');f.session.clear();assert.equal(f.counts().activeBitmaps,0);
});
test('U09 FAKE cancelled candidate two and expired A timer cannot release a pending B canvas',async()=>{
  const a=deferred(),b=deferred();const f=targetFixture((options,index)=>index===1?{size:300000,type:options.mime}:index===2?a.promise:b.promise);
  await f.select();const jobA=f.session.generate();await drainUntil(()=>f.calls.length===2);const oldTimer=f.allTimers[0];const ownerA=f.owner();
  assert.equal(f.session.update({targetRaw:'1'}),false);f.session.cancel();assert.equal(f.session.snapshot().status,'ready');assert.equal(f.session.snapshot().metrics,null);assert.equal(f.counts().activeTimers,0);assert.ok(f.session.sourceBitmap());assert.deepEqual(await jobA,{ok:false,code:'CANCELLED'});
  f.session.update({targetRaw:'1000',targetUnit:'bytes'});const jobB=f.session.generate();const ownerB=f.owner();assert.notEqual(ownerA,ownerB);const released=f.released.length;
  a.resolve({size:1,type:'image/jpeg'});f.fire(oldTimer);await drainUntil(()=>f.calls.length===3);await Promise.resolve();await Promise.resolve();
  assert.equal(f.owner(),ownerB);assert.equal(f.released.length,released);assert.equal(f.counts().created,0);assert.equal(f.counts().activeTimers,1);assert.equal(f.session.snapshot().status,'encoding');
  b.resolve({size:900,type:'image/jpeg'});assert.deepEqual(await jobB,{ok:true});assert.equal(f.calls.filter(call=>call.jobId===ownerA).length,2);assert.equal(f.counts().created,1);f.session.clear();assert.equal(f.counts().activeTimers,0);assert.equal(f.counts().activeBitmaps,0);
});
test('U09 FAKE 29.999s succeeds; timer-first and elapsed 30s reject valid late blobs',async()=>{
  for(const stage of ['before','timer','elapsed','blob-ready-before-timer-microtask']) {
    const pending=deferred();const f=targetFixture(()=>pending.promise);await f.select({targetRaw:'100',targetUnit:'bytes'});const generation=f.session.generate();const timer=f.allTimers[0];
    if(stage==='blob-ready-before-timer-microtask') {pending.resolve({size:1,type:'image/jpeg'});await Promise.resolve();}
    f.advance(stage==='before'?29999:30000);if(stage==='timer'||stage==='blob-ready-before-timer-microtask') {f.fire(timer);assert.equal(f.session.snapshot().code,'ENCODE_TIMEOUT');assert.equal(f.counts().activeTimers,0);assert.deepEqual(await generation,{ok:false,code:'ENCODE_TIMEOUT'});}
    pending.resolve({size:1,type:'image/jpeg'});const result=await generation;
    if(stage==='before') {assert.equal(result.ok,true);assert.equal(f.counts().created,1);}else {assert.equal(result.code,'ENCODE_TIMEOUT');assert.equal(f.session.snapshot().output,null);assert.equal(f.counts().created,0);assert.ok(f.session.sourceBitmap());}
    assert.equal(f.counts().activeTimers,0);assert.equal(f.owner(),null);f.session.clear();
  }
});
test('U09 FAKE clear/new source invalidate late jobs and reset all owned resources',async()=>{
  for(const action of ['clear','select']) {
    const pending=deferred();const f=targetFixture(()=>pending.promise);await f.select();const generation=f.session.generate();const timer=f.allTimers[0];
    if(action==='clear') f.session.clear();else await f.session.select([file(22,11)]);
    assert.equal(f.session.snapshot().metrics,null);assert.equal(f.session.snapshot().settings.targetEnabled,false);assert.equal(f.session.snapshot().settings.targetUnit,'kB');assert.equal(f.counts().activeTimers,0);
    pending.resolve({size:1,type:'image/jpeg'});f.fire(timer);await generation;assert.equal(f.counts().created,0);assert.equal(f.session.snapshot().status,action==='clear'?'idle':'ready');f.session.clear();assert.equal(f.counts().activeBitmaps,0);assert.equal(f.owner(),null);
  }
});
test('U09 FAKE disabled target preserves ordinary single-codec path, including fallback',async()=>{
  for(const mime of ['image/png','image/jpeg','image/webp']) {
    const f=targetFixture(options=>({size:500000,type:options.mime==='image/webp'?'image/png':options.mime}));await f.select({mime,targetEnabled:false,targetRaw:'invalid',targetUnit:'KB'});await f.session.generate();
    assert.equal(f.calls.length,1);assert.equal(f.calls[0].quality,mime==='image/png'?undefined:.85);assert.equal(f.session.snapshot().status,'success');assert.equal(f.session.snapshot().metrics,null);assert.equal(f.counts().maxTimers,0);f.session.clear();
  }
});
