# 構造リファクタリング提案

* **目的**：PoCのDoD「ChatGPT⇔ローカル往復が安定・再現」を、誰がいつ走らせても再現できる状態にする。
* **方針**：生成物と手作業資材を分離、運用ドキュメントを定位置化、リスク（秘匿情報／ログ肥大）を事前に封じ込め。

# 気になる点（観点別）

1. 生成物の混在

* `index/`（`lunr.idx.json` など）は**生成物**に見えます。リポジトリに置くなら「生成物」であることを明示し、原則は `build/` や `site/` に退避、CIで再生成可能に。
* `node_modules/` がツリーに含まれていますが、**リポジトリには含めない**前提に（`.gitignore` 必須）。パッケージマネージャは `pnpm` などに固定し、`pnpm-lock.yaml` をコミット。

2. 実証ログと個人情報（PII）

* `chatlogs/` は日付階層が明確で良いです。あわせて以下を推奨：

  * **メタデータ標準化**：各mdのFrontmatterに `source`, `client`, `hash`, `scrubbed:true/false`, `tags`, `run_id` を持たせる。
  * **スクラビング・保管ポリシー**：`docs/policies/data-handling.md` にPIIマスク、保存期間、公開時の除外基準を明文化。
  * **再現手順との紐付け**：`RUNBOOK.md` の各ステップに「どのログが証跡か」をIDでトレース。

3. ドキュメント置き場と命名

* `docs/250918A_PoC` は“日付＋枝番”の意図が伝わりやすい一方、**長期運用では階層ルールを固定**した方が探しやすいです。例：

  * `docs/poc/2025-09-18/`（絶対日付）＋固定ファイル名（`executive-summary.md`, `implementation-report.md`, `poc-plan.md`, `technical-metrics.md`）。
* \*\*ADR（Architecture Decision Record）\*\*を追加：`docs/adr/0001-record-indexing-strategy.md` など、意思決定の履歴を日付で固定。

4. 運用ドキュメントの定位置

* `RUNBOOK.md` は運用の中核。**役割分離**を：

  * `RUNBOOK.md`（手順・復旧）
  * `OPERATIONS.md`（定常運用・ローテ）
  * `SECURITY.md`（鍵・トークン取扱、公開時の手順）
  * `CONTRIBUTING.md` / `CODE_OF_CONDUCT.md`（公開準備）
  * `CHANGELOG.md`（PoCフェーズも含めて変更履歴を絶対日付で）

5. 設定・スキーマの所在

* `openapi.yml`、`schema/`（チャットログのFrontmatter/JSONスキーマ）、`configs/`（`tsconfig.json`, `eslint`, `prettier`, `mcp`設定など）を**ひとまとめ**に。
* `.env.example` を用意し、`.env*` は `.gitignore`。

6. テストと検証の置き場

* **外形試験の再現**を重視：

  * `tests/smoke/`（保存→検索→要約の最短ルート）
  * `tests/e2e/`（MCP/HTTPの往復）
  * `benchmarks/`（簡易メトリクス計測スクリプト）
* `examples/` は\*\*“合格サンプル”\*\*を厳選し、RUNBOOKのステップ番号と対応付け。

7. CI/CD とリリース前提

* `/.github/workflows/` に **lint→build→index再生成→smoke** を流す簡易パイプライン。
* `LICENSE` はMITで決め打ち済みならルート直下へ。将来の公開に向けて準備。

# 提案する最小リファクタ（フォルダ案）

```
.
├── README.md
├── RUNBOOK.md
├── OPERATIONS.md
├── SECURITY.md
├── CHANGELOG.md
├── LICENSE
├── .gitignore
├── .nvmrc            # Nodeバージョン固定（任意）
├── configs/
│   ├── openapi.yml
│   ├── eslint.config.js
│   ├── prettier.config.cjs
│   └── tsconfig.json
├── schema/
│   ├── chatlog.frontmatter.schema.json
│   └── index.stats.schema.json
├── chatlogs/
│   └── 2025/09/2025-09-18-*.md    # Frontmatter標準化＋scrub済みフラグ
├── docs/
│   ├── poc/2025-09-18/
│   │   ├── executive-summary.md
│   │   ├── implementation-report.md
│   │   ├── poc-plan.md
│   │   └── technical-metrics.md
│   ├── adr/
│   │   └── 0001-indexing-strategy.md
│   └── policies/
│       └── data-handling.md
├── examples/
│   └── example-chat-log.md
├── site/             # 生成物（index, lunrなど）→ CIで再生成
│   ├── documents.json
│   ├── lunr.idx.json
│   ├── stats.json
│   └── terms.json
├── scripts/
│   ├── build-index.mjs
│   ├── scrub-chatlogs.mjs
│   └── smoke.mjs
├── tests/
│   ├── smoke/
│   ├── e2e/
│   └── fixtures/
└── .github/
    └── workflows/
        └── ci.yml
```

# Acceptance Criteria（PoC DoDに直結）

* `pnpm install && pnpm run smoke` だけで**保存→検索→要約**の外形試験が**どの環境でも**通る。
* `site/` の生成物は**CIで再現**でき、ローカル差分が出ない。
* `chatlogs/` はFrontmatter準拠・PIIスクラビング済み・保存期間が明文化。
* 主要意思決定は `docs/adr/` に**絶対日付**で残る。

# リスク & 先回りの対策

* **ログの機密性**：`SECURITY.md`に公開/非公開の線引きを明記。公開前に`scripts/scrub-chatlogs.mjs`実行を必須化。
* **属人化**：RUNBOOKの手順に**所要時間と失敗時の分岐**（よくあるエラー→対処）を追記。
* **依存ばらつき**：`.nvmrc` と`pnpm`固定、CIでNodeバージョン明記。

---

このままの骨格で十分進められます。上記の“分離（生成物/ソース/運用）”と“手順の定位置化”だけ整えると、**DoD検収・公開移行**が滑らかになります。必要でしたら、`RUNBOOK.md` の章立てテンプレ（項番・絶対日付併記）もすぐ用意します。
