---
doc_type: concept
status: draft
owner: vemikrs
created: 2025-09-21
concept_version: c0.2
doc_version: 0.2.0-doc.1
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
