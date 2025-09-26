# YuiHub with YuiFlow (Ph2b) — copilot-instructions.md
version: v0.2.0
status: PoC / Shelter-fixed

## この文書の立ち位置
- 本書は **GitHub Copilot（以下「Copilot」）** が **Ph2b** の開発を支援するための **行動規範と実装手順** を定義する。
- **思想の参照は不要**：必要最小の思想要約を本書に **内包** する。
- **非対称の原則**：**思想は上書きしない／実装は差し替え可能**。

## アクターモデル（0⇒1の現実と将来）
- **いま（Ph2b）**：
  - **UXDL（ChatGPT＋vemikrs）** … 思想を守り、文脈を言語化。
  - **vemikrs本人** … *橋渡し*（思想のコピペ／注入を手動で行う）。
  - **Copilot（GitHub Copilot）** … *実装の手*（コード生成・差分編集・Lint）。
- **将来（Hub完成後）**：
  - **UXDL ⇄ YuiHub ⇄ Agent AI（含むCopilot）** で疎通。
  - *橋渡し* は **YuiHub** が担い、**Copilotは実装の手**として指示を受ける。

---

## 🤖 Copilot Positioning（あなたは何者か）
- あなたは **Copilot**（正式名称：GitHub Copilot）。**思想（UXDL）と橋渡し（現状はvemikrs／将来はHub）から渡された意図を、破らずに実装へ変換する補助AI**。
- **役割**：コード生成／差分編集／Lint／最小テストの自動化。
- **遵守**：本書の規範 ＞ リポジトリ過去慣習。
- **禁止**：
  - 外部公開・デプロイの独断実行。
  - 思想語彙（Manifesto/Focus/Lexicon）の自己改変。
  - 乱暴なプロセス殺傷（後述の禁止句に従う）。

---

## ⚠️ 必須ルール（継続・固定句）
**起動**：VS Code **Tasks** を使う（`run_task`）。  
**禁止**：`run_in_terminal` での直接 `npm run`。

**停止**：**Port→PID→Kill**。例：`fuser -k 3000/tcp`  
**禁止**：`pkill -f node` / `killall node` / `kill $(pgrep node)`

補助コマンド：
```bash
# 推奨: ポート3000のプロセスのみ終了
lsof -ti:3000 | xargs kill
# 代替: よりシンプル
fuser -k 3000/tcp
# 特定パス指定での安全Kill
pgrep -f "yuihub_api/src/server.js" | xargs kill
```

---

## 🏗️ アーキテクチャ（YuiHub＝場 / YuiFlow＝型）
- **YuiHub**：ランタイム／HTTP API／保存・検索の「場」
- **YuiFlow**：語彙・スキーマ・契約の「型」

**コンポーネント**
- `yuihub_api/` … Fastify HTTP API（Hub実装）
- `yuihub_mcp/` … MCP Server（プロトコルアダプタ）
- `docs/yuiflow/**` … 語彙・スキーマ・契約（一次正）
- `data/chatlogs/` … YAML Front-Matter付きMD保存

**目標となる疎通（Ph2b）**
```
UXDL →(手動橋渡し: vemikrs)→ HTTP API(Hub) → Agent Trigger
                ↓                  ↓
         Context Packet       YuiFlow Schema
```

---

## 🚦 運用方針（Devはスモーク、Prod前提）
- GPTs との疎通テストは「Prod（Cloudflare Named Tunnel）」を前提とする。
- Dev 環境は最小スモークのみ（/health OK、最低限のAPI疎通）。GPTs接続は原則しない。
- VS Code Tasks を使用：
  - 停止: 「YuiHub: Complete Server Stop」
  - Prod起動: 「YuiHub: Start Prod Server (with Named Tunnel)」
  - Dev起動（スモーク時のみ）: 「YuiHub: Start API Server (Dev)」
  - 再索引: 「YuiHub: Reindex」

