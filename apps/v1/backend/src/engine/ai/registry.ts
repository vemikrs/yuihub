import { AppConfig } from '../../config/schema.js';
import { IEmbeddingService } from '../embeddings/types.js';
import { IGenAIService } from './types.js';
import { LocalEmbeddingService } from '../embeddings/local-service.js';
// We will import Vertex services later

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
      // Stub for now
      throw new Error('Vertex Embedding Service not implemented yet');
    } else {
      throw new Error(`Unknown provider type: ${(providerConfig as any).type}`);
    }

    await service.init();
    this.embeddingServices.set(id, service);
    return service;
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
        // Stub
         throw new Error('Vertex GenAI Service not implemented yet');
         // service = new VertexGenAIService(providerConfig);
    } else {
        throw new Error(`Unknown provider type: ${(providerConfig as any).type}`);
    }
    
    await service.init();
    this.genAIServices.set(id, service);
    return service;
  }
}
