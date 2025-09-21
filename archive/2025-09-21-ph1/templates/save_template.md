# SAVE テンプレート

この会話を保存します。以下のテンプレで出力してください。

```
SAVE:
---
id: {{ulid}}
date: {{ISO8601+09:00}}
actors: [chatgpt]
topic: {{短い主題}}
tags: [{{,区切り}}]
decision: {{採用|保留|却下}}
links: [{{任意URL}}]
---
## 要点（3行）
- ...
- ...
- ...

## 本文
（会話抜粋／根拠／引用）
END
```

## パラメータ説明

- **id**: ULID形式の一意識別子
- **date**: ISO8601形式のタイムスタンプ（UTC+09:00）
- **actors**: 会話参加者（chatgpt, claude, copilot, perplexity等）
- **topic**: 会話の主要テーマ
- **tags**: カテゴリ分類用タグ（カンマ区切り）
- **decision**: 意思決定状況（採用/保留/却下）
- **links**: 参照URL（配列）