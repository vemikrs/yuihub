---
doc_type: guide
status: draft
owner: vemikrs
created: 2025-09-23
version: 0.2.0-step2.5-kit
related:
  - docs/TECH_DESIGN_STEP2_5.md
  - docs/COPILOT_INSTRUCTIONS.md
  - docs/WORKFLOW_MIN_STEPS.md
---

# YuiHub Step 2.5 Kit（Shelter最小）

このキットは **GPTs ⇔ YuiHub ⇔ VS Code（GH Copilot）** の最小ループを構成するための“叩き”です。  
索引再生成は **ローカル優先**（pre-commit / VS Codeタスク）とし、**/ops/reindex** エンドポイントもローカル限定で提供します。  
GitHub Actions は **Signal移行の選択肢**としてコメント付きで同梱。

## 収録物
- 技術設計叩き `docs/TECH_DESIGN_STEP2_5.md`
- 運用API設計 `/ops/reindex` `docs/OPS_REINDEX_SPEC.md` + `docs/openapi.yml`
- Copilot指示文 `docs/COPILOT_INSTRUCTIONS.md`
- ミニマム作業手順 `docs/WORKFLOW_MIN_STEPS.md`
- スキーマ雛形 `schemas/*.schema.json`
- 索引ビルド `scripts/build-index.js`
- pre-commitサンプル `scripts/hooks/pre-commit.sample`
- VS Codeタスク `/.vscode/tasks.json`
- （任意）GitHub Actions `/.github/workflows/reindex.yml`（コメント付き）

## ポリシー
- **mode=Shelter** / `visibility=private` / `external_io=off` を既定。
- Signal移行は **チェックリスト通過後** に段階的に。
