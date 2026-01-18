import { IEmbeddingService, EmbeddingOutput } from './types.js';
import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';

export class VertexEmbeddingService implements IEmbeddingService {
  private config: any;
  private client: VertexAI | null = null;
  private model: GenerativeModel | null = null;

  constructor(config: any) {
    this.config = config;
  }

  async init(): Promise<void> {
    if (!this.config.projectId || !this.config.location) {
        if (!this.config.projectId) throw new Error("Vertex AI requires 'projectId' in config or env");
        if (!this.config.location) throw new Error("Vertex AI requires 'location' in config or env");
    }

    this.client = new VertexAI({
        project: this.config.projectId,
        location: this.config.location,
    });
    
    // 'gemini-embedding-001' or user config
    const modelName = this.config.embeddingModel || 'gemini-embedding-001';
    this.model = this.client.getGenerativeModel({ model: modelName });

    console.log(`[Vertex] Embedding Service Initialized: ${modelName} (${this.config.projectId}/${this.config.location})`);
  }

  async embed(text: string): Promise<EmbeddingOutput> {
    if (!this.model) await this.init();
    
    // Cast to any to bypass TS error if embedContent is missing in type definition but present in runtime
    // or if version mismatch.
    const result = await (this.model as any).embedContent(text);
    
    // handling response structure
    const embedding = result.embedding;
    if (!embedding || !embedding.values) {
        throw new Error('Vertex AI returned empty embedding');
    }

    return {
      data: embedding.values, 
      dimensions: embedding.values.length
    };
  }

  getDimensions(): number {
    return 768; 
  }
}

