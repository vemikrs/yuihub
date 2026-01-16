import { z } from 'zod';
import { ulid } from 'ulid';

/**
 * YuiFlow Schema Definitions
 * Based on docs/yuiflow/00_min-spec.md
 */

// Base ID patterns - ULID uses 0-9A-Z (excluding I,L,O,U)
const ULID_PATTERN = /^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const MSG_ID_PATTERN = /^msg-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const TH_ID_PATTERN = /^th-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const REC_ID_PATTERN = /^rec-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const KNOT_ID_PATTERN = /^knot-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;
const TRG_ID_PATTERN = /^trg-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

// Source types as defined in YuiFlow spec
const SourceEnum = z.enum(['gpts', 'copilot', 'claude', 'human']);

// Mode is fixed to 'shelter' in Ph2b
const ModeEnum = z.literal('shelter');

// Controls schema (暫定 - placeholder as per spec)
const ControlsSchema = z.object({
  visibility: z.enum(['internal', 'external']).optional(),
  detail: z.enum(['minimal', 'full']).optional(),
  external_io: z.enum(['blocked', 'unsafe']).optional()
}).optional();

/**
 * InputMessage Schema - Input format for /save endpoint
 * Maps to input.message.yaml in spec
 */
export const InputMessageSchema = z.object({
  id: z.string().regex(MSG_ID_PATTERN).optional(), // Auto-generated if not provided
  when: z.string().datetime().optional(), // ISO8601, defaults to now
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
 * Fragment Schema - The atomic unit of storage
 * Maps to record.entry.yaml with kind: fragment
 */
export const FragmentSchema = z.object({
  id: z.string().regex(REC_ID_PATTERN),
  when: z.string().datetime(),
  mode: ModeEnum,
  controls: ControlsSchema,
  thread: z.string().regex(TH_ID_PATTERN),
  source: SourceEnum,
  text: z.string(),
  terms: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  links: z.array(z.object({
    type: z.string(),
    ref: z.string()
  })).optional().default([]),
  kind: z.literal('fragment').optional().default('fragment')
});

/**
 * Knot Schema - Bundle of related fragments representing key points
 * Maps to record.entry.yaml with kind: knot
 */
export const KnotSchema = z.object({
  id: z.string().regex(KNOT_ID_PATTERN),
  when: z.string().datetime(),
  mode: ModeEnum,
  controls: ControlsSchema,
  thread: z.string().regex(TH_ID_PATTERN),
  source: SourceEnum,
  text: z.string(),
  terms: z.array(z.string()).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  links: z.array(z.object({
    type: z.string(),
    ref: z.string()
  })).optional().default([]),
  kind: z.literal('knot'),
  decision: z.enum(['採用', '保留', '却下']).optional(),
  refs: z.array(z.string()).optional().default([]) // References to fragments
});

/**
 * AgentTrigger Schema - For triggering AI agents
 * Maps to agent.trigger.yaml in spec
 */
export const AgentTriggerSchema = z.object({
  id: z.string().regex(TRG_ID_PATTERN).optional(), // Auto-generated if not provided
  when: z.string().datetime().optional(), // Defaults to now
  type: z.string(),
  payload: z.record(z.string(), z.any()),
  reply_to: z.string().regex(TH_ID_PATTERN)
});

/**
 * Context Packet Schema - Bridge format for GPTs⇄Copilot communication
 */
export const ContextPacketSchema = z.object({
  version: z.literal('1.0.0'),
  intent: z.string(),
  fragments: z.array(FragmentSchema),
  knots: z.array(KnotSchema).optional().default([]),
  thread: z.string().regex(TH_ID_PATTERN)
});

/**
 * Search Query Schema - For search endpoint parameters
 */
export const SearchQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  thread: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(10)
});

/**
 * Helper function to validate and transform InputMessage to Fragment
 */
export function inputMessageToFragment(input, generatedId = null, generatedWhen = null) {
  // Validate input first
  const validatedInput = InputMessageSchema.parse(input);
  
  // Generate IDs if not provided
  const id = generatedId || `rec-${ulid()}`;
  const when = generatedWhen || validatedInput.when || new Date().toISOString();
  
  // Transform to Fragment format
  const fragment = {
    id,
    when,
    mode: 'shelter', // Fixed in Ph2b
    controls: {
      visibility: 'internal',
      detail: 'minimal', 
      external_io: 'blocked'
    },
    thread: validatedInput.thread,
    source: validatedInput.source,
    text: validatedInput.text,
    terms: [], // Will be populated by terms extraction
    tags: validatedInput.tags || [],
    links: validatedInput.meta?.ref ? [{
      type: 'origin',
      ref: validatedInput.meta.ref
    }] : [],
    kind: 'fragment'
  };
  
  // Validate transformed fragment
  return FragmentSchema.parse(fragment);
}

/**
 * Validation helper functions
 */
export const Validators = {
  inputMessage: (data) => InputMessageSchema.safeParse(data),
  fragment: (data) => FragmentSchema.safeParse(data),
  knot: (data) => KnotSchema.safeParse(data),
  agentTrigger: (data) => AgentTriggerSchema.safeParse(data),
  contextPacket: (data) => ContextPacketSchema.safeParse(data),
  searchQuery: (data) => SearchQuerySchema.safeParse(data)
};