import {copyFile,lstat,mkdir,realpath,rm} from 'node:fs/promises';
import {dirname,relative,resolve} from 'node:path';
import {auditPublic} from './check.mjs';import {projectRoot,within} from './serve.mjs';
const root=await realpath(projectRoot);const source=resolve(root,'public');const target=resolve(root,'test/product-fixture');
if(!within(root,target)||relative(root,target)!=='test\\product-fixture'&&relative(root,target)!=='test/product-fixture') throw Error('FIXTURE_PATH_REJECTED');
try{if((await lstat(target)).isSymbolicLink()||await realpath(target)!==target) throw Error('FIXTURE_LINK_REJECTED');}catch(error){if(error.code!=='ENOENT') throw error;}
const files=await auditPublic(source);await rm(target,{recursive:true,force:true});
for(const file of files){const dest=resolve(target,relative(source,file));if(!within(target,dest)) throw Error('FIXTURE_PATH_REJECTED');await mkdir(dirname(dest),{recursive:true});await copyFile(file,dest);}
console.log(`Prepared ${files.length} product source files for same-origin actual browser tests (not in build)`);
