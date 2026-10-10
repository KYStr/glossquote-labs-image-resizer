import { copyFile, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { auditPublic } from './check.mjs';
import { projectRoot, within } from './serve.mjs';
import {buildOptions,pageOutput,siteExtras} from './site-output.mjs';
const options=buildOptions(process.argv.slice(2));
const root = await realpath(projectRoot);
const source = resolve(root, 'public');
const destination = resolve(root, 'dist');
const files = await auditPublic(source);
if (!within(root, destination) || relative(root, destination) !== 'dist') throw new Error('BUILD_PATH_REJECTED');
try { if ((await lstat(destination)).isSymbolicLink() || await realpath(destination) !== destination) throw new Error('BUILD_LINK_REJECTED'); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
await rm(destination, { recursive: true, force: true });
await mkdir(destination);
for (const file of files) {
  const target = resolve(destination, relative(source, file));
  if (!within(destination, target)) throw new Error('BUILD_PATH_REJECTED');
  await mkdir(dirname(target), { recursive: true });
  if(file.endsWith('.html')) await writeFile(target,pageOutput(await readFile(file,'utf8'),relative(source,file).replaceAll('\\','/'),options));
  else await copyFile(file, target);
}
for(const [path,content] of Object.entries(siteExtras(options))) await writeFile(resolve(destination,path),content);
console.log(`BUILD PASS: ${files.length} public files + hosting/SEO outputs; ${options.release?'release candidate (not deployed)':'preview noindex'}`);
