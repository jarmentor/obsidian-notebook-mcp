const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const logger = require('./logger');

class MCPServer {
  constructor(vectorProcessor) {
    this.vectorProcessor = vectorProcessor;
    this.server = new Server(
      {
        name: 'ai-note-searcher',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'search_notes',
            description: 'Search through Obsidian notes using semantic similarity',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'The search query to find relevant notes',
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of results to return (default: 10)',
                  default: 10,
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'get_note_content',
            description: 'Get the full content of a specific note by file path',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'The file path of the note to retrieve',
                },
              },
              required: ['file_path'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_notes':
            return await this.handleSearchNotes(args);
          case 'get_note_content':
            return await this.handleGetNoteContent(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        logger.error(`Error handling tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async handleSearchNotes(args) {
    const { query, limit = 10 } = args;
    
    if (!query) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Query parameter is required'
      );
    }

    try {
      const results = await this.vectorProcessor.search(query, limit);
    
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query,
              results: results.map(result => ({
                file_path: result.file_path,
                title: result.title,
                score: result.score,
                search_type: result.searchType || 'semantic',
                search_query_used: result.searchQuery,
                text_preview: result.text.substring(0, 200) + '...',
                tags: result.tags,
                chunk_index: result.chunk_index,
              })),
              total_results: results.length,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Search failed: ${error.message}`
      );
    }
  }

  async handleGetNoteContent(args) {
    const { file_path } = args;
    
    if (!file_path) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_path parameter is required'
      );
    }

    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const fullPath = path.join(process.env.NOTEBOOK_PATH || '/app/notebook', file_path);
      const content = await fs.readFile(fullPath, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file_path,
              content,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Could not read file: ${error.message}`
      );
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP server started');
  }
}

module.exports = MCPServer;