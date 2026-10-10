# Image resizer acceptance evidence

Date: 2026-10-10 (Asia/Taipei). Windows desktop, x86; Codex IAB actual Chromium **155.0.8059.27**, obtained from userAgentData.fullVersionList. Node v24.14.0 / npm 11.9.0. Synthetic geometric fixtures only.

## T03

- npm.cmd test: 11/11 named behavior tests PASS, exit 0. npm.cmd run check: PASS, exit 0. Test command explicitly selects test/*.test.mjs; browser harness and generated product copies are not Node tests.
- `node scripts/prepare-browser-tests.mjs`, `node scripts/serve-fixtures.mjs`: actual product DOM on same-origin synthetic fixture copy at 127.0.0.1:5189. `npm.cmd run dev`: actual public source at 127.0.0.1:4189, noindex.
- T03 machine-readable report: `.runs/image-resizer/20261010-thread09/t03-browser-zh.json` (incubator-only evidence, not public source).

| Case | Result | Evidence and limit |
|---|---|---|
| IM-01–08 | PASS A | dimensions/output/header/session tests; 12MP/10MiB inputs, 8MP output, no enlargement, strict decimal quality, malformed lengths, animation rejection |
| IM-09 | PASS B | product decodes and really encodes all eight orientations; corners match, 5–8 swap dimensions |
| IM-10 | PASS B | original-size PNG image/png, 79,951 bytes, fully transparent alpha 0, half-transparent alpha 128; checkerboard stays in CSS |
| IM-11 | PASS B | JPEG image/jpeg, 25,378 bytes, transparent center [255,255,255,255] |
| IM-12 | PASS A+B | actual WebP probe and encoder supported, alpha 0; simulated WebP failure uses real PNG encoding, PNG name and visible fallback |
| IM-13 | PASS B | settings revoke old URL, remove result src and disable download immediately |
| IM-14 | PASS A+B | deliberately delayed real encoding callbacks; A arrives after B, creates no URL and cannot replace B; cancellation preserves source |
| IM-15 | PASS ownership / NOT_RUN native memory | 10 load/generate/clear cycles, URLs/bitmaps/input/result/preview cleaned. JS heap samples rise ~0.11 MB per cycle before browser GC; this does not establish a native-memory leak or prove a memory plateau. Native bitmap allocations/GC profiling remains a manual NOT_RUN |
| IM-16 | PASS B observation + code review | initial seven same-origin static resources, HTTP resource count remains seven; no fetch/XHR calls or storage writes; no content requests. Native Network panel and physical disconnection NOT_RUN |
| IM-17 | PASS B | hostile synthetic File name displays literal text, no child elements; fixed image-1920x1280.png name |
| IM-18 | PASS B mocks | toBlob(null) and decoder rejection after startup: fixed error, no download, reselect recovers. Genuine malformed headers tested separately |
| IM-19 | PASS layout / partial keyboard | 320px iframe: client/scroll 305/305; 200% text at 640px: 625/625. Direct keyboard Enter opens file chooser, synthetic file set through chooser; Tab/arrow/type/Enter selects width 1200, JPEG 85, produces real 1200×800 image/jpeg, 7,860 bytes; Tab reaches download with visible solid focus. Native picker dialog navigation, physical save and full browser zoom NOT_RUN at this milestone |
| IM-20 | PASS B synthetic drag events | two files rejected; URI text rejected; no fetch |

Mock error/latency results are distinct from real native encoding. Browser heap/GC, native picker navigation, OS save dialog, screen reader, real touch and physical mobile are user-authorized manual NOT_RUN, not PASS. Untested Firefox/Edge/Safari are not listed as verified support.

## UI rationale

Product App: preview is the largest contiguous region; adjacent size/format/quality controls, explicit result and download. Warm paper #f3f0e8, ink #111410, white #ffffff, acid #c8f56a, control border #60645c. System Segoe UI for controls and Cascadia Mono fallback for measured values. Desktop: preview | settings; compact: full-width preview, then settings, then result. Checkerboard has a functional alpha purpose. No decorative image, generic hero, nested cards or external fonts. Authentication and server timeout states do not apply to a browser-local tool; decoding/encoding errors and missing browser capability have recovery copy.

T04/T05 final source, bilingual and release build evidence will be appended after actual execution.

## T04 — PASS with explicit manual NOT_RUN

Static how-to, limits, local data lifecycle and five FAQs added to initial HTML (readable without JS). npm.cmd test 11/11 PASS, check/build exit 0, eight public files, preview noindex. Existing unchanged algorithm/native codec evidence reused.

Actual 320px public page: client/scroll 305/305, all static headings present. Product source and result focus inspected on desktop and mobile. Contrast calculation: ink/paper 16.30; muted/paper 6.30; ink/acid 14.78; control-border/white 6.04; danger/paper 7.68. Control targets min 44px, two-layer focus and reduced-motion rules reviewed. There is one active primary action per state after the T03 visual fix.

Five Ctrl-plus key events in IAB did not change innerWidth (1280), clientWidth (1265) or visualViewport.scale (1); Ctrl-0 sent afterward. Full browser 200% zoom remains NOT_RUN, not confused with the passed 200% text-size reflow. Screen reader, physical mobile/touch, native heap/GC and native OS picker/save remain manual NOT_RUN under TASK-ENTRY authorization. No additional product decision needed.

## T05 final — PASS with authorized manual NOT_RUN

- Added full static English page, both complete runtime locales, same-language homepage links and language navigation. 14/14 named Node tests PASS, exit 0; npm.cmd run check exit 0. Negative auditor tests detected a real issue: it inspected ancestor .tmp as a public dotfile. Fixed to inspect paths relative to the audited root, preserving dotfile rejection inside public.
- Default npm.cmd run build exit 0 remains noindex. Final npm.cmd run build -- --release --site=https://images.glossquote.com exit 0; node scripts/verify-release.mjs exit 0. Final dist has 16 files: three HTML, seven JS, two CSS, robots, sitemap, headers and redirects. No tests/docs/user inputs in dist. Reciprocal canonical/hreflang, x-default, allowed origin, robots, sitemap, 404, MIME/security header preparation and local release-asset HTTP checks PASS. Cloudflare packaging and live response behavior remain integration NOT_RUN.
- Final bilingual product browser runs each passed all 13 cases. Traditional Chinese and English reports: t05-browser-zh-final.json / t05-browser-en-final.json in the dedicated incubator run directory. Nine same-origin resources load initially in each language, unchanged during workflows; zero observed network API calls and storage writes. Native outputs unchanged: PNG alpha 0/128, JPEG white center 255 per channel, WebP alpha 0.
- Final actual 320px, 768px and 200% text cases: client/scroll 305/305, 753/753, 625/625. The standard-width preview fraction was 63.6879%; removed the settings column’s 15rem minimum, then both-language actual browser assertions required >=65% and passed. Desktop and compact layouts were unchanged. No further design exploration.
- Direct English public-source verification: invalid 1e3 produces English size error and disables generation; corrected 1200 + JPEG produces 1200×800, image/jpeg, 7,860 bytes. Keyboard focus reaches download with visible solid outline; only download has active primary styling after success. English source/FAQ/help and matching-language homepage links inspected.
- Screenshot evidence retained in incubator .runs/image-resizer/20261010-thread09/desktop-result-en.jpg and mobile-en.jpg; screenshots contain synthetic image only. These are not runtime/public assets.
- Native memory/GC plateau, OS save, native picker navigation, screen reader, physical mobile/touch, full browser zoom, native Network and physical offline remain explicit manual NOT_RUN. Wrangler not installed: task forbids new dependencies/credentials/deployment. Config checked against current official static asset documentation; Wrangler dry-run and live release stay with the integration chat.
