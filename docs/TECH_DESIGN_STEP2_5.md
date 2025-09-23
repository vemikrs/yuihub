---
doc_type: tech_design
status: draft
owner: vemikrs
created: 2025-09-23
version: 0.2.0-step2.5-draft.2
target_code_tag: v0.2.0-prototype.1
related:
  - meta/MANIFESTO.md
  - meta/appendix.lexicon.md
  - docs/openapi.yml
---

# 技術設計（Step 2.5）叩き – YuiHub / YuiFlow PoC（Shelter最小）

> 目的：**Ph2b**における「思想→実装」の橋渡しを最小で確実に行う。Shelter基準で進め、Signal移行はつまみ（visibility/detail/external_io）で制御する。

## 1. アーキ概要（Minimum）

```
GPTs (MCP/ファイル出力)
   └─[MD+YAML write]──> yuihub repo (WSLローカル)
                         ├─ scripts/build-index.js（lunr）
                         ├─ /ops/reindex（ローカル限定）
                         ├─ .git/hooks/pre-commit（FREEZE & reindex）
                         └─ .vscode/tasks.json（手動reindex）
VS Code (GH Copilot) ──(編集)──┘
```

- **哲学の旗** = Mode（Shelter/Signal）
- **技術のつまみ** = `visibility`, `detail`, `external_io`（front-matterで管理）
- 索引は **ローカル優先**。ActionsはSignal段階で選択肢に降格。

## 2. ディレクトリとFREEZE（PoC）

```
/meta /docs /notes /logdocs /scripts /index /.vscode /.github
FREEZE … コード・構成凍結フラグファイル
```

**pre-commit（FREEZE中の保護 + 再索引）**（サンプルは `scripts/hooks/pre-commit.sample` を参照）

## 3. フロントマター最小スキーマ

```yaml
doc_type: <manifesto|lexicon|guide|logdoc|delta|packet|thread>
status: <draft|active|archived>
mode: <Shelter|Signal>            # default: Shelter
visibility: <private|internal|public>
detail: <minimal|normal|rich>
external_io: <off|limited|on>
owner: vemikrs
created: 2025-09-23
updated: 2025-09-23
tags: [yuihub, ph2b, v0.2.0]
related: []
```

## 4. I/Oコントラクト最小（抜粋）

- `input.message.yaml`（UXDL→記録）
- `record.entry.yaml`（内部記録）
- `agent.trigger.yaml`（reindex/publish等の操作）

## 5. 運用API `/ops/reindex`（Shelter限定）

- `127.0.0.1` バインド、Bearerトークン必須、FREEZE尊重
- 同期 200 → 将来 202 非同期化へ拡張

## 6. API/サーバ骨子 & 索引

- OpenAPI は `docs/openapi.yml` を参照
- `scripts/build-index.js` は notes/logdocs を走査し `index/lunr.idx.json` を生成

## 7. GitHub連携（段階的）

- **Shelter期**：ローカルのみ（pre-commit / VS Codeタスク）
- **Signal期**：Actionsで索引CI化、公開導線へ接続

## 8. テスト方針（PoC）

- スキーマ検証（ajv）
- 索引E2E（Stub文書でヒット確認）
- FREEZEフローの静的テスト

## 9. マイルストーン（9/23–10/07）

- M1：I/Oスキーマ確定（~09/26）
- M2：FS ingest/search + Lunr（~09/30）
- M3：/ops/reindex 実装（~10/02）
- M4：Signal試験（限定公開）（~10/07）
