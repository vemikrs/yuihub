---
doc_type: note
status: draft
owner: vemikrs
created: 2025-09-22
concept_version: c0.2
doc_version: 0.2.0-doc.1
target_code_tag: v0.2.0-prototype.1
---

# OpenAPI ⇔ I/O スキーマ 整合チェック表

| 項目 | I/O (YAML) | OpenAPI | 状態 |
|------|------------|---------|------|
| InputMessage.mode | 必須 "shelter" | enum: [shelter] | ✓ |
| RecordEntry.controls | 仮置き {visibility,detail,external_io} | object (任意) | ✓ |
| thread | 必須 | optional | ⚠ 差分 |
| /trigger.reply_to | 任意 | optional | ✓ |
| セキュリティ | Bearer (PoC原則) | ApiKeyAuth (3.1.1) | ⚠ 要揃え |
| /health | スコープ外 | 実装に存在 | ⚠ 要無視 |

## 方針
- 差分⚠は Δ-Knot に記録し、Step2.5 で解消
- /health は PoC 範囲外として仕様上は「無視する」
