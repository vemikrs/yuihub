import { IGenAIService, GenAIResult, ToolCall } from '../ai/types.js';
import { ToolDef } from '../ai/tools.js';
import { FSTools, FSToolImplementations } from './tools/fs.js';
import { MemoryTools, MemoryToolImplementations } from './tools/memory.js';
import { AgentContext } from './context.js';
import { IVectorStore } from '../vector-store-types.js';

export interface AgentConfig {
    genAI: IGenAIService;
    rootDir: string;
    sessionId: string;
    vectorStore: IVectorStore;
    dataDir: string;
}

export class Agent {
    private genAI: IGenAIService;
    private rootDir: string;
    private maxTurns: number = 10;
    private context: AgentContext;

    constructor(config: AgentConfig) {
        this.genAI = config.genAI;
        this.rootDir = config.rootDir;
        
        // Initialize agent context
        this.context = {
            sessionId: config.sessionId,
            vectorStore: config.vectorStore,
            workingMemory: new Map<string, any>(),
            dataDir: config.dataDir
        };
    }

    async run(prompt: string, contextInfo?: string): Promise<string> {
        // Set initial intent from prompt
        this.context.workingMemory.set('current_intent', prompt);
        
        let messages = [
            `System: You are YuiHub Autonomous Agent. You have access to the file system and memory tools.`,
            `Context: ${contextInfo || 'No additional context provided.'}`,
            `User: ${prompt}`
        ];
        
        let currentPrompt = messages.join('\n\n');
        
        const tools: ToolDef[] = [...FSTools, ...MemoryTools];
        
        for (let i = 0; i < this.maxTurns; i++) {
            console.log(`[Agent] Turn ${i+1}/${this.maxTurns}`);
            
            const result: GenAIResult = await this.genAI.generate(currentPrompt, tools);
            
            if (result.toolCalls && result.toolCalls.length > 0) {
                let toolOutputs = "";
                for (const call of result.toolCalls) {
                    console.log(`[Agent] Tool Call: ${call.name}`);
                    const output = await this.executeTool(call);
                    toolOutputs += `\nTool Output (${call.name}): ${output}\n`;
                }
                
                currentPrompt += `\n${result.text || ''}\n${toolOutputs}`;
            } else {
                return result.text;
            }
        }
        
        return "Agent max turns reached.";
    }

    private async executeTool(call: ToolCall): Promise<string> {
        const { name, args } = call;
        
        // Type-safe dispatch
        if (name in FSToolImplementations) {
            const impl = FSToolImplementations as Record<string, (args: any, rootDir: string) => Promise<string>>;
            return impl[name](args, this.rootDir);
        }
        if (name in MemoryToolImplementations) {
            const impl = MemoryToolImplementations as Record<string, (args: any, context: AgentContext) => Promise<string>>;
            return impl[name](args, this.context);
        }
        
        return `Error: Tool ${name} not found.`;
    }
}
