import { pipeline } from '@xenova/transformers';
import { IEmbeddingService, EmbeddingOutput } from './types.js';

export class LocalEmbeddingService implements IEmbeddingService {
  private embedder: any = null;
  private modelName: string = 'Xenova/bge-m3';

  constructor(modelName?: string) {
    if (modelName) this.modelName = modelName;
  }

  async init(): Promise<void> {
    if (this.embedder) return;
    
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // NOTE: This downloads the model on first run.
        this.embedder = await pipeline('feature-extraction', this.modelName);
        return;
      } catch (error) {
        console.warn(`[Embedding] Init attempt ${attempt}/${maxRetries} failed:`, error);
        if (attempt === maxRetries) throw error;
        // Wait before retry (exponential backoff)
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }


  async embed(text: string): Promise<EmbeddingOutput> {
    if (!this.embedder) throw new Error('Embedder not initialized');
    
    // Pooling: mean, Normalize: true is standard for sentence similarity
    const output = await this.embedder(text, { pooling: 'mean', normalize: true });
    
    return {
      data: Array.from(output.data),
      dimensions: output.dims ? output.dims[1] : output.data.length
    };
  }

  getDimensions(): number {
    // Default for all-MiniLM-L6-v2 is 384. 
    // If using bge-m3, it is 1024.
    // Ideally this should be determined after init, but for now we hardcode or guess based on model name?
    // Or we fetch it from embedder config if possible.
    if (this.modelName.includes('MiniLM')) return 384;
    if (this.modelName.includes('bge-m3')) return 1024;
    return 384; // Fallback
  }
}
