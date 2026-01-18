/**
 * YuiHub V1 Core Types
 * Based on docs/specs/glossary.md and docs/specs/schemas/context_packet.yaml
 */

export type YuiHubMode = 'private' | 'public';

// Volatile Cognitive Log (Entry)
export interface Entry {
  id: string; // ulid
  date: string; // ISO 8601
  text: string;
  mode: YuiHubMode;
  tags?: string[];
  session_id?: string;
  source?: string; // File path or URL
  metadata?: Record<string, unknown>;
}

// Decision Anchor (Checkpoint)
export interface Checkpoint {
  id: string; // ulid
  entry_id: string; // Linked Entry ID
  snapshot: {
    working_memory: string;
    decision_rationale: string;
  };
  created_at: string;
}

// Cognitive Session (Session)
export interface Session {
  id: string; // ulid
  title: string;
  created_at: string;
  last_updated: string;
  entries_count: number;
}
