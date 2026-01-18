/**
 * YuiHub MCP Tools - Context Operations
 * fetch_context, create_checkpoint
 */

import { z } from 'zod';
import type { YuiHubClient } from '../client.js';

// --- fetch_context ---
export const fetchContextSchema = z.object({
  intent: z.string().optional().describe('Current intent/goal for context retrieval'),
  session: z.string().optional().describe('Session ID to get context for'),
});

export type FetchContextInput = z.infer<typeof fetchContextSchema>;

export async function fetchContext(client: YuiHubClient, input: FetchContextInput): Promise<string> {
  const packet = await client.exportContext(input.intent, input.session);
  
  const memories = packet.long_term_memory.map((m, i) => 
    `[${i + 1}] (relevance: ${m.relevance.toFixed(3)})\n${m.text.slice(0, 200)}${m.text.length > 200 ? '...' : ''}`
  ).join('\n\n');
  
  return `Intent: ${packet.intent}
Session: ${packet.session_id || 'N/A'}
Mode: ${packet.meta.mode}

Long-term Memory:
${memories || 'No relevant memories found.'}`;
}

// --- create_checkpoint ---
export const createCheckpointSchema = z.object({
  session_id: z.string().describe('Session ID to checkpoint'),
  summary: z.string().describe('Summary of the decision/conclusion'),
  intent: z.string().describe('Current goal/intent'),
  working_memory: z.record(z.string(), z.unknown()).optional().describe('Current working memory state'),
  entry_ids: z.array(z.string()).optional().describe('Related entry IDs'),
});

export type CreateCheckpointInput = z.infer<typeof createCheckpointSchema>;

export async function createCheckpoint(client: YuiHubClient, input: CreateCheckpointInput): Promise<string> {
  const checkpoint = await client.createCheckpoint({
    session_id: input.session_id,
    summary: input.summary,
    intent: input.intent,
    working_memory: input.working_memory,
    entry_ids: input.entry_ids,
  });
  
  return `Created checkpoint:
ID: ${checkpoint.id}
Session: ${checkpoint.session_id}
Intent: ${checkpoint.intent}
Created: ${checkpoint.created_at}`;
}
