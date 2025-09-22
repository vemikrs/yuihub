---
doc_type: guideline
status: draft
owner: vemikrs
created: 2025-09-22
concept_version: c0.2
doc_version: 0.2.0-doc.1
target_code_tag: v0.2.0-prototype.1
---

# 日本語処理規範（Step2）

## 目的
検索における **安心と再現性** を担保するため、日本語テキストの token → terms 抽出規範を定義する。

## 規範フロー（擬似コード）

```
text -> tokenize_ja()
     -> normalize(katakana->hiragana, width, lower)
     -> drop_stopwords()
     -> pick(名詞, 動詞基本形, 形容詞語幹)
     -> dedup(limit=24)
```

## ストップワード最小セット（例）
```
["の","に","は","を","た","が","で","て","と","し","れ","さ",
 "ある","いる","も","する","から","な","こと","として","い",
 "や","など","なっ","ない","この","ため","その","あっ","よう"]
```

## 非目標
- 形態素解析器の切替は本PoC範囲外
- 意味ベクトル検索は次フェーズ
