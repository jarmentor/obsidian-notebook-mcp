declare class QdrantClientWrapper {
  constructor(url?: string);
  connect(): Promise<boolean>;
  ensureCollection(collectionName: string, vectorSize: number): Promise<void>;
  upsertPoints(collectionName: string, points: any[]): Promise<void>;
  searchPoints(collectionName: string, vector: number[], limit?: number, filter?: any): Promise<any[]>;
  deletePointsByFilter(collectionName: string, filter: any): Promise<void>;
  collectionExists(collectionName: string): Promise<boolean>;
}

export = QdrantClientWrapper;