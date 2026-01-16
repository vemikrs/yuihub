# サポートガイド — YuiHub VS Code Bridge

本拡張機能をご利用いただきありがとうございます。  

⚠️ **ご注意ください：この拡張機能は YuiHub プロジェクトの Prototype フェーズです。**  
- 機能は最小限です。  
- 安定性や後方互換性は保証されません。  
- 今後の開発フェーズに伴い、大きく仕様が変更される可能性があります。  

その前提でご利用いただき、フィードバックを歓迎します。

---

## よくある質問（FAQ）

### Q. Smoke Test が失敗します
- `yuihub.apiBaseUrl` が正しいかご確認ください（例: `http://localhost:3000`）。
- サーバが起動しているか確認してください。
- APIキーが必要な構成の場合は、設定に入力してください。

### Q. 保存（/save）が失敗します
- Thread ID が設定されているか確認してください。
- サーバ側のログにエラーが記録されていないか確認してください。

---

## バグ報告・機能リクエスト
- [GitHub Issues](https://github.com/vemikrs/vscode-yuihub-copilot-chat/issues) にて受付けています。
- 再現手順、環境（OS / VS Code バージョン）、設定内容を添えてご報告いただけると助かります。

---

## コントリビュート
- Pull Request は歓迎します。
- ただし PoC フェーズであり、開発方針が流動的なため、大きな変更は事前に Issue でご相談ください。

---

## 緊急のご連絡
- セキュリティ上の懸念や脆弱性を発見した場合は、公開 Issue ではなく直接以下までご連絡ください：
  - Email: contact@vemi.jp

---

## 開発者情報
- Publisher: **vemikrs**  
- Homepage: [https://github.com/vemikrs/vscode-yuihub-copilot-chat](https://github.com/vemikrs/vscode-yuihub-copilot-chat)
