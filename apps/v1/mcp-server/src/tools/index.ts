/**
 * YuiHub MCP Tools - Registration
 */

import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { YuiHubClient } from '../client.js';
import { toMCPError } from '../errors.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { saveThoughtSchema, saveThought } from './memory.js';
import { searchMemorySchema, searchMemory } from './memory.js';
import { startSessionSchema, startSession } from './session.js';
import { fetchContextSchema, fetchContext } from './context.js';
import { createCheckpointSchema, createCheckpoint } from './context.js';

export function registerTools(server: Server, client: YuiHubClient): void {
  // List tools handler
  server.setRequestHandler({ method: 'tools/list' } as any, async () => {
    return {
      tools: [
        {
          name: 'save_thought',
          description: 'Save a thought, memo, or decision to YuiHub memory',
          inputSchema: zodToJsonSchema(saveThoughtSchema),
        },
        {
          name: 'search_memory',
          description: 'Search past memories using semantic search',
          inputSchema: zodToJsonSchema(searchMemorySchema),
        },
        {
          name: 'start_session',
          description: 'Start a new thinking session/thread',
          inputSchema: zodToJsonSchema(startSessionSchema),
        },
        {
          name: 'fetch_context',
          description: 'Fetch context packet for a given intent or session',
          inputSchema: zodToJsonSchema(fetchContextSchema),
        },
        {
          name: 'create_checkpoint',
          description: 'Create a decision checkpoint to persist current state',
          inputSchema: zodToJsonSchema(createCheckpointSchema),
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler({ method: 'tools/call' } as any, async (request: any) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      switch (name) {
        case 'save_thought':
          result = await saveThought(client, saveThoughtSchema.parse(args));
          break;
        case 'search_memory':
          result = await searchMemory(client, searchMemorySchema.parse(args));
          break;
        case 'start_session':
          result = await startSession(client, startSessionSchema.parse(args));
          break;
        case 'fetch_context':
          result = await fetchContext(client, fetchContextSchema.parse(args));
          break;
        case 'create_checkpoint':
          result = await createCheckpoint(client, createCheckpointSchema.parse(args));
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const mcpError = toMCPError(error);
      return {
        content: [{ type: 'text', text: `Error: ${mcpError.message}` }],
        isError: true,
      };
    }
  });
}
