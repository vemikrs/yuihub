import { ToolDef } from './tools.js'; // We will define this next

export interface GenAIResult {
  text: string;
  toolCalls?: {
    name: string;
    args: Record<string, any>;
  }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface IGenAIService {
  init(): Promise<void>;
  generate(prompt: string, tools?: ToolDef[]): Promise<GenAIResult>;
  stream(prompt: string, tools?: ToolDef[]): AsyncGenerator<string>;
  getModelName(): string;
}
