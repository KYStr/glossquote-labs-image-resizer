# File size limit source candidate — 2026-10-13

Bilingual browser-local image resizer. Optional exact file size limit in kB=1000, KiB=1024 or bytes. JPEG/WebP try a bounded sequence of lower quality values; PNG is checked once. Dimensions and the selected format are preserved. Only the first actual result within the limit is offered for download. Timeout/failure has no download and retains settings for editing.

Local acceptance:38 Node tests,check,preview/release build and release verification passed.13 product DOM/native cases passed per language, including controlled clock/callback/fallback boundaries that are clearly labeled. Actual native product downloads:JPEG185178bytes/800×600/quality50/5attempts at200kB;WebP199246bytes/800×600/quality25/7attempts at200KiB.

This source candidate is not a new live release. Integration must independently verify the fixed gitHEAD, deploy the reviewed static assets, verify HTTPS/MIME/security headers/SEO/404/redirects and actual browser workflows, then update the bilingual family homepage. Existing live GQ-01 release is distinct. Source manifest identifies exact reviewed blobs; generated dist and private evidence are excluded.

Manual exceptions remain:physical devices/touch,AT/other engines/full zoom,nativeGC,complete Network/Storage/offline and nativeOS keyboard coverage. WebP DOM File-object readback is unavailable in the browser-control proxy; actual output natural dimensions, downloaded bytes/header and independent file decoding are verified without permission expansion.

Build: npm.cmd run build -- --release --site=https://images.glossquote.com; npm.cmd run verify:release. Preview remains noindex.
