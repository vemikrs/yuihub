---
doc_type: design
status: stable
created: 2026-01-17
---

# Governance & Operational Guidelines

YuiHub のアーキテクチャと思想（Core Principles）を維持するための運用ガイドライン。

## 1. Principles of Implementation

### Traceability by Design

すべての実装は、ユーザーの操作や思考の履歴を**追跡可能（Traceable）**な状態で保存しなければならない。
ログを捨てる最適化は禁止する。ストレージ容量よりも、文脈の再現性を優先する。

### Revisit as a Feature

ユーザーが過去の Checkpoint に立ち戻り、そこからフォーク（分岐）して思考をやり直せる機能を、コア機能として提供する。
これはエラー訂正のためだけでなく、「思考の探索（Exploration）」を支援するためである。

## 2. Decision Making Criteria

機能追加や変更を行う際は、以下の基準で判断する。

1.  **Does it preserve context?**
    その機能は、文脈を保存するか、それとも断絶させるか？ 断絶させるなら却下する。
2.  **Is it local-first?**
    その機能は、オフラインのローカル環境で動作するか？ 外部依存（Cloud API 等）が必須なら、Option 扱いとする。

## 3. Anti-Patterns (To Avoid)

- **Context Optimization Abuse**: 速度のために過去のログを過剰に要約・削除し、原文脈（Raw Context）を失うこと。
- **Premature Broadcasting**: 思考が固まる前（Checkpoint 化前）の情報を外部へ送信・共有させようとする UI/UX。
