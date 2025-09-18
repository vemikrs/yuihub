/**
 * ConfigManager - 環境別プロファイル管理
 * 
 * 環境分離:
 * - development: 認証OFF、ホットリロード、詳細ログ
 * - production: 認証ON、最小ログ、CORS制限
 * - test: 認証OFF、固定シード、テスト最適化
 */

export class ConfigManager {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    
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
   * 現在の環境設定を取得
   * @returns {object} 環境設定オブジェクト
   */
  get current() {
    const profile = this.profiles[this.env] || this.profiles.development;
    
    return {
      ...profile,
      env: this.env,
      // パス設定（環境変数から取得、デフォルトはdata/配下）
      dataRoot: process.env.DATA_ROOT || './data',
      port: parseInt(process.env.PORT) || 3000,
      host: process.env.HOST || (this.env === 'production' ? '0.0.0.0' : 'localhost'),
      storageAdapter: process.env.STORAGE_ADAPTER || 'local',
      
      // パス構築
      get localStoragePath() {
        return process.env.LOCAL_STORAGE_PATH || `${this.dataRoot}/chatlogs`;
      },
      get lunrIndexPath() {
        return process.env.LUNR_INDEX_PATH || `${this.dataRoot}/index/lunr.idx.json`;
      },
      get termsIndexPath() {
        return process.env.TERMS_INDEX_PATH || `${this.dataRoot}/index/terms.json`;
      },
      get statsPath() {
        return process.env.STATS_PATH || `${this.dataRoot}/index/stats.json`;
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
      
      // /health エンドポイントはスキップ
      if (req.method === 'GET' && req.url.startsWith('/health')) {
        return;
      }

      const apiToken = config.apiToken;
      const authHeader = req.headers['x-yuihub-token'];
      
      if (!apiToken) {
        reply.code(500).send({ 
          ok: false, 
          error: 'API_TOKEN not configured' 
        });
        return;
      }

      if (!authHeader) {
        reply.code(401).send({ 
          ok: false, 
          error: 'Missing x-yuihub-token header' 
        });
        return;
      }

      // タイミング攻撃対策の安全な比較
      const safeEquals = (a, b) => {
        const A = Buffer.from(String(a ?? ''));
        const B = Buffer.from(String(b ?? ''));
        if (A.length !== B.length) return false;
        try { 
          return require('crypto').timingSafeEqual(A, B); 
        } catch { 
          return false; 
        }
      };

      if (!safeEquals(authHeader, apiToken)) {
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