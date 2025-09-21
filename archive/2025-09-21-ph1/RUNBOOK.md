# YuiHub 運用ガイド（RUNBOOK）

このドキュメントは、YuiHubの日常的な運用、監視、トラブルシューティングに関する実践的なガイドです。

## 🚀 デプロイメント

### 本番環境での推奨構成

```bash
# 本番用環境変数設定
export NODE_ENV=production
export PORT=3000
export HOST=0.0.0.0
export STORAGE_ADAPTER=github
export GITHUB_TOKEN=${GITHUB_PERSONAL_ACCESS_TOKEN}
export GITHUB_OWNER=your_org
export GITHUB_REPO=yuihub_data
export GITHUB_BRANCH=main
export LUNR_INDEX_PATH=/app/index/lunr.idx.json
```

### Docker構成例

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### クラウド環境での設定

#### Cloudflare Workers

- `yuihub_api`をCloudflare Workersにデプロイ
- D1データベースまたはKVを活用した軽量化
- Cloudflare Pagesで検索UIを提供

#### AWS Lambda

- API Gateway + Lambda関数として配置
- S3バケットでのファイルストレージ
- CloudWatchによる監視

## 📊 監視とアラート

### ヘルスチェック

```bash
# 基本ヘルスチェック
curl -f http://localhost:3000/health

# 期待されるレスポンス
{
  "ok": true,
  "timestamp": "2025-09-18T12:00:00.000Z",
  "storage": "github",
  "searchIndex": "loaded"
}
```

### 重要な監視指標

1. **API可用性**
   - `/health`エンドポイントの応答時間（< 100ms）
   - HTTP 200応答率（> 99%）

2. **検索性能**
   - `/search`の応答時間（< 20秒）
   - 検索インデックスの読み込み状況

3. **ストレージ**
   - GitHub API呼び出し上限の監視
   - ファイル保存成功率

4. **リソース使用量**  
   - メモリ使用量（Node.jsプロセス）
   - ディスク使用量（検索インデックス）

### Prometheus / Grafana設定例

```javascript
// server.js にメトリクス追加例
import prometheus from 'prom-client';

const httpRequestDuration = new prometheus.Histogram({
  name: 'yuihub_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

const notesTotal = new prometheus.Counter({
  name: 'yuihub_notes_total',
  help: 'Total number of notes saved'
});
```

## 🔧 メンテナンス

### 定期メンテナンスタスク

#### 日次タスク

```bash
# 検索インデックスの更新確認
ls -la index/lunr.idx.json
jq '.generatedAt' index/lunr.idx.json

# GitHub API使用量確認
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit
```

#### 週次タスク

```bash  
# 週次要約の確認
npm run build-summaries
ls -la summaries/weekly-summaries.json

# 古いログファイルのクリーンアップ（1年以上前）
find chatlogs -name "*.md" -mtime +365 -type f
```

#### 月次タスク

```bash
# パッケージ依存関係の更新
npm update
npm audit --fix

# インデックスサイズの最適化
npm run build-index
du -h index/
```

### バックアップ戦略

#### 1. GitHubリポジトリバックアップ

```bash
# 完全バックアップ（データ + メタデータ）
git clone --mirror https://github.com/user/yuihub_data.git backup/

# 増分バックアップ
cd backup && git remote update && git fetch --all
```

#### 2. ローカルファイルバックアップ

```bash
# チャットログのアーカイブ
tar -czf "yuihub_backup_$(date +%Y%m%d).tar.gz" chatlogs/ index/ summaries/

# S3等への自動アップロード
aws s3 cp yuihub_backup_*.tar.gz s3://your-backup-bucket/
```

## 🚨 トラブルシューティング

### よくある問題と解決法

#### 1. API サーバが起動しない

**症状**: `npm start` でエラーが発生

```bash
# 依存関係の確認
npm ls --depth=0

# ポートの重複確認  
lsof -i :3000

# 設定ファイルの検証
node -e "require('dotenv').config(); console.log(process.env)"
```

**対処法**:
- 依存関係の再インストール: `rm -rf node_modules && npm install`
- ポート変更: `PORT=3001 npm start`
- 環境変数の確認: `.env`ファイルの設定を確認

#### 2. 検索インデックスが読み込めない

**症状**: `searchIndex: "missing"` がヘルスチェックで表示

```bash
# インデックスファイルの存在確認
ls -la index/lunr.idx.json

# インデックスの再構築
npm run build-index

# JSON形式の検証
jq . index/lunr.idx.json > /dev/null && echo "Valid JSON"
```

