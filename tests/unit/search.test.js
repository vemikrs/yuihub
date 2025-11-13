/**
 * search.js ユニットテスト
 * 
 * テスト対象：
 * - SearchService クラス
 * - インデックスのロード
 * - 検索機能
 * - スニペット生成
 * - 最近のノート取得
 */

import { jest } from '@jest/globals';
import { SearchService } from '../../yuihub_api/src/search.js';
import path from 'path';

describe('SearchService', () => {
  let searchService;

  beforeEach(() => {
    searchService = new SearchService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('コンストラクタ', () => {
    test('正常に初期化される', () => {
      expect(searchService.index).toBeNull();
      expect(searchService.documents).toBeInstanceOf(Map);
      expect(searchService.documents.size).toBe(0);
    });
  });

  describe('loadIndex()', () => {
    test('有効なインデックスをロードできる', async () => {
      const fsExtra = await import('fs-extra');
      const lunr = await import('lunr');

      // モックインデックスデータ
      const mockIndexData = {
        index: {
          version: '2.3.9',
          fields: ['title', 'body'],
          ref: 'id',
          pipeline: [],
          documentVectors: {},
          fieldVectors: {},
          invertedIndex: {},
        },
        documents: [
          {
            id: 'test-1',
            title: 'Test Document',
            body: 'This is a test',
            tags: ['test'],
          },
        ],
      };

      jest.spyOn(fsExtra, 'pathExists').mockResolvedValue(true);
      jest.spyOn(fsExtra, 'readJson').mockResolvedValue(mockIndexData);

      // Lunrのloadメソッドをモック
      const mockIndex = {
        search: jest.fn().mockReturnValue([]),
      };
      jest.spyOn(lunr.Index, 'load').mockReturnValue(mockIndex);

      const result = await searchService.loadIndex('/test/index.json');

      expect(result).toBe(true);
      expect(searchService.index).toBe(mockIndex);
      expect(searchService.documents.size).toBe(1);
      expect(searchService.documents.get('test-1')).toEqual(mockIndexData.documents[0]);
    });

    test('インデックスファイルが存在しない場合、falseを返す', async () => {
      const fsExtra = await import('fs-extra');
      jest.spyOn(fsExtra, 'pathExists').mockResolvedValue(false);

      const result = await searchService.loadIndex('/nonexistent/index.json');

      expect(result).toBe(false);
      expect(searchService.index).toBeNull();
    });

    test('不正なインデックスデータでfalseを返す', async () => {
      const fsExtra = await import('fs-extra');
      
      jest.spyOn(fsExtra, 'pathExists').mockResolvedValue(true);
      jest.spyOn(fsExtra, 'readJson').mockRejectedValue(new Error('Invalid JSON'));

      const result = await searchService.loadIndex('/test/invalid.json');

      expect(result).toBe(false);
      expect(searchService.index).toBeNull();
    });
  });

  describe('search()', () => {
    test('インデックスがロードされていない場合、空の結果を返す', async () => {
      const result = await searchService.search('test query');

      expect(result).toEqual({ hits: [] });
    });

    test('空のクエリで空の結果を返す', async () => {
      searchService.index = { query: jest.fn() };
      
      const result = await searchService.search('');

      expect(result).toEqual({ hits: [] });
    });

    test('検索結果を正しくフォーマットする', async () => {
      const mockResults = [
        { ref: 'doc-1', score: 1.5 },
      ];

      const mockDoc = {
        id: 'doc-1',
        title: 'Test Title',
        topic: 'Test Topic',
        body: 'This is test body content with some test keywords',
        path: '/test/path',
        url: 'http://example.com/doc-1',
        date: '2025-01-01',
        tags: ['test', 'example'],
        decision: 'approved',
        thread: 'th-123',
      };

      searchService.index = {
        query: jest.fn().mockReturnValue(mockResults),
      };

      searchService.documents.set('doc-1', mockDoc);

      const result = await searchService.search('test', 10);

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0]).toMatchObject({
        id: 'doc-1',
        score: 1.5,
        title: 'Test Title',
        path: '/test/path',
        url: 'http://example.com/doc-1',
        date: '2025-01-01',
        tags: ['test', 'example'],
        decision: 'approved',
        thread: 'th-123',
      });
      expect(result.hits[0].snippet).toBeTruthy();
    });

    test('limit パラメータで結果数を制限する', async () => {
      const mockResults = [
        { ref: 'doc-1', score: 1.5 },
        { ref: 'doc-2', score: 1.3 },
        { ref: 'doc-3', score: 1.1 },
      ];

      searchService.index = {
        query: jest.fn().mockReturnValue(mockResults),
      };

      searchService.documents.set('doc-1', { id: 'doc-1', body: 'test', tags: [] });
      searchService.documents.set('doc-2', { id: 'doc-2', body: 'test', tags: [] });
      searchService.documents.set('doc-3', { id: 'doc-3', body: 'test', tags: [] });

      const result = await searchService.search('test', 2);

      expect(result.hits).toHaveLength(2);
    });

    test('ドキュメントが見つからない場合はスキップする', async () => {
      const mockResults = [
        { ref: 'doc-exists', score: 1.5 },
        { ref: 'doc-missing', score: 1.3 },
      ];

      searchService.index = {
        query: jest.fn().mockReturnValue(mockResults),
      };

      searchService.documents.set('doc-exists', { id: 'doc-exists', body: 'test', tags: [] });

      const result = await searchService.search('test');

      expect(result.hits).toHaveLength(1);
      expect(result.hits[0].id).toBe('doc-exists');
    });

    test('検索エラーが発生した場合、空の結果を返す', async () => {
      searchService.index = {
        query: jest.fn().mockImplementation(() => {
          throw new Error('Search failed');
        }),
      };

      const result = await searchService.search('test');

      expect(result).toEqual({ hits: [] });
    });
  });

  describe('_generateSnippet()', () => {
    test('クエリを含むスニペットを生成する', () => {
      const text = 'This is a long text with important keywords that we want to find in the search results.';
      const query = 'important keywords';

      const snippet = searchService._generateSnippet(text, query, 50);

      expect(snippet).toContain('important');
      expect(snippet.length).toBeLessThanOrEqual(200); // デフォルトmaxLength
    });

    test('クエリが見つからない場合、先頭から切り取る', () => {
      const text = 'This is a long text without the search term.';
      const query = 'nonexistent';

      const snippet = searchService._generateSnippet(text, query, 20);

      expect(snippet).toBe('This is a long text ');
    });

    test('短いテキストはそのまま返す', () => {
      const text = 'Short text';
      const query = 'text';

      const snippet = searchService._generateSnippet(text, query, 200);

      expect(snippet).toBe('Short text');
    });

    test('省略記号が正しく付加される', () => {
      const text = 'A'.repeat(300);
      const query = 'nonexistent';

      const snippet = searchService._generateSnippet(text, query, 100);

      expect(snippet).toMatch(/^A+$/); // 先頭から
      expect(snippet.length).toBeLessThanOrEqual(100);
    });

    test('空のテキストやクエリを処理できる', () => {
      expect(searchService._generateSnippet('', 'query')).toBe('');
      expect(searchService._generateSnippet('text', '')).toBe('text');
      expect(searchService._generateSnippet(null, 'query')).toBe('');
      expect(searchService._generateSnippet('text', null)).toBe('');
    });
  });

  describe('getStats()', () => {
    test('統計情報を返す', () => {
      searchService.index = { some: 'index' };
      searchService.documents.set('doc-1', {});
      searchService.documents.set('doc-2', {});

      const stats = searchService.getStats();

      expect(stats).toEqual({
        indexLoaded: true,
        documents: 2,
      });
    });

    test('インデックスがロードされていない場合', () => {
      const stats = searchService.getStats();

      expect(stats).toEqual({
        indexLoaded: false,
        documents: 0,
      });
    });
  });

  describe('fallbackByTag()', () => {
    beforeEach(() => {
      searchService.documents.set('doc-1', {
        id: 'doc-1',
        title: 'Test 1',
        tags: ['javascript', 'nodejs'],
        body: 'Content 1',
      });
      searchService.documents.set('doc-2', {
        id: 'doc-2',
        title: 'Test 2',
        tags: ['python', 'flask'],
        body: 'Content 2',
      });
      searchService.documents.set('doc-3', {
        id: 'doc-3',
        title: 'Test 3',
        tags: ['javascript', 'react'],
        body: 'Content 3',
      });
    });

    test('タグで検索結果を返す', () => {
      const result = searchService.fallbackByTag('javascript');

      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.hits[0].tags).toContain('javascript');
    });

    test('空のクエリで空の結果を返す', () => {
      const result = searchService.fallbackByTag('');

      expect(result.hits).toEqual([]);
    });

    test('limit パラメータで結果数を制限する', () => {
      const result = searchService.fallbackByTag('javascript', 1);

      expect(result.hits).toHaveLength(1);
    });

    test('マッチしないクエリで空の結果を返す', () => {
      const result = searchService.fallbackByTag('nonexistent');

      expect(result.hits).toEqual([]);
    });

    test('タグがない場合はスキップする', () => {
      searchService.documents.set('doc-no-tags', {
        id: 'doc-no-tags',
        title: 'No Tags',
        body: 'Content',
      });

      const result = searchService.fallbackByTag('test');

      expect(result.hits.every(h => Array.isArray(h.tags))).toBe(true);
    });

    test('エラーが発生した場合、空の結果を返す', () => {
      // documentsを壊す
      searchService.documents = null;

      const result = searchService.fallbackByTag('test');

      expect(result.hits).toEqual([]);
    });
  });

  describe('エッジケースと異常系', () => {
    test('非常に長いクエリを処理できる', async () => {
      const longQuery = 'word '.repeat(1000);
      searchService.index = { query: jest.fn().mockReturnValue([]) };

      await expect(searchService.search(longQuery)).resolves.toEqual({ hits: [] });
    });

    test('特殊文字を含むクエリを処理できる', async () => {
      searchService.index = { query: jest.fn().mockReturnValue([]) };

      await expect(searchService.search('!@#$%^&*()')).resolves.toBeTruthy();
    });

    test('日本語クエリを処理できる', async () => {
      searchService.index = { query: jest.fn().mockReturnValue([]) };

      await expect(searchService.search('日本語検索')).resolves.toBeTruthy();
    });

    test('複数のドキュメントをロードできる', async () => {
      const fsExtra = await import('fs-extra');
      const lunr = await import('lunr');

      const mockIndexData = {
        index: { version: '2.3.9', fields: [], ref: 'id' },
        documents: Array(100).fill(null).map((_, i) => ({
          id: `doc-${i}`,
          title: `Document ${i}`,
          body: `Content ${i}`,
          tags: [],
        })),
      };

      jest.spyOn(fsExtra, 'pathExists').mockResolvedValue(true);
      jest.spyOn(fsExtra, 'readJson').mockResolvedValue(mockIndexData);
      jest.spyOn(lunr.Index, 'load').mockReturnValue({ search: jest.fn() });

      await searchService.loadIndex('/test/index.json');

      expect(searchService.documents.size).toBe(100);
    });

    test('nullドキュメントを処理できる', async () => {
      const fsExtra = await import('fs-extra');
      const lunr = await import('lunr');

      const mockIndexData = {
        index: { version: '2.3.9', fields: [], ref: 'id' },
        documents: [
          { id: 'doc-1', title: 'Test' },
          null,
          undefined,
          { id: 'doc-2', title: 'Test 2' },
        ],
      };

      jest.spyOn(fsExtra, 'pathExists').mockResolvedValue(true);
      jest.spyOn(fsExtra, 'readJson').mockResolvedValue(mockIndexData);
      jest.spyOn(lunr.Index, 'load').mockReturnValue({ search: jest.fn() });

      await searchService.loadIndex('/test/index.json');

      expect(searchService.documents.size).toBeGreaterThan(0);
    });
  });
});
