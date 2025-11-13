/**
 * IndexManager ユニットテスト
 * 
 * テスト対象：
 * - 索引の状態管理（missing|building|ready）
 * - 索引の再構築・リロード
 * - バックグラウンド索引更新（debounce機構）
 * - 絶対パススクリプト呼び出しロジック（重点）
 * - エラーハンドリング
 */

import { jest } from '@jest/globals';
import { IndexManager } from '../../yuihub_api/src/index-manager.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// モックの設定
let mockSearchService;
let mockLogger;

describe('IndexManager', () => {
  beforeEach(() => {
    // SearchServiceのモック
    mockSearchService = {
      loadIndex: jest.fn().mockResolvedValue(true),
      clearDelta: jest.fn(),
    };

    // ロガーのモック
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('コンストラクタ', () => {
    test('正常に初期化される', () => {
      const config = {
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        termsPath: '/test/terms.json',
        statsPath: '/test/stats.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      };

      const manager = new IndexManager(config);

      expect(manager.searchService).toBe(mockSearchService);
      expect(manager.indexPath).toBe('/test/index.json');
      expect(manager.termsPath).toBe('/test/terms.json');
      expect(manager.statsPath).toBe('/test/stats.json');
      expect(manager.dataRoot).toBe('/test/data');
      expect(manager.logger).toBe(mockLogger);
      expect(manager.status).toBe('missing');
      expect(manager.lastBuildAt).toBeNull();
    });

    test('デフォルト値で初期化される', () => {
      const manager = new IndexManager({
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
      });

      expect(manager.logger).toBe(console);
      expect(manager.status).toBe('missing');
    });
  });

  describe('getStatus()', () => {
    test('インデックスが存在しない場合、missingを返す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      // indexExistsがfalseを返すようにモック
      jest.spyOn(manager, 'indexExists').mockResolvedValue(false);

      const status = await manager.getStatus();

      expect(status.status).toBe('missing');
      expect(status.lastBuildAt).toBeNull();
    });

    test('ビルド中の場合、buildingを返す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      jest.spyOn(manager, 'indexExists').mockResolvedValue(true);
      manager.buildPromise = Promise.resolve(true);
      manager._buildStartTime = new Date().toISOString();

      const status = await manager.getStatus();

      expect(status.status).toBe('building');
      expect(status.startedAt).toBe(manager._buildStartTime);
    });

    test('インデックスが準備完了の場合、readyを返す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      jest.spyOn(manager, 'indexExists').mockResolvedValue(true);
      manager.status = 'ready';
      manager.lastBuildAt = '2025-01-01T00:00:00Z';

      const status = await manager.getStatus();

      expect(status.status).toBe('ready');
      expect(status.lastBuildAt).toBe('2025-01-01T00:00:00Z');
    });

    test('debounce情報が含まれる', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      jest.spyOn(manager, 'indexExists').mockResolvedValue(true);
      manager.status = 'ready';
      manager._debounceTimer = setTimeout(() => {}, 1000);
      manager._debounceScheduledAt = Date.now();

      const status = await manager.getStatus();

      expect(status.debounce).not.toBeNull();
      expect(status.debounce.scheduledAt).toBe(manager._debounceScheduledAt);
      expect(status.debounce.etaSeconds).toBeGreaterThanOrEqual(0);

      clearTimeout(manager._debounceTimer);
    });
  });

  describe('indexExists()', () => {
    test('インデックスファイルが存在する場合、trueを返す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      // fs.accessのモック（成功）
      const fsPromises = await import('fs/promises');
      jest.spyOn(fsPromises, 'access').mockResolvedValue(undefined);

      const exists = await manager.indexExists();

      expect(exists).toBe(true);
      expect(fsPromises.access).toHaveBeenCalledWith('/test/index.json');
    });

    test('インデックスファイルが存在しない場合、falseを返す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      // fs.accessのモック（失敗）
      const fsPromises = await import('fs/promises');
      jest.spyOn(fsPromises, 'access').mockRejectedValue(new Error('ENOENT'));

      const exists = await manager.indexExists();

      expect(exists).toBe(false);
    });
  });

  describe('rebuild()', () => {
    test('索引を正常に再構築する', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        termsPath: '/test/terms.json',
        statsPath: '/test/stats.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      // _performRebuildのモック
      jest.spyOn(manager, '_performRebuild').mockResolvedValue(true);

      const result = await manager.rebuild();

      expect(result).toBe(true);
      expect(manager.status).toBe('ready');
      expect(manager.lastBuildAt).not.toBeNull();
      expect(manager._lastFullRebuildAt).not.toBeNull();
      expect(mockLogger.info).toHaveBeenCalledWith('🔄 Starting index rebuild...');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Index rebuild completed successfully');
    });

    test('再構築が既に実行中の場合、既存のPromiseを返す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      // 最初の再構築を開始（完了しない）
      const existingPromise = new Promise((resolve) => {
        setTimeout(() => resolve(true), 1000);
      });
      manager.buildPromise = existingPromise;

      const result = manager.rebuild();

      expect(result).toBe(existingPromise);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Index rebuild already in progress, returning existing promise'
      );
    });

    test('再構築が失敗した場合、エラーをスローする', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      const error = new Error('Rebuild failed');
      jest.spyOn(manager, '_performRebuild').mockRejectedValue(error);

      await expect(manager.rebuild()).rejects.toThrow('Rebuild failed');
      expect(manager.status).toBe('missing');
      expect(manager._lastRebuildResult).toEqual({
        status: 'failed',
        reason: 'Rebuild failed',
      });
      expect(mockLogger.error).toHaveBeenCalledWith('❌ Index rebuild failed:', 'Rebuild failed');
    });

    test('再構築成功後にdeltaがクリアされる', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      jest.spyOn(manager, '_performRebuild').mockResolvedValue(true);

      await manager.rebuild();

      expect(mockSearchService.clearDelta).toHaveBeenCalled();
    });
  });

  describe('_performRebuild() - 絶対パス呼び出しロジック', () => {
    test('スクリプトを絶対パスで呼び出す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/data/index/lunr.idx.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      // child_process.execFileのモック
      const childProcess = await import('child_process');
      
      const mockExecFileAsync = jest.fn().mockResolvedValue({
        stdout: 'Build completed',
        stderr: '',
      });

      jest.spyOn(childProcess, 'execFile').mockImplementation((cmd, args, opts, cb) => {
        mockExecFileAsync(cmd, args, opts).then(
          (result) => cb(null, result.stdout, result.stderr),
          (error) => cb(error)
        );
      });

      jest.spyOn(manager, '_updateStats').mockResolvedValue(undefined);

      await manager._performRebuild();

      // スクリプトパスが絶対パスであることを確認
      expect(mockExecFileAsync).toHaveBeenCalled();
      const callArgs = mockExecFileAsync.mock.calls[0];
      expect(callArgs[0]).toBe('node');
      
      const scriptPath = callArgs[1][0];
      expect(path.isAbsolute(scriptPath)).toBe(true);
      expect(scriptPath).toMatch(/chunk_and_lunr\.mjs$/);
    });

    test('正しい引数でスクリプトを呼び出す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/data/index/lunr.idx.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      const childProcess = await import('child_process');
      
      const mockExecFileAsync = jest.fn().mockResolvedValue({
        stdout: 'Success',
        stderr: '',
      });

      jest.spyOn(childProcess, 'execFile').mockImplementation((cmd, args, opts, cb) => {
        mockExecFileAsync(cmd, args, opts).then(
          (result) => cb(null, result.stdout, result.stderr),
          (error) => cb(error)
        );
      });

      jest.spyOn(manager, '_updateStats').mockResolvedValue(undefined);

      await manager._performRebuild();

      const callArgs = mockExecFileAsync.mock.calls[0];
      const args = callArgs[1];
      
      // --source と --output が正しく設定されていることを確認
      expect(args).toContain('--source=/test/data/chatlogs');
      expect(args).toContain('--output=/test/data/index');
    });

    test('スクリプト実行が失敗した場合、エラーをスローする', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/data/index/lunr.idx.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      const childProcess = await import('child_process');
      
      jest.spyOn(childProcess, 'execFile').mockImplementation((cmd, args, opts, cb) => {
        cb(new Error('Script execution failed'));
      });

      await expect(manager._performRebuild()).rejects.toThrow('Index rebuild failed');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Index rebuild script failed:',
        expect.any(Error)
      );
    });

    test('タイムアウトが設定される', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/data/index/lunr.idx.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      const childProcess = await import('child_process');
      
      const mockExecFileAsync = jest.fn().mockResolvedValue({
        stdout: 'Success',
        stderr: '',
      });

      jest.spyOn(childProcess, 'execFile').mockImplementation((cmd, args, opts, cb) => {
        mockExecFileAsync(cmd, args, opts).then(
          (result) => cb(null, result.stdout, result.stderr),
          (error) => cb(error)
        );
      });

      jest.spyOn(manager, '_updateStats').mockResolvedValue(undefined);

      await manager._performRebuild();

      const callArgs = mockExecFileAsync.mock.calls[0];
      const options = callArgs[2];
      expect(options.timeout).toBe(120000); // 2分
    });

    test('stdoutとstderrをログに出力する', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/data/index/lunr.idx.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      const childProcess = await import('child_process');
      
      jest.spyOn(childProcess, 'execFile').mockImplementation((cmd, args, opts, cb) => {
        cb(null, 'Script output', 'Warning message');
      });

      jest.spyOn(manager, '_updateStats').mockResolvedValue(undefined);

      await manager._performRebuild();

      expect(mockLogger.info).toHaveBeenCalledWith('Build script output:', 'Script output');
      expect(mockLogger.warn).toHaveBeenCalledWith('Build script warnings:', 'Warning message');
    });
  });

  describe('reload()', () => {
    test('インデックスを正常にリロードする', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        statsPath: '/test/stats.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      mockSearchService.loadIndex.mockResolvedValue(true);
      jest.spyOn(manager, '_updateStats').mockResolvedValue(undefined);

      const result = await manager.reload();

      expect(result).toBe(true);
      expect(manager.status).toBe('ready');
      expect(manager.lastBuildAt).not.toBeNull();
      expect(mockSearchService.loadIndex).toHaveBeenCalledWith('/test/index.json');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Index reloaded successfully');
    });

    test('リロードが失敗した場合、statusをmissingに設定する', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      mockSearchService.loadIndex.mockResolvedValue(false);
      jest.spyOn(manager, '_updateStats').mockResolvedValue(undefined);

      const result = await manager.reload();

      expect(result).toBe(false);
      expect(manager.status).toBe('missing');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        '⚠️ Index reload failed - file not found or invalid'
      );
    });

    test('リロード中にエラーが発生した場合、エラーをスローする', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      const error = new Error('Load failed');
      mockSearchService.loadIndex.mockRejectedValue(error);

      await expect(manager.reload()).rejects.toThrow('Load failed');
      expect(manager.status).toBe('missing');
      expect(mockLogger.error).toHaveBeenCalledWith('❌ Index reload error:', 'Load failed');
    });
  });

  describe('scheduleRebuild()', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('debounce機構により再構築がスケジュールされる', () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      manager.scheduleRebuild();

      expect(manager._debounceTimer).not.toBeNull();
      expect(manager._debounceScheduledAt).not.toBeNull();
    });

    test('既にスケジュール済みの場合、新規スケジュールしない', () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      manager.scheduleRebuild();
      const firstTimer = manager._debounceTimer;
      const firstScheduledAt = manager._debounceScheduledAt;

      manager.scheduleRebuild();

      expect(manager._debounceTimer).toBe(firstTimer);
      expect(manager._debounceScheduledAt).toBe(firstScheduledAt);
    });
  });

  describe('setDebounceDelay()', () => {
    test('debounce遅延時間を設定する', () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
      });

      manager.setDebounceDelay(30000);

      expect(manager._debounceDelayMs).toBe(30000);
    });

    test('負の値は0として扱われる', () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
      });

      manager.setDebounceDelay(-1000);

      expect(manager._debounceDelayMs).toBe(0);
    });

    test('文字列を数値に変換する', () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
      });

      manager.setDebounceDelay('45000');

      expect(manager._debounceDelayMs).toBe(45000);
    });
  });

  describe('_computeBackoffDelay()', () => {
    test('失敗回数に応じて遅延が増加する', () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
      });

      manager._debounceDelayMs = 60000;

      manager._backoffAttempt = 0;
      expect(manager._computeBackoffDelay()).toBe(60000); // 1x

      manager._backoffAttempt = 1;
      expect(manager._computeBackoffDelay()).toBe(120000); // 2x

      manager._backoffAttempt = 2;
      expect(manager._computeBackoffDelay()).toBe(240000); // 4x

      manager._backoffAttempt = 3;
      expect(manager._computeBackoffDelay()).toBe(480000); // 8x
    });

    test('バックオフの上限が適用される', () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
      });

      manager._debounceDelayMs = 60000;
      manager._backoffAttempt = 10; // 2^10 = 1024だが、15で上限

      expect(manager._computeBackoffDelay()).toBe(900000); // 15x
    });
  });

  describe('initialize()', () => {
    test('インデックスが存在する場合、正常に初期化する', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      jest.spyOn(manager, 'indexExists').mockResolvedValue(true);
      mockSearchService.loadIndex.mockResolvedValue(true);

      const result = await manager.initialize();

      expect(result).toBe(true);
      expect(manager.status).toBe('ready');
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('✅ Search index loaded from')
      );
    });

    test('インデックスが存在しない場合、falseを返す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      jest.spyOn(manager, 'indexExists').mockResolvedValue(false);

      const result = await manager.initialize();

      expect(result).toBe(false);
      expect(manager.status).toBe('missing');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ Search index not found at')
      );
    });

    test('ロードが失敗した場合、falseを返す', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      jest.spyOn(manager, 'indexExists').mockResolvedValue(true);
      mockSearchService.loadIndex.mockResolvedValue(false);

      const result = await manager.initialize();

      expect(result).toBe(false);
      expect(manager.status).toBe('missing');
    });
  });

  describe('エッジケースと異常系', () => {
    test('null設定でも動作する', () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        termsPath: null,
        statsPath: null,
      });

      expect(manager.termsPath).toBeNull();
      expect(manager.statsPath).toBeNull();
    });

    test('空の設定で初期化できる', () => {
      expect(() => {
        new IndexManager({});
      }).not.toThrow();
    });

    test('clearDelta関数が存在しない場合でもエラーにならない', async () => {
      const searchServiceWithoutClear = {
        loadIndex: jest.fn().mockResolvedValue(true),
      };

      const manager = new IndexManager({
        searchService: searchServiceWithoutClear,
        indexPath: '/test/index.json',
        dataRoot: '/test/data',
        logger: mockLogger,
      });

      jest.spyOn(manager, '_performRebuild').mockResolvedValue(true);

      await expect(manager.rebuild()).resolves.toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Delta clear failed:',
        expect.any(String)
      );
    });

    test('undefined値の処理', async () => {
      const manager = new IndexManager({
        searchService: mockSearchService,
        indexPath: undefined,
        dataRoot: undefined,
      });

      expect(manager.indexPath).toBeUndefined();
      expect(manager.dataRoot).toBeUndefined();
    });
  });
});
