import fastq from 'fastq';
import type { queueAsPromised } from 'fastq';
import fs from 'fs-extra';
import { Entry } from '@yuihub/core';
import { globalMutex } from './lock.js';
import { SemanticChunker } from './chunker.js';
import { IVectorStore } from './vector-store-types.js';

interface IndexJob {
  filePath: string;
}

export class Indexer {
  private queue: queueAsPromised<IndexJob>;
  private chunker: SemanticChunker;
  private vectorStore: IVectorStore;

  constructor(vectorStore: IVectorStore) {
    this.vectorStore = vectorStore;
    this.chunker = new SemanticChunker();
    // Concurrency 1 (Serialized)
    this.queue = fastq.promise(this, this.worker, 1);
  }

  async enqueue(filePath: string) {
    // Simple deduplication can be added here if needed, 
    // but fastq processes linearly so pushing same file twice just queues it twice.
    // Given debounce in Watcher, this shouldn't happen often.
    return this.queue.push({ filePath });
  }

  private async worker(job: IndexJob): Promise<void> {
    const { filePath } = job;
    
    // Acquire Global Lock (Wait for API /save)
    const release = await globalMutex.acquire();
    try {
      console.log(`[Indexer] Processing ${filePath}`);
      if (!await fs.pathExists(filePath)) {
        console.log(`[Indexer] File deleted: ${filePath}`);
        // Handle deletion (remove from vector) - TODO
        return;
      }

      const content = await fs.readFile(filePath, 'utf8');
      
      // Determining language from extension
      let lang: 'javascript' | 'typescript' | 'tsx' = 'typescript'; // Default
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) lang = 'javascript';
      else if (filePath.endsWith('.tsx')) lang = 'tsx';

      const chunks = await this.chunker.chunk(content, lang);
      
      const entries: Entry[] = chunks.map(c => ({
        id: '', // Should be deterministic based on content+path or ulid? Re-indexing needs stable ID or delete-and-insert logic.
        // For V1 MVP, assuming append-only or simple rebuild. 
        // Ideally should generate ID from file path + chunk metadata (e.g. function name)
        // or clear previous entries for this file.
        // TODO: Implement "Clear entries by Source" logic in VectorStore.
        mode: 'private', 
        date: new Date().toISOString(),
        text: c.text,
        source: filePath,
        metadata: {
          ...c.metadata
        }
      }));

      // TODO: Delete old entries for this source
      await this.vectorStore.add(entries);
      console.log(`[Indexer] Indexed ${entries.length} chunks from ${filePath}`);

    } catch (error) {
      console.error(`[Indexer] Failed to index ${filePath}:`, error);
    } finally {
      release();
    }
  }
}
