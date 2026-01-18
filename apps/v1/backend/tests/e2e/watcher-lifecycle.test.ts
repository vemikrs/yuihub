/**
 * Scenario B: Index Lifecycle Tests
 * Tests: File Create/Update/Delete → Index synchronization
 * Simplified version for reliable CI execution
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestEnv, waitFor, TestEnv } from './setup.js';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { LanceVectorStore } from '../../src/engine/vector-store.js';
import { LocalEmbeddingService } from '../../src/engine/embeddings/local-service.js';
import { Indexer } from '../../src/engine/indexer.js';

describe('Scenario B: Index Lifecycle', () => {
  let env: TestEnv;
  let vectorStore: LanceVectorStore;
  let embeddingService: LocalEmbeddingService;
  let indexer: Indexer;

  beforeAll(async () => {
    env = await createTestEnv();
    
    embeddingService = new LocalEmbeddingService();
    vectorStore = new LanceVectorStore(env.DATA_DIR, embeddingService, 'test-b');
    
    await embeddingService.init();
    await vectorStore.init();
    
    indexer = new Indexer(vectorStore);
  }, 60000);

  afterAll(async () => {
    await env.cleanup();
  });

  // B-1: File Creation → Index
  it('B-1: should index newly created markdown file', async () => {
    const filename = 'lifecycle-test.md';
    const content = '# Lifecycle Test\n\nUnique content for lifecycle indexer testing B1.';
    const filePath = join(env.notesDir, filename);
    
    await writeFile(filePath, content);
    await indexer.enqueue(filePath);
    
    await waitFor(async () => {
      const results = await vectorStore.search('lifecycle indexer testing B1', 5);
      return results.some(r => r.source === filePath);
    }, 45000);
    
    const results = await vectorStore.search('lifecycle indexer testing B1', 5);
    expect(results.some(r => r.source === filePath)).toBe(true);
  }, 60000);

  // B-2: DeleteBySource functionality
  it('B-2: should delete entries by source path', async () => {
    const filename = 'delete-test.md';
    const filePath = join(env.notesDir, filename);
    
    await writeFile(filePath, '# Delete Test\n\nContent for delete by source B2.');
    await indexer.enqueue(filePath);
    
    await waitFor(async () => {
      const results = await vectorStore.search('delete by source B2', 5);
      return results.some(r => r.source === filePath);
    }, 45000);
    
    // Delete by source
    const deletedCount = await vectorStore.deleteBySource(filePath);
    expect(deletedCount).toBeGreaterThan(0);
    
    // Verify deletion
    const results = await vectorStore.search('delete by source B2', 5);
    expect(results.every(r => r.source !== filePath)).toBe(true);
  }, 60000);
});
