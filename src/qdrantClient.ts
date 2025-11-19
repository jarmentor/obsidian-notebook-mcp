import { QdrantClient } from '@qdrant/js-client-rest';
import logger from './logger';

class QdrantClientWrapper {
  private client: QdrantClient;
  private url: string;

  constructor(url: string = process.env.QDRANT_URL || 'http://localhost:6333') {
    this.client = new QdrantClient({ url });
    this.url = url;
  }

  async connect(): Promise<boolean> {
    try {
      await this.client.getCollections();
      logger.info(`Connected to Qdrant at ${this.url}`);
      return true;
    } catch (error) {
      logger.error(`Failed to connect to Qdrant at ${this.url}:`, error);
      throw error;
    }
  }

  async createCollection(name: string, config: any): Promise<any> {
    return await this.client.createCollection(name, config);
  }

  async getCollection(name: string): Promise<any> {
    return await this.client.getCollection(name);
  }

  async upsert(collectionName: string, data: any): Promise<any> {
    return await this.client.upsert(collectionName, data);
  }

  async search(collectionName: string, searchParams: any): Promise<any> {
    return await this.client.search(collectionName, searchParams);
  }

  async delete(collectionName: string, filter: any): Promise<any> {
    return await this.client.delete(collectionName, filter);
  }

  async getCollections(): Promise<any> {
    return await this.client.getCollections();
  }

  // Expose the underlying client for advanced operations
  get rawClient(): QdrantClient {
    return this.client;
  }
}

export default QdrantClientWrapper;
