import { IGenAIService, GenAIResult } from './types.js';
import { ToolDef } from './tools.js';
import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';
import { zodToJsonSchema } from 'zod-to-json-schema';

export class VertexGenAIService implements IGenAIService {
  private config: any; // VertexProviderConfig
  private client: VertexAI | null = null;
  private model: GenerativeModel | null = null;
  
  constructor(config: any) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (!this.config.projectId || !this.config.location) {
        console.warn("[Vertex] projectId or location missing in config. Attempting default or might fail.");
        if (!this.config.projectId) throw new Error("Vertex AI projectId missing");
        if (!this.config.location) throw new Error("Vertex AI location missing");
    }

    this.client = new VertexAI({
        project: this.config.projectId,
        location: this.config.location,
    });

    const modelName = this.getModelName();
    this.model = this.client.getGenerativeModel({ model: modelName });
    console.log(`[Vertex] Initializing GenAI Service: ${modelName}`);
  }

  getModelName(): string {
    return this.config.chatModel || 'gemini-2.5-flash';
  }

  async generate(prompt: string, tools?: ToolDef[]): Promise<GenAIResult> {
    if (!this.model) await this.init();

    const request: any = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    if (tools && tools.length > 0) {
      // Map ToolDef to Vertex AI FunctionDeclaration
      // Vertex AI expects { functionDeclarations: [...] } inside 'tools'
      const functionDeclarations = tools.map(t => {
        // Cast to any to avoid TypeScript infinite type instantiation error
        const jsonSchema = zodToJsonSchema(t.parameters as any) as Record<string, any>;
        // Clean up schema for Vertex (remove $schema property)
        delete jsonSchema.$schema;

        return {
          name: t.name,
          description: t.description,
          parameters: jsonSchema,
        };
      });

      request.tools = [{ functionDeclarations }];
    }

    const result = await this.model!.generateContent(request);
    const response = result.response;
    const candidate = response.candidates?.[0];
    const content = candidate?.content;
    
    let text = '';
    const toolCalls: any[] = [];

    if (content?.parts) {
      for (const part of content.parts) {
        if (part.text) {
          text += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            name: part.functionCall.name,
            args: part.functionCall.args,
            id: 'call_' + Math.random().toString(36).substr(2, 9) // Vertex doesn't consistently give IDs for single turn?
          });
        }
      }
    }
    
    const usage = response.usageMetadata;

    return {
      text,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: usage?.promptTokenCount || 0,
        completionTokens: usage?.candidatesTokenCount || 0
      }
    };
  }

  async *stream(prompt: string, tools?: ToolDef[]): AsyncGenerator<string> {
    if (!this.model) await this.init();

    const resultStream = await this.model!.generateContentStream(prompt);
    
    for await (const chunk of resultStream.stream) {
        const text = chunk.candidates?.[0].content.parts[0]?.text;
        if (text) {
            yield text;
        }
    }
  }
}
