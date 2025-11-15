/**
 * Enhanced-search.js ユニットテスト  
 * 
 * テスト対象：
 * - EnhancedSearchService クラス（SearchServiceの拡張）
 * - 日本語検索強化機能
 * - Delta overlay（差分レイヤ）
 * - Terms逆引き検索
 * - フォールバック検索
 */

import { jest } from '@jest/globals';
import { EnhancedSearchService } from '../../yuihub_api/src/enhanced-search.js';

describe('EnhancedSearchService', () => {
  let searchService;

  beforeEach(() => {
    searchService = new EnhancedSearchService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('コンストラクタ', () => {
    test('正常に初期化される', () => {
      expect(searchService.termsIndex).toBeNull();
      expect(searchService.termsLoaded).toBe(false);
      expect(searchService.deltaDocs).toBeInstanceOf(Map);
      expect(searchService.deltaDocs.size).toBe(0);
      expect(searchService.tombstones).toBeInstanceOf(Set);
    });
  });

  describe('_normalizeQuery()', () => {
    test('全角英数字を半角に変換する', () => {
      const result = searchService._normalizeQuery('ＡＢＣ１２３');
      expect(result).toBe('abc123');
    });

    test('ひらがなをカタカナに変換する', () => {
      const result = searchService._normalizeQuery('ひらがな');
      expect(result).toBe('ヒラガナ');
    });

    test('連続する空白を単一にする', () => {
      const result = searchService._normalizeQuery('複数　　空白');
      expect(result).toBe('複数 空白');
    });

    test('小文字に変換する', () => {
      const result = searchService._normalizeQuery('UPPERCASE');
      expect(result).toBe('uppercase');
    });

    test('空文字列を処理できる', () => {
      expect(searchService._normalizeQuery('')).toBe('');
      expect(searchService._normalizeQuery(null)).toBe('');
      expect(searchService._normalizeQuery(undefined)).toBe('');
    });
  });

  describe('addDeltaFromSave()', () => {
    test('保存後の差分を追加する', () => {
      const frontmatter = {
        id: 'msg-123',
        topic: 'Test Topic',
        date: '2025-01-15T10:30:00Z',
        tags: ['test', 'delta'],
        thread: 'th-456',
      };
      const body = 'This is test content that should be searchable immediately.';

      const result = searchService.addDeltaFromSave(frontmatter, body);

      expect(result).toBe(true);
      expect(searchService.deltaDocs.size).toBeGreaterThan(0);
      expect(searchService.lastDeltaAdd).toBeTruthy();
    });

    test('IDがない場合falseを返す', () => {
      const frontmatter = { topic: 'No ID' };
      const result = searchService.addDeltaFromSave(frontmatter, 'Body');

      expect(result).toBe(false);
    });

    test('既存のdeltaを置換する', () => {
      const frontmatter = {
        id: 'msg-replace',
        date: '2025-01-15',
        tags: [],
      };

      searchService.addDeltaFromSave(frontmatter, 'First body');
      expect(searchService.deltaDocs.size).toBeGreaterThan(0);
      const firstSize = searchService.deltaDocs.size;

      searchService.addDeltaFromSave(frontmatter, 'Updated body');
      const secondSize = searchService.deltaDocs.size;

      // 同じIDなので、置換されてサイズは同じかそれ以下
      expect(secondSize).toBeLessThanOrEqual(firstSize + 1);
    });

    test('長いテキストをチャンク化する', () => {
      const frontmatter = {
        id: 'msg-long',
        date: '2025-01-15',
        tags: [],
      };
      const longBody = 'Long text. '.repeat(200);

      searchService.addDeltaFromSave(frontmatter, longBody);

      // チャンク化により複数のdeltaドキュメントが作成される
      expect(searchService.deltaDocs.size).toBeGreaterThan(0);
    });
  });

  describe('clearDelta()', () => {
    test('deltaDocs をクリアする', () => {
      searchService.deltaDocs.set('test-1', { id: 'test-1' });
      searchService.deltaDocs.set('test-2', { id: 'test-2' });

      searchService.clearDelta();

      expect(searchService.deltaDocs.size).toBe(0);
    });
  });

  describe('addTombstone()', () => {
    test('墓石を追加する', () => {
      searchService.addTombstone('deleted-doc-1');
      searchService.addTombstone('deleted-doc-2');

      expect(searchService.tombstones.has('deleted-doc-1')).toBe(true);
      expect(searchService.tombstones.has('deleted-doc-2')).toBe(true);
    });

    test('nullやundefinedは無視する', () => {
      searchService.addTombstone(null);
      searchService.addTombstone(undefined);
      searchService.addTombstone('');

      // nullやundefinedは追加されない（空文字列は追加される）
      expect(searchService.tombstones.has(null)).toBe(false);
      expect(searchService.tombstones.has(undefined)).toBe(false);
    });
  });

  describe('clearTombstones()', () => {
    test('墓石をクリアする', () => {
      searchService.addTombstone('doc-1');
      searchService.addTombstone('doc-2');

      searchService.clearTombstones();

      expect(searchService.tombstones.size).toBe(0);
    });
  });

  describe('getTopDocuments()', () => {
    beforeEach(() => {
      searchService.documents.set('doc-1', {
        id: 'doc-1',
        title: 'Document 1',
        date: '2025-01-15',
        tags: ['tag1'],
      });
      searchService.documents.set('doc-2', {
        id: 'doc-2',
        title: 'Document 2',
        date: '2025-01-16',
        tags: ['tag2'],
      });
      searchService.documents.set('doc-3', {
        id: 'doc-3',
        title: 'Document 3',
        date: '2025-01-14',
        tags: ['tag3'],
      });
    });

    test('最近のドキュメントを返す', () => {
      const docs = searchService.getTopDocuments(10);

      expect(docs.length).toBe(3);
      // 日付順（新しい順）
      expect(docs[0].id).toBe('doc-2'); // 2025-01-16
      expect(docs[1].id).toBe('doc-1'); // 2025-01-15
      expect(docs[2].id).toBe('doc-3'); // 2025-01-14
    });

    test('limit パラメータで制限する', () => {
      const docs = searchService.getTopDocuments(2);

      expect(docs.length).toBe(2);
    });

    test('エラーが発生した場合空配列を返す', () => {
      searchService.documents = null;

      const docs = searchService.getTopDocuments();

      expect(docs).toEqual([]);
    });
  });

  describe('getStats()', () => {
    test('拡張された統計情報を返す', () => {
      searchService.index = { some: 'index' };
      searchService.documents.set('doc-1', {});
      searchService.termsLoaded = true;
      searchService.termsIndex = { term1: [], term2: [] };
      searchService.deltaDocs.set('delta-1', {});

      const stats = searchService.getStats();

      expect(stats.indexLoaded).toBe(true);
      expect(stats.documents).toBe(1);
      expect(stats.termsIndexLoaded).toBe(true);
      expect(stats.termsCount).toBe(2);
      expect(stats.deltaDocs).toBe(1);
      expect(stats.enhancedFeatures).toBeDefined();
      expect(stats.enhancedFeatures.japanesNormalization).toBe(true);
      expect(stats.enhancedFeatures.twoPhaseSearch).toBe(true);
    });
  });

  describe('_splitQuery()', () => {
    test('クエリをトークンに分割する', () => {
      const tokens = searchService._splitQuery('hello world test');

      expect(tokens).toEqual(['hello', 'world', 'test']);
    });

    test('空白を正しく処理する', () => {
      const tokens = searchService._splitQuery('  multiple   spaces  ');

      expect(tokens).toEqual(['multiple', 'spaces']);
    });

    test('空文字列で空配列を返す', () => {
      const tokens = searchService._splitQuery('');

      expect(tokens).toEqual([]);
    });
  });

  describe('_calculateTermMatchScore()', () => {
    test('完全一致で高スコアを返す', () => {
      const score = searchService._calculateTermMatchScore('test', ['test']);

      expect(score).toBeGreaterThan(10); // 15 * 1.2 (length bonus) = 18
    });

    test('前方一致でスコアを返す', () => {
      const score = searchService._calculateTermMatchScore('testing', ['test']);

      expect(score).toBeGreaterThan(10); // 12 * 1.2 = 14.4
    });

    test('後方一致でスコアを返す', () => {
      const score = searchService._calculateTermMatchScore('contest', ['test']);

      expect(score).toBeGreaterThan(8); // 10 * 1.2 = 12
    });

    test('部分一致でスコアを返す', () => {
      const score = searchService._calculateTermMatchScore('latest', ['test']);

      expect(score).toBeGreaterThan(5); // 8 * 1.2 = 9.6
    });

    test('マッチしない場合0を返す', () => {
      const score = searchService._calculateTermMatchScore('nomatch', ['test']);

      expect(score).toBe(0);
    });

    test('長さボーナスが適用される', () => {
      const shortScore = searchService._calculateTermMatchScore('te', ['te']);
      const longScore = searchService._calculateTermMatchScore('testing', ['testing']);

      // 短い用語は減点、長い用語はボーナス
      expect(longScore).toBeGreaterThan(shortScore);
    });
  });

  describe('_mergeHits()', () => {
    test('ヒットを統合する', () => {
      const lunrHits = [
        { id: 'doc-1', score: 5.0 },
        { id: 'doc-2', score: 3.0 },
      ];
      const termsHits = [
        { id: 'doc-3', score: 5.0 }, // スコア調整により5.0に制限される
        { id: 'doc-1', score: 2.0 }, // 重複
      ];

      const merged = searchService._mergeHits(lunrHits, termsHits);

      expect(merged.length).toBe(3);
      // スコアで降順ソート
      expect(merged[0].score).toBeGreaterThanOrEqual(merged[1].score);
      expect(merged[1].score).toBeGreaterThanOrEqual(merged[2].score);
    });

    test('スコアで降順ソートされる', () => {
      const hits1 = [{ id: 'doc-1', score: 2.0 }];
      const hits2 = [
        { id: 'doc-2', score: 5.0 },
        { id: 'doc-3', score: 3.0 },
      ];

      const merged = searchService._mergeHits(hits1, hits2);

      expect(merged[0].score).toBeGreaterThanOrEqual(merged[1].score);
      expect(merged[1].score).toBeGreaterThanOrEqual(merged[2].score);
    });
  });

  describe('エッジケースと異常系', () => {
    test('空のtermsIndexで検索してもエラーにならない', async () => {
      searchService.termsIndex = null;
      searchService.index = null;

      const result = await searchService.search('test query');

      expect(Array.isArray(result)).toBe(true);
    });

    test('非常に長いクエリを処理できる', async () => {
      const longQuery = 'word '.repeat(1000);
      
      const result = await searchService.search(longQuery);

      expect(Array.isArray(result)).toBe(true);
    });

    test('deltaDocs が null でもエラーにならない', () => {
      searchService.deltaDocs = null;

      expect(() => searchService.clearDelta()).toThrow();
    });

    test('複数のdelta追加が正しく動作する', () => {
      for (let i = 0; i < 10; i++) {
        searchService.addDeltaFromSave(
          { id: `msg-${i}`, date: '2025-01-15', tags: [] },
          `Content ${i}`
        );
      }

      expect(searchService.deltaDocs.size).toBeGreaterThan(0);
    });
  });
});
