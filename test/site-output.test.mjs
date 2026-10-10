import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {resolve} from 'node:path';
import {projectRoot} from '../scripts/serve.mjs';import {buildOptions,pageOutput,siteExtras,candidateSite} from '../scripts/site-output.mjs';import {strings as en} from '../public/js/locales/en.mjs';import {strings as zh} from '../public/js/locales/zh-Hant.mjs';
test('preview stays noindex; release requires explicit authorized origin and reciprocal SEO',async()=>{
  const preview=buildOptions([]);assert.equal(preview.release,false);const release=buildOptions(['--release',`--site=${candidateSite}`]);
  for(const args of [['--release'],[`--site=${candidateSite}`],['--release','--site=https://example.com'],['--unknown'],['--release','--release',`--site=${candidateSite}`]]) assert.throws(()=>buildOptions(args));
  for(const page of ['index.html','en/index.html']){const html=await readFile(resolve(projectRoot,'public',page),'utf8');assert.equal(pageOutput(html,page,preview),html);const result=pageOutput(html,page,release);assert.ok(!result.includes('noindex'));assert.ok(result.includes(`href="${candidateSite}/${page}"`));for(const lang of ['zh-Hant','en','x-default']) assert.ok(result.includes(`rel="alternate" hreflang="${lang}"`));}
  assert.equal(siteExtras(preview)['sitemap.xml'],undefined);assert.ok(siteExtras(preview)['_headers'].includes('X-Robots-Tag: noindex'));assert.ok(siteExtras(release)['robots.txt'].includes('Allow: /'));assert.throws(()=>pageOutput('<html></html>','index.html',release));
});
test('both languages contain matching controls, help and complete runtime copy',async()=>{
  assert.deepEqual(Object.keys(en).sort(),Object.keys(zh).sort());assert.deepEqual(Object.keys(en.errors).sort(),Object.keys(zh.errors).sort());assert.deepEqual(Object.keys(en.messages).sort(),Object.keys(zh.messages).sort());
  const zhHtml=await readFile(resolve(projectRoot,'public/index.html'),'utf8'),enHtml=await readFile(resolve(projectRoot,'public/en/index.html'),'utf8');
  const ids=text=>[...text.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]).sort();assert.deepEqual(ids(zhHtml),ids(enHtml));assert.equal(new Set(ids(enHtml)).size,ids(enHtml).length);
  assert.equal((zhHtml.match(/<h1>/g)||[]).length,1);assert.equal((enHtml.match(/<h1>/g)||[]).length,1);assert.equal((enHtml.match(/<summary>/g)||[]).length,5);
  assert.ok(zhHtml.includes('href="./en/index.html"'));assert.ok(enHtml.includes('href="../index.html"'));
  for(const text of [...Object.values(en.errors),...Object.values(en.messages),en.success('1','1','PNG','4 bytes')]) assert.ok(!/[\u3400-\u9fff]/.test(text));
});
