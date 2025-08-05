import QdrantClient = require('./qdrantClient.js');
import VectorProcessor = require('./vectorProcessor.js');
import FileWatcher = require('./fileWatcher.js');
import { MCPServer } from './mcpServer.js';

const logger = require('./logger');

class AINotesearcher {
  private qdrantClient: any;
  private vectorProcessor: any;
  private fileWatcher: any;
  private mcpServer?: MCPServer;

  constructor() {
    this.qdrantClient = null;
    this.vectorProcessor = null;
    this.fileWatcher = null;
  }

  async initialize(): Promise<void> {
    try {
      logger.info('Initializing AI Note Searcher...');

      // Initialize Qdrant client
      const qdrantUrl = process.env.QDRANT_URL || 'http://qdrant:6333';
      this.qdrantClient = new QdrantClient(qdrantUrl);
      await this.qdrantClient.connect();
      logger.info('Connected to Qdrant');

      // Initialize vector processor
      this.vectorProcessor = new VectorProcessor(this.qdrantClient);
      await this.vectorProcessor.initialize();
      logger.info('Vector processor initialized');

      // Initialize file watcher if not running as MCP server
      if (!process.env.MCP_SERVER) {
        this.fileWatcher = new FileWatcher(this.vectorProcessor);
        this.fileWatcher.start();
        logger.info('File watcher started');
      }

      logger.info('AI Note Searcher initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize:', error);
      throw error;
    }
  }

  async startMCPServer(): Promise<void> {
    if (!this.vectorProcessor) {
      throw new Error('Vector processor not initialized. Call initialize() first.');
    }

    this.mcpServer = new MCPServer(this.vectorProcessor);
    await this.mcpServer.start();
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down AI Note Searcher...');
    
    if (this.fileWatcher) {
      this.fileWatcher.stop();
    }
    
    if (this.qdrantClient) {
      // Qdrant client cleanup if needed
    }
    
    logger.info('Shutdown complete');
  }
}

// Main execution
async function main(): Promise<void> {
  const searcher = new AINotesearcher();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    await searcher.shutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await searcher.shutdown();
    process.exit(0);
  });

  try {
    await searcher.initialize();
    
    // If running as MCP server, start it
    if (process.env.MCP_SERVER) {
      await searcher.startMCPServer();
    } else {
      // Keep the process running for file watching
      logger.info('AI Note Searcher is running. Press Ctrl+C to stop.');
      
      // Keep process alive
      setInterval(() => {
        // Periodic health check or maintenance tasks could go here
      }, 60000); // Check every minute
    }
  } catch (error) {
    logger.error('Failed to start AI Note Searcher:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { AINotesearcher };