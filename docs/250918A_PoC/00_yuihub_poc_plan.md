# PoC作業計画書 — YuiHub（会話メモリ横断基盤 × MCP / Actions）
最終更新: 2025-09-18 08:15 UTC+09:00

---

## 1. 背景（根源情報）

### 1.1 現場課題（わたし要件）
- **チャット駆動の設計・方式決定が埋没**：ChatGPT / Copilot Chat / Claude / Perplexity 等での会話の流れ・判断根拠が分散・散逸し、後で**拾い戻し**や**横断参照**が困難。  
- **ベンダー／プラン差の摩擦**：ChatGPT Plus では GitHub コネクタが通常チャットで使えない等、**機能差によるワークフロー分断**が発生。Deep Research は上限が厳しい。  
- **ロックイン回避・最小費用**：特定AIや特定SaaSに依存した月額“数万円”運用を避け、**自分で持てる外部記憶（データ主権）**を確立したい。  
- **UXは戦略上「控えめで可」**：まずは**機能の再現性・継続性・移行容易性**を優先。

### 1.2 技術トレンド（前提）
- **MCP（Model Context Protocol）**がクライアント横断の標準候補として浸透（Claude Desktop / VS Code / Cursor / Continue など）。  
- **Notion / Perplexity 等のコネクタ路線**は進展中だが、「**複数AIの会話メモリ**の横断統合」は未充足。  
- **最小コスト検索**は、全文検索（例: Lunr 事前索引）→必要に応じて軽量ベクタ（sqlite-vec / Workers + Vectorize）への**段階導入**が実用的。

### 1.3 YuiHub が目指すもの
- **複数AIの“会話メモリ”**（会話の流れ・意思決定・根拠）を**中立フォーマット**で外部化・横断検索・双方向に書き戻す**薄い核**。  
- **MCP と HTTP を二面で提供**：MCP 対応クライアントはそのまま、ChatGPT Plus 等は HTTP Actions で同じ API を叩ける。  
- **OSS・ロックイン最小・運用費極小**：まずは全文検索のみでゼロ〜極小コスト、必要時にだけ強化。

---

## 2. 目的とゴール（DoD）

**目的**：AI横断で「会話→保存→検索→再編集→書き戻し」が**1つの外部記憶**を通じて回ること。

**Done 条件**：
- チャットから出力した **SAVE ブロック**（YAML + Markdown）を **`POST /save`** で受け、**GitHub（またはローカル / Notion）**へ .md 永続化。  
- **`GET /search`**（全文/Lunr）で **10–20 秒以内**にスニペット付きヒット返却。  
- **MCP サーバ経由**で Claude / Continue / Cursor / VS Code から同等機能を利用可能。  
- GitHub Actions で **週次要約**・**用語逆引き**・**Lunr索引 JSON** を自動生成。  
- **最小権限・監査ログ**（誰がいつ何を保存したか）を保持。

---

## 3. 原則（設計ポリシー）

- **中立フォーマット**：YAML Front‑Matter + Markdown。データの寿命・移植性を最優先。  
- **二面 API**：MCP（Tools/Resources）と HTTP（OpenAPI）。同じ契約で実装。  
- **段階的検索**：まず全文（Lunr）→必要時のみベクタへ拡張。  
- **書き戻し前提**：読み取りだけでなく、**決定レジャー**として更新・再編集・再コミットを重視。  
- **ロックイン回避**：保存先はアダプタ化（GitHub / ローカル / Notion）。  
- **最小コスト運用**：GitHub Pages / Cloudflare Pages + 事前索引でゼロ円運用を基本。

---

## 4. 成果物（Deliverables）

1. **YuiHub API（HTTP）**
   - `POST /save`：SAVE 受け取り→保存（アダプタ切替）。
   - `GET /search?q=`：Lunr 事前索引検索→スニペット返却。  
   - `GET /recent?n=`：最近の決定事項一覧。  
   - （任意）`POST /commit-md`：固定ディレクトリへのコミット（書戻し）。

