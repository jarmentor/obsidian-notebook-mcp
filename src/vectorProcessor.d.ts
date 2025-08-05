declare class VectorProcessor {
  constructor(qdrantClient: any);
  ollamaUrl: string;
  initialize(): Promise<void>;
  search(query: string, limit?: number): Promise<any[]>;
  processFile(filePath: string): Promise<void>;
  deleteFile(filePath: string): Promise<void>;
}

export = VectorProcessor;