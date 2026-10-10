import test from 'node:test';import assert from 'node:assert/strict';
import { deriveDimensions,validateSource } from '../public/js/core/dimensions.mjs';
test('IM-01–06 dimensions, rounding, 1px floor, no enlargement and resource limits',()=>{
  const run=(width,height,mode,value)=>deriveDimensions({width,height,mode,value});
  assert.deepEqual(run(2400,1600,'long-edge','1920').value,{width:1920,height:1280});
  assert.deepEqual(run(100,33,'width','50').value,{width:50,height:17});
  assert.deepEqual(run(1,100,'height','1').value,{width:1,height:1});
  for (const value of ['101','','1e3','1.5','-1',' 50','+50','Infinity','4001']) assert.equal(run(100,100,'width',value).code,'SIZE_INVALID');
  assert.equal(run(4000,3000,'width','4000').ok,false); // 12MP output exceeds 8MP
  assert.deepEqual(run(4000,2000,'width','4000').value,{width:4000,height:2000});
  assert.equal(run(100,100,'other','50').ok,false);
  assert.equal(validateSource({size:10_485_760,width:4000,height:3000}).ok,true);
  assert.equal(validateSource({size:10_485_761,width:1,height:1}).code,'FILE_TOO_LARGE');
  assert.equal(validateSource({size:1,width:4001,height:3000}).code,'IMAGE_TOO_LARGE');
  for (const n of [0,-1,8193,NaN,Infinity,1.5]) assert.equal(validateSource({size:1,width:n,height:1}).ok,false);
});
