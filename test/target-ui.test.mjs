import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { strings as en } from '../public/js/locales/en.mjs';
import { strings as zh } from '../public/js/locales/zh-Hant.mjs';
test('U09 UI exposes explicit units, blank opt-in limit and associated field feedback in both languages',async()=>{
  for(const path of ['../public/index.html','../public/en/index.html']) {
    const html=await readFile(new URL(path,import.meta.url),'utf8');
    assert.match(html,/<input id="target-enabled" type="checkbox"[^>]*aria-controls="target-fields"[^>]*>/);
    assert.doesNotMatch(html,/<input id="target-enabled"[^>]*\bchecked\b/);
    assert.match(html,/<input id="target-size"[^>]*maxlength="16"[^>]*value=""[^>]*aria-describedby="target-help target-size-error target-exact"/);
    assert.match(html,/<option value="kB" selected>kB<\/option><option value="KiB">KiB<\/option><option value="bytes">bytes<\/option>/);
    for(const id of ['target-fields','target-exact','target-size-error','target-feedback','target-feedback-info','target-met','target-result-info','quality-label'])assert.ok(html.includes(`id="${id}"`));
  }
});
test('U09 translated dynamic feedback preserves exact target, attempts and actual quality without optimality claims',()=>{
  for(const t of [en,zh]) {
    for(const code of ['TARGET_SIZE_INVALID','TARGET_NOT_MET','ENCODE_TIMEOUT'])assert.ok(t.errors[code]);
    assert.ok(t.targetPreview('200','KiB','204,800').includes('204,800'));
    const result=t.targetResult('200 kB = 200000 bytes','3',t.appliedQuality('70'));assert.ok(result.includes('200000')&&result.includes('70')&&result.includes('3'));
    const failed=t.targetFailure('9','199999 bytes','1',t.appliedQuality('25'));assert.ok(failed.includes('199999')&&failed.includes('9')&&failed.includes('25'));
    const timeout=t.targetTimeout('1','1000','100 bytes');assert.ok(timeout.includes('100 bytes'));assert.doesNotMatch(timeout,/exceed|超出|仍超|未達/);
    assert.doesNotMatch(t.fallbackNeutral,/exceed|超出|仍超|未達/);
  }
  for(const text of [en.targetFailure('9','200000 bytes','1',''),en.targetTimeout('2','200000'),en.targetProgress('2','80',false),en.fallbackFailure])assert.ok(!/[\u3400-\u9fff]/.test(text));
});
