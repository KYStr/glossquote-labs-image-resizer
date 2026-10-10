import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const csp = "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
export const mimeTypes = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
export function within(root, target) {
  const rel = relative(root, target);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
}
export function createStaticServer(root = resolve(projectRoot, 'public'), { preview = true, policy = csp } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('Content-Security-Policy', policy);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store');
    if (preview) res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    const send = (status, text) => { res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end(req.method === 'HEAD' ? undefined : text); };
    const notFound=async()=>{
      try {
        const canonicalRoot=await realpath(root),file=await realpath(resolve(root,'404.html'));
        if(!within(canonicalRoot,file)||!(await stat(file)).isFile()) return send(404,'Not found');
        const text=(await readFile(file,'utf8')).replace('href="./index.html"','href="/index.html"').replace('href="./en/index.html"','href="/en/index.html"');
        res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end(req.method==='HEAD'?undefined:text);
      } catch {send(404,'Not found');}
    };
    if (!['GET', 'HEAD'].includes(req.method)) { res.setHeader('Allow', 'GET, HEAD'); return send(405, 'Method not allowed'); }
    try {
      const raw = req.url.split('?')[0];
      if (raw.length > 2048 || !raw.startsWith('/')) return send(400, 'Invalid path');
      const path = decodeURIComponent(raw);
      if (/[\\\0:%\x01-\x1f]/.test(path)) return send(400, 'Invalid path');
      if (path.split('/').some(part => part === '..' || part === '.' || part.startsWith('.'))) return send(403, 'Forbidden');
      const target = resolve(root, `.${path.endsWith('/') ? `${path}index.html` : path}`);
      if (!within(root, target)) return send(403, 'Forbidden');
      const type = mimeTypes[extname(target)];
      if (!type) return notFound();
      const canonicalRoot = await realpath(root);
      const canonicalTarget = await realpath(target);
      if (!within(canonicalRoot, canonicalTarget)) return send(403, 'Forbidden');
      if (!(await stat(canonicalTarget)).isFile()) return notFound();
      const content = await readFile(canonicalTarget);
      res.writeHead(200, { 'Content-Type': type, 'Content-Length': content.length });
      res.end(req.method === 'HEAD' ? undefined : content);
    } catch (error) { return error instanceof URIError?send(400,'Invalid path'):notFound(); }
  });
}
export async function startServer(root, defaultPort, options = {}) {
  const portArg = process.argv.find(arg => arg.startsWith('--port='));
  const port = portArg ? Number(portArg.slice(7)) : defaultPort;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('INVALID_PORT');
  const server = createStaticServer(root, options);
  const listen = p => new Promise((yes, no) => { server.once('error', no); server.listen(p, '127.0.0.1', () => { server.removeListener('error', no); yes(); }); });
  try { await listen(port); } catch (error) { if (error.code !== 'EADDRINUSE' || portArg) throw error; await listen(0); }
  console.log(`Preview: http://127.0.0.1:${server.address().port}/ (noindex)`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  startServer(resolve(projectRoot, 'public'), 4189).catch(() => { console.error('SERVER_START_FAILED'); process.exitCode = 1; });
}
