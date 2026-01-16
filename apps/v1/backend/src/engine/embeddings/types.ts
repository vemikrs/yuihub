export interface EmbeddingOutput {
  data: number[];
  dimensions: number;
}

export interface IEmbeddingService {
  init(): Promise<void>;
  embed(text: string): Promise<EmbeddingOutput>;
  getDimensions(): number; // Returns dimension size (e.g. 384 or 768)
}
