import { IGenAIService, GenAIResult, ToolCall } from '../ai/types.js';
import { ToolDef } from '../ai/tools.js';
import { FSTools, FSToolImplementations } from './tools/fs.js';
import { MemoryTools, MemoryToolImplementations } from './tools/memory.js';
import { AgentContext, IAgentContext } from './context.js';

export interface AgentConfig {
    genAI: IGenAIService;
    rootDir: string;
    dataDir: string;
    sessionId?: string;
}

// Type-safe tool dispatch maps
type FSToolName = keyof typeof FSToolImplementations;
type MemoryToolName = keyof typeof MemoryToolImplementations;

export class Agent {
    private genAI: IGenAIService;
    private rootDir: string;
    private dataDir: string;
    private sessionId: string;
    private maxTurns: number = 10;
    private context: IAgentContext | null = null;

    constructor(config: AgentConfig) {
        this.genAI = config.genAI;
        this.rootDir = config.rootDir;
        this.dataDir = config.dataDir;
        this.sessionId = config.sessionId || `agent-${Date.now()}`;
    }

    async run(prompt: string, contextStr?: string): Promise<string> {
        // Initialize AgentContext for this session
        this.context = await AgentContext.loadOrCreate(this.sessionId, this.dataDir);
        
        // Construct system prompt with tools and context
        let messages = [
            `System: You are YuiHub Autonomous Agent. You have access to the file system and memory tools.`,
            `Context: ${contextStr || 'No additional context provided.'}`,
            `User: ${prompt}`
        ];
        
        let currentPrompt = messages.join('\n\n');
        
        const tools: ToolDef[] = [...FSTools, ...MemoryTools];
        
        for (let i = 0; i < this.maxTurns; i++) {
            console.log(`[Agent] Turn ${i+1}/${this.maxTurns}`);
            
            const result: GenAIResult = await this.genAI.generate(currentPrompt, tools);
            
            if (result.toolCalls && result.toolCalls.length > 0) {
                // Execute tools
                let toolOutputs = "";
                for (const call of result.toolCalls) {
                    console.log(`[Agent] Tool Call: ${call.name}`);
                    const output = await this.executeTool(call);
                    toolOutputs += `\nTool Output (${call.name}): ${output}\n`;
                }
                
                // Append result text (thought) and tool outputs to prompt for next turn
                currentPrompt += `\n${result.text || ''}\n${toolOutputs}`;
            } else {
                // Final answer - save context before returning
                await this.context.save();
                return result.text;
            }
        }
        
        // Save context even on max turns
        await this.context.save();
        return "Agent max turns reached.";
    }

    private async executeTool(call: ToolCall): Promise<string> {
        const { name, args } = call;
        
        // FS Tools dispatch
        if (name in FSToolImplementations) {
            const fn = (FSToolImplementations as Record<string, (args: any, rootDir: string) => Promise<string>>)[name];
            return fn(args, this.rootDir);
        }
        
        // Memory Tools dispatch - requires context
        if (name in MemoryToolImplementations && this.context) {
            const fn = (MemoryToolImplementations as Record<string, (args: any, ctx: IAgentContext) => Promise<string>>)[name];
            return fn(args, this.context);
        }
        
        return `Error: Tool ${name} not found.`;
    }
}

