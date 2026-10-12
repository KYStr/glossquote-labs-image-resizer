export const strings={
  locale:'zh-Hant',
  qualityLabel:'品質（1–100）',startQualityLabel:'起始品質（1–100）',qualityHelp:'品質影響結果容量；產生後才顯示實際大小。',targetQualityHelp:'先試這個品質，再依序試固定的較低值。低品質可能損失細節，不保證畫質最佳。',
  generateLimit:'產生並核對容量',generateTry:'嘗試壓到容量上限',targetReady:'上限已就緒，產生圖片以核對實際容量。',targetMet:'符合容量上限',pngQuality:'PNG，不調整品質',
  targetPngHelp:'PNG 只產生一次，不以品質調整容量。超出時可自行縮小尺寸或選擇其他格式。',targetLossyHelp:'最多嘗試 12 次品質，總期限 30 秒；尺寸與選定格式保持不變，達標才提供下載。',
  fallbackFailure:'瀏覽器改用 PNG；PNG 無法搜尋品質，這次結果仍超出上限，沒有可下載的結果。',
  fallbackNeutral:'瀏覽器實際編碼為 PNG，PNG 不使用品質參數。',
  appliedQuality:q=>`實際品質 ${q}`,targetPreview:(value,unit,bytes)=>`${value} ${unit}＝${bytes} bytes`,targetResult:(limit,attempts,q)=>`${limit} · 嘗試 ${attempts} 次 · ${q}`,
  targetProgress:(attempts,q,png)=>png?'正在產生 PNG 並核對實際容量，可以取消。':attempts==='0'?'正在準備容量嘗試，可以取消。':`正在嘗試第 ${attempts} 次，品質 ${q}；可以取消。`,
  targetFailure:(attempts,min,target,q)=>`已嘗試 ${attempts} 次，最小實際結果為 ${min}${q?`（${q}）`:''}，仍超出 ${target} bytes。可自行降低尺寸或改格式後再試。`,
  targetTimeout:(attempts,target,min)=>`已為 ${target} bytes 上限嘗試 ${attempts} 次，30 秒期限已到。${min?`已測得最小結果 ${min}。`:''}期限後不提供下載，來源與設定仍保留，可調整後重試。`,
  errors:{EMPTY_FILE:'這個檔案沒有內容，請選擇其他圖片。',MULTIPLE_FILES:'一次只能處理一張圖片，請重新選擇。',FILE_TOO_LARGE:'檔案超過 10 MiB，請先使用其他本機工具縮小。',FORMAT_UNSUPPORTED:'請選擇靜態 PNG 或 JPEG；不接受動圖或圖片網址。',IMAGE_TOO_LARGE:'圖片超過每邊 8,192 或 12 MP 的限制，請先使用其他本機工具縮小。',IMAGE_CORRUPT:'這張圖片無法讀取，請改選靜態 PNG 或 JPEG。',SIZE_INVALID:'請輸入 1–4,000 的整數，不得放大；輸出不能超過 8 MP。',QUALITY_INVALID:'請輸入 1–100 的整數品質。',ENCODE_FAILED:'圖片產生失敗，尚未儲存。請重試或選擇其他格式。',BROWSER_UNSUPPORTED:'此瀏覽器無法完成圖片處理，請使用已驗證的瀏覽器版本。'},
  messages:{idle:'選擇一張圖片，調整尺寸後儲存。',checking:'正在檢查圖片。',decoding:'正在讀取圖片。',ready:'尺寸已就緒，按「產生圖片」以查看實際結果。',encoding:'正在產生圖片，可以取消。',cancelled:'已取消，尚未儲存圖片。'},
  generate:'產生圖片',generating:'正在產生圖片…',original:'原始',output:'輸出',noSource:'尚未選擇圖片',noDimensions:'輸出尺寸會顯示於此',fixDimensions:'請修正尺寸設定',fallback:'此瀏覽器改用 PNG，下載格式也已改為 PNG。',
  bytes:(bytes,kib)=>`${bytes} bytes（${kib} KiB）`,
  success:(width,height,format,bytes)=>`圖片已產生：${width} × ${height}，${format}，${bytes}。`
};
Object.assign(strings.errors,{TARGET_SIZE_INVALID:'請以半形整數輸入上限，並選擇 kB、KiB 或 bytes；換算後須為 1 byte 至 10 MiB。',TARGET_NOT_MET:'沒有結果符合容量上限，不提供下載；來源與設定仍保留。',ENCODE_TIMEOUT:'30 秒期限已到，沒有可下載的結果；可調整設定後重試。'});
