"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPServer = void 0;
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const registry_js_1 = require("./tools/registry.js");
const logger = require('./logger');
class MCPServer {
    constructor(vectorProcessor) {
        this.toolRegistry = new registry_js_1.ToolRegistry(vectorProcessor);
        this.server = new index_js_1.Server({
            name: 'ai-note-searcher',
            version: '2.0.0',
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.setupHandlers();
    }
    setupHandlers() {
        this.server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
            return {
                tools: this.toolRegistry.getToolDefinitions(),
            };
        });
        this.server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                const tool = this.toolRegistry.getTool(name);
                if (!tool) {
                    throw new types_js_1.McpError(types_js_1.ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
                return await tool.handler(args);
            }
            catch (error) {
                logger.error(`Error handling tool ${name}:`, error);
                if (error instanceof types_js_1.McpError) {
                    throw error;
                }
                throw new types_js_1.McpError(types_js_1.ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
            }
        });
    }
    async start() {
        const transport = new stdio_js_1.StdioServerTransport();
        await this.server.connect(transport);
        logger.info('MCP server started');
    }
}
exports.MCPServer = MCPServer;
//# sourceMappingURL=mcpServer.js.map