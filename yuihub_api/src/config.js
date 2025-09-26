/**
 * ConfigManager - 環境別プロファイル管理
 * 
 * 環境分離:
 * - development: 認証OFF、ホットリロード、詳細ログ
 * - production: 認証ON、最小ログ、CORS制限
 * - test: 認証OFF、固定シード、テスト最適化
 */

import path from 'path';
import fs from 'fs';
import { timingSafeEqual } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class ConfigManager {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.workspaceRoot = this._findWorkspaceRoot();
    
    this.profiles = {
      development: {
        auth: false,
        hotReload: true,
        verboseLogging: true,
        corsOrigins: '*',
        indexAutoRebuild: true,
        rateLimitMax: 1000,
        rateLimitWindow: '1 minute',
        requestTimeout: 30000,
        logLevel: 'debug'
      },
      production: {
        auth: true,
        hotReload: false,
        verboseLogging: false,
        corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['https://poc-yuihub.vemi.jp'],
        indexAutoRebuild: false,
        rateLimitMax: 120,
        rateLimitWindow: '1 minute', 
        requestTimeout: 10000,
        logLevel: 'info'
      },
      test: {
        auth: false,
        hotReload: false,
        verboseLogging: false,
        corsOrigins: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        indexAutoRebuild: true,
        rateLimitMax: 10000,
        rateLimitWindow: '1 minute',
        requestTimeout: 5000,
        logLevel: 'warn',
        fixedSeed: true
      }
    };
  }

  /**
   * ワークスペースルートを自動検出
   * yuihub_apiフォルダが存在するディレクトリを探索
   * @returns {string} ワークスペースルートの絶対パス
   * @private
   */
  _findWorkspaceRoot() {
    let current = process.cwd();
    
    // 現在のディレクトリがyuihub_api配下の場合は親を探す
    if (current.endsWith('/yuihub_api') || current.includes('/yuihub_api/')) {
      current = path.resolve(current, '../');
    }
    
    // yuihub_apiフォルダが存在するまで上位ディレクトリを探索
    while (current !== '/' && current !== path.parse(current).root) {
      const yuihubApiPath = path.join(current, 'yuihub_api');
      if (fs.existsSync(yuihubApiPath) && fs.statSync(yuihubApiPath).isDirectory()) {
        return current;
      }
      current = path.dirname(current);
    }
    
    // 見つからない場合は現在のディレクトリから相対的に推測
    console.warn('⚠️  Workspace root not found, falling back to relative path detection');
    const fallback = path.resolve(__dirname, '../../..');
    if (fs.existsSync(path.join(fallback, 'yuihub_api'))) {
      return fallback;
    }
    
    // 最後の手段として現在のcwdを返す
    return process.cwd();
  }

  /**
   * 現在の環境設定を取得
   * @returns {object} 環境設定オブジェクト
   */
  get current() {
    const profile = this.profiles[this.env] || this.profiles.development;
    
    // ワークスペースルートベースのデフォルトパス構築
  const defaultDataRoot = path.resolve(this.workspaceRoot, 'yuihub_api', 'data');
    
    return {
      ...profile,
      env: this.env,
      workspaceRoot: this.workspaceRoot,
      // パス設定（環境変数から取得、デフォルトは自動検出したyuihub_api/data）
  dataRoot: path.resolve(this.workspaceRoot, process.env.DATA_ROOT || defaultDataRoot),
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || (this.env === 'production' ? '0.0.0.0' : 'localhost'),
      storageAdapter: process.env.STORAGE_ADAPTER || 'local',
      
      // パス構築
      get localStoragePath() {
        const p = process.env.LOCAL_STORAGE_PATH || path.join(this.dataRoot, 'chatlogs');
        return path.resolve(this.workspaceRoot, p);
      },
      get lunrIndexPath() {
        const p = process.env.LUNR_INDEX_PATH || path.join(this.dataRoot, 'index', 'lunr.idx.json');
        return path.resolve(this.workspaceRoot, p);
      },
      get termsIndexPath() {
        const p = process.env.TERMS_INDEX_PATH || path.join(this.dataRoot, 'index', 'terms.json');
        return path.resolve(this.workspaceRoot, p);
      },
      get statsPath() {
        const p = process.env.STATS_PATH || path.join(this.dataRoot, 'index', 'stats.json');
        return path.resolve(this.workspaceRoot, p);
      },
      
      // API設定
      apiToken: process.env.API_TOKEN,
      
      // Tunnel設定
      enableTunnel: process.env.ENABLE_TUNNEL === 'true',
      tunnelMode: process.env.TUNNEL_MODE || 'quick'
    };
  }

  /**
   * 開発環境かどうか判定
   * @returns {boolean}
   */
  isDev() { 
    return this.env === 'development'; 
  }

  /**
   * 本番環境かどうか判定 
   * @returns {boolean}
   */
  isProd() { 
    return this.env === 'production'; 
  }

  /**
   * テスト環境かどうか判定
   * @returns {boolean}
   */
  isTest() { 
    return this.env === 'test'; 
  }

  /**
   * 設定の検証
   * @returns {{valid: boolean, errors: string[]}}
   */
  validate() {
    const config = this.current;
    const errors = [];

    // API Token検証（認証有効時）
    if (config.auth) {
      if (!config.apiToken || config.apiToken.length < 16) {
        errors.push('API_TOKEN is missing or too short (minimum 16 characters)');
      }
    }

    // ポート番号検証
    if (config.port < 1 || config.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }

    // データルートパス検証
    if (!config.dataRoot) {
      errors.push('DATA_ROOT is required');
    }

    // CORS Origins検証（本番環境）
    if (config.env === 'production' && (!config.corsOrigins || config.corsOrigins === '*')) {
      errors.push('CORS origins should be restricted in production environment');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 設定のサマリー情報を取得（ログ出力用）
   * @returns {object}
   */
  getSummary() {
    const config = this.current;
    return {
      environment: config.env,
      workspaceRoot: this.workspaceRoot,
      auth: config.auth ? 'enabled' : 'disabled',
      cors: Array.isArray(config.corsOrigins) ? config.corsOrigins : config.corsOrigins,
      indexAutoRebuild: config.indexAutoRebuild,
      dataRoot: config.dataRoot,
      port: config.port,
      host: config.host,
      logLevel: config.logLevel,
      tunnel: config.enableTunnel ? config.tunnelMode : 'disabled'
    };
  }

  /**
   * Fastify ログレベルを取得
   * @returns {string|boolean}
   */
  getFastifyLogLevel() {
    const config = this.current;
    
    if (config.env === 'test') {
      return false;  // テスト時はログ無効
    }
    
    if (config.env === 'development') {
      return {
        level: config.logLevel
      };
    }
    
    return {
      level: config.logLevel
    };
  }

  /**
   * 認証設定に基づく認証ミドルウェア関数を作成
   * @returns {function}
   */
  createAuthMiddleware() {
    const config = this.current;
    
    if (!config.auth) {
      // 開発・テスト環境では認証スキップ
      return async (req, reply) => {
        // 何もしない
      };
    }

    return async (req, reply) => {
      // OPTIONS (CORS preflight) はスキップ
      if (req.method === 'OPTIONS') {
        return;
      }
      
      // /ops/* はローカル限定・別トークン（LOCAL_OPS_TOKEN）
      if (req.url.startsWith('/ops/')) {
        const isLocal = req.ip === '127.0.0.1' || req.ip === '::1' || req.hostname === 'localhost';
        if (!isLocal) {
          reply.code(403).send({ ok: false, error: 'Forbidden: local only' });
          return;
        }
        const bearer = req.headers['authorization'];
        const bearerToken = (typeof bearer === 'string' && bearer.toLowerCase().startsWith('bearer '))
          ? bearer.slice(7).trim()
          : undefined;
        const opsToken = process.env.LOCAL_OPS_TOKEN || '';
        if (!opsToken || !bearerToken) {
          reply.code(401).send({ ok: false, error: 'Unauthorized: missing ops token' });
          return;
        }
        const safeEquals = (a, b) => {
          const A = Buffer.from(String(a ?? ''), 'utf8');
          const B = Buffer.from(String(b ?? ''), 'utf8');
          if (A.length !== B.length) return false;
          try { return timingSafeEqual(A, B); } catch { return false; }
        };
        if (!safeEquals(bearerToken, opsToken)) {
          reply.code(401).send({ ok: false, error: 'Unauthorized: invalid ops token' });
          return;
        }
        return; // /ops/* はここで認証完了
      }

      // /health エンドポイントはスキップ
      if ((req.method === 'GET' || req.method === 'HEAD') && req.url.startsWith('/health')) {
        return;
      }
      
      // OpenAPI schema is public for GPTs Actions integration
      if ((req.method === 'GET' || req.method === 'HEAD') && req.url.startsWith('/openapi.yml')) {
        return;
      }
      
      // Privacy policy is public for OpenAPI compliance
      if ((req.method === 'GET' || req.method === 'HEAD') && req.url.startsWith('/privacy')) {
        return;
      }

      const apiToken = config.apiToken;
      const headerToken = req.headers['x-yuihub-token'];
      const bearer = req.headers['authorization'];
      const bearerToken = (typeof bearer === 'string' && bearer.toLowerCase().startsWith('bearer '))
        ? bearer.slice(7).trim()
        : undefined;
      
      if (!apiToken) {
        reply.code(500).send({ 
          ok: false, 
          error: 'API_TOKEN not configured' 
        });
        return;
      }

      if (!headerToken && !bearerToken) {
        reply.code(401).send({ 
          ok: false, 
          error: 'Missing authentication: x-yuihub-token or Authorization: Bearer' 
        });
        return;
      }

      // タイミング攻撃対策の安全な比較（ESM対応）
      const safeEquals = (a, b) => {
        const A = Buffer.from(String(a ?? ''), 'utf8');
        const B = Buffer.from(String(b ?? ''), 'utf8');
        if (A.length !== B.length) return false;
        try {
          return timingSafeEqual(A, B);
        } catch {
          return false;
        }
      };

      const provided = headerToken ?? bearerToken;
      if (!safeEquals(provided, apiToken)) {
        req.log.warn({ 
          ip: req.ip, 
          url: req.url 
        }, 'Forbidden: invalid token');
        reply.code(403).send({ 
          ok: false, 
          error: 'Forbidden' 
        });
        return;
      }
    };
  }
}