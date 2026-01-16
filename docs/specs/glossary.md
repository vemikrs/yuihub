---
doc_type: spec
status: stable
created: 2026-01-17
---

# Glossary (Terminology Standard V1)

YuiHub V1 における標準用語定義。
各用語は **Interface Definition (機能)** と **Cognitive Rationale (認知工学的意図)** の対で定義される。

## Core Terms

### YuiHub (Engine)

- **Interface**: Semantic Memory Layer のランタイム実装。保存・検索・Embedding 生成を担う。
- **Rationale**: 思考と実装を結びつける「結（Yui）」の場。

### Entry (旧 Fragment)

- **Interface**: システムに保存される最小単位の記録要素。Note, Memo, Log。
- **Rationale**: **Volatile Cognitive Log (揮発性認知ログ)**。脳内のワーキングメモリを外部化し、認知負荷を下げるためのスナップショット。

### Checkpoint (旧 Knot)

- **Interface**: 明確な状態保存点。ID を持ち、他の要素から参照される。
- **Rationale**: **Decision Anchor (意思決定の確定ポイント)**。流動的なコンテキストを「決定事項」として固定し、エージェントが参照すべき「正解」を定義する場所。

### Session (旧 Thread)

- **Interface**: 関連する Entry や Checkpoint の時系列および論理的なまとまり。
- **Rationale**: **Cognitive Session**。一貫した目的（Intent）を持つ思考の流れ。文脈の切れ目を定義する。

### Context Packet

- **Interface**: エージェント（Copilot/Cline 等）に入力として渡される構造化データ(JSON/YAML)。
- **Rationale**: **Context Translation Protocol**。人間用の非構造化コンテキストを、LLM が理解可能な形式に翻訳したもの。

## Modes

### Private Mode (旧 Shelter)

- **Interface**: 外部ネットワークへの送信を行わず、ローカルストレージとローカル LLM/Embedding のみで動作するモード。デフォルト設定。
- **Rationale**: **Cognitive Safety**. 外部評価を気にせず、未精査の思考（Raw Thoughts）を自由に出力・整理するための保護領域。

### Public Mode (旧 Signal)

- **Interface**: 指定された範囲（Team/Public）へデータを送信・共有・公開するモード。
- **Rationale**: **Knowledge Broadcast**. 精査された結論や知見を、他者や外部システムへ伝搬・共有するフェーズ。
