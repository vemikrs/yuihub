# プライバシーポリシー — YuiHub VSCode Client

本拡張機能（以下「本拡張」）は、ユーザーが指定した **ローカル YuiHub Engine** とのみ通信を行います。  
テレメトリや利用データを外部に送信することはありません。

---

## Offline Context (ローカルファースト)

本拡張は **Offline Context** 設計に基づいています:

- すべてのデータは **ローカルマシン** にのみ保存
- インターネットへのデータ送信は **行いません**
- Cloud Context (クラウド同期) は **ユーザーが明示的に設定した場合のみ** 有効

---

## 収集する情報

本拡張自体は、ユーザー個人を特定する情報を収集しません。

`yuihub.apiBaseUrl` (デフォルト: `http://localhost:4182`) に対し、ユーザー操作に応じて以下のデータを送信します:

- 検索クエリ (`/search`)
- 保存対象テキスト (`/save`)
- セッション作成リクエスト (`/threads/new`)
- チェックポイント作成 (`/checkpoints`)
- コンテキスト取得 (`/export/context`)
- ヘルスチェック (`/health`)

---

## データの保存

- **認証トークン**:
  - File-based Handshake: `~/.yuihub/.token` に自動生成
  - SecretStorage: VSCode の暗号化ストレージに保存
- **設定**: VSCode の設定ストレージに保存

---

## データの利用

- 本拡張が送信するデータは、**ローカルの YuiHub Engine のみ** が受信します
- 開発者（vemikrs）は、本拡張からユーザーデータを直接収集・保存しません

---

## 外部サービス

- 本拡張は Microsoft や GitHub など外部サービスに自動通信しません（Marketplace 配信を除く）
- MCP Server インストール機能はローカル設定ファイルへの書き込みのみ行います

---

## 変更について

- 本ポリシーの内容は、機能追加や法令改正等により改定される場合があります
- 最新版は本拡張リポジトリ内の [`PRIVACY.md`](./PRIVACY.md) にて公開されます

---

## お問い合わせ

ご不明点は [GitHub Issues](https://github.com/vemikrs/yuihub/issues) までお問い合わせください。
