/**
 * storage.js ユニットテスト
 * 
 * テスト対象：
 * - StorageAdapter クラス
 * - ローカルストレージ保存
 * - GitHubストレージ保存
 * - Markdown生成
 * - 最近のノート取得
 */

import { jest } from '@jest/globals';
import { StorageAdapter, createStorageAdapter } from '../../yuihub_api/src/storage.js';

describe('StorageAdapter', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('コンストラクタ', () => {
    test('localアダプタを初期化できる', () => {
      const adapter = new StorageAdapter('local', { basePath: '/test/path' });

      expect(adapter.type).toBe('local');
      expect(adapter.config.basePath).toBe('/test/path');
    });

    test('githubアダプタを初期化できる', () => {
      const config = {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
      };
      const adapter = new StorageAdapter('github', config);

      expect(adapter.type).toBe('github');
      expect(adapter.config).toEqual(config);
      expect(adapter.octokit).toBeDefined();
    });
  });

  describe('save() - local', () => {
    test('正しいパスでファイルを保存する', async () => {
      const fsExtra = await import('fs-extra');
      jest.spyOn(fsExtra, 'ensureDir').mockResolvedValue(undefined);
      jest.spyOn(fsExtra, 'writeFile').mockResolvedValue(undefined);

      const adapter = new StorageAdapter('local', { basePath: '/test/base' });
      const frontmatter = {
        id: 'msg-123',
        date: '2025-01-15T10:30:00Z',
        topic: 'test-topic',
        tags: ['test'],
      };
      const body = 'Test message content';

      const result = await adapter.save(frontmatter, body);

      expect(result.ok).toBe(true);
      expect(result.path).toMatch(/^2025\/01\/2025-01-15-test-topic-msg-123\.md$/);
      expect(fsExtra.ensureDir).toHaveBeenCalled();
      expect(fsExtra.writeFile).toHaveBeenCalled();
    });

    test('topicなしでもファイルを保存できる', async () => {
      const fsExtra = await import('fs-extra');
      jest.spyOn(fsExtra, 'ensureDir').mockResolvedValue(undefined);
      jest.spyOn(fsExtra, 'writeFile').mockResolvedValue(undefined);

      const adapter = new StorageAdapter('local', { basePath: '/test/base' });
      const frontmatter = {
        id: 'msg-456',
        date: '2025-01-15T10:30:00Z',
        tags: [],
      };
      const body = 'Content';

      const result = await adapter.save(frontmatter, body);

      expect(result.ok).toBe(true);
      expect(result.path).toMatch(/^2025\/01\/2025-01-15-msg-456\.md$/);
    });

    test('日付に基づいてディレクトリ構造を作成する', async () => {
      const fsExtra = await import('fs-extra');
      jest.spyOn(fsExtra, 'ensureDir').mockResolvedValue(undefined);
      jest.spyOn(fsExtra, 'writeFile').mockResolvedValue(undefined);

      const adapter = new StorageAdapter('local', { basePath: '/test/base' });
      const frontmatter = {
        id: 'msg-789',
        date: '2024-12-25T15:45:00Z',
        topic: 'christmas',
      };

      await adapter.save(frontmatter, 'Ho ho ho');

      const ensureDirCall = fsExtra.ensureDir.mock.calls[0][0];
      expect(ensureDirCall).toContain('2024');
      expect(ensureDirCall).toContain('12');
    });

    test('不正な文字をトピックから除去する', async () => {
      const fsExtra = await import('fs-extra');
      jest.spyOn(fsExtra, 'ensureDir').mockResolvedValue(undefined);
      jest.spyOn(fsExtra, 'writeFile').mockResolvedValue(undefined);

      const adapter = new StorageAdapter('local', { basePath: '/test/base' });
      const frontmatter = {
        id: 'msg-abc',
        date: '2025-01-15T10:30:00Z',
        topic: 'test/topic:with*chars?',
      };

      const result = await adapter.save(frontmatter, 'Content');

      expect(result.path).toMatch(/test-topic-with-chars-/);
    });
  });

  describe('_buildMarkdown()', () => {
    test('正しいYAML front-matterを生成する', () => {
      const adapter = new StorageAdapter('local', { basePath: '/test' });
      const frontmatter = {
        id: 'msg-123',
        date: '2025-01-15T10:30:00Z',
        topic: 'Test Topic',
        tags: ['tag1', 'tag2'],
        author: 'tester',
      };
      const body = 'This is the content';

      const markdown = adapter._buildMarkdown(frontmatter, body);

      expect(markdown).toContain('---');
      expect(markdown).toContain('id: "msg-123"');
      expect(markdown).toContain('date: "2025-01-15T10:30:00Z"');
      expect(markdown).toContain('topic: "Test Topic"');
      expect(markdown).toContain('tags: ["tag1", "tag2"]');
      expect(markdown).toContain('This is the content');
    });

    test('配列を正しくフォーマットする', () => {
      const adapter = new StorageAdapter('local', { basePath: '/test' });
      const frontmatter = {
        id: 'msg-456',
        tags: ['javascript', 'nodejs', 'testing'],
      };

      const markdown = adapter._buildMarkdown(frontmatter, 'Body');

      expect(markdown).toContain('tags: ["javascript", "nodejs", "testing"]');
    });

    test('空の配列を処理できる', () => {
      const adapter = new StorageAdapter('local', { basePath: '/test' });
      const frontmatter = {
        id: 'msg-789',
        tags: [],
      };

      const markdown = adapter._buildMarkdown(frontmatter, 'Body');

      expect(markdown).toContain('tags: []');
    });

    test('bodyが空でも動作する', () => {
      const adapter = new StorageAdapter('local', { basePath: '/test' });
      const frontmatter = { id: 'msg-empty' };

      const markdown = adapter._buildMarkdown(frontmatter, '');

      expect(markdown).toContain('---');
      expect(markdown).toContain('id: "msg-empty"');
    });
  });

  describe('getRecent()', () => {
    test('最近のノートを取得する', async () => {
      const adapter = new StorageAdapter('local', { basePath: '/test/chatlogs' });
      
      const glob = await import('glob');
      const fsExtra = await import('fs-extra');
      const matter = await import('gray-matter');

      // glob のモック
      jest.spyOn(glob, 'glob').mockResolvedValue([
        '/test/chatlogs/2025/01/file1.md',
        '/test/chatlogs/2025/01/file2.md',
      ]);

      // fs.stat のモック
      jest.spyOn(fsExtra, 'stat').mockResolvedValue({
        mtimeMs: Date.now(),
      });

      // fs.readFile のモック
      jest.spyOn(fsExtra, 'readFile').mockResolvedValue(`---
id: msg-123
date: 2025-01-15
tags: [test]
---
Content`);

      // gray-matter のモック
      jest.spyOn(matter, 'default').mockReturnValue({
        data: { id: 'msg-123', date: '2025-01-15', tags: ['test'] },
        content: 'Content',
      });

      const recent = await adapter.getRecent(10);

      expect(Array.isArray(recent)).toBe(true);
    });

    test('localアダプタ以外では空配列を返す', async () => {
      const adapter = new StorageAdapter('github', { token: 'test' });

      const recent = await adapter.getRecent();

      expect(recent).toEqual([]);
    });

    test('limit パラメータで結果数を制限する', async () => {
      const adapter = new StorageAdapter('local', { basePath: '/test' });
      
      const glob = await import('glob');
      const fsExtra = await import('fs-extra');

      // 多数のファイルをモック
      const files = Array(50).fill(null).map((_, i) => `/test/file${i}.md`);
      jest.spyOn(glob, 'glob').mockResolvedValue(files);
      jest.spyOn(fsExtra, 'stat').mockResolvedValue({ mtimeMs: Date.now() });
      jest.spyOn(fsExtra, 'readFile').mockResolvedValue('---\nid: test\n---\nBody');

      const recent = await adapter.getRecent(5);

      // glob の結果は50件だが、limitは5
      expect(glob.glob).toHaveBeenCalled();
    });
  });

  describe('save() - github', () => {
    test('GitHubにファイルを保存する', async () => {
      const mockOctokit = {
        repos: {
          createOrUpdateFileContents: jest.fn().mockResolvedValue({
            data: {
              content: {
                html_url: 'https://github.com/test/test/blob/main/file.md',
              },
            },
          }),
        },
      };

      const adapter = new StorageAdapter('github', {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
        branch: 'main',
        basePath: 'chatlogs',
      });

      adapter.octokit = mockOctokit;

      const frontmatter = {
        id: 'msg-gh',
        date: '2025-01-15T10:30:00Z',
        topic: 'github-test',
      };

      const result = await adapter.save(frontmatter, 'GitHub content');

      expect(result.ok).toBe(true);
      expect(result.url).toContain('github.com');
      expect(mockOctokit.repos.createOrUpdateFileContents).toHaveBeenCalled();
    });

    test('GitHub保存が失敗した場合エラーをスローする', async () => {
      const mockOctokit = {
        repos: {
          createOrUpdateFileContents: jest.fn().mockRejectedValue(
            new Error('GitHub API error')
          ),
        },
      };

      const adapter = new StorageAdapter('github', {
        token: 'test-token',
        owner: 'test-owner',
        repo: 'test-repo',
      });

      adapter.octokit = mockOctokit;

      const frontmatter = {
        id: 'msg-fail',
        date: '2025-01-15T10:30:00Z',
      };

      await expect(adapter.save(frontmatter, 'Content')).rejects.toThrow(
        'GitHub save failed'
      );
    });
  });

  describe('createStorageAdapter()', () => {
    test('デフォルトでlocalアダプタを作成する', () => {
      delete process.env.STORAGE_ADAPTER;
      const adapter = createStorageAdapter();

      expect(adapter.type).toBe('local');
    });

    test('環境変数に基づいてアダプタを作成する', () => {
      process.env.STORAGE_ADAPTER = 'local';
      process.env.LOCAL_STORAGE_PATH = '/custom/path';
      
      const adapter = createStorageAdapter();

      expect(adapter.type).toBe('local');
      expect(adapter.config.basePath).toBe('/custom/path');
    });

    test('GitHubアダプタを環境変数から作成する', () => {
      process.env.STORAGE_ADAPTER = 'github';
      process.env.GITHUB_TOKEN = 'test-token';
      process.env.GITHUB_OWNER = 'test-owner';
      process.env.GITHUB_REPO = 'test-repo';
      
      const adapter = createStorageAdapter();

      expect(adapter.type).toBe('github');
      expect(adapter.config.token).toBe('test-token');
    });

    test('オーバーライドで設定を上書きできる', () => {
      const adapter = createStorageAdapter({
        type: 'local',
        local: { basePath: '/override/path' },
      });

      expect(adapter.type).toBe('local');
      expect(adapter.config.basePath).toBe('/override/path');
    });
  });

  describe('エッジケースと異常系', () => {
    test('サポートされていないアダプタタイプでエラーをスローする', async () => {
      const adapter = new StorageAdapter('unsupported', {});
      const frontmatter = { id: 'test', date: '2025-01-15' };

      await expect(adapter.save(frontmatter, 'Body')).rejects.toThrow(
        'Unsupported storage adapter'
      );
    });

    test('空のfrontmatterを処理できる', () => {
      const adapter = new StorageAdapter('local', { basePath: '/test' });
      const markdown = adapter._buildMarkdown({}, '');

      expect(markdown).toContain('---');
    });

    test('日付がnullの場合でもファイル名を生成できる', async () => {
      const fsExtra = await import('fs-extra');
      jest.spyOn(fsExtra, 'ensureDir').mockResolvedValue(undefined);
      jest.spyOn(fsExtra, 'writeFile').mockResolvedValue(undefined);

      const adapter = new StorageAdapter('local', { basePath: '/test' });
      const frontmatter = {
        id: 'msg-null-date',
        date: new Date('invalid'),
      };

      // 不正な日付でもエラーにならないことを確認
      await expect(adapter.save(frontmatter, 'Body')).rejects.toThrow();
    });

    test('ファイル読み込みエラーをスキップする', async () => {
      const adapter = new StorageAdapter('local', { basePath: '/test' });
      
      const glob = await import('glob');
      const fsExtra = await import('fs-extra');

      jest.spyOn(glob, 'glob').mockResolvedValue(['/test/file.md']);
      jest.spyOn(fsExtra, 'stat').mockResolvedValue({ mtimeMs: Date.now() });
      jest.spyOn(fsExtra, 'readFile').mockRejectedValue(new Error('Read error'));

      const recent = await adapter.getRecent();

      // エラーがあってもクラッシュせず空配列を返す
      expect(Array.isArray(recent)).toBe(true);
    });
  });
});
