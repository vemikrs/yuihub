---
doc_type: consistency_log
status: draft
owner: vemikrs
created: 2025-09-23
concept_version: c0.2
doc_version: 0.2.0-doc.1
target_code_tag: v0.2.0-prototype.1
scope: "Flow ↔ OpenAPI 整合"
---

# CONSISTENCY — Flow と OpenAPI の整合表

## 使い方
- 各差分を1行で記録し、必要に応じてΔ-Knot IDを付与する
- 解消したら `Status` を `Resolved` に更新

| Path & Method | Flow参照 | OpenAPI参照 | 差分⚠ (概要) | アクション | Δ-Knot | Status |
|---|---|---|---|---|---|---|
| `/records` POST | 00_min-spec: Thread必須 | schema: `thread_id` optional | 必須/任意の不一致 | OpenAPIを必須に揃える | DK-2025-09-23-01 | Open |
| `/search` GET | 02_hub-vs-flow: 検索AND既定 | spec: `op` に OR | 既定逸脱（OR露出） | 仕様の非既定扱いへ注記 | DK-2025-09-23-02 | Open |

> 記録の原則：冗長説明は書かない。**次アクションが分かる最小文**のみ。
