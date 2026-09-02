/* 麻的🔥小辛辣 營運巡檢 App — 設定
 * MODE: 'local' = 純本機（草稿/送出都存這台裝置，測流程用）
 *       'cloud' = 接 Google 後端（送出寫試算表、照片上 Drive、歷史跨裝置）
 * 部署 Apps Script 後，把「網頁應用程式」網址貼到 APPS_SCRIPT_URL，並把 MODE 改成 'cloud'。
 */
window.MDSSL_CONFIG = {
  MODE: 'cloud',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxok7zAxOWRBW8FP94sH_2ud4yiMgEkjyOf8pC13W-O-0ge_eoE1ztfVVOcBJDRWYhOlA/exec',
  LOCAL_PASSCODE: '', // 正式站(cloud)通行碼一律由後端 Script Property 驗，前端不留（避免進公開 repo）
};
