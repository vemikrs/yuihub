---
doc_type: concept
status: draft
owner: vemikrs
created: 2025-09-21
concept_version: c0.2
doc_version: 0.2.0-doc.2
target_code_tag: v0.2.0-prototype.1
---

# YuiHub × YuiFlow 分離原則（一次正）

## 一行定義
- YuiHub: 実体（ランタイム／API／保存・検索の場）
- YuiFlow: 型（思想→仕様→コントラクトの流れ）

## 責務マトリクス
- スキーマ・ICD・コントラクトテスト定義 … Flow
- 保存/検索実装 … Hub
- 日本語 terms 抽出規範 … Flow
- terms 抽出実装 … Hub

> 注記: 上記は現時点の整理であり、責務の追加・修正はPoC進行に応じて随時追記される。

## 依存の向き
- Hub は Flow なしでも最小動作可
- Flow は Hub 非依存

## 置き場所
- Flow: docs/yuiflow/**
- Hub: yuihub_api/**

## アンチゴール
- Flow に実装依存の最適化を持ち込まない
- Flow 一次定義はHubへ持ち込まない
- Hub に仕様の一次定義を置かない

## 思想対応表

| 思想／約束（Flow起点） | 仕様要素（Flow側） | 実装の置き場所（Hub側） | 検証／運用フロー |
|------------------------|--------------------|--------------------------|------------------|
| Mode は必須で固定      | `00_min-spec.md`   | request/record のバリデーション | コントラクトテスト（Flow）＋APIテスト（Hub） |
| Thread を必須化        | `00_min-spec.md`   | 保存時の必須フィールド   | `CONSISTENCY.md` に差分記録／Δ-Knot連携 |
| JA terms 規範          | `ja-terms-guideline.md` | terms 抽出ロジック     | 規範に基づく抽出テスト（Flow） |
| 検索は AND 既定        | `02_hub-vs-flow-separation.md` | クエリビルダ実装    | Δ-Knot に例外条件を記録 |
| Context Packet の定義  | `00_min-spec.md`   | request/response パケット設計 | contracts/README.md に順序記述 |

> 運用メモ  
> - 一次正は常に Flow 起点。Hub が先に最適化を求める場合は Δ-Knot で戻し、`CONSISTENCY.md` を経由して Flow に反映する。  
> - Flow に実装依存の最適化を持ち込まない／Hub に仕様の一次定義を置かない、をアンチゴールとして維持する。
