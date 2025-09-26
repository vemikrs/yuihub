# YuiHub PoC Step2.5 Package

- `schemas/` : Finished JSON Schemas (with $id, additionalProperties, descriptions)
- `scripts/build-index.cjs` : Front-matter aware Lunr indexer with filters & dryRun
- `yuihub_api/src/server.mjs` : Minimal `/ops/reindex` (localhost + Bearer)
- `.vscode/tasks.json` : VS Code tasks for reindex
- `scripts/hooks/pre-commit.sample` : Optional pre-commit hook

## Install
```bash
npm i
# if needed
npm i -D ajv ajv-formats minimist
```

## Run index (dryRun)
```bash
node scripts/build-index.cjs --paths notes --paths chatlogs --mode=Shelter --visibility=private,internal --dryRun
```

## Run API
```bash
# 環境設定（初回のみ）
cp .env.example .env
# .envファイルを編集してAPI_TOKENを設定

npm run dev -w yuihub_api
# then:
curl -s -H "Authorization: Bearer $LOCAL_OPS_TOKEN" -H "Content-Type: application/json"   -d '{"paths":["notes/","chatlogs/"],"filters":{"mode":["Shelter"],"visibility":["private","internal"]},"dryRun":true}'   http://127.0.0.1:3000/ops/reindex | jq .
```
