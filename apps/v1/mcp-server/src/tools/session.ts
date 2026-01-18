/**
 * YuiHub MCP Tools - Session Operations
 * start_session
 */

import { z } from 'zod';
import type { YuiHubClient } from '../client.js';

// --- start_session ---
export const startSessionSchema = z.object({
  title: z.string().optional().describe('Optional session title'),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;

export async function startSession(client: YuiHubClient, input: StartSessionInput): Promise<string> {
  const session = await client.createThread(input.title);
  
  return `Created new session:\nID: ${session.id}\nTitle: ${session.title}\nCreated: ${session.created_at}`;
}
