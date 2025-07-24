const { QdrantClient } = require('@qdrant/js-client-rest');
const logger = require('./logger');

class QdrantClientWrapper {
  constructor(url = process.env.QDRANT_URL || 'http://localhost:6333') {
    this.client = new QdrantClient({ url });
    this.url = url;
  }

  async connect() {
    try {
      await this.client.getCollections();
      logger.info(`Connected to Qdrant at ${this.url}`);
      return true;
    } catch (error) {
      logger.error(`Failed to connect to Qdrant at ${this.url}:`, error);
      throw error;
    }
  }

  async createCollection(name, config) {
    return await this.client.createCollection(name, config);
  }

  async getCollection(name) {
    return await this.client.getCollection(name);
  }

  async upsert(collectionName, data) {
    return await this.client.upsert(collectionName, data);
  }

  async search(collectionName, searchParams) {
    return await this.client.search(collectionName, searchParams);
  }

  async delete(collectionName, filter) {
    return await this.client.delete(collectionName, filter);
  }

  async getCollections() {
    return await this.client.getCollections();
  }
}

module.exports = QdrantClientWrapper;