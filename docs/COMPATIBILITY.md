# Image processing compatibility

2026-10-13:Google Chrome/Chromium155.0.8059.40,Windows11 Home10.0.26200/64-bit. Bilingual capacity product UI and nativeJPEG/WebP outputs passed scoped acceptance. Existing native EXIF1–8,PNG/WebPalpha,JPEGwhite and bounded core behavior are documented/reused for unchanged encoder inputs. Startup still probes all eight EXIF orientations and PNG/JPEG/WebP MIME; unsupported engines fail closed.

No claim of full other-engine/physical-device/AT/GC/zoom coverage. FullNetwork/Storage/offline and nativeOS workflows remain NOT_RUN. WebPinput is unsupported. Browser-control DOM proxy does not expose File objects for a separateWebPdownload re-read; no permission expansion was granted.

Official format references: [PNG specification](https://www.w3.org/TR/png-3/), [JPEG T.81](https://www.itu.int/rec/T-REC-T.81), [createImageBitmap](https://developer.mozilla.org/en-US/docs/Web/API/Window/createImageBitmap), [Canvas toBlob](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob). Browser-default color conversion is not cross-engine pixel equivalence or metadata/DPI fidelity.
