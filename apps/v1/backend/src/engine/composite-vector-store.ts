import { Entry } from '@yuihub/core';
import { IVectorStore, SearchResult } from './vector-store-types.js';

/**
 * CompositeVectorStore
 * Manages multiple VectorStore instances (Dual Embedding).
 * - Writes to ALL stores (Fan-out).
 * - Searches from ALL stores and merges using RRF.
 */
export class CompositeVectorStore implements IVectorStore {
  private stores: IVectorStore[];

  constructor(stores: IVectorStore[]) {
    this.stores = stores;
  }

  async init(): Promise<void> {
    await Promise.all(this.stores.map(s => s.init()));
  }

  async add(entries: Entry[]): Promise<void> {
    // Fan-out write with error collection
    const errors: Error[] = [];
    await Promise.all(this.stores.map(async s => {
      try {
        await s.add(entries);
      } catch (e) {
        console.error(`[CompositeVectorStore] add failed for store:`, e);
        errors.push(e as Error);
      }
    }));
    // If all stores failed, throw
    if (errors.length === this.stores.length) {
      throw new Error('All stores failed to add entries');
    }
  }

  async isEmpty(): Promise<boolean> {
    // Return true if all stores are empty
    const results = await Promise.all(this.stores.map(s => s.isEmpty()));
    return results.every(r => r === true);
  }

  async deleteBySource(source: string): Promise<number> {
    // Fan-out delete and sum results
    const counts = await Promise.all(this.stores.map(s => s.deleteBySource(source)));
    return counts.reduce((sum, c) => sum + c, 0);
  }

  async search(query: string, limit: number = 10, filter?: { tag?: string; session?: string }): Promise<SearchResult[]> {
    // Hybrid Search: RRF
    // 1. Parallel Search
    const resultsPerStore = await Promise.all(this.stores.map(s => s.search(query, limit * 2, filter))); // Fetch deeper for fusing

    // 2. RRF Fusion
    // RRF score = sum(1 / (k + rank))
    const K = 60;
    const scores: Map<string, number> = new Map();
    const docMap: Map<string, SearchResult> = new Map(); // Keep detailed doc

    for (const results of resultsPerStore) {
      results.forEach((doc, rank) => {
        if (!docMap.has(doc.id)) {
            docMap.set(doc.id, doc);
        }
        const currentScore = scores.get(doc.id) || 0;
        const rrfContribution = 1.0 / (K + rank + 1);
        scores.set(doc.id, currentScore + rrfContribution);
      });
    }

    // 3. Sort & Limit
    const sortedIds = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1]) // Descending score
      .slice(0, limit)
      .map(([id]) => id);

    return sortedIds.map(id => docMap.get(id)!);
  }
}

