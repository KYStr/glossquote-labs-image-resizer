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
