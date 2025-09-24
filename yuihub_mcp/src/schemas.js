/**
 * YuiFlow Schema Definitions for MCP
 * Simplified version based on API schemas
 */

import { z } from 'zod';

// Simplified ID patterns for MCP validation
const MSG_ID_PATTERN = /^msg-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const TH_ID_PATTERN = /^th-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const TRG_ID_PATTERN = /^trg-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

// Source types as defined in YuiFlow spec
const SourceEnum = z.enum(['gpts', 'copilot', 'claude', 'human']);

/**
 * InputMessage Schema for MCP save_note tool
 */
export const MCPInputMessageSchema = z.object({
  id: z.string().regex(MSG_ID_PATTERN).optional(),
  when: z.string().datetime().optional(),
  source: SourceEnum,
  thread: z.string().regex(TH_ID_PATTERN),
  author: z.string(),
  text: z.string(),
  tags: z.array(z.string()).optional().default([]),
  meta: z.object({
    intent: z.string().optional(),
    ref: z.string().nullable().optional()
  }).optional()
});

/**
 * AgentTrigger Schema for MCP trigger_agent tool
 */
export const MCPAgentTriggerSchema = z.object({
  id: z.string().regex(TRG_ID_PATTERN).optional(),
  when: z.string().datetime().optional(),
  type: z.string(),
  payload: z.record(z.string(), z.any()),
  reply_to: z.string().regex(TH_ID_PATTERN)
});

/**
 * Search Query Schema for MCP search_notes tool
 */
export const MCPSearchQuerySchema = z.object({
  query: z.string().optional(),
  tag: z.string().optional(),
  thread: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(10)
});

/**
 * Validation helpers
 */
export const MCPValidators = {
  inputMessage: (data) => MCPInputMessageSchema.safeParse(data),
  agentTrigger: (data) => MCPAgentTriggerSchema.safeParse(data),
  searchQuery: (data) => MCPSearchQuerySchema.safeParse(data)
};