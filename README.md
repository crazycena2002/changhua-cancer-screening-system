# NCHU-11507-ChanghuaEscreening
NCHU-11507-彰化縣衛生局癌症篩檢活動預約系統

## 專案結構

前後端分離的 monorepo，兩個子專案各自獨立安裝與啟動：

| 目錄 | 角色 | 技術 |
|------|------|------|
| `backend/` | 純 JSON API | Laravel 13、Sanctum、Pest、Pint |
| `frontend/` | SPA | Vue 3、Vue Router、Pinia、Vite |

## 環境需求

- PHP 8.3 以上、Composer
- Node.js 22.18 以上（或 24.12 以上）、npm
- MariaDB / MySQL

## 專案拉下來後的啟動步驟

### 1. 後端

先在資料庫建立 `nchu_changhua_e_screening`（名稱可於 `backend/.env` 的 `DB_DATABASE` 調整），再執行：

```sh
cd backend
composer run setup      # composer install、建立 .env、產生 APP_KEY、執行 migrate
```

> `composer run setup` 最後一步會執行 migrate，若資料庫尚未建立或 `.env` 的 DB 連線設定不正確會失敗。請先確認資料庫可連線，或在 `.env` 建立後修改 `DB_*` 設定再重新執行 `php artisan migrate`。

### 2. 前端

```sh
cd frontend
npm install
npm run dev             # 啟動於 http://localhost:5173，會自動開啟瀏覽器
```

## 常用指令

### 後端（於 `backend/` 目錄）

```sh
composer run setup      # 初始化專案
php artisan serve       # 啟動開發伺服器
php artisan migrate     # 執行資料庫遷移
composer test           # 執行 Pest 測試
vendor/bin/pint         # PHP 程式碼格式化
```

### 前端（於 `frontend/` 目錄）

```sh
npm install             # 安裝套件
npm run dev             # 開發模式（HMR）
npm run build           # 產生正式版靜態檔
npm run preview         # 預覽 build 結果
```
