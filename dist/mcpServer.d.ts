import { VectorProcessor } from './types/mcp.js';
export declare class MCPServer {
    private server;
    private toolRegistry;
    constructor(vectorProcessor: VectorProcessor);
    private setupHandlers;
    start(): Promise<void>;
}
//# sourceMappingURL=mcpServer.d.ts.map