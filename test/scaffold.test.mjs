import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createStaticServer, projectRoot, within } from '../scripts/serve.mjs';
import { auditPublic } from '../scripts/check.mjs';
test('ESM commands and real noindex scaffold', async () => {
  const pkg = JSON.parse(await readFile(resolve(projectRoot, 'package.json')));
  assert.equal(pkg.private, true); assert.equal(pkg.type, 'module');
  for (const command of ['dev', 'test', 'check', 'build']) assert.ok(pkg.scripts[command]);
  const html = await readFile(resolve(projectRoot, 'public/index.html'), 'utf8');
  assert.match(html, /<h1>/); assert.match(html, /noindex,nofollow/);
  assert.ok((await auditPublic()).length >= 4);
  assert.equal(within(projectRoot, `${projectRoot}-sibling`), false);
});
test('loopback server rejects traversal, uploads, dotfiles and private paths', async t => {
  const server = createStaticServer();
  await new Promise(yes => server.listen(0, '127.0.0.1', yes));
  t.after(() => new Promise(yes => server.close(yes)));
  assert.equal(server.address().address, '127.0.0.1');
  const request = (path, method = 'GET') => new Promise((yes, no) => {
    const req = http.request({ host: '127.0.0.1', port: server.address().port, path, method }, res => { res.resume(); res.on('end', () => yes({ status: res.statusCode, headers: res.headers })); });
    req.on('error', no); req.end();
  });
  const home = await request('/');
  assert.equal(home.status, 200); assert.match(home.headers['content-type'], /text\/html/);
  assert.equal(home.headers['x-robots-tag'], 'noindex, nofollow');
  assert.equal(home.headers['x-content-type-options'], 'nosniff');
  assert.match(home.headers['content-security-policy'], /connect-src 'none'/);
  assert.equal((await request('/js/app.mjs')).status, 200);
  assert.equal((await request('/', 'POST')).status, 405);
  assert.equal((await request('/', 'HEAD')).status, 200);
  for (const path of ['/../package.json', '/%2e%2e/package.json', '/.git/config', '/%5c..%5cpackage.json', '/%00', '/%zz', '/%252e%252e/package.json']) assert.ok([400, 403].includes((await request(path)).status), path);
  for (const path of ['/package.json', '/docs/BRAND.md', '/test/browser-fixtures.html', '/styles/', '/missing.html']) assert.equal((await request(path)).status, 404, path);
});
