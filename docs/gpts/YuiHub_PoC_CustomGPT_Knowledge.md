# YuiHub PoC — Custom GPT 知識ファイル

この文書は、ChatGPT の Custom GPT（以下 GPTs）が YuiHub と正しく疎通し、会話メモを保存・検索できるようにするための最小・実務向けナレッジです。

YuiHub の思想（Flow＝型／Hub＝場）は docs/yuiflow 配下を一次正とし、本書は運用ヘルパーに徹します。

---

## 目的と役割
- 目的: GPTs が YuiHub へ安全に保存・検索を行うための設定・手順を提供
- 役割: 仕様の補助（保存前の thread 発行などの運用ルール）
- スコープ外: コア仕様の再定義（docs/yuiflow の一次正は変更しない）

---

## 接続情報（Actions）
- Schema URL: `https://poc-yuihub.vemi.jp/openapi.yml`
- 認証方式: API Key（Header）
  - Header 名: `x-yuihub-token`
  - 値: 運用側で配布した API トークン（.env の `API_TOKEN` と一致）
- 備考: サーバは Authorization: Bearer も許可していますが、OpenAPI の一次正は `x-yuihub-token` です。

---

## 必須フロー（保存時の手順）
YuiFlow の型制約により、`thread` は必ず `th-` + ULID(26字) です。保存前に正規の thread を取得してください。

1) `POST /threads/new` を呼んで正規の thread を発行
   - レスポンス例: `{ ok: true, thread: "th-01K6...", timestamp: "...Z" }`
2) 取得した `thread` を使って `POST /save` に InputMessage を送信
   - InputMessage 必須項目: `source`, `thread`, `author`, `text`
   - 推奨値: `source=gpts`, `author=ChatGPT`

既存スレッドに追記する場合は、ユーザから正規の `thread` を受け取り、(1) を省略して (2) のみ実行します。

---

## InputMessage（保存ボディ）
- 必須: `source`, `thread`, `author`, `text`
- 制約:
  - `thread`: `^th-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$`
  - `source`: `gpts | copilot | claude | human`
- 例:
```json
{
  "source": "gpts",
  "thread": "th-01K6EXAMPLEULIDABCDEFGH1234",
  "author": "ChatGPT",
  "text": "この議論の要点を保存します。",
  "tags": ["decision", "design"]
}
```

---

## 主なエンドポイント（抜粋）
- `POST /threads/new` … 正規 thread 発行（ヘルパー／認証必須）
- `POST /save` … InputMessage で保存（認証必須）
- `GET /search?q=&thread=&tag=&limit=` … 検索
- `POST /trigger` … Shelter モードでは記録のみ（実行はしない）
- `GET /openapi.yml` … OpenAPI スキーマ（実行環境に応じて動的 URL）
- `GET /health` … ヘルス

注: `/threads/new` はコア仕様の拡張（Helper）です。Flow の一次正（docs/yuiflow/openapi/poc.yaml）は保持しつつ、Hub の拡張として提供しています。

---

## エラーハンドリング
- 400 Invalid InputMessage format
  - `thread` の形式不正が多いです → `/threads/new` で取得し直し
  - 必須項目不足（`source`, `thread`, `author`, `text`）を確認
- 401/403 認証エラー
  - `x-yuihub-token`（または `Authorization: Bearer`）の値を再設定
- 5xx サーバエラー
  - 少数回リトライの上、ユーザに通知

---

## セキュリティとモード
- Shelter モード（既定）: 外部I/O停止、ローカル保存原則
- PII 最小化: 不要な個人情報は保存しない
- トークン管理: 知識ファイルにトークンを直書きしない（GPTs の Actions 設定にのみ登録）

---

## GPTs の画面項目（貼り付け例）

### 説明
> AI会話メモをローカルに保存・検索するためのPoCエージェント

### 指示（System）
- あなたはYuiHubに対する保存ワーカーです。
- 新規保存のときは必ず以下の順で実行してください。
  1) POST /threads/new を呼び、レスポンスの thread を受け取る
  2) 受け取った thread を使って、POST /save に InputMessage を送る
- InputMessage 要件
  - source: gpts
  - thread: 取得した（または既存の正規）thread
  - author: ChatGPT
  - text: ユーザの内容
  - tags: 任意（例: ["design", "decision"]）
- バリデーション/エラー
  - thread は `^th-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$`
  - 400 は thread/必須項目を要再確認、必要に応じて `/threads/new` を再実行
  - 403 はトークン設定（`x-yuihub-token`）を再確認
- 成功時は `{id, thread, when}` を返答に含めて簡潔に共有

### 会話のきっかけ（スターター）
- この議論を保存して（新規スレッド）
- thread: th-... にこのメモを書き足して
- 過去のAPI設計決定を検索して確認したい

### Actions（OpenAPI）
- Schema URL: `https://poc-yuihub.vemi.jp/openapi.yml`
- Auth: API Key（Header 名 `x-yuihub-token`、値は配布トークン）

---

## 運用メモ
- トンネルURLが変わった場合: GPTs の Schema URL を更新
- トークンをローテーションした場合: GPTs の Actions 設定も更新
- インデックスが未構築/古い場合: ワークスペースのビルドタスクで再構築

---

## 付記（将来の拡張案・非PoC）
- `POST /threads/resolve`（alias → thread の解決）
- 保存ラッパー（alias 受け／正規化して /save へ委譲）

本書は PoC 期の運用補助です。コア仕様は `docs/yuiflow/` を参照してください。
