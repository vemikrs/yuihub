import { Entry } from '@yuihub/core';

export interface SearchResult {
  id: string;
  text: string;
  score: number; // Normalized score or distance
  mode: string;
  tags: string; // JSON stringified array
  session_id: string;
  source: string;
  date: string;
  metadata: string;
  _source_store?: string; // Debug info: 'local', 'vertex'
}

export interface IVectorStore {
  init(): Promise<void>;
  add(entries: Entry[]): Promise<void>;
  search(query: string, limit?: number, filter?: { tag?: string; session?: string }): Promise<SearchResult[]>;
  isEmpty(): Promise<boolean>;
  deleteBySource(source: string): Promise<number>; // Returns count of deleted rows
}

