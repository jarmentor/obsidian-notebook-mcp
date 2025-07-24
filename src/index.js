const QdrantClient = require('./qdrantClient');
const VectorProcessor = require('./vectorProcessor');
const FileWatcher = require('./fileWatcher');
const MCPServer = require('./mcpServer');
const logger = require('./logger');
const fs = require('fs').promises;

class AINotesearcher {
  constructor() {
    this.qdrantClient = null;
    this.vectorProcessor = null;
    this.fileWatcher = null;
    this.mcpServer = null;
  }

  async initialize() {
    try {
      logger.info('Initializing AI Note Searcher...');

      await this.ensureLogsDirectory();

      this.qdrantClient = new QdrantClient();
      await this.qdrantClient.connect();

      this.vectorProcessor = new VectorProcessor(this.qdrantClient);
      await this.vectorProcessor.initialize();

      const notebookPath = process.env.NOTEBOOK_PATH || '/app/notebook';
      this.fileWatcher = new FileWatcher(notebookPath, this.vectorProcessor);

      this.mcpServer = new MCPServer(this.vectorProcessor);

      logger.info('AI Note Searcher initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize AI Note Searcher:', error);
      throw error;
    }
  }

  async ensureLogsDirectory() {
    try {
      await fs.mkdir('logs', { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  async start() {
    try {
      await this.initialize();

      await this.fileWatcher.start();

      await this.mcpServer.start();

      logger.info('AI Note Searcher is running');

      process.on('SIGINT', () => this.shutdown());
      process.on('SIGTERM', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start AI Note Searcher:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('Shutting down AI Note Searcher...');
    
    if (this.fileWatcher) {
      this.fileWatcher.stop();
    }

    process.exit(0);
  }
}

if (require.main === module) {
  const app = new AINotesearcher();
  app.start();
}

module.exports = AINotesearcher;