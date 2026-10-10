export const strings={
  locale:'zh-Hant',
  errors:{EMPTY_FILE:'這個檔案沒有內容，請選擇其他圖片。',MULTIPLE_FILES:'一次只能處理一張圖片，請重新選擇。',FILE_TOO_LARGE:'檔案超過 10 MiB，請先使用其他本機工具縮小。',FORMAT_UNSUPPORTED:'請選擇靜態 PNG 或 JPEG；不接受動圖或圖片網址。',IMAGE_TOO_LARGE:'圖片超過每邊 8,192 或 12 MP 的限制，請先使用其他本機工具縮小。',IMAGE_CORRUPT:'這張圖片無法讀取，請改選靜態 PNG 或 JPEG。',SIZE_INVALID:'請輸入 1–4,000 的整數，不得放大；輸出不能超過 8 MP。',QUALITY_INVALID:'請輸入 1–100 的整數品質。',ENCODE_FAILED:'圖片產生失敗，尚未儲存。請重試或選擇其他格式。',BROWSER_UNSUPPORTED:'此瀏覽器無法完成圖片處理，請使用已驗證的瀏覽器版本。'},
  messages:{idle:'選擇一張圖片，調整尺寸後儲存。',checking:'正在檢查圖片。',decoding:'正在讀取圖片。',ready:'尺寸已就緒，按「產生圖片」以查看實際結果。',encoding:'正在產生圖片，可以取消。',cancelled:'已取消，尚未儲存圖片。'},
  generate:'產生圖片',generating:'正在產生圖片…',original:'原始',output:'輸出',noSource:'尚未選擇圖片',noDimensions:'輸出尺寸會顯示於此',fixDimensions:'請修正尺寸設定',fallback:'此瀏覽器改用 PNG，下載格式也已改為 PNG。',
  bytes:(bytes,kib)=>`${bytes} bytes（${kib} KiB）`,
  success:(width,height,format,bytes)=>`圖片已產生：${width} × ${height}，${format}，${bytes}。`
};
