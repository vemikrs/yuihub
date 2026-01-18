/**
 * Unit tests for indexer.ts
 * Uses mocks to isolate from external dependencies
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Indexer } from '../../src/engine/indexer.js';
import { IVectorStore } from '../../src/engine/vector-store-types.js';

// Mock vector store
function createMockVectorStore(): IVectorStore {
  return {
    init: vi.fn().mockResolvedValue(undefined),
    add: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue([]),
    deleteBySource: vi.fn().mockResolvedValue(0),
    isEmpty: vi.fn().mockResolvedValue(true),
  };
}

describe('Indexer', () => {
  let mockVectorStore: IVectorStore;

  beforeEach(() => {
    mockVectorStore = createMockVectorStore();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create an Indexer instance with vector store', () => {
      const indexer = new Indexer(mockVectorStore);
      expect(indexer).toBeDefined();
    });
  });

  describe('enqueue', () => {
    it('should enqueue a file path for indexing', async () => {
      const indexer = new Indexer(mockVectorStore);
      
      // enqueue returns a promise that resolves when worker processes
      // Since file doesn't exist, it will handle gracefully
      await indexer.enqueue('/nonexistent/file.ts');
      
      // Should have called deleteBySource for cleanup of non-existent file
      expect(mockVectorStore.deleteBySource).toHaveBeenCalled();
    });
  });

  describe('enqueueDelete', () => {
    it('should enqueue a file path for deletion', async () => {
      const indexer = new Indexer(mockVectorStore);
      
      await indexer.enqueueDelete('/path/to/deleted-file.ts');
      
      expect(mockVectorStore.deleteBySource).toHaveBeenCalledWith('/path/to/deleted-file.ts');
    });
  });
});
