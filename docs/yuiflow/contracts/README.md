---
doc_type: guide
status: draft
owner: vemikrs
created: 2025-09-22
concept_version: c0.2
doc_version: 0.2.0-doc.1
target_code_tag: v0.2.0-prototype.1
---

# コントラクトテスト運用ガイド

## 原則
- **定義は Flow**（docs/yuiflow/contracts/*.schema.json）
- **実行は Hub**（yuihub_api/tests/contract/**）

## 更新手順
1. Flow 側で schema を更新  
2. Δ-Knot として `docs/logdocs/Δ_Knots.md` に記録  
3. Hub 側テストを更新し validate  
4. PR レビューで「Flow → Hub」の順が守られているか確認

## 戻り条件（Δ-Knot）
- コントラクトに影響する変更は必ず **Δ-Knot として明示**  
- 実装がコントラクト未満のまま進まないよう、PR マージ条件に含める
