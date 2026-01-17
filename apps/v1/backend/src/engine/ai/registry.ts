import { AppConfig } from '../../config/schema.js';
import { IEmbeddingService } from '../embeddings/types.js';
import { VertexEmbeddingService } from '../embeddings/vertex-service.js';
import { IGenAIService } from './types.js';
import { LocalEmbeddingService } from '../embeddings/local-service.js';
import { VertexGenAIService } from './vertex-genai-service.js';


export class AIProviderRegistry {
  private config: AppConfig['ai'];
  private embeddingServices: Map<string, IEmbeddingService> = new Map();
  private genAIServices: Map<string, IGenAIService> = new Map();

  constructor(aiConfig: AppConfig['ai']) {
    this.config = aiConfig;
  }

  async getEmbeddingService(providerId?: string): Promise<IEmbeddingService> {
    const id = providerId || this.config.defaults.embedding[0] || 'local';
    
    if (this.embeddingServices.has(id)) {
      return this.embeddingServices.get(id)!;
    }

    const providerConfig = this.config.providers[id];
    if (!providerConfig) {
      throw new Error(`Provider config not found for id: ${id}`);
    }

    let service: IEmbeddingService;

    if (providerConfig.type === 'local') {
      service = new LocalEmbeddingService(providerConfig.embeddingModel);
    } else if (providerConfig.type === 'vertex') {
       service = new VertexEmbeddingService(providerConfig);
    } else {
      throw new Error(`Unknown provider type: ${(providerConfig as any).type}`);
    }

    await service.init();
    this.embeddingServices.set(id, service);
    return service;
  }

  async getAllEmbeddingServices(): Promise<{ id: string; service: IEmbeddingService }[]> {
    // 1. Identify all embedding providers from config
    const embeddingProviderIds = this.config.defaults.embedding; // e.g. ['local', 'vertex']
    
    const results: { id: string; service: IEmbeddingService }[] = [];
    for (const id of embeddingProviderIds) {
      try {
        const service = await this.getEmbeddingService(id);
        results.push({ id, service });
      } catch (err) {
        console.error(`[AI] Failed to initialize embedding provider '${id}':`, err);
        // We continue to allow partial functionality? 
        // Or throw? Dual embedding implies redundancy, but if primary fails?
        // Let's log and continue for now (Lazy / Partial support).
      }
    }
    return results;
  }

  async getGenAIService(providerId?: string): Promise<IGenAIService> {
    const id = providerId || this.config.defaults.agent;
    
    if (this.genAIServices.has(id)) {
        return this.genAIServices.get(id)!;
    }
    
    const providerConfig = this.config.providers[id];
    if (!providerConfig) {
        // Fallback for bootstrap or minimal config?
        throw new Error(`Provider config not found for id: ${id}`);
    }

    let service: IGenAIService;

    if (providerConfig.type === 'local') {
        throw new Error('Local GenAI Service (Ollama) not implemented yet');
        // service = new LocalGenAIService(); 
    } else if (providerConfig.type === 'vertex') {
         service = new VertexGenAIService(providerConfig);
    } else {
        throw new Error(`Unknown provider type: ${(providerConfig as any).type}`);
    }
    
    await service.init();
    this.genAIServices.set(id, service);
    return service;
  }
}
