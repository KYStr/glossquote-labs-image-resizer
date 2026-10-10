import {csp} from './serve.mjs';
export const candidateSite='https://images.glossquote.com';
export const pages=[{path:'index.html',lang:'zh-Hant'},{path:'en/index.html',lang:'en'}];
export function buildOptions(args) {
  if(args.some(arg=>arg!=='--release'&&!arg.startsWith('--site='))||args.filter(arg=>arg==='--release').length>1||args.filter(arg=>arg.startsWith('--site=')).length>1) throw Error('BUILD_ARGUMENT_REJECTED');
  const release=args.includes('--release');const site=args.find(arg=>arg.startsWith('--site='))?.slice(7);
  if(release&&site!==candidateSite||!release&&site!==undefined) throw Error('RELEASE_SITE_REQUIRED');
  return {release,site:release?site:null};
}
export function pageOutput(html,page,{release,site}) {
  if((html.match(/<meta name="robots" content="noindex,nofollow">/g)||[]).length!==1||/rel="(?:canonical|alternate)"/.test(html)) throw Error('PREVIEW_SEO_REQUIRED');
  if(!release) return html;
  if(site!==candidateSite) throw Error('RELEASE_SITE_REQUIRED');
  if(page==='404.html') return html.replace('href="./index.html"',`href="${site}/index.html"`).replace('href="./en/index.html"',`href="${site}/en/index.html"`);
  if(!pages.some(p=>p.path===page)) throw Error('PAGE_REJECTED');
  const links=`  <link rel="canonical" href="${site}/${page}">\n${[...pages.map(p=>({lang:p.lang,path:p.path})),{lang:'x-default',path:'index.html'}].map(p=>`  <link rel="alternate" hreflang="${p.lang}" href="${site}/${p.path}">`).join('\n')}`;
  return html.replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow">').replace('</head>',`${links}\n</head>`);
}
export function siteExtras({release,site}) {
  const headers=`/*\n  Content-Security-Policy: ${csp}\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: no-referrer\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n${release?'':'  X-Robots-Tag: noindex, nofollow\n'}\n/js/*\n  Content-Type: text/javascript; charset=utf-8\n\n/styles/*\n  Content-Type: text/css; charset=utf-8\n\n/404.html\n  X-Robots-Tag: noindex, nofollow\n`;
  const extras={'_headers':headers,'_redirects':'/ /index.html 301\n/en /en/index.html 301\n/en/ /en/index.html 301\n','robots.txt':release?`User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`:'User-agent: *\nDisallow: /\n'};
  if(release) extras['sitemap.xml']=`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${pages.map(page=>`  <url><loc>${site}/${page.path}</loc>${[...pages,{path:'index.html',lang:'x-default'}].map(p=>`<xhtml:link rel="alternate" hreflang="${p.lang}" href="${site}/${p.path}"/>`).join('')}</url>`).join('\n')}\n</urlset>\n`;
  return extras;
}
