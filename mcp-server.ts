#!/usr/bin/env node

// Change to the script's directory to ensure proper module resolution
process.chdir(__dirname);

import QdrantClient = require('./src/qdrantClient.js');
import VectorProcessor = require('./src/vectorProcessor.js');
import { MCPServer } from './src/mcpServer.js';

const logger = require('./src/logger');

async function startMCPServer(): Promise<void> {
  try {
    // Use environment variables or defaults for local connection
    const qdrantUrl = process.env.QDRANT_URL || 'http://127.0.0.1:6333';
    const ollamaUrl = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
    const notebookPath = process.env.NOTEBOOK_PATH || '/Volumes/Development/Notebook';

    console.error(`Starting MCP server with Qdrant: ${qdrantUrl}, Ollama: ${ollamaUrl}`);

    const qdrantClient = new QdrantClient(qdrantUrl);
    await qdrantClient.connect();

    const vectorProcessor = new VectorProcessor(qdrantClient);
    // Override Ollama URL for local connection
    vectorProcessor.ollamaUrl = ollamaUrl;
    
    await vectorProcessor.initialize();

    const mcpServer = new MCPServer(vectorProcessor);
    await mcpServer.start();

    console.error('MCP Server started successfully');
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

startMCPServer();