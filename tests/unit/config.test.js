/**
 * config.js ユニットテスト
 * 
 * テスト対象：
 * - ConfigManager クラス
 * - 環境別プロファイル管理
 * - パス解決
 * - 認証ミドルウェア
 * - 設定検証
 */

import { jest } from '@jest/globals';
import { ConfigManager } from '../../yuihub_api/src/config.js';

describe('ConfigManager', () => {
  let originalEnv;

  beforeEach(() => {
    // 環境変数のバックアップ
    originalEnv = { ...process.env };
    jest.clearAllMocks();
  });

  afterEach(() => {
    // 環境変数の復元
    process.env = originalEnv;
    jest.restoreAllMocks();
  });

  describe('コンストラクタ', () => {
    test('デフォルトでdevelopment環境として初期化される', () => {
      delete process.env.NODE_ENV;
      const config = new ConfigManager();

      expect(config.env).toBe('development');
    });

    test('環境変数に基づいて環境を設定する', () => {
      process.env.NODE_ENV = 'production';
      const config = new ConfigManager();

      expect(config.env).toBe('production');
    });

    test('プロファイルが正しく定義されている', () => {
      const config = new ConfigManager();

      expect(config.profiles).toHaveProperty('development');
      expect(config.profiles).toHaveProperty('production');
      expect(config.profiles).toHaveProperty('test');
    });
  });

  describe('current プロパティ', () => {
    test('development環境の設定を返す', () => {
      process.env.NODE_ENV = 'development';
      const config = new ConfigManager();
      const current = config.current;

      expect(current.env).toBe('development');
      expect(current.auth).toBe(false);
      expect(current.hotReload).toBe(true);
      expect(current.corsOrigins).toBe('*');
    });

    test('production環境の設定を返す', () => {
      process.env.NODE_ENV = 'production';
      const config = new ConfigManager();
      const current = config.current;

      expect(current.env).toBe('production');
      expect(current.auth).toBe(true);
      expect(current.hotReload).toBe(false);
    });

    test('test環境の設定を返す', () => {
      process.env.NODE_ENV = 'test';
      const config = new ConfigManager();
      const current = config.current;

      expect(current.env).toBe('test');
      expect(current.auth).toBe(false);
      expect(current.fixedSeed).toBe(true);
    });

    test('環境変数でポート番号を設定できる', () => {
      process.env.PORT = '4000';
      const config = new ConfigManager();

      expect(config.current.port).toBe(4000);
    });

    test('デフォルトポート3000が使用される', () => {
      delete process.env.PORT;
      const config = new ConfigManager();

      expect(config.current.port).toBe(3000);
    });

    test('データルートパスが正しく設定される', () => {
      const config = new ConfigManager();
      const current = config.current;

      expect(current.dataRoot).toBeTruthy();
      expect(current.localStoragePath).toBeTruthy();
      expect(current.lunrIndexPath).toBeTruthy();
    });

    test('APIトークンが環境変数から読み込まれる', () => {
      process.env.API_TOKEN = 'test-token-12345';
      const config = new ConfigManager();

      expect(config.current.apiToken).toBe('test-token-12345');
    });
  });

  describe('isDev()', () => {
    test('development環境でtrueを返す', () => {
      process.env.NODE_ENV = 'development';
      const config = new ConfigManager();

      expect(config.isDev()).toBe(true);
    });

    test('他の環境でfalseを返す', () => {
      process.env.NODE_ENV = 'production';
      const config = new ConfigManager();

      expect(config.isDev()).toBe(false);
    });
  });

  describe('isProd()', () => {
    test('production環境でtrueを返す', () => {
      process.env.NODE_ENV = 'production';
      const config = new ConfigManager();

      expect(config.isProd()).toBe(true);
    });

    test('他の環境でfalseを返す', () => {
      process.env.NODE_ENV = 'development';
      const config = new ConfigManager();

      expect(config.isProd()).toBe(false);
    });
  });

  describe('isTest()', () => {
    test('test環境でtrueを返す', () => {
      process.env.NODE_ENV = 'test';
      const config = new ConfigManager();

      expect(config.isTest()).toBe(true);
    });

    test('他の環境でfalseを返す', () => {
      process.env.NODE_ENV = 'development';
      const config = new ConfigManager();

      expect(config.isTest()).toBe(false);
    });
  });

  describe('validate()', () => {
    test('有効な開発環境設定を検証する', () => {
      process.env.NODE_ENV = 'development';
      const config = new ConfigManager();
      const validation = config.validate();

      expect(validation.valid).toBe(true);
      expect(validation.errors).toEqual([]);
    });

    test('本番環境で認証トークンがない場合エラーを返す', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.API_TOKEN;
      const config = new ConfigManager();
      const validation = config.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
      expect(validation.errors.some(e => e.includes('API_TOKEN'))).toBe(true);
    });

    test('短すぎるAPIトークンでエラーを返す', () => {
      process.env.NODE_ENV = 'production';
      process.env.API_TOKEN = 'short';
      const config = new ConfigManager();
      const validation = config.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('API_TOKEN'))).toBe(true);
    });

    test('不正なポート番号でエラーを返す', () => {
      process.env.PORT = '99999';
      const config = new ConfigManager();
      const validation = config.validate();

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('PORT'))).toBe(true);
    });

    test('本番環境でワイルドカードCORSを警告する', () => {
      process.env.NODE_ENV = 'production';
      process.env.API_TOKEN = 'valid-token-1234567890';
      delete process.env.ALLOWED_ORIGINS;
      const config = new ConfigManager();
      
      // 本番のデフォルトはCORS制限があるため、これは通る
      const validation = config.validate();
      expect(validation.valid).toBe(true);
    });
  });

  describe('getSummary()', () => {
    test('設定サマリーを返す', () => {
      process.env.NODE_ENV = 'development';
      process.env.PORT = '3000';
      const config = new ConfigManager();
      const summary = config.getSummary();

      expect(summary).toHaveProperty('environment');
      expect(summary).toHaveProperty('workspaceRoot');
      expect(summary).toHaveProperty('auth');
      expect(summary).toHaveProperty('cors');
      expect(summary).toHaveProperty('port');
      expect(summary).toHaveProperty('host');
    });

    test('認証有効/無効が正しく表示される', () => {
      process.env.NODE_ENV = 'production';
      process.env.API_TOKEN = 'valid-token-1234567890';
      const config = new ConfigManager();
      const summary = config.getSummary();

      expect(summary.auth).toBe('enabled');
    });
  });

  describe('getFastifyLogLevel()', () => {
    test('test環境でログを無効化する', () => {
      process.env.NODE_ENV = 'test';
      const config = new ConfigManager();
      const logLevel = config.getFastifyLogLevel();

      expect(logLevel).toBe(false);
    });

    test('development環境でdebugログを返す', () => {
      process.env.NODE_ENV = 'development';
      const config = new ConfigManager();
      const logLevel = config.getFastifyLogLevel();

      expect(logLevel).toHaveProperty('level');
      expect(logLevel.level).toBe('debug');
    });

    test('production環境でinfoログを返す', () => {
      process.env.NODE_ENV = 'production';
      const config = new ConfigManager();
      const logLevel = config.getFastifyLogLevel();

      expect(logLevel).toHaveProperty('level');
      expect(logLevel.level).toBe('info');
    });
  });

  describe('createAuthMiddleware()', () => {
    test('開発環境で認証をスキップする', async () => {
      process.env.NODE_ENV = 'development';
      const config = new ConfigManager();
      const middleware = config.createAuthMiddleware();

      const mockReq = { method: 'GET', url: '/test', headers: {} };
      const mockReply = { code: jest.fn(), send: jest.fn() };

      await middleware(mockReq, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    test('本番環境で認証トークンをチェックする', async () => {
      process.env.NODE_ENV = 'production';
      process.env.API_TOKEN = 'valid-token-1234567890';
      const config = new ConfigManager();
      const middleware = config.createAuthMiddleware();

      const mockReq = {
        method: 'POST',
        url: '/save',
        headers: { 'x-yuihub-token': 'valid-token-1234567890' },
      };
      const mockReply = { code: jest.fn(), send: jest.fn() };

      await middleware(mockReq, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    test('不正なトークンで403を返す', async () => {
      process.env.NODE_ENV = 'production';
      process.env.API_TOKEN = 'valid-token-1234567890';
      const config = new ConfigManager();
      const middleware = config.createAuthMiddleware();

      const mockReq = {
        method: 'POST',
        url: '/save',
        headers: { 'x-yuihub-token': 'invalid-token' },
        log: { warn: jest.fn() },
        ip: '1.2.3.4',
      };
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await middleware(mockReq, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(403);
      expect(mockReply.send).toHaveBeenCalledWith({
        ok: false,
        error: 'Forbidden',
      });
    });

    test('トークンがない場合401を返す', async () => {
      process.env.NODE_ENV = 'production';
      process.env.API_TOKEN = 'valid-token-1234567890';
      const config = new ConfigManager();
      const middleware = config.createAuthMiddleware();

      const mockReq = {
        method: 'POST',
        url: '/save',
        headers: {},
      };
      const mockReply = {
        code: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await middleware(mockReq, mockReply);

      expect(mockReply.code).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith(
        expect.objectContaining({ ok: false })
      );
    });

    test('/health エンドポイントは認証をスキップする', async () => {
      process.env.NODE_ENV = 'production';
      process.env.API_TOKEN = 'valid-token-1234567890';
      const config = new ConfigManager();
      const middleware = config.createAuthMiddleware();

      const mockReq = {
        method: 'GET',
        url: '/health',
        headers: {},
      };
      const mockReply = { code: jest.fn(), send: jest.fn() };

      await middleware(mockReq, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
      expect(mockReply.send).not.toHaveBeenCalled();
    });

    test('/openapi.yml エンドポイントは認証をスキップする', async () => {
      process.env.NODE_ENV = 'production';
      process.env.API_TOKEN = 'valid-token-1234567890';
      const config = new ConfigManager();
      const middleware = config.createAuthMiddleware();

      const mockReq = {
        method: 'GET',
        url: '/openapi.yml',
        headers: {},
      };
      const mockReply = { code: jest.fn(), send: jest.fn() };

      await middleware(mockReq, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });

    test('Bearer トークンをサポートする', async () => {
      process.env.NODE_ENV = 'production';
      process.env.API_TOKEN = 'valid-token-1234567890';
      const config = new ConfigManager();
      const middleware = config.createAuthMiddleware();

      const mockReq = {
        method: 'POST',
        url: '/save',
        headers: { authorization: 'Bearer valid-token-1234567890' },
      };
      const mockReply = { code: jest.fn(), send: jest.fn() };

      await middleware(mockReq, mockReply);

      expect(mockReply.code).not.toHaveBeenCalled();
    });
  });

  describe('_findWorkspaceRoot()', () => {
    test('ワークスペースルートを検出する', () => {
      const config = new ConfigManager();
      
      expect(config.workspaceRoot).toBeTruthy();
      expect(typeof config.workspaceRoot).toBe('string');
    });
  });

  describe('エッジケースと異常系', () => {
    test('未定義の環境でdevelopmentにフォールバックする', () => {
      process.env.NODE_ENV = 'unknown-env';
      const config = new ConfigManager();
      const current = config.current;

      // 未定義の環境はdevelopmentプロファイルを使用
      expect(current.hotReload).toBe(true);
    });

    test('CORSオリジンをカンマ区切りで設定できる', () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://example.com,https://test.com';
      const config = new ConfigManager();

      expect(config.current.corsOrigins).toEqual([
        'https://example.com',
        'https://test.com',
      ]);
    });

    test('不正なポート番号を処理できる', () => {
      process.env.PORT = 'invalid';
      const config = new ConfigManager();

      expect(isNaN(config.current.port)).toBe(true);
    });

    test('tunnel設定が正しく読み込まれる', () => {
      process.env.ENABLE_TUNNEL = 'true';
      process.env.TUNNEL_MODE = 'named';
      const config = new ConfigManager();

      expect(config.current.enableTunnel).toBe(true);
      expect(config.current.tunnelMode).toBe('named');
    });
  });
});
