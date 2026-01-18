# サポートガイド — YuiHub VSCode Client

本拡張機能をご利用いただきありがとうございます。

---

## よくある質問（FAQ）

### Q. 接続テストが失敗します

- Backend が起動しているか確認 (`pnpm dev:backend`)
- `yuihub.apiBaseUrl` が正しいか確認 (デフォルト: `http://localhost:4182`)

### Q. MCP ツールが見えない

1. `YuiHub: Install MCP Server` コマンドを実行
2. Antigravity/Cursor を再起動

### Q. Language Model Tools が動作しない

- VSCode 1.104.0 以上が必要です

### Q. 保存が失敗する

- Backend が起動しているか確認
- Backend ログでエラーを確認

---

## バグ報告・機能リクエスト

[GitHub Issues](https://github.com/vemikrs/yuihub/issues) にて受付けています。

報告時に以下を添えてください:

- 再現手順
- 環境 (OS / VSCode バージョン)
- 設定内容

---

## セキュリティ

脆弱性を発見した場合は、公開 Issue ではなく以下まで:

- Email: contact@vemi.jp

---

## 開発者情報

- Publisher: **vemikrs**
- Repository: [https://github.com/vemikrs/yuihub](https://github.com/vemikrs/yuihub)
