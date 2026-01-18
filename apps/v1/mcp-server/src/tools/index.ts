/**
 * YuiHub MCP Tools - Registration
 * Using Zod v4 native z.toJSONSchema()
 */

import { z } from 'zod';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { YuiHubClient } from '../client.js';
import { toMCPError } from '../errors.js';

import { saveThoughtSchema, saveThought } from './memory.js';
import { searchMemorySchema, searchMemory } from './memory.js';
import { startSessionSchema, startSession } from './session.js';
import { fetchContextSchema, fetchContext } from './context.js';
import { createCheckpointSchema, createCheckpoint } from './context.js';

export function registerTools(server: Server, client: YuiHubClient): void {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'save_thought',
          description: 'Save a thought, memo, or decision to YuiHub memory',
          inputSchema: z.toJSONSchema(saveThoughtSchema),
        },
        {
          name: 'search_memory',
          description: 'Search past memories using semantic search',
          inputSchema: z.toJSONSchema(searchMemorySchema),
        },
        {
          name: 'start_session',
          description: 'Start a new thinking session/thread',
          inputSchema: z.toJSONSchema(startSessionSchema),
        },
        {
          name: 'fetch_context',
          description: 'Fetch context packet for a given intent or session',
          inputSchema: z.toJSONSchema(fetchContextSchema),
        },
        {
          name: 'create_checkpoint',
          description: 'Create a decision checkpoint to persist current state',
          inputSchema: z.toJSONSchema(createCheckpointSchema),
        },
      ],
    };
  });

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
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