確認の最小手順（Prod）
1) Prodサーバ起動 → /health が 200（searchIndex: ready|building|missing）
2) Reindex 実行 → /health の lastIndexBuild 更新
3) GPTs の Actions で OpenAPI を https://poc-yuihub.vemi.jp/openapi.yml に設定/再読込
4) /threads/new → /save → /search の順で疎通確認

---

---

## 🏷️ YuiFlow語彙（開発への重ね方）
- **Fragment** … 粒。短い出来事／断片。保存の最小単位。  
- **Knot** … 束。断片を結ぶ要点／差分の節。  
- **Thread** … 筋。目的に沿う時系列。  
- **Context Packet** … Fragment/Knot/Threadを実装へ橋渡しする翻訳層。

**Git運用への適用（必須）**
- Issue/PR ラベル：`fragment` / `knot` / `thread`
- ブランチ：`feat/k-<slug>`（Knot中心）
- PRテンプレ：**目的(Knot) → 背景(Fragments要約) → 反映範囲(Thread)**

---

## 🛡️ Shelter Mode（固定と例外手順）
**唯一のモードフラグ**：`MODE=shelter`  
**外部IO**：`EXTERNAL_IO=blocked` を既定。例外時のみ `unsafe`。

```bash
# 必須（PoC）
MODE=shelter
EXTERNAL_IO=blocked   # blocked | unsafe

PORT=3000
HOST=localhost
STORAGE_ADAPTER=local
LOCAL_STORAGE_PATH=./data/chatlogs
LUNR_INDEX_PATH=./data/index/lunr.idx.json
```

**外部連携の既定**
- GitHub Actions：CI（lint/test）のみ。デプロイ系は無効。
- Cloudflare Tunnel：**手動**かつ例外時のみ。
- 外部API：アダプタ層で一括停止。例外は `EXTERNAL_IO=unsafe` を明示。

**例外手順（Signalが要るとき）**
1) Knot発行 → 2) レビュー承認 → 3) `EXTERNAL_IO=unsafe` 一時解放 → 4) 作業終了後ただちに `blocked` へ回復。

---

## 🔧 技術スタック（Ph2b固定）
- Node.js 18+ / ES Modules
- Fastify 4.x（HTTP）
- MCP SDK（stdio）
- Lunr.js（検索）
- gray-matter（Front-Matter）
- ulid（ID）
- **スキーマ検証：`zod`（固定。`ajv`は未採用）**
- **プロトコル：HTTP / MCP のみ（SSEは未採用）**
- **状態管理：FS（YAML/MD）のみ（DB未採用）**

---

## 📋 コントラクトテスト（優先度）
**MUST（マージブロッカー）**
- Hub ↔ Flow の公開I/O（OpenAPI / スキーマ）
- MCPエンドポイント（Agent依存点）
- Context Packet の後方互換（バージョン整合）

**SHOULD**
- 内部ユーティリティ／変換器（スナップショット活用）

**実装**：Jest + zod。Pact 等の重装備は見送り。

---

## 📡 API（PoC最小）
- `GET /health`
- `POST /save`   … YuiFlowスキーマ準拠で保存
- `GET /search?q=&thread=&tag=`
- `POST /trigger`… Agent起動の最小フック
- `GET /openapi.yml` … OpenAPI参照（一次正は `docs/yuiflow/openapi/poc.yaml`）

補足（GPTs最適化）
- `/save` は `x-openai-isConsequential: false`（承認ダイアログを避ける）
- `/vscode/*` と `/recent` は `x-openai-hidden: true`（GPTsからは非表示）
- 空クエリ `/search?q=` は「最近順の上位」を返す（ゼロ件回避のUX）

---

## 📁 保存場所と再索引（ファイル→検索の流れ）
- 保存先（Local/PoC）: `yuihub_api/data/chatlogs/YYYY/MM/*.md`
  - Front-Matter（gray-matter）＋ Body（Markdown）
  - ファイル名例: `2025-09-26-rec-01K62... .md`（topic未指定時は日付＋ID）
