# YuiHub API (minimal)

## Setup
```bash
cd yuihub_api
npm i
cp ../.env.example .env
npm run dev
```

## Endpoints
- `POST /save` — save YAML+MD note
- `GET /recent?n=20` — list decisions
- `GET /search?q=...` — naive substring over prebuilt index (replace with Lunr in UI)
