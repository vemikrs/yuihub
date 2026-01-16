# YuiHub API (minimal)

## Setup
```bash
# 環境設定
cp .env.example .env  # 統合環境設定ファイル
# .envファイルを編集（API_TOKEN等）

# API開発サーバー起動
npm run dev:api       # または npm run dev -w yuihub_api
```

## Endpoints
- `POST /save` — save YAML+MD note
- `GET /recent?n=20` — list decisions
- `GET /search?q=...` — naive substring over prebuilt index (replace with Lunr in UI)
