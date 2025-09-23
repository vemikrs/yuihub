---
doc_type: guide
status: draft
owner: vemikrs
created: 2025-09-22
concept_version: c0.2
doc_version: 0.2.0-doc.2
target_code_tag: v0.2.0-prototype.1
---

# Contracts — Flow定義／Hub実行の順序

## 目的
Flow（一次正：思想→仕様→コントラクト）を起点に、Hub（実装／API）が**それを満たすだけ**の流れを固定する。

## ソース・オブ・トゥルース
- Flow: `docs/yuiflow/00_min-spec.md`, `02_hub-vs-flow-separation.md`, `ja-terms-guideline.md`
- Hub: `yuihub_api/openapi.yaml`（実装側の表現）

## 実行順序（標準オペレーション）
1. Flowが定義を更新（Δ-Knot発火条件は下記）
2. 契約テスト（Flow側）更新／追加
3. Hubは契約テストを緑にする実装変更（API/保存・検索）
4. 整合チェック（`CONSISTENCY.md`に記録）
5. 差分は `Δ_Knots.md` に追記（1行記録）

## Δ-Knot 戻り条件（例）
- Hub最適化でFlow一次正の前提が揺れる
- OpenAPIで表現できない語彙／粒度の差が出た
- 例外系（検索ORなど）を既定から外す必要が生じた

## ロール
- Flow Maintainer：一次正の保持者（変更の可否判断）
- Hub Maintainer：契約を満たす実装／APIの管理者

## 出力
- 契約テスト：Flow側に置く
- 実装：Hub側（OpenAPI含む）
- 差分：`CONSISTENCY.md` と `Δ_Knots.md`

> 原則：**FlowはHub非依存／HubはFlowなしでも最小動作可**（一次正の分離）。 
