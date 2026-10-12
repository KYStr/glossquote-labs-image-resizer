# Image resizer / 圖片縮放與匯出

Browser-local one-image resizing and export, with completeTraditionalChinese/English controls/help. Set required dimensions and optionally choose a size limit in kB (1000bytes),KiB(1024) or bytes. JPEG/WebP try fixed lower quality values,at most12attempts/30seconds. PNG is checked once. Only an actual qualifying result can be downloaded; unsuccessful/expired jobs keep source/settings for editing,with no download. Dimensions and selected format are not changed automatically. This is not an optimal-quality search.

容量預設關閉、空白數字、單位kB。以exact bytes核對；200kB=200000bytes，200KiB=204800bytes。改設定撤銷舊結果，clear/新來源/語言切換重設target。PNG/WebP保留alpha，JPEG白底；WebP→PNG明示並停止品質搜尋。

Input:one nonempty staticPNG or8-bitbaseline/progressiveJPEG,≤10MiB,each edge≤8192,total≤12MP. Output:locked proportions,no enlargement,1..4000edge,≤8MP;exactintegerhalf-up. PNG/JPEG/feature-testedWebP only. No crop,batch,WebPinput,HEIC,SVG,animatedimages,accounts,uploadendpoint,telemetry,storagewrites or remote fonts. No metadata/DPI,color-fidelity or secure-memory-erasure guarantee.

## Development and acceptance

Node24+,built-ins only,no npm install.

```powershell
npm.cmd test
npm.cmd run check
npm.cmd run build
npm.cmd run dev
npm.cmd run fixtures
```

Dev:127.0.0.1:4189;fixture:127.0.0.1:5189/product-tests.html. Bothloopback/noindex;busy defaultports fallback to a printed system-assigned loopback URL. Tests use synthetic data. Generatedtest/product-fixture anddist are excluded fromGit.

38Node tests and13targetproductcases per language passed; controlledclock/callback/fallback cases are identified. Actualnative downloads:JPEG185178bytes/800×600 at200kB;WebP199246bytes/800×600 at200KiB. Fullzoom/physicaldevices/AT/otherengines/nativeGC/fullNetwork-Storage-offline remainNOT_RUN. See docs/TEST-RESULTS.md and docs/COMPATIBILITY.md.

## Source candidate and live release

Current capacity source snapshot is identified by gitHEAD and its manifest. New capacity hosting/integration/external review is pending;source publication is distinct from live deployment. Existing2026-10-12 exact-rounding release at170d77b/Cloudflare4d1ddd53-09c9-4671-bb21-6cf59e2f0bd8 is historical.

```powershell
npm.cmd run build -- --release --site=https://images.glossquote.com
npm.cmd run verify:release
```

Explicitapprovedorigin produces canonical,reciprocalzh-Hant/en/x-default,sitemap,robots,404,_headers and redirects. Defaultbuild staysnoindex. Build does not deploy. Free static hosting and both-language homepage integration require independentlive verification.

[Privacy](docs/PRIVACY.md) · [Release candidate](docs/RELEASE-CANDIDATE.md)
