# 🛠️ YuiHub PoC Phase 2 具体修正計画書

## 📊 現状分析結果

### 検出された課題

1. **フォルダ構成の不統一**
   - chatlogs がルートと chatlogs に重複存在
   - VS Code Tasksは `${workspaceFolder}/chatlogs` を参照
   - API実装は chatlogs（相対パス）を使用
   - スクリプトは引数で指定可能だが統一されていない

2. **索引同期の課題**
   - `/health` の `searchIndex` が "missing" になる状況あり
   - 保存後の索引更新が非同期で遅延発生
   - インデックスパス設定が分散（.env, tasks.json, scripts等）

3. **環境プロファイル未分離**
   - dev/prod/test環境の明確な分離なし  
   - 認証ON/OFF制御が曖昧
   - ホットリロード設定が不統一

## 🎯 Phase 2 実装計画

### Task 1: フォルダ構成統一化（優先度：★★★）

#### 1.1 データ配置の統一
````bash
#!/bin/bash
# フォルダ構成統一化スクリプト

echo "🔄 YuiHub構造統一化を開始..."

# 1. data/chatlogs への統一移動
mkdir -p data/chatlogs
if [ -d "yuihub_api/chatlogs" ] && [ "$(ls -A yuihub_api/chatlogs)" ]; then
    echo "📁 yuihub_api/chatlogs → data/chatlogs へ移動"
    cp -r yuihub_api/chatlogs/* data/chatlogs/
    rm -rf yuihub_api/chatlogs
fi

# 2. indexディレクトリもdataへ移動
mkdir -p data/index
if [ -d "index" ]; then
    echo "📁 index → data/index へ移動"
    mv index/* data/index/
    rmdir index
    ln -sf data/index index  # 後方互換性のためのシンボリックリンク
fi

# 3. .gitkeeep配置
touch data/chatlogs/.gitkeep
touch data/index/.gitkeep

echo "✅ 構造統一化完了"
````

#### 1.2 設定ファイル更新
````javascript
// VS Code Tasks設定の統一

{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "YuiHub: Start API Server (Dev)",
      "type": "shell",
      "command": "npm",
      "args": ["run", "dev:api"],
      "group": "build",
      "isBackground": true,
      "options": {
        "env": {
          "NODE_ENV": "development",
          "LOCAL_STORAGE_PATH": "${workspaceFolder}/data/chatlogs",
          "LUNR_INDEX_PATH": "${workspaceFolder}/data/index/lunr.idx.json",
          "TERMS_INDEX_PATH": "${workspaceFolder}/data/index/terms.json",
          "PORT": "3000",
          "HOST": "localhost",
          "STORAGE_ADAPTER": "local"
        }
      }
    }
  ]
}
````

#### 1.3 環境変数統一
````env
# 統一された環境設定

# Data Paths (統一)
DATA_ROOT=./data
LOCAL_STORAGE_PATH=./data/chatlogs
LUNR_INDEX_PATH=./data/index/lunr.idx.json  
TERMS_INDEX_PATH=./data/index/terms.json
STATS_PATH=./data/index/stats.json

# Server Settings
PORT=3000
HOST=localhost
NODE_ENV=development

# Storage Adapter
STORAGE_ADAPTER=local
````

### Task 2: 索引API拡張（優先度：★★★）

#### 2.1 索引管理API実装
````javascript
// 索引管理サービス

import { SearchService } from './search.js';
import path from 'path';
import fs from 'fs/promises';

export class IndexManager {
  constructor(config) {
    this.searchService = new SearchService();
    this.indexPath = config.indexPath;
    this.status = 'missing';  // missing|building|ready
    this.lastBuildAt = null;
    this.buildPromise = null;
  }

  async getStatus() {
    const exists = await this.indexExists();
    if (!exists) return { status: 'missing', lastBuildAt: null };
    
    if (this.buildPromise) {
      return { status: 'building', lastBuildAt: this.lastBuildAt };
    }

    return { status: 'ready', lastBuildAt: this.lastBuildAt };
  }

  async indexExists() {
    try {
      await fs.access(this.indexPath);
      return true;
    } catch {
      return false;
    }
  }

  async rebuild() {
    if (this.buildPromise) {
      return this.buildPromise; // 既に実行中
    }

    this.status = 'building';
    this.buildPromise = this._performRebuild();
    
    try {
      const result = await this.buildPromise;
      this.status = 'ready';
      this.lastBuildAt = new Date().toISOString();
      return result;
    } catch (error) {
      this.status = 'missing';
      throw error;
    } finally {
      this.buildPromise = null;
    }
  }

  async _performRebuild() {
    // scripts/chunk_and_lunr.mjsを内部呼び出し
    const { execFile } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(execFile);

    const scriptPath = path.resolve(process.cwd(), '../scripts/chunk_and_lunr.mjs');
    const dataRoot = process.env.DATA_ROOT || './data';
    
    await execAsync('node', [
      scriptPath,
      `--source=${path.join(dataRoot, 'chatlogs')}`,
      `--output=${path.join(dataRoot, 'index')}`
    ]);

    // 索引をリロード
    return await this.searchService.loadIndex(this.indexPath);
  }

  async reload() {
    const loaded = await this.searchService.loadIndex(this.indexPath);
    if (loaded) {
      this.status = 'ready';
      this.lastBuildAt = new Date().toISOString();
    } else {
      this.status = 'missing';
    }
    return loaded;
  }
}
````

#### 2.2 API エンドポイント追加
````javascript
// ...existing code...

import { IndexManager } from './index-manager.js';

// IndexManager初期化
const indexManager = new IndexManager({
  indexPath: process.env.LUNR_INDEX_PATH || './data/index/lunr.idx.json'
});

// Health check enhancement
app.get('/health', async (req, reply) => {
  const indexStatus = await indexManager.getStatus();
  
  return { 
    ok: true, 
    timestamp: new Date().toISOString(),
    storage: storageAdapter.type,
    searchIndex: indexStatus.status,
    lastIndexBuild: indexStatus.lastBuildAt
  };
});

// Index management endpoints
app.get('/index/status', async (req, reply) => {
  return await indexManager.getStatus();
});

app.post('/index/rebuild', async (req, reply) => {
  try {
    await indexManager.rebuild();
    return { ok: true, status: 'rebuilt', timestamp: new Date().toISOString() };
  } catch (error) {
    reply.status(500);
    return { ok: false, error: error.message };
  }
});

app.post('/index/reload', async (req, reply) => {
  try {
    const loaded = await indexManager.reload();
    return { 
      ok: loaded, 
      status: loaded ? 'reloaded' : 'failed',
      timestamp: new Date().toISOString() 
    };
  } catch (error) {
    reply.status(500);
    return { ok: false, error: error.message };
  }
});

// Enhanced save endpoint with index sync
app.post('/save', async (req, reply) => {
  try {
    // ...existing save logic...
    const result = await storageAdapter.save(enrichedFrontmatter, body);
    
    // 保存成功後、バックグラウンドで索引更新をトリガー
    setImmediate(async () => {
      try {
        await indexManager.rebuild();
        console.log('📚 Index rebuilt after save');
      } catch (error) {
        console.warn('⚠️ Index rebuild failed:', error.message);
      }
    });
    
    return result;
  } catch (error) {
    // ...error handling...
  }
});

// ...existing code...
````

### Task 3: 環境プロファイル分離（優先度：★★☆）

#### 3.1 プロファイル設定
````javascript
// 環境プロファイル管理

export class ConfigManager {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.profiles = {
      development: {
        auth: false,
        hotReload: true,
        verboseLogging: true,
        corsOrigins: '*',
        indexAutoRebuild: true
      },
      production: {
        auth: true,
        hotReload: false,
        verboseLogging: false,
        corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
        indexAutoRebuild: false
      },
      test: {
        auth: false,
        hotReload: false,
        verboseLogging: false,
        corsOrigins: ['http://localhost:3000'],
        indexAutoRebuild: true,
        fixedSeed: true
      }
    };
  }

  get current() {
    return {
      ...this.profiles[this.env],
      env: this.env,
      dataRoot: process.env.DATA_ROOT || './data',
      port: process.env.PORT || 3000,
      host: process.env.HOST || 'localhost'
    };
  }

  isDev() { return this.env === 'development'; }
  isProd() { return this.env === 'production'; }
  isTest() { return this.env === 'test'; }
}
````

#### 3.2 認証ミドルウェア
````javascript
// 認証ミドルウェア

import { ConfigManager } from './config.js';

export function createAuthMiddleware() {
  const config = new ConfigManager();
  
  if (!config.current.auth) {
    // 開発・テスト環境では認証スキップ
    return async (req, reply, next) => next();
  }

  return async (req, reply, next) => {
    const apiToken = process.env.API_TOKEN;
    const authHeader = req.headers.authorization;
    
    if (!apiToken) {
      reply.status(500).send({ error: 'API_TOKEN not configured' });
      return;
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.status(401).send({ error: 'Missing or invalid authorization header' });
      return;
    }

    const token = authHeader.substring(7);
    if (token !== apiToken) {
      reply.status(401).send({ error: 'Invalid API token' });
      return;
    }

    next();
  };
}
````

### Task 4: 日本語検索二段強化（優先度：★★☆）

#### 4.1 二段検索実装
````javascript
// 日本語検索強化版

import { SearchService } from './search.js';
import path from 'path';
import fs from 'fs/promises';

export class EnhancedSearchService extends SearchService {
  constructor() {
    super();
    this.termsIndex = null;
    this.termsLoaded = false;
  }

  async loadTermsIndex(termsPath) {
    try {
      const content = await fs.readFile(termsPath, 'utf8');
      this.termsIndex = JSON.parse(content);
      this.termsLoaded = true;
      return true;
    } catch (error) {
      console.warn('Terms index not loaded:', error.message);
      this.termsLoaded = false;
      return false;
    }
  }

  _normalizeQuery(query) {
    // 日本語正規化（全角→半角、ひらがな→カタカナ）
    return query
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
      .replace(/[ぁ-ゖ]/g, (s) => String.fromCharCode(s.charCodeAt(0) + 0x60));
  }

  async search(query, limit = 10) {
    const normalizedQuery = this._normalizeQuery(query);
    
    // Phase 1: Lunr検索
    const lunrHits = await super.search(normalizedQuery, limit);
    
    // Phase 2: Terms逆引き検索（Lunrで不足の場合）
    if (lunrHits.length < limit / 2 && this.termsLoaded) {
      const termsHits = this._searchByTerms(normalizedQuery, limit);
      
      // 重複除去して結果統合
      const combinedHits = this._mergeHits(lunrHits, termsHits);
      return combinedHits.slice(0, limit);
    }

    return lunrHits;
  }

  _searchByTerms(query, limit) {
    if (!this.termsIndex) return [];

    const hits = [];
    const queryTerms = query.toLowerCase().split(/\s+/);
    
    for (const [term, docIds] of Object.entries(this.termsIndex)) {
      if (queryTerms.some(qt => term.includes(qt) || qt.includes(term))) {
        for (const docId of docIds) {
          hits.push({
            id: docId,
            score: this._calculateTermScore(term, query),
            source: 'terms'
          });
        }
      }
    }

    return hits
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  _calculateTermScore(term, query) {
    // 用語マッチスコア計算（簡易版）
    const similarity = query.length / Math.max(term.length, query.length);
    return similarity * 10; // Lunrスコアと同等レンジに調整
  }

  _mergeHits(lunrHits, termsHits) {
    const merged = [...lunrHits];
    const existingIds = new Set(lunrHits.map(h => h.id));
    
    for (const hit of termsHits) {
      if (!existingIds.has(hit.id)) {
        merged.push(hit);
      }
    }

    return merged.sort((a, b) => b.score - a.score);
  }
}
````

### Task 5: 可観測性・ログ強化（優先度：★☆☆）

#### 5.1 統合ログシステム
````javascript
// 統合ログ・監査システム

import { ConfigManager } from './config.js';

export class AuditLogger {
  constructor() {
    this.config = new ConfigManager();
  }

  // 操作タイムライン（save→index→search）
  timeline(operation, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      operation,
      duration: data.duration || null,
      ...data
    };

    if (this.config.current.verboseLogging) {
      console.log(`🕒 [${operation}]`, logEntry);
    }

    // 本番では監査ログファイルに記録
    if (this.config.isProd()) {
      this._writeAuditLog(logEntry);
    }
  }

  async _writeAuditLog(entry) {
    // 監査ログファイル書き込み（実装略）
    const auditPath = path.join(process.env.DATA_ROOT || './data', 'audit.jsonl');
    await fs.appendFile(auditPath, JSON.stringify(entry) + '\n');
  }

  // 統計メトリクス更新
  async updateStats(operation, metadata = {}) {
    const statsPath = process.env.STATS_PATH || './data/index/stats.json';
    
    try {
      const stats = JSON.parse(await fs.readFile(statsPath, 'utf8'));
      stats.operations = stats.operations || {};
      stats.operations[operation] = (stats.operations[operation] || 0) + 1;
      stats.lastActivity = new Date().toISOString();
      
      Object.assign(stats, metadata);
      
      await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));
    } catch (error) {
      console.warn('Stats update failed:', error.message);
    }
  }
}
````

## 🚀 実装手順

### Week 1: 構造統一化
1. **Day 1-2**: フォルダ構成統一（Task 1）
2. **Day 3**: VS Code Tasks/Launch設定更新
3. **Day 4**: CI/CD Workflow調整
4. **Day 5**: テスト実行・検証

### Week 2: 機能強化
1. **Day 1-2**: 索引管理API実装（Task 2） 
2. **Day 3**: 環境プロファイル分離（Task 3）
3. **Day 4**: 日本語検索強化（Task 4）
4. **Day 5**: 統合テスト・デバッグ

### Week 3: 品質向上
1. **Day 1-2**: ログ・監査機能（Task 5）
2. **Day 3**: パフォーマンステスト
3. **Day 4**: ドキュメント更新
4. **Day 5**: リリース準備

## ✅ 受け入れ条件

### 必須条件
- [ ] `/health` が常に正確な `searchIndex` ステータスを返す
- [ ] `data/chatlogs` への統一配置完了
- [ ] 保存→索引→検索の99%+ 成功率
- [ ] dev/prod環境の明確な分離
- [ ] 日本語検索の精度向上確認

### 推奨条件  
- [ ] 索引再構築API（`POST /index/rebuild`）動作
- [ ] 二段検索によるヒット率向上
- [ ] 監査ログの出力確認
- [ ] VS Code Tasks統一実行確認

## 🔍 品質ゲート

各週末に以下を実施：

````bash
# 品質チェックスクリプト例
npm run test:smoke          # スモークテスト
npm run test:search         # 検索精度テスト  
npm run test:performance    # パフォーマンステスト
npm run build-all          # 全索引再構築
curl http://localhost:3000/health  # ヘルスチェック
````
