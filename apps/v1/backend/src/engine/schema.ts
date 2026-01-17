import { Entry } from '@yuihub/core';

// LanceDB Record Schema
// Tags are stored as JSON string to avoid Arrow type inference issues with empty arrays
export interface LanceEntry {
  id: string;
  vector: number[]; // Float32Array in runtime
  text: string;
  mode: string;
  tags: string; // JSON stringified array (e.g., '["tag1","tag2"]')
  session_id: string;
  source: string;
  date: string; // ISO string for metadata filtering
  metadata: string; // JSON stringified extra metadata
}

/**
 * Convert Core Entry to LanceDB Entry (without vector)
 * Vector must be added separately.
 * Tags are serialized to JSON string.
 */
export function toLanceEntryBase(entry: Entry): Omit<LanceEntry, 'vector'> {
  return {
    id: entry.id,
    text: entry.text,
    mode: entry.mode,
    tags: JSON.stringify(entry.tags || []), // Serialize to avoid Arrow type inference issues
    session_id: entry.session_id || '',
    source: entry.source || '',
    date: entry.date,
    metadata: JSON.stringify(entry.metadata || {})
  };
}

