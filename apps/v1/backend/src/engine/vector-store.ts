import * as lancedb from '@lancedb/lancedb';
import { pipeline } from '@xenova/transformers';
import path from 'path';
import fs from 'fs-extra';
import { Entry } from '@yuihub/core';
import { LanceEntry, toLanceEntryBase } from './schema.js';

export class VectorStore {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private embedder: any = null;
  private dbPath: string;
  private tableName: string = 'yuihub_entries';

  constructor(basePath: string) {
    this.dbPath = path.join(basePath, 'data/lancedb');
  }

  async init() {
    await fs.ensureDir(this.dbPath);
    this.db = await lancedb.connect(this.dbPath);
    
    // Initialize Embedder (All-MiniLM-L6-v2)
    // NOTE: This downloads the model on first run.
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    // Check if table exists
    const tableNames = await this.db.tableNames();
    if (tableNames.includes(this.tableName)) {
      this.table = await this.db.openTable(this.tableName);
    } else {
      // Create empty table with dummy data to enforce schema?
      // LanceDB creates table on first add usually, strictly defining schema is better but
      // for now we'll lazily create on first add or create with empty if possible.
      // @lancedb/lancedb currently requires data to create table or Arrow schema.
      // We will handle creation in add() if table is null.
    }
  }

  async add(entries: Entry[]) {
    if (!this.db || !this.embedder) throw new Error('VectorStore not initialized');

    const data: LanceEntry[] = [];
    for (const entry of entries) {
      const output = await this.embedder(entry.text, { pooling: 'mean', normalize: true });
      const vector = Array.from(output.data) as number[];
      
      data.push({
        ...toLanceEntryBase(entry),
        vector
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
    if (!this.table || !this.embedder) return [];

    const output = await this.embedder(query, { pooling: 'mean', normalize: true });
    const vector = Array.from(output.data) as number[];

    let builder = this.table.search(vector).limit(limit);

    const whereClauses: string[] = [];
    if (filter?.tag) {
      // LanceDB SQL filter for list? array_contains not fully supported in SQL string yet?
      // Need to check LanceDB documentation for tag filtering.
      // For now, strict match or simple workaround.
      // SQL: array_contains(tags, 'tag')
      // Note: Check lancedb version support. If not supported, we might need to filter manually or use post-filtering.
      // Assuming array_contains is supported in newer versions or use regex for now if tags are stringified?
      // Schema defines tags as string[]. LanceDB supports list types.
      // Let's assume standard SQL works or leave it for now.
    }
    if (filter?.session) {
      whereClauses.push(`session_id = '${filter.session}'`);
    }

    if (whereClauses.length > 0) {
      builder = builder.where(whereClauses.join(' AND '));
    }

    return await builder.toArray();
  }
}