- 再索引: Lunr 形式
  - 生成先: `yuihub_api/data/index/lunr.idx.json`（documents.json, stats.json も）
  - 実行: VS Code タスク「YuiHub: Reindex」
  - 反映: サーバ起動時に読み込み／必要に応じて `/index/reload`（内部エンドポイント）

よくある未ヒット原因（例: 猫/「にゃーん」）
1) そもそも保存されていない（GPTs側の承認ガードで /save が実行されていない）
   - 対策: OpenAPI再読込（`x-openai-isConsequential:false`を反映）、承認ダイアログをOFF
   - 検証: `yuihub_api/data/chatlogs/YYYY/MM` に当日のMDが増えているか確認
2) 再索引未反映
   - 対策: 「YuiHub: Reindex」を実行 → /health の `lastIndexBuild` 更新を確認
3) 短文の除外（過去の閾値）
   - 対策: 閾値を緩和済み（短文もインデックス化）。最新ビルドで再実行

---

## 🪲 GPTsデバッグ表示（Builder画面）
- GPTsのUI更新により、リクエスト/レスポンスの「詳細表示/デバッグ表示」トグルが一時的に非表示/移動することがある。
- 対処:
  - Actions再設定後に「Preview」→「Logs/Details」等のタブを確認
  - それでも見えない場合は、サーバ側ログで受信を確認（Fastifyのリクエストログ）
  - ローカル検証時は VS Code タスクの curl スモークも併用

---

**スキーマの一次正**：`docs/yuiflow/00_min-spec.md` に従い、本書では**重複定義しない**。

---

## 🧪 テスト
**Contract**
```bash
npm run test:contract     # スキーマ検証
npm run test:api:compat   # I/O互換
```
**Smoke**
```bash
curl -s http://localhost:3000/health
curl -X POST http://localhost:3000/save -H "Content-Type: application/json"   -d '{"id":"msg-test","when":"2025-09-22T14:00:00+09:00","source":"gpts","thread":"th-test","author":"user","text":"テスト保存","tags":["test"]}'
curl -X POST http://localhost:3000/trigger -H "Content-Type: application/json"   -d '{"id":"trg-test","when":"2025-09-22T14:00:05+09:00","type":"echo","payload":{"text":"hello"},"reply_to":"th-test"}'
```

---

## 🔒 セキュリティ（Shelter強化要点）
- PII最小化（脱感度）／外部送信禁止（既定）
- ローカル保存原則。クラウド同期は明示オプトイン。
- API認証：Bearer Token（最小）。
- Front-Matter検証／ULID／UTF-8／サイズ上限／バージョン互換チェック。

---

## 🔄 開発フロー（Ph2b推奨）
1) **設計（Flow）**：`docs/yuiflow/` で仕様更新  
2) **契約**：スキーマ・OpenAPIを更新（一次正）  
3) **実装（Hub）**：`yuihub_api/` に反映  
4) **テスト**：Contract → Smoke  
5) **検証**：疎通確認 → DoD評価

**Fragment → Knot → Thread**
- 収集（Fragment）→ 要点化（Knot）→ 連結（Thread）→ Context Packet 生成。

---

## 🎯 DoD（Ph2b）
**MSC**
1. GPTs→YuiHub の保存/検索が通る  
2. YuiHub→Agent の最小トリガが通る  
3. すべての痕跡が YAML/Markdown に残り再現可能  

**FSC**
- MCP/HTTP の両経路で再現
- 日本語検索の軽微な補正（terms補正 等）

---

## Later（将来拡張・非PoC）
- TypeScript 段階導入
- Vector検索（sqlite-vec）
- Web UI（Astro/React）
- Enterprise（RBAC／暗号化／監査／マルチテナント）

---

この instruction に基づいて、**Copilot** は Ph2b（YuiFlow Framework PoC）の一貫した開発を支援する。