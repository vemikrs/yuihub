# YuiHub Cloudflare Tunnel

このディレクトリは、YuiHubをCloudflare Tunnelを通じて外部公開するための設定を管理します。

## 🎯 Quick Mode (開発用)

YuiHubは **Quick Tunnel** を使用したセキュアな一次公開が可能です。

### 特徴
- ✅ 認証不要、即座に使用可能  
- ✅ 毎回新しい一時URL生成（セキュア）
- ✅ 開発・テスト用途に最適
- ✅ 固定URLを設定したい場合はNamed Tunnelを使用可能 (Cloudflareでのドメイン設定が必要)

## 📋 使用方法

### 1. 前提条件
```bash
# cloudflaredのインストール（未インストールの場合）
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared.deb
```

### 2. APIサーバー起動
```bash
npm run start:api
# または VS Code Task: "YuiHub:API:Start"
```

### 3. Tunnel起動
```bash
./.cloudflare/tunnel.sh
# または VS Code Task: "YuiHub:API:Start (Prod + Named Tunnel)" または "YuiHub:API:Start (Dev + Quick Tunnel)"
```

### 4. URL取得
```bash
# 現在のTunnel URLを確認
cat .cloudflare/.tunnel-url
# または VS Code Task: "YuiHub: Get Tunnel URL"
```

## 🔗 VS Code Tasks

| タスク名 | 機能 |
|---------|------|
| `YuiHub:API:Start (Prod + Named Tunnel)` | Named Tunnel起動（バックグラウンド） |
| `YuiHub: Get Tunnel URL` | 現在のURL表示 |
| `YuiHub: Test Tunnel Connection` | 疎通確認 |
| `YuiHub:API:Stop:All (Force)` | API（3000番）停止（トンネルは別途停止） |

## 📝 ChatGPT Actions設定

Tunnel起動後に表示されるURLを使用：

```
Base URL: https://xxxxx-yyyy-zzzzz.trycloudflare.com
OpenAPI Schema: https://xxxxx-yyyy-zzzzz.trycloudflare.com/openapi.yml
```

## 🗂️ ファイル構成

```
.cloudflare/
├── tunnel.sh           # メインスクリプト（Git管理対象）
├── README.md          # このファイル（Git管理対象）
├── .gitignore         # ローカル除外設定
├── .tunnel-url        # 動的生成URL（Git除外）
└── (他の動的ファイル)    # 全てGit除外
```

## 🛠️ トラブルシューティング

### Tunnel接続失敗
```bash
# インターネット接続確認
ping 1.1.1.1

# cloudflaredバージョン確認
cloudflared version
```

### APIサーバー未起動
```bash
# ヘルスチェック
curl http://localhost:3000/health
```

### URL取得できない
```bash
# プロセス確認
ps aux | grep cloudflared

# ログ確認
# tunnel.shの出力を確認
```

## 🔒 セキュリティ

- **認証情報**: システムの `~/.cloudflared/` に保存（プロジェクト外）
- **動的URL**: 毎回変更されるため第三者アクセス困難
- **Git除外**: 一時ファイルは全てVersion Control対象外

## 📈 将来拡張

Named Tunnel（固定URL）への移行も可能：
- Cloudflare Dashboardでドメイン設定
- `tunnel.sh` を Named Tunnel 対応に拡張
- ChatGPT Actions URL固定化