import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTargetSize, normalizeTargetBytes, qualityCandidates, TARGET_DEADLINE_MS } from '../public/js/core/target-size.mjs';

test('U09 target units preserve raw integer intent and exact byte boundaries',()=>{
  for(const [raw,unit,expected] of [['200','kB',200000],['200','KiB',204800],['1','bytes',1],['10240','KiB',10485760],['10485','kB',10485000],['10485760','bytes',10485760],[' \t204800\r ','bytes',204800]]) {
    assert.deepEqual(normalizeTargetSize(raw,unit),{ok:true,value:expected});
  }
  assert.equal(normalizeTargetSize('200','kB').value,200000);
  for(const raw of ['1','200000',' 204800 ','10485760']) assert.equal(normalizeTargetBytes(raw).ok,true);
  for(const [raw,unit] of [['10241','KiB'],['10486','kB'],['10485761','bytes'],['200','KB'],['1','__proto__'],['1',null],['1',undefined]]) assert.equal(normalizeTargetSize(raw,unit).code,'TARGET_SIZE_INVALID');
});
test('U09 target parser rejects signs, decimals, exponent, Unicode whitespace/digits and overlong raw',()=>{
  for(const raw of ['', '0','00000000','+1','-1','1.5','1e5','NaN','Infinity','２００','\u00a01\u00a0','\u20031','123456789',' '.repeat(16)+'1',1,null,undefined]) {
    assert.equal(normalizeTargetBytes(raw).code,'TARGET_SIZE_INVALID');
  }
  assert.equal(normalizeTargetBytes('00000001').value,1);
});
test('U09 quality candidate plan is strict descending, unique and at most twelve',()=>{
  assert.deepEqual(qualityCandidates(85).value,[85,80,70,60,50,40,25,10,1]);
  assert.deepEqual(qualityCandidates(99).value,[99,95,90,85,80,70,60,50,40,25,10,1]);
  assert.deepEqual(qualityCandidates(100).value,[100,95,90,85,80,70,60,50,40,25,10,1]);
  assert.deepEqual(qualityCandidates(1).value,[1]);
  for(let q=1;q<=100;q++) {const plan=qualityCandidates(q).value;assert.equal(plan[0],q);assert.ok(plan.length<=12);assert.equal(new Set(plan).size,plan.length);assert.ok(plan.every((value,index)=>index===0||value<plan[index-1]));}
  for(const q of [0,101,NaN,Infinity,85.1,'85',null,undefined]) assert.equal(qualityCandidates(q).code,'QUALITY_INVALID');
  assert.equal(TARGET_DEADLINE_MS,30000);
});
