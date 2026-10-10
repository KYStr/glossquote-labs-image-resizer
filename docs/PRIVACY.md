# 本工具資料處理 / Data handling

圖片內容在當次瀏覽器頁面記憶體內處理；工具沒有圖片上傳、第三方請求、追蹤、遠端字型、瀏覽器儲存或 Service Worker。網站程式資源本身仍會載入，託管方可能收到一般連線資訊。程式碼檢查與實際 Resource Timing 觀察已記錄在 TEST-RESULTS；原生 Network 面板、實體斷網與全裝置隱私狀態並未驗證。

Image content is processed in the current browser page. The tool has no image upload flow, third-party requests, analytics, remote fonts, browser storage or Service Worker. Website resources still load, and hosting providers may receive ordinary connection information. Code review and actual Resource Timing observation are documented in TEST-RESULTS; native Network-panel inspection, physical disconnection and the wider device environment remain unverified.

選新圖片先撤銷前一工作；改設定使既有下載失效。清除／離開頁面會撤銷本頁結果網址、close 來源 bitmap 並縮小受控畫布。取消編碼保留來源與設定，丟棄晚到結果，無法保證瀏覽器原生編碼立刻停止。這些操作不刪除已下載檔案，也不保證抹除瀏覽器或作業系統記憶體。

Selecting another image invalidates the previous job. Changing settings invalidates its download. Clear or page exit revokes result URLs, closes the source bitmap and shrinks controlled canvases. Encoding cancellation keeps the source and settings and discards late output; native encoding may continue. These actions do not delete downloaded files or guarantee erasure of browser or operating-system memory.

輸入檔名只以文字顯示；固定下載名為 image-WxH.png／.jpg／.webp，依實際 MIME 決定。工具不複製原始 EXIF／GPS／ICC 片段，但不承諾全部輸出 metadata 清空。所有開發測資均為合成幾何圖形，未使用私人照片。

Input names are rendered as literal text. Downloads use image-WxH.png/.jpg/.webp according to actual MIME. Original EXIF/GPS/ICC segments are not copied; completely metadata-free output is not promised. All test images are synthetic geometric shapes, not private photos.
