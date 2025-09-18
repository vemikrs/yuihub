# YuiHub minimal PoC bundle

- `yuihub_api/` — HTTP API (`/save`, `/search`, `/recent`)
- `yuihub_mcp/` — MCP server that proxies to API
- `scripts/` — index prebuilder (lunr-like simple JSON)
- `chatlogs/` — sample notes
- `.env.example` — config

## Quickstart
1) Build simple index
```bash
cd yuihub_min
node scripts/chunk_and_lunr.mjs
```
2) Start API
```bash
cd yuihub_api && npm i && cp ../.env.example .env && npm run start
```
3) (Optional) Start MCP
```bash
cd ../yuihub_mcp && npm i && YUIHUB_API=http://localhost:8787 npm start
```
