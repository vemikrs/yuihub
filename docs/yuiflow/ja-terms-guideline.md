---
doc_type: guideline
status: draft
owner: vemikrs
created: 2025-09-22
concept_version: c0.2
doc_version: 0.2.0-doc.1
target_code_tag: v0.2.0-prototype.1
---

# 日本語処理規範（JA Terms Guideline）

## 目的
日本語テキストから用語（terms）を抽出・正規化するための共通規範を定義し、Flow（思想→仕様）と Hub（実装）間の乖離を防ぐ。

## 適用範囲
- YuiFlow が一次定義する規範。Hub は本規範を**参照実装**として順守する。

## 規範フロー（擬似コード）

```
tokens = tokenize(input_text)
tokens = remove_stopwords(tokens)
tokens = normalize(tokens)   # 表記ゆれ・品詞ベースの正規化（名詞・固有名詞を優先）
terms  = select_terms(tokens) # 頻度・重要度ヒューリスティクス（将来拡張）
return terms
```

## ストップワード例（最小）
- 「こと」「ような」「的」「これ」「それ」「あれ」
- 補助動詞・助詞・終助詞（は・が・を・に・で・ます・です など）

## 正規化の指針（最小）
- 全角／半角・大文字／小文字の統一
- 記号（句読点・括弧・長音）のトリム
- 見出し語は**基本形**に寄せる（例: 「結び」「結ぶ」→「結」）

## 役割分担
- **Flow**：規範の一次定義・更新。テストケース（擬似コード準拠）を付与。
- **Hub**：規範に従った抽出実装。速度・記憶域などの最適化はしても、規範を改変しない。

## テスト観点（最小）
- ストップワードが terms に混入しないこと
- 同義表記が同一の見出し語に正規化されること
- 英数・記号混在語の扱いが一貫していること

## 非目標
- 形態素解析器の切替は本PoC範囲外
- 意味ベクトル検索は次フェーズ

> 注: 本ガイドラインは PoC 期間中に Δ-Knot を通じて更新されうる。更新は常に Flow 起点で行う。
