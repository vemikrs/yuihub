/**
 * YuiHub MCP Tools - Memory Operations
 * save_thought, search_memory
 */

import { z } from 'zod';
import type { YuiHubClient } from '../client.js';

// --- save_thought ---
export const saveThoughtSchema = z.object({
  text: z.string().describe('The thought, memo, or decision to save'),
  session_id: z.string().describe('Session/Thread ID (th-ULID format)'),
  tags: z.array(z.string()).optional().describe('Optional tags'),
  mode: z.enum(['private', 'public']).optional().default('private').describe('Privacy mode'),
});

export type SaveThoughtInput = z.infer<typeof saveThoughtSchema>;

export async function saveThought(client: YuiHubClient, input: SaveThoughtInput): Promise<string> {
  const result = await client.save([{
    text: input.text,
    session_id: input.session_id,
    tags: input.tags,
    mode: input.mode,
  }]);
  
  return `Saved ${result.count} entry to session ${input.session_id}`;
}

// --- search_memory ---
export const searchMemorySchema = z.object({
  query: z.string().describe('Semantic search query'),
  limit: z.number().optional().default(10).describe('Maximum results'),
  session: z.string().optional().describe('Filter by session ID'),
  tag: z.string().optional().describe('Filter by tag'),
});

export type SearchMemoryInput = z.infer<typeof searchMemorySchema>;

export async function searchMemory(client: YuiHubClient, input: SearchMemoryInput): Promise<string> {
  const results = await client.search(input.query, input.limit, {
    session: input.session,
    tag: input.tag,
  });
  
  if (results.length === 0) {
    return 'No results found.';
  }
  
  return results.map((r, i) => 
    `[${i + 1}] (score: ${r.score.toFixed(3)})\n${r.text.slice(0, 200)}${r.text.length > 200 ? '...' : ''}`
  ).join('\n\n');
}
