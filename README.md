# YuiHub: Semantic Memory Layer for Autonomous Agents

YuiHub は、自律エージェント（Copilot, Cline, Devin 等）のための**意味的記憶層 (Semantic Memory Layer)** です。
開発者の思考プロセス、文脈、意思決定をローカルのベクトルストアに蓄積し、エージェントが「文脈の欠落 (Context Hollow)」を起こさずに協働できる基盤を提供します。

## Key Features

### 1. Decision Anchor (意思決定の固定)

流動的な対話や思考を **Checkpoint** として明示的に保存します。
エージェントはこれを参照することで、過去の決定事項を正確に踏まえた提案が可能になります。

### 2. Local-First & Private

デフォルトで **Private Mode** (完全ローカル) で動作します。
**LanceDB** (Vector Store) を内蔵し、外部 API に依存することなく、自身の過去の思考をセマンティック検索できます。未精査の思考プロセス (Raw Thoughts) を外部に漏らす心配はありません。

### 3. Context Packet Generation

過去の **Entry** (メモ) や Checkpoint を統合し、エージェントに渡すための最適化された **Context Packet** (JSON/YAML) を自動生成します。
これにより、LLM の Context Window を浪費することなく、必要な文脈だけを注入できます。

## Use Cases

- **Context Recovery**: 週末明けや割り込み作業後に、"前回の思考の筋 (Session)" を即座に復元する。
- **Agent Handover**: 人間の思考を構造化データに変換し、自律エージェントにタスクを引き継ぐ。
- **Evolutionary Documentation**: チャットログから決定事項だけを抽出し、生きたドキュメントとして育て続ける。

## Documentation

- **Architecture & Philosophy**: [Core Principles](docs/design/core_principles.md)
- **Terminology**: [Glossary](docs/specs/glossary.md)
- **Specifications**: [Specs Directory](docs/specs/)