#### 3. GitHub保存でエラーが発生

**症状**: `POST /save` で GitHub API エラー

```bash
# トークンの権限確認
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/user

# API制限の確認  
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/rate_limit

# リポジトリアクセス権の確認
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/owner/repo
```

**対処法**:
- Personal Access Tokenの再生成（`repo`スコープが必要）
- API制限に達している場合は時間を置いて再試行
- リポジトリの存在とアクセス権限を確認

#### 4. MCP接続の問題  

**症状**: Claude DesktopでYuiHubツールが表示されない

```bash
# MCPサーバの起動確認
ps aux | grep "yuihub.*mcp"

# MCPサーバログの確認
YUIHUB_API=http://localhost:3000 node yuihub_mcp/src/server.js 2>mcp.log &

# API接続の確認
curl http://localhost:3000/health
```

**対処法**:
- Claude Desktop設定の確認（`claude_desktop_config.json`）
- MCPサーバとAPIサーバの両方が起動していることを確認
- ファイアウォール設定でローカル接続がブロックされていないか確認

#### 5. メモリ不足エラー

**症状**: 大量のファイル処理時にNode.jsプロセスが停止

```bash
# メモリ使用量の確認
ps aux | grep node
top -p $(pgrep -f yuihub)

# Node.jsメモリ制限の調整
NODE_OPTIONS="--max-old-space-size=4096" npm start
```

**対処法**:
- インデックス構築時のチャンクサイズ削減
- バッチ処理での並列数制限  
- メモリ制限の調整またはスワップ領域の確保

### ログ分析

#### API サーバログ

```bash
# エラーレベルのログ抽出
grep -i error logs/yuihub-api.log

# 検索クエリの分析
grep "Search performed" logs/yuihub-api.log | \
  jq -r '.query' | sort | uniq -c | sort -nr
```

#### GitHub Actions ログ

```bash
# インデックス構築の失敗分析
gh run list --workflow=build-index.yml --json status,conclusion

# 特定の実行ログ詳細
gh run view RUN_ID --log
```

## 🔐 セキュリティ

### アクセス制御

#### Personal Access Token管理

```bash
# 最小権限トークンの生成（GitHub）
# 必要スコープ: repo (private repo用) または public_repo
# オプション: delete_repo (削除権限が必要な場合のみ)
```

#### 環境変数の安全な管理

```bash
# Secretsの暗号化（本番環境）
echo "GITHUB_TOKEN=ghp_xxx" | gpg --symmetric --cipher-algo AES256 > .env.gpg

# 復号化
gpg --decrypt .env.gpg > .env
```

### 監査ログ

```javascript
// 保存操作の監査ログ例
{
  "timestamp": "2025-09-18T21:00:00Z",
  "operation": "save_note", 
  "user_agent": "yuihub-mcp/0.1.0",
  "note_id": "01HZXK7Q...",
  "topic": "API設計検討",
  "storage_path": "chatlogs/2025/09/note.md"
}
```

## 📈 パフォーマンス最適化

### 検索性能の改善

```bash
# インデックスサイズの最適化
node scripts/chunk_and_lunr.mjs --chunk-size=500

# 不要な古いファイルの除外
find chatlogs -name "*.md" -mtime +730 -exec rm {} \;
```

### API応答時間の最適化

```javascript  
// Fastifyでの圧縮とキャッシュ有効化
await app.register(require('@fastify/compress'));
await app.register(require('@fastify/caching'));
```

## 📞 サポートとエスカレーション

### 緊急時の連絡先

1. **サービス停止**: システム管理者に即座に連絡
2. **データ損失**: バックアップ復旧手順を即座に実行
3. **セキュリティ侵害**: アクセストークンの即座に無効化

### ログ収集とレポート

```bash
# 問題発生時のログ収集スクリプト
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p support_logs_$TIMESTAMP

# システム情報
uname -a > support_logs_$TIMESTAMP/system_info.txt
df -h > support_logs_$TIMESTAMP/disk_usage.txt
free -h > support_logs_$TIMESTAMP/memory_usage.txt

# YuiHub固有の情報  
curl -s http://localhost:3000/health > support_logs_$TIMESTAMP/health_check.json
ls -la index/ > support_logs_$TIMESTAMP/index_files.txt
tail -n 100 logs/*.log > support_logs_$TIMESTAMP/recent_logs.txt

tar -czf support_logs_$TIMESTAMP.tar.gz support_logs_$TIMESTAMP/
```

このRunbookは継続的に更新され、運用経験に基づいて改善されます。