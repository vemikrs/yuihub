---
doc_type: guide
status: draft
owner: vemikrs
created: 2025-09-23
version: 0.2.0
---

# 運用API仕様：POST /ops/reindex（Shelter限定）

## 概要
ローカルリポジトリの `notes/` と `logdocs/` を対象に Lunr 索引を再生成する。  
**127.0.0.1 バインド／Bearerトークン必須／FREEZE尊重**。

## リクエスト例
```http
POST /ops/reindex HTTP/1.1
Host: 127.0.0.1:3000
Authorization: Bearer <LOCAL_OPS_TOKEN>
Content-Type: application/json

{
  "paths": ["notes/", "logdocs/"],
  "filters": { "mode": ["Shelter"], "visibility": ["private","internal"] },
  "dryRun": false
}
```

## レスポンス例（200）
```json
{
  "ok": true,
  "indexed": 42,
  "skipped": 3,
  "duration_ms": 684,
  "artifact": "index/lunr.idx.json",
  "warnings": []
}
```

## エラーレスポンス（例）
- `401 Unauthorized`：トークン不正
- `423 Locked`：FREEZE 等により拒否（Signal専用等のポリシー違反）

## 実装メモ
- 実体は `scripts/build-index.js` を呼び出す薄いオーケストレーション。
- `dryRun` 時は対象ファイル一覧と見積もりだけ返す。
