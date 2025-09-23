---
doc_type: plan
status: active
owner: vemikrs
created: 2025-09-22
scope: "Ph2b Step2 構想設計"
concept_version: c0.2
doc_version: 0.2.0-doc.2
target_code_tag: v0.2.0-prototype.1
---

# Step2 作業計画書（チェックリスト）

## P1: 一次正を固める
- [x] `02_hub-vs-flow-separation.md` レビュー観点追記（責務/依存/アンチゴール/思想対応表）
- [ ] `00_min-spec.md` 更新:  
  - mode 固定必須  
  - record.entry.controls 仮置き  
  - thread 必須化  
  - kind: fragment|knot の規定と例追加  
  - JA/EN 2例に拡張
- [ ] Context Packet の定義文を追記
- [ ] 日本語処理規範 `ja-terms-guideline.md` を追加し擬似コード＋ストップワード例

## P2: 橋渡し（Step2→2.5）
- [ ] `contracts/README.md` を新規作成（Flow定義／Hub実行の順序、Δ-Knot戻り条件）
- [ ] OpenAPI整合表 `CONSISTENCY.md` を作成（差分⚠をΔ-Knot化）

## P3: 差分記録
- [ ] `Δ_Knots.md` に mode固定／controls仮置き／検索AND既定／OpenAPI差分を記録

## 完了条件 (DoR準備OK)
- [ ] 00_min-spec / 02_hub-vs-flow-separation がレビュー済み
- [ ] ja-terms-guideline が存在
- [ ] contracts/README.md が存在
- [ ] CONSISTENCY.md が存在し、差分がΔ-Knotsに反映
