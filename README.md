# YuiHub Prototype — AI会話の連続性を守る外部記憶

YuiHub は、AIとの対話や開発過程で失われやすい **判断の筋** を守るための OSS Prototype（試作版）です。  
「思想の翻訳装置」というコンセプトを、Fragment → Knot → Thread → Context Packet の流れとして最小実装しました。  
本リポジトリは実用製品ではなく、コンセプトを体験できる **試作的プロトタイプ** として公開しています。  

---

## Why YuiHub?

AIとの会話は一瞬で流れ去り、成果物だけが残って「なぜそう判断したか」は失われがちです。  
YuiHub は、その判断理由や意図を **一本の筋** として結び直すことを目的としたプロジェクトです。  
単なるログ保存ではなく、Fragment → Knot → Packet による「判断の連続性を守る外部記憶」としてのPoCを行っています。  

* **Continuity with Velocity** — 速度を保ちつつ、連続性を犠牲にしない。  
* **Traceability by Design** — 根拠や判断にすぐアクセスできる形で残す。  
* **Intent before Implementation** — 実装は常に意図に従属させる。  

詳細は [meta/MANIFESTO.md](meta/MANIFESTO.md) / [meta/ETHICS.md](meta/ETHICS.md) を参照ください。

---

## Project Status

> **Prototype**
> 本プロジェクトは思想検証フェーズにあり、API/仕様は安定していません。
> **Shelter Mode** を基本とし、内部利用を優先しています。

---

## Quickstart（ローカルAPIサーバ）

以下は「ローカルで API サーバとして使えるまで」の最小手順です。

### 0. 前提
- Node.js 22 系（推奨）
- Linux/macOS（Windows は WSL 推奨）

### 1. Clone & Install
```bash
git clone https://github.com/vemikrs/yuihub.git
cd yuihub
npm install
```

### 2. .env を用意（開発モード）
ルート直下に `.env` を作成します（`.env.example` をコピーして最小構成にします）。

```
NODE_ENV=development
PORT=3000
HOST=localhost

# Ph2b 既定
MODE=shelter
EXTERNAL_IO=blocked

# 保存と索引の保存先（デフォルトのままでOK）
DATA_ROOT=./yuihub_api/data
LOCAL_STORAGE_PATH=./yuihub_api/data/chatlogs
LUNR_INDEX_PATH=./yuihub_api/data/index/lunr.idx.json
TERMS_INDEX_PATH=./yuihub_api/data/index/terms.json
STATS_PATH=./yuihub_api/data/index/stats.json
```

開発モード（NODE_ENV=development）では認証は無効化され、トークン無しで試せます。

### 3. API サーバを起動

- VS Code Tasks（推奨）: 「YuiHub:API:Start (Dev)」
- もしくは npm スクリプト: `npm run dev:api`

起動後、ログに `listening on localhost:3000` が出ればOKです。

### 4. ヘルスチェック
`GET http://localhost:3000/health` が 200 を返せば起動成功です。

### 5. Thread を発行（/threads/new）
現状、Thread ID の初期発行が必要です。まずは1つ発行します。

```bash
curl -s -X POST http://localhost:3000/threads/new
```

レスポンス例（抜粋）:
```json
{ "ok": true, "thread": "th-01HZ...", "timestamp": "..." }
```

### 6. Fragment を保存（/save）
`/save` は YuiFlow の InputMessage 形式です（最低限: source, thread, author, text）。

```bash
curl -s -X POST http://localhost:3000/save \
	-H "Content-Type: application/json" \
	-d '{
		"source":"human",
		"thread":"th-ここに手順5で得たID",
		"author":"user",
		"text":"初期Fragmentのテスト",
		"tags":["test"]
	}'
```

保存に成功すると `ok: true` と保存されたID/時刻が返ります。保存直後は検索の即時反映（デルタ適用）も働きます。

### 7. 検索（/search）

```bash
curl -s "http://localhost:3000/search?q=初期"
```

クエリ無し（`/search?q=`）の場合は最近ドキュメント上位を返します。タグやスレッドで絞込も可能です（例: `&tag=test` / `&thread=th-...`）。

### 8. （任意）再索引の実行
大量に投入した後などは再索引を行うと安定します。

- VS Code Tasks（稼働中サーバ向け）: 「YuiHub:Index:Reindex:OPS」
	- サーバに対して正攻法で再構築（IndexManager経由）。`/health` の `lastIndexBuild` が更新されます。
- 代替（ローカル実行）: 「YuiHub:Index:Reindex:Local」
	- サーバ停止中やローカルで一気に再構築したい場合に利用します。
 - HTTP API: `POST http://localhost:3000/index/rebuild`

---

補足
- 本番相当（NODE_ENV=production）では認証が有効になります。`API_TOKEN` を設定し、`Authorization: Bearer <token>` もしくは `x-yuihub-token: <token>` ヘッダーを付与してください。
- ポート競合時は VS Code Tasks の「YuiHub:API:Stop:Force (Port 3000)」または「YuiHub:API:Stop:All (Force)」を利用してください。
- OpenAPI は `GET /openapi.yml` から取得できます（PoC段階では、ChatGPT Actionsをターゲットにしています）。

YuiHub は保存した断片を索引化し、Context Packet として取り出せます。

---

## Contributing

Issue / PR 歓迎です。
~~詳細は [CONTRIBUTING.md](CONTRIBUTING.md) を参照ください。~~ 🚧準備中🚧

---

## License

[MIT](LICENSE)
