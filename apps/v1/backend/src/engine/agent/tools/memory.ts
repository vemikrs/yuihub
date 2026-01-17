import { ToolDef } from '../../ai/tools.js';
import z from 'zod';
import { AgentContext, CheckpointMetadata } from '../context.js';
import { randomUUID } from 'crypto';
import fs from 'fs-extra';
import path from 'path';

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

export const MemoryToolImplementations = {
    create_checkpoint: async (args: { summary: string; intent: string }, context: AgentContext): Promise<string> => {
        const checkpointId = randomUUID();
        const timestamp = new Date().toISOString();
        
        const metadata: CheckpointMetadata = {
            id: checkpointId,
            session_id: context.sessionId,
            summary: args.summary,
            intent: args.intent,
            timestamp,
        };
        
        // Save checkpoint to file
        const checkpointDir = path.join(context.dataDir, 'checkpoints');
        await fs.ensureDir(checkpointDir);
        const checkpointFile = path.join(checkpointDir, `${checkpointId}.json`);
        await fs.writeJson(checkpointFile, metadata, { spaces: 2 });
        
        return `Checkpoint created: ${checkpointId} - "${args.summary}"`;
    },
    
    upsert_intent: async (args: { intent: string }, context: AgentContext): Promise<string> => {
        context.workingMemory.set('current_intent', args.intent);
        context.workingMemory.set('intent_updated_at', new Date().toISOString());
        return `Intent updated to: "${args.intent}"`;
    },
    
    update_working_memory: async (args: { key: string; value: any }, context: AgentContext): Promise<string> => {
        context.workingMemory.set(args.key, args.value);
        return `Working memory updated: ${args.key} = ${JSON.stringify(args.value)}`;
    },
    
    get_current_packet: async (args: {}, context: AgentContext): Promise<string> => {
        const packet = {
            session_id: context.sessionId,
            intent: context.workingMemory.get('current_intent') || 'No intent set',
            working_memory: Object.fromEntries(context.workingMemory),
            timestamp: new Date().toISOString()
        };
        return JSON.stringify(packet, null, 2);
    }
};
