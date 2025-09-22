---
doc_type: spec
status: draft
owner: vemikrs
created: 2025-09-21
concept_version: c0.2
doc_version: 0.2.0-doc.1
target_code_tag: v0.2.0-prototype.1
---

# YuiFlow Minimum Spec

## 一行定義
YuiFlow は「型」。語彙と I/O スキーマとコントラクトの“正”を担保する。

## 語彙（最小）
- **Fragment**: 粒。短い出来事／断片。保存の最小単位。
- **Knot**: 束。関連する断片を結ぶ“要点”。差分の節にも使う。
- **Thread**: 筋。目的に沿う時間的な流れ。Knot/Fragment を辿れる。
- **Flow**: 形式。語彙とスキーマ、コントラクトの集合。
- **Hub**: 場。実装／API／保存・検索のランタイム。

> PoC では Mode は **固定（shelter）**。I/O スキーマに `mode` フィールドを**必須**として持たせ、値は `shelter`（定数）。Signal などの可変化は次フェーズで拡張する。

## Lexicon Contracts（Schema Hooks）
- すべての `record.entry` は **`thread` を必須**とする
- `record.entry.kind` を `fragment|knot` とし、既定は `fragment`
- `kind: knot` のときのみ `decision`/`refs[]` を許容
- Context Packet は `input.message[]` / `record.entry[]` の**部分集合**（Thread/タグで抽出可能）

## I/O スキーマ（一次は YAML, JSON は派生）

### input.message.yaml
```yaml
id: msg-<ulid>
when: "2025-09-21T14:00:00+09:00"
source: gpts
thread: th-<ulid>
author: user
text: "保存したいテキスト…"
tags: [flow:test, lang:ja]
meta:
  intent: "save"
  ref: null
```

### record.entry.yaml
```yaml
id: rec-<ulid>
when: "2025-09-21T14:00:01+09:00"
mode: "shelter" # Ph2では定数
controls: # Ph2bでは仮置き
  visibility: internal
  detail: minimal
  external_io: blocked
thread: th-<ulid>
source: gpts
text: "保存したいテキスト…"
terms:
  - "保存"
  - "テキスト"
tags: [flow:test, lang:ja]
links:
  - type: "origin"
    ref: "msg-<ulid>"
```

### agent.trigger.yaml
```yaml
id: trg-<ulid>
when: "2025-09-21T14:00:05+09:00"
type: echo
payload:
  text: "hello agent"
reply_to: th-<ulid>
```
