---
doc_type: readme
status: draft
owner: vemikrs
created: 2025-09-21
updated: 2025-09-22
concept_version: c0.2
doc_version: 0.2.0-doc.1
target_code_tag: v0.2.0-prototype.1
related: []
---

# YuiHub Documentation

### Overview

Architecture of the docs directory:
```bash
/docs/
   guides/        # 固定ガイド・ハウツー
   story/         # よみもの
   logdocs/       # トランザクショナル（時系列ログ）
```

### guides

### story

### logdocs

- 命名：YYMMDD+連番_概要.md
- flat構成：まずは1階層に積む
- 必要になったら：テーマまたは年月でサブフォルダへ切り出し

### Front Matter Template
```yaml
doc_type: concept
status: draft            # draft | review | frozen
owner: vemikrs
created: 2025-09-22
updated: 2025-09-22

# Versioning
concept_version: c0.2 # 構想の主系。コードの MINOR と揃える
doc_version: 0.2.0-doc.1 # 構想配下の文書改訂番号（.2, .3 と増やす）
target_code_tag: v0.2.0-prototype.1 # この文書が説明対象とするコードタグ
iteration: 0
mode: Shelter # YuiHub流のモード

# Relationships
related:
  - CHANGELOG_DOC.md
  - meta/MANIFESTO.md
  - meta/appendix.lexicon.md
---
```
