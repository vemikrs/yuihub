# GAP-Map: YuiHub Ph2b Step2 構想設計前分析

## 1. GAPマップ（全体俯瞰）

| Area | 期待状態 | 現状 | GAP要約 | 影響度 | 修復コスト | 優先度 | 根拠 |
|------|---------|------|---------|--------|------------|--------|------|
| 思想整合 | MANIFESTO/FOCUS/ETHICSの全項目が実装に反映 | meta/配下に配置済みだが実装との紐付け未検証 | 思想と実装の対応マッピング不在 | High | M | P1 | MANIFESTO.md:全体, 250921B計画:302-307 |
| 語彙整合 | Fragment/Step/Thread/Flowの一貫使用 | lexicon.md存在するが実装側との同期未確認 | 用語の実装反映が部分的 | High | S | P1 | lexicon.md:全体, 250921B計画:65 |
| Hub/Flow分離 | YuiHub(場)とYuiFlow(型)の明確な責務境界 | 計画書にテンプレあるが未作成 | 分離原則ドキュメント未存在 | High | S | P1 | 250921B計画:80-111 |
| I/Oスキーマ | YAML形式の統一I/O定義 | OpenAPIサンプルのみ存在 | YAMLスキーマ定義ファイル不在 | High | M | P1 | 250921B計画:151-234 |
| 検索仕様 | 日本語terms/tokenizer仕様明文化 | text-ja.js実装はあるが仕様文書なし | 日本語処理の規範文書不在 | Med | M | P2 | text-ja.js:全体 |
| ICD定義 | GPTs↔Hub↔Agentの境界定義 | 計画書に記載のみ | ICD技術設計書未作成 | High | M | P1 | 250921B計画:119-128 |
| OpenAPI仕様 | 3エンドポイント(/save,/search,/trigger)定義 | 骨子のみ計画書内に存在 | 正式OpenAPIファイル未作成 | High | S | P1 | 250921B計画:156-234 |
| コントラクトテスト | コントラクトSchema定義と実行分離 | 概念のみ記載 | contracts/ディレクトリ未作成 | Med | M | P2 | 250921B計画:135-139 |
| セキュリティ | 最小権限・Bearer Token方式 | 環境変数は外だしだが原則文書なし | セキュリティ原則の明文化不足 | Med | S | P2 | config.js:全体 |
| DoR/DoD | Step2.5→Step3移行基準明確化 | DoRチェックリスト案のみ | 正式DoR/DoD文書不在 | Med | S | P2 | 250921B計画:144-150 |

## 2. Step2のための情報収集プラン（読みにいく順序）

### 1. 思想文書の確認
- **対象**: MANIFESTO.md, FOCUS.md, ETHICS.md
- **確認観点**:
  - [ ] 中立形式の定義は明確か？
  - [ ] 移植性の具体要件はあるか？
  - [ ] 膨張抑制の判断基準は？
  - [ ] 安心の実装要件は？

### 2. 語彙定義の確認
- **対象**: lexicon.md
- **確認観点**:
  - [ ] Fragment/Knot/Thread/Flowの定義は完備か？
  - [ ] 実装用語との対応表はあるか？
  - [ ] 日英の用語対応は明確か？

### 3. 現計画書の詳細確認
- **対象**: 250921B_Ph2b_Plan_YuiHub-YuiFlow.md
- **確認観点**:
  - [ ] Step2の成果物定義は明確か？
  - [ ] I/Oスキーマ案は使えるか？
  - [ ] DoRチェックリストは完備か？

### 4. 既存実装の構造確認
- **対象**: server.js, search.js
- **確認観点**:
  - [ ] 現在のエンドポイント構成は？
  - [ ] I/O形式の実態は？
  - [ ] Flow準拠可能な構造か？

### 5. 日本語処理の実装確認
- **対象**: text-ja.js, `scripts/create_terms.mjs`
- **確認観点**:
  - [ ] トークナイザーの処理フローは？
  - [ ] ストップワードリストはあるか？
  - [ ] terms生成ロジックは文書化可能か？

## 3. Step2の最小アウトプット叩き（骨子）

### `00_min-spec.md` 骨子

````markdown
---
doc_type: specification
status: draft
version: 0.1.0
---

# YuiFlow Framework 最小仕様書

## 1. 語彙定義
- Fragment: [TODO: lexicon.mdから転記]
- Knot: [TODO: lexicon.mdから転記]
- Thread: [TODO: lexicon.mdから転記]
- Flow: [TODO: lexicon.mdから転記]

## 2. I/Oスキーマ定義

### 2.1 input.message.yaml
[TODO: 250921B計画:InputMessageから生成]

### 2.2 record.entry.yaml
[TODO: 250921B計画:RecordEntryから生成]

### 2.3 agent.trigger.yaml
[TODO: 250921B計画:AgentTriggerから生成]

