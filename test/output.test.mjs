import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeQuality,resolveOutput} from '../public/js/core/output.mjs';
test('IM-08 quality is an integer percentage',()=>{
  assert.equal(normalizeQuality('85').value,.85);assert.equal(normalizeQuality('1').value,.01);assert.equal(normalizeQuality('100').value,1);
  for(const text of ['0','101','NaN','1.5','1e2','',' 85',85]) assert.equal(normalizeQuality(text).code,'QUALITY_INVALID');
});
test('IM-12 filenames always follow actual MIME; unexpected codecs fail closed',()=>{
  const png=resolveOutput('image/webp','image/png',1920,1280);assert.equal(png.value.notice,'FORMAT_FALLBACK');assert.equal(png.value.filename,'image-1920x1280.png');
  assert.equal(resolveOutput('image/jpeg','image/jpeg',1,1).value.filename,'image-1x1.jpg');
  for(const [requested,actual] of [['image/jpeg','image/png'],['image/png','image/jpeg'],['image/webp','image/jpeg'],['image/png','text/html'],['bad','image/png']]) assert.equal(resolveOutput(requested,actual,1,1).code,'ENCODE_FAILED');
});
