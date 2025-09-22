---
doc_type: design
status: draft
owner: vemikrs
created: 2025-09-21
concept_version: c0.2
doc_version: 0.2.0-doc.1
target_code_tag: v0.2.0-prototype.1
---

# YuiFlow Technical Design

## 1. ICD（境界）
- GPTs → Hub（/save）: `InputMessage{ …, mode: "shelter" }` を POST。Hub は `RecordEntry{ …, mode: "shelter" }` を返す。
- Client → Hub（/search）: AND 検索。返却 `RecordEntry[]{ …, mode: "shelter" }`。
- Hub → Agent（/trigger）: `AgentTrigger{ …, mode: "shelter" }` を POST。`{ ok, ref }`。

### エラーモデル（最小）
- `400` Validation Error（`mode` 欠落 or `shelter` 以外）
- `401` Missing/Bad Bearer
- `429` Rate Limit
- `500` Unexpected

## HTTP API（最小）
- POST /save
- GET /search?q=...&tag=...&thread=...
- POST /trigger

## セキュリティ
- AUTH_TOKEN (Bearer)
- レートリミット（ゆるく）

## コントラクトテスト
- contracts/*.json に定義
- 実行は yuihub_api/tests/contract/