2. **YuiHub MCP サーバ**  
   - 上記 API を MCP の **Tools/Resources** として公開。

3. **索引・自動化**  
   - `scripts/chunk_and_lunr.mjs`（チャンク化→Lunr JSON 生成）  
   - `scripts/build_terms.mjs`（用語逆引き）  
   - `scripts/summarize_weekly.mjs`（週次要約）  
   - GitHub Actions ワークフロー  
   - 静的検索 UI（Astro / MkDocs いずれか）

4. **保存スキーマ v0（SAVE ブロック）**
```yaml
---
id: ulid()                 # 一意ID
date: 2025-09-18T21:00+09:00
actors: [chatgpt, copilot, claude]
topic: UXDL / 会話メモリ統合
tags: [uxdl, memory, rag]
decision: 採用|保留|却下
links: [https://...]
---
## 要点（3行）
- …
- …
- …
## 本文
（会話抜粋／根拠／引用）
```

5. **ガイド**：README / RUNBOOK（導入・権限・運用・データモデリング）

---

## 5. スコープと非スコープ（PoC）

- **スコープ**：保存・全文検索・二面 API（MCP/HTTP）・GitHub/ローカル保存・週次要約・用語逆引き・最小 UI。  
- **非スコープ**：高度なRBAC/SSO、PII自動マスキング（v0は手動）、埋め込みVSS（任意拡張）、大規模クローリング。

---

## 6. アーキテクチャ（概略）

```
[ChatGPT (Plus)] --(HTTP Actions)--> [YuiHub API] --(Adapter)--> [GitHub / Local / Notion]
[Claude/Continue/Cursor/VS Code] --(MCP)--> [YuiHub MCP] --> [YuiHub API] --> [同上]
                                               |
                                       [Lunr Index JSON]
                                               |
                                   [Static Search UI (Pages)]
```

- 保存先アダプタ：初期は **GitHub / ローカル**、必要で **Notion** を追加。  
- 将来：**sqlite-vec / Vectorize** を検索層に差し込み（APIは据え置き）。

---

## 7. API 仕様（最小）

### 7.1 `POST /save`
**Req**
```json
{
  "frontmatter": {
    "id": "01J...",
    "date": "2025-09-18T21:00+09:00",
    "actors": ["chatgpt","copilot"],
    "topic": "UXDL / 会話メモリ統合",
    "tags": ["uxdl","memory","rag"],
    "decision": "採用",
    "links": ["https://..."]
  },
  "body": "## 要点...\n- ...\n\n## 本文\n..."
}
```
**Res**
```json
{"ok": true, "path": "chatlogs/2025/09/18-uxdl-memory-01J....md", "url": "https://..."}
```

### 7.2 `GET /search?q=...&limit=10`
**Res**
```json
{"hits":[{"id":"01J...","score":12.3,"title":"UXDL / 会話メモリ統合","path":"chatlogs/...md","snippet":"...","url":"https://..."}]}
```

### 7.3 `GET /recent?n=20`
- 直近の `decision` 付きノートの一覧を返却。

### 7.4 （任意）`POST /commit-md`
- 明示的に .md を指定パスへコミット（固定ディレクトリ・固定ブランチ）。

---

## 8. MCP（抜粋）

**Tools**
- `save_note(frontmatter: object, body: string) -> {ok, path}`  
- `search(q: string, limit?: number) -> hits[]`  
- `recent(n?: number) -> items[]`  

**Resources**
- `yui://note/{id}`（個別ノート）

**Transport**：stdio / SSE のいずれか。

---

## 9. リポジトリ構成（提案）

