export interface EmbeddingOutput {
  data: number[];
  dimensions: number;
}

export interface IEmbeddingService {
  init(): Promise<void>;
  embed(text: string): Promise<EmbeddingOutput>;
}
