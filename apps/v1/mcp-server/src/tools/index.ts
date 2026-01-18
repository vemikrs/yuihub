/**
 * YuiHub MCP Tools - Registration
 */

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

// JSON Schema definitions (Zod v4 compatible)
const toolSchemas = {
  save_thought: {
    type: 'object',
    properties: {
      text: { type: 'string', description: 'The thought, memo, or decision to save' },
      session_id: { type: 'string', description: 'Session/Thread ID (th-ULID format)' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Optional tags' },
      mode: { type: 'string', enum: ['private', 'public'], default: 'private', description: 'Privacy mode' },
    },
    required: ['text', 'session_id'],
  },
  search_memory: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Semantic search query' },
      limit: { type: 'number', default: 10, description: 'Maximum results' },
      session: { type: 'string', description: 'Filter by session ID' },
      tag: { type: 'string', description: 'Filter by tag' },
    },
    required: ['query'],
  },
  start_session: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Optional session title' },
    },
    required: [],
  },
  fetch_context: {
    type: 'object',
    properties: {
      intent: { type: 'string', description: 'Current intent/goal for context retrieval' },
      session: { type: 'string', description: 'Session ID to get context for' },
    },
    required: [],
  },
  create_checkpoint: {
    type: 'object',
    properties: {
      session_id: { type: 'string', description: 'Session ID to checkpoint' },
      summary: { type: 'string', description: 'Summary of the decision/conclusion' },
      intent: { type: 'string', description: 'Current goal/intent' },
      working_memory: { type: 'object', description: 'Current working memory state' },
      entry_ids: { type: 'array', items: { type: 'string' }, description: 'Related entry IDs' },
    },
    required: ['session_id', 'summary', 'intent'],
  },
};

export function registerTools(server: Server, client: YuiHubClient): void {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'save_thought',
          description: 'Save a thought, memo, or decision to YuiHub memory',
          inputSchema: toolSchemas.save_thought,
        },
        {
          name: 'search_memory',
          description: 'Search past memories using semantic search',
          inputSchema: toolSchemas.search_memory,
        },
        {
          name: 'start_session',
          description: 'Start a new thinking session/thread',
          inputSchema: toolSchemas.start_session,
        },
        {
          name: 'fetch_context',
          description: 'Fetch context packet for a given intent or session',
          inputSchema: toolSchemas.fetch_context,
        },
        {
          name: 'create_checkpoint',
          description: 'Create a decision checkpoint to persist current state',
          inputSchema: toolSchemas.create_checkpoint,
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