## 3. 日本語処理規範
- トークナイザー仕様: [TODO: text-ja.jsから抽出]
- ストップワード定義: [TODO: 最小セット定義]
- terms生成アルゴリズム: [TODO: 擬似コード化]

## 4. 非目標（スコープ外）
- UI/可視化機能
- 高度な検索機能（ベクトル検索等）
- 認証・認可の詳細実装
````

### `02_hub-vs-flow-separation.md` 骨子

````markdown
---
doc_type: concept
status: draft
---

# YuiHub × YuiFlow 分離原則

## 一行定義
- **YuiHub**: 実体（ランタイム／API／保存・検索の"場"）
- **YuiFlow**: 型（思想→仕様→コントラクトの"流れ"）

## 責務マトリクス

| 機能領域 | YuiFlow（型） | YuiHub（場） |
|---------|-------------|-------------|
| スキーマ定義 | ✓ 一次定義 | - 準拠実装 |
| ICD定義 | ✓ 境界仕様 | - API実装 |
| コントラクトテスト | ✓ 定義 | - 実行 |
| 日本語処理 | ✓ 規範 | - 実装 |
| 永続化 | - | ✓ 実装 |
| API提供 | - | ✓ 実装 |

## 依存の向き
- Hub → Flow（準拠）
- Flow ↛ Hub（非依存）

## アンチゴール
- Flowに実装詳細を含めない
- Hubに仕様の一次定義を置かない
````

## 4. Step2.5（技術設計確定）のDoRチェック

### Definition of Ready チェックリスト

- [ ] `02_hub-vs-flow-separation.md` レビュー済み **[P1]**
- [ ] OpenAPI `poc.yaml` 3エンドポイント定義完了 **[P1]**
- [ ] 各エンドポイント2例以上のサンプル **[P1]**
- [ ] コントラクトJSON Schema作成済み **[P2]**
- [ ] Schema例がvalidate OK **[P2]**
- [ ] I/O YAML定義とOpenAPI整合性確認 **[P1]**
- [ ] セキュリティ最小原則記載 **[P2]**
- [ ] ログ出力ルール記載 **[P3]**

## 5. 未リポジトリContextの質問リスト（最小）

1. **AI Agent種別は何を想定？**（Echo/Summarize/Custom？）
   - 回答により`agent.trigger.yaml`のtype enumが変わる

2. **本番デプロイ先は？**（Cloudflare/Vercel/Self-hosted？）
   - 回答によりセキュリティ原則の記述レベルが変わる

3. **AUTH_TOKEN発行フローは？**（環境変数固定/動的生成？）
   - 回答により認証仕様の記載内容が変わる

4. **MCP経路は必須？**（HTTP APIのみでも可？）
   - 回答によりICD設計の複雑度が変わる

5. **Thread IDは自動生成？**（ULID/UUID/連番？）
   - 回答によりI/Oスキーマのid仕様が変わる

## 6. 即時アクション（5〜10分でできること）

### 1. docs/yuiflow/ディレクトリ作成と.gitkeep配置

````bash
mkdir -p docs/yuiflow/{openapi,contracts,schemas}
touch docs/yuiflow/{.gitkeep,openapi/.gitkeep,contracts/.gitkeep,schemas/.gitkeep}
````

### 2. 日本語ストップワード最小セット案

````javascript
[
  "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ",
  "ある", "いる", "も", "する", "から", "な", "こと", "として", "い", "や",
  "など", "なっ", "ない", "この", "ため", "その", "あっ", "よう", "また",
  "もの", "という", "あり", "まで", "られ", "なる", "へ", "か", "だ", "これ",
  "によって", "により", "おり", "より", "による", "ず", "なり", "られる", "において",
  "ば", "なかっ", "なく", "しかし", "について", "だけ", "でも", "だっ", "てき"
]
````

### 3. FREEZE-LOG.md追記テンプレート

````markdown
## Phase 2b - Step 2 (2025-09-21)
- YuiFlow Framework 構想設計開始
- docs/yuiflow/ 構造確定
- I/Oスキーマ第一版策定
````

### 4. 最小OpenAPI雛形作成

````yaml
openapi: 3.0.3
info:
  title: YuiHub PoC API
  version: 0.1.0
  description: YuiHub with YuiFlow Framework - Minimum PoC API
servers:
  - url: http://localhost:3000
    description: Local development
paths:
  /save:
    post:
      summary: Save message to YuiHub
      operationId: saveMessage
      tags: [core]
      # TODO: 完全定義
  /search:
    get:
      summary: Search messages
      operationId: searchMessages
      tags: [core]
      # TODO: 完全定義
  /trigger:
    post:
      summary: Trigger agent action
      operationId: triggerAgent
      tags: [agent]
      # TODO: 完全定義
````

---

**次のステップ**: 上記GAPマップのP1項目から順次対応し、Step2成果物を作成してください。
