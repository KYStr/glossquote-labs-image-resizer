import test from 'node:test';import assert from 'node:assert/strict';import {copyFile,mkdir,mkdtemp,rm,writeFile} from 'node:fs/promises';import {dirname,resolve,relative} from 'node:path';
import {projectRoot,within} from '../scripts/serve.mjs';import {auditPublic} from '../scripts/check.mjs';
test('static audit really rejects missing imports, third-party resources, storage and unsafe DOM',async t=>{
  const tempRoot=resolve(projectRoot,'test/.tmp');await mkdir(tempRoot,{recursive:true});const root=await mkdtemp(resolve(tempRoot,'audit-'));
  t.after(async()=>{assert.ok(within(tempRoot,root));await rm(root,{recursive:true,force:true});});
  for(const path of ['index.html','styles/tokens.css','styles/app.css','js/app.mjs']){const dest=resolve(root,path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,path.endsWith('.html')?'<h1>synthetic</h1>':'');}
  assert.equal((await auditPublic(root)).length,4);
  for(const code of ["import './missing.mjs';","import 'https://example.invalid/code.mjs';","import('./missing.mjs');","document.body.innerHTML='synthetic';","localStorage.setItem('synthetic','x');"]){await writeFile(resolve(root,'js/app.mjs'),code);await assert.rejects(()=>auditPublic(root));}
  await writeFile(resolve(root,'js/app.mjs'),'');await writeFile(resolve(root,'index.html'),'<script src="https://example.invalid/code.js"></script>');await assert.rejects(()=>auditPublic(root));
  await writeFile(resolve(root,'index.html'),'<h1>synthetic</h1>');await writeFile(resolve(root,'styles/app.css'),'body{background:url(./missing.png)}');await assert.rejects(()=>auditPublic(root));
});
