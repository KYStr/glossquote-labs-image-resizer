import { lstat, readdir, readFile, realpath } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, extname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { projectRoot, within } from './serve.mjs';

export async function listFiles(root) {
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isSymbolicLink() || (await lstat(path)).isSymbolicLink()) throw new Error('SYMLINK_REJECTED');
      if (!within(root, await realpath(path))) throw new Error('PATH_ESCAPE');
      if (entry.isDirectory()) await walk(path); else if (entry.isFile()) files.push(path); else throw new Error('FILE_TYPE_REJECTED');
    }
  }
  await walk(root);
  return files.sort();
}
export async function auditPublic(root = resolve(projectRoot, 'public')) {
  const files = await listFiles(root);
  for (const required of ['index.html', 'styles/tokens.css', 'styles/app.css', 'js/app.mjs']) if (!files.includes(resolve(root, required))) throw new Error(`MISSING_FILE: ${required}`);
  for (const file of files) {
    if (!['.html', '.css', '.mjs', '.js', '.json', '.txt', '.xml', '.svg', '.png', '.jpg', '.webp'].includes(extname(file))) throw new Error('PUBLIC_FILE_REJECTED');
    if (relative(root,file).split(/[\\/]/).some(p => p.startsWith('.'))) throw new Error('DOTFILE_REJECTED');
    if (!['.html', '.css', '.mjs', '.js', '.svg'].includes(extname(file))) continue;
    const content = await readFile(file, 'utf8');
    if (/\b(?:innerHTML|outerHTML|insertAdjacentHTML|eval)\b|new\s+Function\b|\b(?:fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|serviceWorker)\b/.test(content)) throw new Error(`UNSAFE_API: ${file}`);
    if (/<\w+[^>]*\son\w+\s*=|<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?\S[\s\S]*?<\/script>/i.test(content)) throw new Error('INLINE_SCRIPT_REJECTED');
    if (/@import|url\(\s*['"]?(?:https?:|\/\/|data:)|\b(?:src|action)\s*=\s*['"](?:https?:|\/\/|data:)/i.test(content)) throw new Error('REMOTE_RESOURCE_REJECTED');
    const references = [];
    if (extname(file) === '.html') for (const match of content.matchAll(/\b(?:src|href)\s*=\s*['"]([^'"]+)['"]/g)) { if (!/^(?:https:|#)/.test(match[1])) references.push(match[1]); }
    if (['.mjs', '.js'].includes(extname(file))) for (const match of content.matchAll(/\b(?:from\s*|import\s*(?:\(\s*)?)['"]([^'"]+)['"]/g)) references.push(match[1]);
    if (extname(file)==='.css') for(const match of content.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) references.push(match[1]);
    for (const reference of references) {
      if (!reference.startsWith('.') || /[?#]/.test(reference)) throw new Error('RESOURCE_PATH_REJECTED');
      const target = resolve(dirname(file), reference);
      if (!within(root, target) || !files.includes(target)) throw new Error(`MISSING_REFERENCE: ${reference}`);
    }
  }
  return files;
}
export async function check() {
  await auditPublic();
  for (const dir of ['public', 'scripts', 'test']) for (const file of await listFiles(resolve(projectRoot, dir))) {
    if (!['.mjs', '.js'].includes(extname(file))) continue;
    const result = spawnSync(process.execPath, ['--check', file], { shell: false, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(`SYNTAX_FAILED: ${file}`);
  }
  console.log('CHECK PASS: syntax, public files, references, resource and DOM rules');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) check().catch(error => { console.error(error.message); process.exitCode = 1; });
