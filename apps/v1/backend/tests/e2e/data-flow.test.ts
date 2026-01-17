/**
 * Scenario A: Data Flow Tests
 * Tests: Save → Index → Search pipeline
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestEnv, createTestNote, waitFor, TestEnv } from './setup.js';
import { LanceVectorStore } from '../../src/engine/vector-store.js';
import { LocalEmbeddingService } from '../../src/engine/embeddings/local-service.js';
import { Indexer } from '../../src/engine/indexer.js';
import { Entry } from '@yuihub/core';

describe('Scenario A: Data Flow', () => {
  let env: TestEnv;
  let vectorStore: LanceVectorStore;
  let embeddingService: LocalEmbeddingService;
  let indexer: Indexer;

  beforeAll(async () => {
    env = await createTestEnv();
    
    // Initialize components
    embeddingService = new LocalEmbeddingService();
    vectorStore = new LanceVectorStore(env.DATA_DIR, embeddingService, 'test');
    
    await embeddingService.init();
    await vectorStore.init();
    
    indexer = new Indexer(vectorStore);
  });

  afterAll(async () => {
    await env.cleanup();
  });

  // A-1: Single Entry Save
  it('A-1: should add entries to vector store', async () => {
    const entry: Entry = {
      id: 'test-entry-1',
      date: new Date().toISOString(),
      text: 'This is a test entry about TypeScript programming.',
      mode: 'private',
      tags: [],
      session_id: '',
      source: 'test',
    };

    await vectorStore.add([entry]);
    
    const isEmpty = await vectorStore.isEmpty();
    expect(isEmpty).toBe(false);
  });

  // A-2: Search after Save
  it('A-2: should find saved entry via semantic search', async () => {
    const results = await vectorStore.search('TypeScript', 10);
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text).toContain('TypeScript');
  });

  // A-3: Private mode filtering
  it('A-3: should respect mode in entries', async () => {
    const privateEntry: Entry = {
      id: 'private-entry-1',
      date: new Date().toISOString(),
      text: 'Secret private information about API keys.',
      mode: 'private',
      tags: [],
      session_id: '',
      source: 'test',
    };

    await vectorStore.add([privateEntry]);
    
    const results = await vectorStore.search('API keys', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].mode).toBe('private');
  });

  // A-4: Tag filter (requires entries with tags)
  it('A-4: should filter by session', async () => {
    const sessionEntry: Entry = {
      id: 'session-entry-1',
      date: new Date().toISOString(),
      text: 'This entry belongs to session-abc.',
      mode: 'private',
      tags: [],
      session_id: 'session-abc',
      source: 'test',
    };

    await vectorStore.add([sessionEntry]);
    
    const results = await vectorStore.search('session', 10, { session: 'session-abc' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].session_id).toBe('session-abc');
  });

  // A-5: File indexing flow
  it('A-5: should index markdown files', async () => {
    const testFile = await createTestNote(
      env.notesDir,
      'test-note.md',
      '# Test Note\n\nThis is a test markdown file for indexing.\n\n## Section 1\n\nContent about JavaScript frameworks.'
    );

    // Enqueue and wait for indexing
    await indexer.enqueue(testFile);
    
    // Wait for indexing to complete (check by searching)
    await waitFor(async () => {
      const results = await vectorStore.search('JavaScript frameworks', 5);
      return results.some(r => r.source === testFile);
    }, 30000);

    const results = await vectorStore.search('JavaScript frameworks', 5);
    expect(results.some(r => r.source === testFile)).toBe(true);
  });
});
