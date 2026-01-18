/**
 * LocalGenAIService - Ollama-based Local GenAI Service
 * Implements IGenAIService interface for local model inference
 */
import { IGenAIService, GenAIResult } from './types.js';
import { ToolDef } from './tools.js';

interface OllamaResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
    tool_calls?: Array<{
      function: {
        name: string;
        arguments: Record<string, unknown>;
      };
    }>;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class LocalGenAIService implements IGenAIService {
  private baseUrl: string;
  private modelName: string;

  constructor(config: { baseUrl?: string; model?: string } = {}) {
    this.baseUrl = config.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.modelName = config.model || 'qwen2.5:7b';
  }

  async init(): Promise<void> {
    // Verify Ollama is available
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Ollama not available at ${this.baseUrl}`);
      }
      console.log(`[LocalGenAI] Connected to Ollama at ${this.baseUrl}, using model: ${this.modelName}`);
    } catch (error) {
      console.error(`[LocalGenAI] Failed to connect to Ollama:`, error);
      throw new Error(`Ollama not available at ${this.baseUrl}. Make sure Ollama is running.`);
    }
  }

  getModelName(): string {
    return this.modelName;
  }

  async generate(prompt: string, tools?: ToolDef[]): Promise<GenAIResult> {
    const messages = [{ role: 'user', content: prompt }];

    const requestBody: Record<string, unknown> = {
      model: this.modelName,
      messages,
      stream: false,
    };

    // Ollama tool calling support (if tools provided)
    if (tools && tools.length > 0) {
      // Ollama uses OpenAI-compatible tool format
      requestBody.tools = tools.map(t => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: {
            type: 'object',
            properties: this.zodToSimpleSchema(t.parameters),
            required: this.getRequiredFields(t.parameters),
          },
        },
      }));
    }

    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
    }

    const data = (await response.json()) as OllamaResponse;
    const message = data.message;

    const toolCalls = message.tool_calls?.map((tc, idx) => ({
      name: tc.function.name,
      args: tc.function.arguments,
      id: `call_${idx}`,
    }));

    return {
      text: message.content || '',
      toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
      },
    };
  }

  async *stream(prompt: string, _tools?: ToolDef[]): AsyncGenerator<string> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        messages: [{ role: 'user', content: prompt }],
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Ollama streaming error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim());

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.message?.content) {
            yield parsed.message.content;
          }
        } catch {
          // Skip malformed lines
        }
      }
    }
  }

  // Simple Zod to JSON Schema converter for Ollama
  private zodToSimpleSchema(schema: any): Record<string, unknown> {
    if (!schema || !schema._def) return {};
    
    const shape = schema._def.shape?.();
    if (!shape) return {};

    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(shape)) {
      const fieldDef = (value as any)._def;
      properties[key] = {
        type: this.getZodType(fieldDef),
        description: fieldDef.description || '',
      };
    }
    return properties;
  }

  private getZodType(def: any): string {
    if (!def) return 'string';
    const typeName = def.typeName;
    if (typeName === 'ZodString') return 'string';
    if (typeName === 'ZodNumber') return 'number';
    if (typeName === 'ZodBoolean') return 'boolean';
    if (typeName === 'ZodArray') return 'array';
    if (typeName === 'ZodObject') return 'object';
    if (typeName === 'ZodOptional') return this.getZodType(def.innerType?._def);
    return 'string';
  }

  private getRequiredFields(schema: any): string[] {
    if (!schema || !schema._def) return [];
    
    const shape = schema._def.shape?.();
    if (!shape) return [];

    const required: string[] = [];
    for (const [key, value] of Object.entries(shape)) {
      const fieldDef = (value as any)._def;
      if (fieldDef.typeName !== 'ZodOptional') {
        required.push(key);
      }
    }
    return required;
  }
}
