# YuiHub VS Code Bridge

⚠️ **この拡張機能は Prototype（試作版）です。**  
- 機能は最小限です。  
- 安定性や後方互換性は保証されません。  
- 今後の開発に伴い、大きく仕様が変更される可能性があります。  

---

**VS Code から YuiHub API に最小疎通する拡張機能**  
Shelter モード前提：ユーザーが設定しない限り外部送信は行いません。

---

## 📌 主な機能

- 検索（YuiHub APIから検索結果を取得し、エディタへ挿入）
- 選択テキストの保存（スレッドへ送信）
- スレッドIDの新規発行とワークスペース保持

## Workspace Trust とセキュリティ

本拡張は VS Code の Workspace Trust（信頼済みワークスペース）に対応しています。ワークスペースが未信頼の場合は、リスク低減のため「限定モード」で動作します。

- 無効化される機能: 「YuiHub: Save Selection」（ワークスペースの内容を読み取り・送信しうるため）
- 許可される機能: ユーザーの明示入力のみを送信するコマンド（検索クエリの入力、スモークテストなど）
- 備考: 拡張はワークスペースから任意コードを実行しません

フル機能が必要な場合は、ワークスペースを信頼してください。通知のアクション、またはコマンドパレットから「Workspaces: Manage Workspace Trust」を実行して切り替えできます。

また、未信頼ワークスペースでは以下の設定はワークスペース構成からは反映されません（restrictedConfigurations）：`yuihub.apiBaseUrl`, `yuihub.apiKey`, `yuihub.authHeader`, `yuihub.authScheme`, `yuihub.defaultSource`, `yuihub.defaultAuthor`, `yuihub.defaultThreadId`, `yuihub.searchLimit`。

### 追加のハードニングオプション

- `yuihub.requestTimeoutMs`（数値, 既定 15000）: HTTP リクエストのタイムアウト（ms）
- `yuihub.logResponseBodies`（boolean, 既定 false）: エラー時にレスポンス本文をログへ含める（最大400文字）。機密混入の恐れがあるため既定はOFF
- `yuihub.saveConfirmOnFullDocument`（boolean, 既定 true）: 選択がない場合（全文送信）に確認ダイアログを表示
- `yuihub.saveConfirmFullDocThresholdBytes`（数値, 既定 8192）: 全文の推定サイズ（byte）がこの閾値以上なら、より強い警告文言を表示

注記: baseUrl が HTTP かつローカル以外の場合は、HTTPS 利用を推奨する警告を表示します。

---

## ⚙ インストール方法

1. Visual Studio Marketplace から拡張機能をインストール  
2. コマンドパレットで「YuiHub: Set API Token (SecretStorage)」を実行し、APIトークンを保存（任意）  
3. 拡張設定（`設定 > 拡張機能 > YuiHub`）で必要に応じて以下を設定  
   - `yuihub.apiBaseUrl`（例: `http://localhost:3000`）  
   - `yuihub.defaultSource`（`gpts | copilot | claude | human`）  
   - `yuihub.defaultAuthor`（例: `VSCode`）  
   - `yuihub.defaultThreadId`（空ならワークスペース保存 or 自動発行）  
   - `yuihub.searchLimit`（例: `10`）

注: 設定の `yuihub.apiKey` は後方互換のため残していますが、セキュリティ上は SecretStorage の利用を推奨します。

---

## 🚀 使い方（コマンドパレット）

- `YuiHub: Smoke Test (Health)`  
- `YuiHub: Search…`  
- `YuiHub: Issue New Thread ID`  
- `YuiHub: Save Selection to Thread`
- `YuiHub: Set API Token (SecretStorage)`

---

## 🛠 トラブルシュート

| 状況 | 解決案 |
|------|--------|
| スモークテストで失敗 | `apiBaseUrl` が間違っている、サーバ起動していない、ネットワーク接続確認 |
| 検索結果が取得されない | クエリが正しいか、limit が過度に低くないか |
| 保存に失敗する | 権限不足（APIキー）、Thread ID 未設定、APIエンドポイント構成不整合 |
| APIトークンが反映されない | コマンド「YuiHub: Set API Token (SecretStorage)」を再実行。空で保存→再入力でリセット。環境がローカル/SSH/WSL/Dev Container で異なると秘密が別ストアになる点に注意。VS Code再起動や「YuiHub: Open Logs」でログ確認 |
| SecretStorage の保存/取得に失敗（権限/鍵のロック） | OSのキーチェーン/キーストアがロックされていないか確認。Linuxは gnome-keyring/kwallet を起動しログイン解錠、リモート（SSH/Containers）は接続先でキーチェーンが利用可能か確認。暫定的に設定 `yuihub.apiKey` に設定し、後でシークレットへ移行 |
| 誤ったトークンを削除したい | 「YuiHub: Set API Token (SecretStorage)」を実行し、空の入力で保存すると削除されます |
| 未信頼WSで機能が出ない/保存できない | 未信頼では限定モード。Save Selectionは無効。必要なら「Workspaces: Manage Workspace Trust」で信頼に切り替え |

---

## 🔒 プライバシーポリシー & データの扱い

- 送信先は **ユーザーが設定した YuiHub API のみ**  
- 拡張は **テレメトリを一切送信しません**  
- `Authorization: Bearer <apiKey>` は **設定がある場合のみ** 送信  
- APIトークンは **SecretStorage に保存**（設定 `yuihub.apiKey` はフォールバックとして読み取り可能）

> プライバシーポリシーはコマンドパレットの `YuiHub: Open Privacy Policy` または [PRIVACY.md](./PRIVACY.md) から閲覧可能です。

---

## 🆘 サポート

- バグ報告・機能提案は [Issue](https://github.com/vemikrs/yuihub-copilot-chat/issues) まで  
- よくある質問は [SUPPORT.md](SUPPORT.md) を参照

---

## 📝 ライセンス

この拡張機能は [MIT ライセンス](https://github.com/vemikrs/yuihub-copilot-chat/blob/main/LICENSE) にて公開されています。

---

## 🧪 開発者向け: デバッグ/実行方法

VSIX にせず、そのまま VS Code からデバッグできます。

1) 依存関係のインストール

```bash
npm ci
```

2) F5 で起動
- `Run Extension` 構成で Extension Development Host が立ち上がります。
- 事前に `npm: build` タスクが走り、`dist/extension.js` が生成されます。
- ブレークポイントは `src/extension.ts` に設定できます（ソースマップ有効）。

3) ウォッチビルド（任意）
- 実装を素早く反映したい場合は「実行とデバッグ」ビューで `npm: watch` タスクを別途実行してください。

### VSIX パッケージが必要なとき
配布・検証用に VSIX を作成する場合のみ行います。

```bash
npm run build
npm run package
# 生成された *.vsix をインストール
code --install-extension ./yuihub-copilot-chat-*.vsix
```

トラブル時は「出力 > 拡張ホスト」や「開発者ツール」を参照してください。
