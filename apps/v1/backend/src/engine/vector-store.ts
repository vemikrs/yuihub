import * as lancedb from '@lancedb/lancedb';
import path from 'path';
import fs from 'fs-extra';
import { Entry } from '@yuihub/core';
import { LanceEntry, toLanceEntryBase } from './schema.js';
import { IEmbeddingService } from './embeddings/types.js';
import { IVectorStore, SearchResult } from './vector-store-types.js';

export class LanceVectorStore implements IVectorStore {
  private db: lancedb.Connection | null = null;
  private table: lancedb.Table | null = null;
  private embedder: IEmbeddingService;
  private dbPath: string;
  private tableName: string;
  public readonly name: string; // Identifier for RRF (e.g. 'local', 'vertex')

  constructor(basePath: string, embedder: IEmbeddingService, name: string = 'yuihub_entries', tableName?: string) {
    this.dbPath = path.join(basePath, 'data/lancedb');
    this.embedder = embedder;
    this.name = name;
    this.tableName = tableName || `entries_${name}`; // e.g. entries_local, entries_vertex
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

  async search(query: string, limit: number = 10, filter?: { tag?: string; session?: string }): Promise<SearchResult[]> {
    if (!this.table) return [];

    const output = await this.embedder.embed(query);
    const vector = output.data;

    let builder = this.table.search(vector).limit(limit);

    const whereClauses: string[] = [];
    if (filter?.session) {
      whereClauses.push(`session_id = '${filter.session}'`);
    }

    if (whereClauses.length > 0) {
      builder = builder.where(whereClauses.join(' AND '));
    }

    const rows = await builder.toArray();
    
    return rows.map((r: any) => ({
      ...r,
      score: r._distance, // LanceDB uses distance (lower is better usually for L2, cosine dist?)
      // Note: OpenAI/MiniLM usually use Cosine Similarity or Distance. 
      // LanceDB 'cosine' distance = 1 - similarity. 
      // RRF needs consistent ranking. Distance is fine for ascending rank.
      _source_store: this.name
    }));
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

