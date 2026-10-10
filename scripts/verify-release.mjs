import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import {resolve,relative} from 'node:path';import {pathToFileURL} from 'node:url';
import {listFiles} from './check.mjs';import {createStaticServer,projectRoot} from './serve.mjs';import {candidateSite,pages} from './site-output.mjs';
export async function verifyRelease() {
  const root=resolve(projectRoot,'dist');const read=path=>readFile(resolve(root,path),'utf8');
  for(const page of pages) {
    const html=await read(page.path);assert.match(html,new RegExp(`<html lang="${page.lang}">`));assert.ok(html.includes('<meta name="robots" content="index,follow">'));assert.ok(!html.includes('noindex'));
    assert.equal((html.match(/rel="canonical"/g)||[]).length,1);assert.ok(html.includes(`rel="canonical" href="${candidateSite}/${page.path}"`));
    for(const alternate of [...pages,{path:'index.html',lang:'x-default'}]) assert.ok(html.includes(`rel="alternate" hreflang="${alternate.lang}" href="${candidateSite}/${alternate.path}"`));
    assert.ok(html.includes(page.lang==='en'?'https://glossquote.com/en/index.html':'https://glossquote.com/index.html'));
    for(const section of ['how-title','limits-title','privacy-title','faq-title']) assert.ok(html.includes(`id="${section}"`));
  }
  const sitemap=await read('sitemap.xml');assert.equal((sitemap.match(/<loc>/g)||[]).length,2);for(const page of pages) assert.ok(sitemap.includes(`<loc>${candidateSite}/${page.path}</loc>`));assert.equal((sitemap.match(/hreflang="x-default"/g)||[]).length,2);assert.ok(!sitemap.includes('404'));
  const robots=await read('robots.txt');assert.ok(robots.includes(`Sitemap: ${candidateSite}/sitemap.xml`)&&!robots.includes('Disallow: /'));
  const headers=await read('_headers');for(const field of ["connect-src 'none'","frame-ancestors 'none'",'X-Content-Type-Options: nosniff','Referrer-Policy: no-referrer','Content-Type: text/javascript']) assert.ok(headers.includes(field));assert.ok(!headers.split('/404.html')[0].includes('noindex'));
  assert.ok((await read('_redirects')).includes('/ /index.html 301'));
  const config=JSON.parse(await readFile(resolve(projectRoot,'wrangler.jsonc'),'utf8'));assert.equal(config.assets.directory,'./dist');assert.equal(config.assets.html_handling,'none');assert.equal(config.assets.not_found_handling,'404-page');assert.equal(config.routes[0].pattern,'images.glossquote.com');assert.equal(config.workers_dev,false);
  const error=await read('404.html');assert.ok(error.includes('noindex')&&error.includes(`${candidateSite}/en/index.html`));
  const files=await listFiles(root);const names=files.map(file=>relative(root,file).replaceAll('\\','/'));
  assert.ok(names.every(name=>!/(?:^|\/)(?:test|docs|node_modules|\.\w+)(?:\/|$)/.test(name)));
  const server=createStaticServer(root,{preview:false});await new Promise(yes=>server.listen(0,'127.0.0.1',yes));
  try {
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const [path,mime] of [['/index.html','text/html'],['/en/index.html','text/html'],['/js/app.mjs','text/javascript'],['/js/locales/en.mjs','text/javascript'],['/styles/app.css','text/css'],['/sitemap.xml','application/xml'],['/robots.txt','text/plain']]) {const response=await fetch(base+path);assert.equal(response.status,200);assert.ok(response.headers.get('content-type').startsWith(mime));assert.equal(response.headers.get('x-content-type-options'),'nosniff');await response.arrayBuffer();}
    const missing=await fetch(base+'/missing/deep/page');assert.equal(missing.status,404);assert.ok((await missing.text()).includes('Page not found'));
  } finally {await new Promise(yes=>server.close(yes));}
  const inventory=[];for(const file of files){const bytes=await readFile(file);inventory.push({path:relative(root,file).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}
  return {status:'PASS',site:candidateSite,hosting:'NOT_DEPLOYED',files:inventory};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) verifyRelease().then(result=>console.log(JSON.stringify(result,null,2))).catch(()=>{console.error('RELEASE_VERIFICATION_FAILED');process.exitCode=1;});
