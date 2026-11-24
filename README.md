# 學習遊戲平台（獨立部署版）

純靜態網站（HTML + JavaScript）＋ Supabase Realtime 多人連線，部署在 Vercel。
**不需要 Claude／Google／ChatGPT 帳號，玩家只要有網址、輸入暱稱就能玩。完全不呼叫任何 AI API。**

## 檔案說明

| 檔案 | 用途 |
| --- | --- |
| `index.html` | 整個平台（老師／學生畫面、題庫、選擇題、翻牌、魯濱遜漂流記、蛇棋、注音） |
| `config.js` | **你要修改的唯一檔案**：填入 Supabase 網址與公開金鑰 |
| `vendor/supabase.js` | supabase-js 2.119.2 的本機副本（不依賴任何 CDN） |
| `vercel.json` | Vercel 設定（安全標頭、快取） |

沒有建置步驟、沒有 `package.json`、沒有伺服器程式碼、沒有資料表。

---

## 步驟 1：建立 Supabase 專案（免費，約 3 分鐘）

1. 到 https://supabase.com ，註冊並登入（只有你這位管理者需要）。
2. 按 **New project**，填專案名稱、設定資料庫密碼（用不到，但請記下）、Region 選離學生近的（例如 Tokyo 或 Singapore），按建立，等 1–2 分鐘。
3. 專案畫面上方按 **Connect**（或左下 **Project Settings → API Keys**），複製兩個值：
   - **Project URL**：`https://xxxxxxxx.supabase.co`
   - **Publishable key**：`sb_publishable_...`（舊專案可用 `anon` key）
4. 注意：**只能用 Publishable／anon key**，絕對不要把 `secret` 或 `service_role` key 放進網頁。
5. 不需要建資料表、不需要開啟登入（Auth）。多人連線用的是 Realtime 的 Broadcast／Presence 公開頻道。
   - Realtime 預設允許公開頻道。若之後連不上，到 **Realtime → Settings**，確認 **Allow public access** 是 Enabled。

## 步驟 2：填入 config.js

用文字編輯器開啟 `config.js`，把兩個值換成你剛複製的：

```js
window.GAME_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_KEY: "sb_publishable_xxxxxxxxxxxxxxxx"
};
```

## 步驟 3：部署到 Vercel

### 方法 A：GitHub ＋ Vercel 網頁（建議，手機也能操作）

1. 註冊 GitHub，建立新的 Repository（例如 `game-platform`），選 Public 或 Private 皆可。
2. 在 Repository 頁面按 **Add file → Upload files**，上傳 `index.html`、`config.js`、`vercel.json`，以及 **整個 `vendor` 資料夾**（內含 `supabase.js`；請保持資料夾結構），按 **Commit changes**。
3. 到 https://vercel.com ，用 GitHub 帳號登入。
4. 按 **Add New → Project**，選剛建立的 Repository，按 **Import**。
5. 設定：
   - **Framework Preset**：Other
   - **Build Command**：留空
   - **Output Directory**：留空（或填 `.`）
   - **Install Command**：留空
6. 按 **Deploy**。完成後會得到網址 `https://專案名稱.vercel.app`。

### 方法 B：Vercel CLI（電腦）

```bash
cd 這個資料夾
npx vercel          # 第一次：依提示登入、建立專案
npx vercel --prod   # 發布到正式網址
```

## 步驟 4：設定公開網址

- **給學生的網址**：用專案的 **Production** 網址 `https://專案名稱.vercel.app`（專案名稱可在 Vercel 的 Project Settings → General 修改；不要用每次部署產生的長網址）。
- **自訂網域**（選用）：Project → **Settings → Domains → Add**，輸入你的網域並依畫面指示設定 DNS。
- **如果學生開網址時被要求登入 Vercel**：到 Project → **Settings → Deployment Protection**，檢查 Vercel Authentication，並讓 Production 網址不需登入（後台選項名稱可能隨 Vercel 更新而不同）。
- 之後修改 `config.js` 或 `index.html`，重新上傳到 GitHub，Vercel 會自動重新部署。

## 使用方式

- **老師**：開網址 → 選「老師」→「房間代碼」，畫面顯示 4 位數房號 → 選「選擇題搶答」或「🐍 蛇棋」。另有「題庫」、「分數統計」。
- **學生**：開網址 → 選「學生」→ 輸入暱稱 → 玩單人遊戲，或按「多人連線」輸入老師的房號加入。
- 題庫批次匯入格式：`題目,答案,錯誤選項1,錯誤選項2,錯誤選項3`（後三欄可空白）。

---

## 限制與注意事項（請先讀）

- **資料存放**：題庫、分數、錯題紀錄都存在各裝置瀏覽器的 localStorage，不會跨裝置同步；清除瀏覽器資料就會消失。多人連線時一律使用老師那台的題庫。
- **無帳號的代價**：沒有驗證機制。知道房號的人都能進入該房間，也可能假冒他人暱稱。適合課堂使用，不適合需要防作弊或保存正式成績的場合。
- **免費額度**：Supabase 免費方案 Realtime 為 200 個同時連線、每秒 100 則訊息、Presence 每秒 20 則（以官方 Realtime Limits 頁面為準，可能變動）。一般一個班級（約 30 人）可用；多個班級同時使用時請留意，必要時升級方案。
- **免費專案可能被暫停**：Supabase 免費專案長時間（約一週）沒有活動可能被暫停，需到後台按 Restore。上課前先試開一次。
- **學校網路**：多人連線使用 WebSocket（`wss://*.supabase.co`），若學校防火牆擋掉，需請網管放行。單人遊戲不受影響。
- **蛇棋人數**：棋盤設計最多 14 人。
- **注音**：介面文字內建注音字典（依教育部《國語注音符號手冊》）；題庫內容、名字、答案不會加注音。首頁可開關。

## 為什麼能獨立運作

- 沒有任何 AI API、金鑰或登入；網站只是靜態檔案。
- 唯一的外部服務是 Supabase（連線）與 Vercel（放網站）。原本協助開發的 AI 停止使用，不影響網站運作。
- 如果日後要更換連線服務，只需要改 `index.html` 內標示為「多人連線：Supabase Realtime」的那一段轉接程式。

## 疑難排解

| 現象 | 檢查 |
| --- | --- |
| 按多人連線顯示「目前無法連線」 | `config.js` 網址與金鑰是否正確；瀏覽器 F12 → Console／Network 看 WebSocket 錯誤；Supabase 專案是否被暫停；Realtime 是否允許公開頻道；學校網路是否擋 WebSocket |
| 學生加入後老師大廳沒出現 | 約 2 秒內會出現（加入時間刻意錯開）；兩邊房號是否相同 |
| 網址要求登入 Vercel | 見步驟 4 的 Deployment Protection |
| 改了 `config.js` 沒變化 | 重新部署完成後，瀏覽器強制重新整理 |
