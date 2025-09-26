# 🎯 YuiHub PoC Ph2b - 運用ガイド

**作成日**: 2024-09-24  
**対象**: YuiHub Min Bundle PoC Ph2b  
**状態**: Production Ready ✅

---

## 🚀 クイックスタート（5分で開始）

### 1. 環境セットアップ
```bash
# プロジェクトクローン・依存関係インストール
git clone <repository>
cd yuihub_min_bundle
npm run install-all

# 環境変数設定（初回のみ）
cp .env.example .env
# ルートの.envファイルを編集（統合管理）
# 本番環境: NODE_ENV=production, TUNNEL_TOKEN等
```

### 2. 開発サーバー起動
```bash
# フルスタック開発環境（推奨）
npm run dev:full
# または個別起動
npm run dev:api    # API サーバー
npm run start:mcp  # MCP サーバー
```

### 3. 動作確認
```bash
# ヘルスチェック
npm run test:e2e
# または手動確認
curl http://localhost:3000/health
```

---

## 📋 基本ワークフロー

### GPTs → YuiHub 保存

**YuiFlow InputMessage形式で保存**：
```bash
curl -X POST http://localhost:3000/save \
  -H "Content-Type: application/json" \
  -d '{
    "source": "gpts",
    "thread": "th-01K5WHS123EXAMPLE456789ABC",
    "author": "ChatGPT",
    "text": "新機能の設計について議論した結果...",
    "tags": ["design", "feature", "discussion"]
  }'
```

### YuiHub → Context Packet生成

**スレッド単位での文脈抽出**：
```bash
# JSON形式（プログラム用）
curl http://localhost:3000/export/context/th-01K5WHS123EXAMPLE456789ABC

# Markdown形式（Copilot用）
curl http://localhost:3000/export/markdown/th-01K5WHS123EXAMPLE456789ABC
```

### Context Packet → Copilot 手動橋渡し

1. **Markdown取得**: 上記のmarkdown exportを実行
2. **Copilot投入**: 生成されたMarkdownをCopilotにコピペ
3. **実装指示**: "この文脈に基づいて実装してください"
4. **結果保存**: Copilotの回答をYuiHubに保存

```bash
# Copilotの回答を保存
curl -X POST http://localhost:3000/save \
  -H "Content-Type: application/json" \
  -d '{
    "source": "copilot",
    "thread": "th-01K5WHS123EXAMPLE456789ABC",
    "author": "GitHub Copilot",
    "text": "実装完了: 新機能のコードを以下に示します...",
    "tags": ["implementation", "copilot", "code"]
  }'
```

---

## 🔍 高度な検索・フィルタリング

### タグ検索
```bash
# 特定タグでフィルタリング
curl "http://localhost:3000/search?tag=design&limit=10"

# 複数条件検索
curl "http://localhost:3000/search?q=implementation&tag=copilot&limit=20"
```

### スレッド検索
```bash
# 特定スレッドの全メッセージ
curl "http://localhost:3000/search?thread=th-01K5WHS123EXAMPLE456789ABC"
```

---

## ⚡ Agent Trigger（Shelter Mode）

**AI Agentアクション要請**（記録のみ・実行なし）：
```bash
curl -X POST http://localhost:3000/trigger \
  -H "Content-Type: application/json" \
  -d '{
    "type": "summarize",
    "payload": {
      "focus": "key_decisions",
      "format": "bullet_points"
    },
    "reply_to": "th-01K5WHS123EXAMPLE456789ABC"
  }'
```

**結果**: Shelter Modeでは実行されず、トリガー記録のみ保存されます。

---

## 🧪 テスト・検証

### 包括的テストスイート
```bash
# 全テスト実行（推奨）
./validate-yuiflow-complete.sh

# 個別テスト
npm run test:schema    # スキーマ検証
npm run test:api       # API統合テスト
npm run test:mcp       # MCP プロトコルテスト
```

### VS Code統合テスト
1. **Ctrl+Shift+P** → "Tasks: Run Task"
2. 以下のタスクを実行：
   - `YuiHub: Run YuiFlow Tests`
   - `YuiHub: E2E Workflow Test`
   - `YuiHub: Validate YuiFlow Compliance`

---

## 🛡️ Shelter Mode制約

**重要**: 現在はShelter Modeで動作し、外部操作は記録のみ行われます。

### 制約事項
- `MODE=shelter` 固定
- `EXTERNAL_IO=blocked` 既定
- Agent実行は**シミュレーション**のみ
- 外部API呼び出し**禁止**

### 制約解除（将来）
```bash
# Signal Modeへの移行（将来実装）
export EXTERNAL_IO=unsafe
export MODE=signal
```

---

## 🔧 トラブルシューティング

### 問題: "Server not reachable"
```bash
# サーバー状態確認
curl http://localhost:3000/health
# ポート使用状況確認
lsof -i :3000
# サーバー再起動
npm run start:api
```

### 問題: "Schema validation failed"
```bash
# スキーマテスト実行
npm run test:schema
# 入力データ形式確認
node -e 'console.log(JSON.stringify({
  source: "gpts",
  thread: "th-01K5WHS123EXAMPLE456789ABC", 
  author: "test",
  text: "test message"
}, null, 2))'
```

### 問題: "MCP connection failed"
```bash
# MCP サーバー起動確認
npm run start:mcp
# API サーバー疎通確認
curl http://localhost:3000/health
```

---

## 🌐 外部連携

### ChatGPT Actions設定
```yaml
Base URL: http://localhost:3000
# または Tunnel使用時:
Base URL: https://xxxxx.trycloudflare.com
OpenAPI Schema: <Base URL>/openapi.yml
```

### Claude Desktop MCP設定
```json
{
  "mcpServers": {
    "yuihub": {
      "command": "node",
      "args": ["yuihub_mcp/src/server.js"],
      "env": {
        "YUIHUB_API": "http://localhost:3000"
      }
    }
  }
}
```

---

## 📊 運用メトリクス

### パフォーマンス目標
- **レスポンス時間**: < 2秒
- **同時接続**: 10リクエスト/秒
- **データ容量**: 1000 Fragments対応
- **稼働率**: 99.9%（開発環境）

### モニタリング
```bash
# システム状態確認
npm run test:e2e
curl http://localhost:3000/vscode/threads  # Thread統計
curl http://localhost:3000/recent?n=10     # 最新活動
```

---

## 🎯 次期Phase準備

### Phase 3: VS Code Extension統合
- **自動Context Packet同期**
- **Copilot Chat Participant**統合
- **リアルタイム通知**

### 現在の準備状況
✅ **VS Code Extension endpoints** 実装済み  
✅ **Context Packet形式** 標準化済み  
✅ **Protocol疎結合** 設計済み  

**移行コスト**: 最小（API変更不要）

---

**🎉 YuiHub PoC Ph2b - GPTs⇄Copilot橋渡し完全対応！**

*本ガイドに従い、思想と実装の分離を実現するAIワークフローをお楽しみください。*