# NCHU-11507-TaichungEERC

臺中市英語教育資源中心網站建置委託資訊服務案（學生專案）。回覆一律使用繁體中文，避免簡體字與中國大陸用語。

## 結構

這是前後端分離的 monorepo，兩個子專案各自獨立安裝與啟動：

| 目錄 | 角色 | 技術 |
|------|------|------|
| `backend/` | 純 JSON API | Laravel 13、Sanctum、Pest、Pint |
| `frontend/` | SPA | Vue 3、Vue Router、Pinia、Vite |

- 後端**沒有**頁面、Blade、Tailwind 或 Vite 資產，所有畫面都在前端。
- AI 規範分三層：本檔（整體結構）、`backend/AGENTS.md`（Laravel Boost 產生的框架規範，勿手動修改）、`backend/CLAUDE.md`（後端專屬補充）。Claude Code 透過各目錄 CLAUDE.md 的 `@AGENTS.md` 讀取同一份內容。
- Laravel Boost MCP 伺服器設定在 `backend/.mcp.json`，處理後端工作時請在 `backend/` 目錄啟動 Claude Code 才能使用 Boost 工具。

## 啟動

```sh
# 後端
cd backend && composer run setup && php artisan serve

# 前端
cd frontend && npm install && npm run dev
```
