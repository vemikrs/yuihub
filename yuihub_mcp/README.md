# YuiHub MCP server (minimal)
Proxies MCP tool calls to the YuiHub HTTP API.

## Run
```bash
cd yuihub_mcp
npm i
YUIHUB_API=http://localhost:8787 npm start
```

## Tools
- `save_note(frontmatter, body)`
- `search(q, limit?)`
- `recent(n?)`