```
yuihub/
├─ packages/
│  ├─ api/                 # Cloudflare Workers or Node (Express/Fastify)
│  ├─ mcp/                 # MCP server (api をラップ)
│  └─ ui/                  # 静的検索UI（Astro/MkDocs）
├─ scripts/                # 索引・用語・要約
├─ index/                  # lunr.idx.json / terms.json
├─ chatlogs/               # 保存先（Git 管理）
├─ .github/workflows/build.yml
└─ README.md / RUNBOOK.md
```

---

## 10. スケジュール（目安：合計 2.5〜3.0 日）

- **Day 0.5** 準備：雛形作成・Secrets 保管・SAVE テンプレ整備。  
- **Day 1.0** API 最小実装：`/save` `/search` `/recent`（GitHub/ローカル アダプタ）。  
- **Day 0.5** Actions（ChatGPT）＆最小 UI：OpenAPI 取込、静的検索。  
- **Day 0.5** 索引自動化：GH Actions + Lunr 索引・週次要約・用語逆引き。  
- **Day 0.5** MCP：Tools/Resources 実装、Claude/Continue 接続確認。  
- **残余** 取り込み導線（Copilot/Claude ログ→SAVE 変換）、Docs 仕上げ。

---

## 11. 受け入れ条件（テスト）

- **保存**：Actions から `POST /save` → 数秒で .md 作成、URL 返却。  
- **検索**：`q=決定キーワード` で **10–20 秒**にヒット返却（ローカル or Pages）。  
- **双方向**：Claude（MCP）から `save_note` / `search` が成功。  
- **自動化**：`push` で `lunr.idx.json` / 週次要約 / 用語逆引きが更新。  
- **権限**：書戻しは固定パスのみ、監査ログ記録。

---

## 12. セキュリティ／運用

- **最小権限**：PAT/トークンはサーバ側に保管、**書込スコープ最小**・**固定パス**のみ許可。  
- **監査**：`/save` `/commit-md` の呼出ログ（who/when/what）を永続化。  
- **PII**：v0 は手動（`pii: true/false`）。将来、簡易マスキングを追加。  
- **バックアップ**：Git リモート／謄写、Notion ミラー運用は任意。

---

## 13. ロードマップ（拡張）

- **検索強化**：sqlite-vec / Workers + Vectorize による類似検索。  
- **保存先拡張**：Notion / SharePoint / Dropbox アダプタ。  
- **取り込み器**：Copilot / Claude / Perplexity のログ → SAVE 変換。  
- **組織モード**：RBAC / 監査UI / 暗号化 / 保持ポリシー。  
- **指標ダッシュボード**：決定件数、再利用率、拾い戻し時間。

---

## 14. 差別化と共存（要約）

- **会話特化**：文書RAGではなく**会話の意思決定レジャー**に最適化。  
- **MCP + HTTP**：どの AI クライアントでも同じ外部記憶を利用。  
- **ゼロ円運用起点**：全文→必要時のみベクタ。  
- **Notion/Perplexityと共存**：必要に応じて Notion API にミラー、Perplexity 連携はブリッジで吸収。

---

## 15. 成功指標（KPI）

- **拾い戻し時間**：ヒットまで 10–20 秒。  
- **操作手数**：保存→コミットが 1–2 操作。  
- **再利用**：MCP/Actions 双方で同一データ往復。  
- **運用費**：月ゼロ〜極小（全文のみ時）。

---

## 付録 A：プロンプト例（SAVE）

```
この会話を保存します。以下のテンプレで出力してください。

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
...
END
```

## 付録 B：GitHub Actions（骨子）

```yaml
name: build-index
on:
  push:
    paths: ['chatlogs/**.md']
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {{ node-version: '20' }}
      - run: npm ci
      - run: node scripts/chunk_and_lunr.mjs
      - run: node scripts/build_terms.mjs
      - run: node scripts/summarize_weekly.mjs
      - run: |
          git config user.name "yuihub-bot"
          git config user.email "bot@example.com"
          git add index/ summaries/
          git commit -m "build: index & weekly summary" || echo "no changes"
          git push
```
