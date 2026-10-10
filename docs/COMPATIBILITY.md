# Compatibility evidence

2026-10-10: T01 in progress. Browser support is determined by real EXIF 1–8, PNG alpha and JPEG white-background tests. Untested browsers are NOT_VERIFIED. No decoder packages or runtime dependencies.

Reviewed official references:

- [PNG third edition](https://www.w3.org/TR/png-3/): signature, IHDR, bounded chunk lengths, IDAT/IEND and acTL. The container gate is not a full decoder or CRC/security certification.
- [ITU-T T.81, Annex B](https://www.w3.org/Graphics/JPEG/itu-t81.pdf): marker segments, segment length including its two length bytes, SOF0/SOF2, sample precision and scan headers. Only 8-bit baseline/progressive supported by product policy.
- [CIPA orientation mapping](https://cipa.jp/std/documents/e/DC-X010-2017.pdf): Orientation tag 274, directions 1–8. Synthetic APP1 stores one SHORT value in little-endian TIFF; no private metadata.
- [createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap): from-image follows EXIF, including mirrors. The browser gate checks the actual result; the product must not rotate it twice.
- [Canvas toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob): unsupported encoders may return PNG, null is failure. MIME is checked before naming a result.
- [Node test runner](https://nodejs.org/docs/latest-v24.x/api/test.html): built-in test runner, invoked on installed Node v24.14.0.

Fixture URL: http://127.0.0.1:5189/browser-fixtures.html. Parser-only Node fixture headers are not used as real decoder images. Real browser fixtures are Canvas geometric images (2400×1600), EXIF variants are generated in memory.

## T01 actual browser gate — PASS (2026-10-10)

Windows desktop, Codex IAB, reported Chrome/155.0.0.0 (reduced UA; full engine build still unconfirmed). Orientation 1–4: 2400×1600; 5–8: 1600×2400. Corner indexes respectively 0123, 1032, 3210, 2301, 0213, 2031, 3120, 1302; all actual JPEG sample colors within 30/channel of expected. PNG 79,947 bytes / image/png / alpha=0. JPEG 25,201 bytes / image/jpeg / white center [255,255,255,255]. WebP 1×1 probe image/webp. No browser-support claims for Firefox, Edge, Safari or physical mobile devices yet.

T03 verified full engine build: Chromium/Google Chrome 155.0.8059.27, reported by userAgentData.fullVersionList in actual product test harness (Windows, x86, platformVersion 19.0.0). This supersedes the earlier reduced-UA uncertainty. Physical mobile, Firefox, Edge and Safari remain NOT_VERIFIED.
