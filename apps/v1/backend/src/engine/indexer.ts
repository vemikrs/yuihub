import fastq from 'fastq';
import type { queueAsPromised } from 'fastq';
import fs from 'fs-extra';
import { Entry } from '@yuihub/core';
import { globalMutex } from './lock.js';
import { SemanticChunker } from './chunker.js';
import { IVectorStore } from './vector-store-types.js';

interface IndexJob {
  filePath: string;
  type: 'index' | 'delete';
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
    return this.queue.push({ filePath, type: 'index' });
  }

  async enqueueDelete(filePath: string) {
    return this.queue.push({ filePath, type: 'delete' });
  }

  private async worker(job: IndexJob): Promise<void> {
    const { filePath, type } = job;
    
    // Acquire Global Lock (Wait for API /save)
    const release = await globalMutex.acquire();
    try {
      if (type === 'delete') {
        await this.handleDelete(filePath);
        return;
      }
      
      console.log(`[Indexer] Processing ${filePath}`);
      if (!await fs.pathExists(filePath)) {
        console.log(`[Indexer] File no longer exists: ${filePath}`);
        await this.handleDelete(filePath);
        return;
      }

      const content = await fs.readFile(filePath, 'utf8');
      
      // Determining language from extension
      let lang: 'javascript' | 'typescript' | 'tsx' = 'typescript'; // Default
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) lang = 'javascript';
      else if (filePath.endsWith('.tsx')) lang = 'tsx';

      const chunks = await this.chunker.chunk(content, lang);
      
      const entries: Entry[] = chunks.map(c => ({
        id: '', // Generated on insert
        mode: 'private', 
        date: new Date().toISOString(),
        text: c.text,
        source: filePath,
        metadata: {
          ...c.metadata
        }
      }));

      // Delete old entries for this source before adding new ones
      const deleted = await this.vectorStore.deleteBySource(filePath);
      if (deleted > 0) {
        console.log(`[Indexer] Removed ${deleted} old entries for ${filePath}`);
      }
      
      await this.vectorStore.add(entries);
      console.log(`[Indexer] Indexed ${entries.length} chunks from ${filePath}`);

    } catch (error) {
      console.error(`[Indexer] Failed to index ${filePath}:`, error);
    } finally {
      release();
    }
  }

  private async handleDelete(filePath: string): Promise<void> {
    const deleted = await this.vectorStore.deleteBySource(filePath);
    console.log(`[Indexer] Deleted ${deleted} entries for removed file: ${filePath}`);
  }
}

