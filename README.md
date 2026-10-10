# 圖片縮放與匯出 / Image resizer

GlossQuote-Labs browser-local single-image tool. Complete Traditional Chinese and English interfaces. No dependencies, accounts, image upload endpoint, telemetry, storage writes or remote fonts.

Accept one static PNG or 8-bit baseline/progressive JPEG up to 10 MiB, 8,192 pixels per edge and 12 MP. Keep proportions, reduce the longest edge/width/height, then explicitly generate PNG, JPEG (white composite) or feature-tested WebP. Maximum target edge 4,000; maximum output 8 MP. View actual MIME/dimensions/bytes before downloading. Cancel, change settings or clear invalidate stale results. Startup checks all eight EXIF directions and actual encoding MIME.

This version does not crop, enlarge, batch, fetch image URLs or accept HEIC, SVG, GIF, animated PNG or WebP input. It does not promise smaller output, preserved original metadata, print DPI/color fidelity or secure memory erasure.

## Local development

Node 24+ (tested v24.14.0), npm 11.9.0. No install step.

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run build
npm.cmd run dev
```

Preview: http://127.0.0.1:4189/index.html and http://127.0.0.1:4189/en/index.html. Bound to loopback, static public only, noindex. If the assigned port is busy the default server uses a system-assigned loopback port and prints it. Explicit override: `npm.cmd run dev -- --port=0`. Stop only this server with Ctrl+C.

Actual synthetic browser acceptance:

```powershell
npm.cmd run fixtures
```

Open http://127.0.0.1:5189/browser-fixtures.html for native EXIF/alpha/codec feasibility, then http://127.0.0.1:5189/product-tests.html for product workflows in either language. Fixtures and generated test/product-fixture are excluded from build/source publication. Never use private photos for tests.

## Release candidate build

Default build stays noindex. Only the explicit, approved candidate origin is accepted for production SEO:

```powershell
npm.cmd run build -- --release --site=https://images.glossquote.com
npm.cmd run verify:release
```

This creates dist with canonical, reciprocal zh-Hant/en/x-default, sitemap/robots, 404, MIME/security `_headers` and root redirects. It **does not deploy**. wrangler.jsonc prepares a static-assets Worker at images.glossquote.com with no dynamic backend, workers.dev or preview URLs. Wrangler is not installed as a project dependency; packaging and live Cloudflare/HTTPS/DNS verification belong to the authorized integration release. This implementation chat did not read credentials or deploy.

Source publication to the independent public repository KYStr/glossquote-labs-image-resizer is separately authorized. Source availability is not a live-website claim. The integration chat owns homepage catalog updates and hosting.

## Verification and privacy

[Acceptance results](docs/TEST-RESULTS.md), [compatibility and official format references](docs/COMPATIBILITY.md), [privacy contract](docs/PRIVACY.md), [release candidate](docs/RELEASE-CANDIDATE.md).

Desktop Chromium 155.0.8059.27 is actually tested. Other browser/device combinations remain unverified; runtime capability checks fail closed. Authorized manual NOT_RUN includes native bitmap/GC profiling, full browser zoom (200% text reflow passed), screen reader, physical mobile/touch, native picker navigation and OS save workflow. No performance, search-indexing or security-certification claim.
