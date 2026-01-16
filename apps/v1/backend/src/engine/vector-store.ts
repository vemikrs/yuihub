import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs-extra';
import { Entry } from '@yuihub/core';
import { LanceEntry, toLanceEntryBase } from './schema.js';
import { IEmbeddingService } from './embeddings/types.js';

export class VectorStore {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private embedder: IEmbeddingService;
  private dbPath: string;
  private tableName: string = 'yuihub_entries';

  constructor(basePath: string, embedder: IEmbeddingService) {
    this.dbPath = path.join(basePath, 'data/lancedb');
    this.embedder = embedder;
  }

  async init() {
    await fs.ensureDir(this.dbPath);
    this.db = await lancedb.connect(this.dbPath);
    
    // Initialize Embedder
    await this.embedder.init();

    // Check if table exists
    const tableNames = await this.db.tableNames();
    if (tableNames.includes(this.tableName)) {
      this.table = await this.db.openTable(this.tableName);
    }
  }

  async add(entries: Entry[]) {
    if (!this.db) throw new Error('VectorStore not initialized');

    const data: LanceEntry[] = [];
    for (const entry of entries) {
      const output = await this.embedder.embed(entry.text);
      
      data.push({
        ...toLanceEntryBase(entry),
        vector: output.data
      });
    }

    if (data.length === 0) return;

    if (!this.table) {
      // @ts-ignore: LanceDB Type mismatch with strict mode
      this.table = await this.db.createTable(this.tableName, data as any);
    } else {
      // @ts-ignore: LanceDB Type mismatch with strict mode
      await this.table.add(data as any);
    }
  }

  async search(query: string, limit: number = 10, filter?: { tag?: string; session?: string }) {
    if (!this.table) return [];

    const output = await this.embedder.embed(query);
    const vector = output.data;

    let builder = this.table.search(vector).limit(limit);

    const whereClauses: string[] = [];
    if (filter?.tag) {
       // Pending: efficient array contains support
    }
    if (filter?.session) {
      whereClauses.push(`session_id = '${filter.session}'`);
    }

    if (whereClauses.length > 0) {
      builder = builder.where(whereClauses.join(' AND '));
    }

    return await builder.toArray();
  }

  async isEmpty(): Promise<boolean> {
    if (!this.table) return true;
    try {
      const count = await this.table.countRows();
      return count === 0;
    } catch {
      return true;
    }
  }
}
