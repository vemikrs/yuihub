import { ToolDef } from '../../ai/tools.js';
import z from 'zod';
import { IAgentContext } from '../context.js';

export const MemoryTools: ToolDef[] = [
  {
    name: 'create_checkpoint',
    description: 'Create a decision anchor (checkpoint) to save the current state and intent.',
    parameters: z.object({
      summary: z.string().describe('Short summary of what was achieved'),
      intent: z.string().describe('The intent or goal capable of being resumed later'),
    }),
  },
  {
    name: 'upsert_intent',
    description: 'Update the current working intent or goal.',
    parameters: z.object({
      intent: z.string(),
    }),
  },
  {
    name: 'update_working_memory',
    description: 'Update the short-term working memory (scratchpad).',
    parameters: z.object({
        key: z.string(),
        value: z.any(),
    })
  },
  {
    name: 'get_current_packet',
    description: 'Retrieve the full current context packet.',
    parameters: z.object({}),
  }
];

// Memory tool implementations - require IAgentContext
export const MemoryToolImplementations = {
    create_checkpoint: async (args: { summary: string; intent: string }, context: IAgentContext) => {
        const checkpoint = await context.createCheckpoint(args.summary, args.intent);
        return `Checkpoint created: ${checkpoint.id} | Intent: ${args.intent}`;
    },
    upsert_intent: async (args: { intent: string }, context: IAgentContext) => {
        context.setIntent(args.intent);
        return `Intent updated to: ${args.intent}`;
    },
    update_working_memory: async (args: { key: string; value: unknown }, context: IAgentContext) => {
        context.setWorkingMemory(args.key, args.value);
        return `Working memory updated: ${args.key} = ${JSON.stringify(args.value)}`;
    },
    get_current_packet: async (_args: Record<string, never>, context: IAgentContext) => {
        const packet = context.getPacket();
        return JSON.stringify(packet, null, 2);
    }
};

