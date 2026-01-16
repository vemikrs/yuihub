import { Entry } from '@yuihub/core';

// LanceDB Record Schema
// Typically inferring from data is enough, but defining types helps.
export interface LanceEntry {
  id: string;
  vector: number[]; // Float32Array in runtime
  text: string;
  mode: string;
  tags: string[];
  session_id: string;
  source: string;
  date: string; // ISO string for metadata filtering
  metadata: string; // JSON stringified extra metadata
}

/**
 * Convert Core Entry to LanceDB Entry (without vector)
 * Vector must be added separately.
 */
export function toLanceEntryBase(entry: Entry): Omit<LanceEntry, 'vector'> {
  return {
    id: entry.id,
    text: entry.text,
    mode: entry.mode,
    tags: entry.tags || [],
    session_id: entry.session_id || '',
    source: entry.source || '',
    date: entry.date,
    metadata: JSON.stringify(entry.metadata || {})
  };
}
