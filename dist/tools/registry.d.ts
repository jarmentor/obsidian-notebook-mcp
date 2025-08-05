import { MCPTool, VectorProcessor } from '../types/mcp.js';
export declare class ToolRegistry {
    private tools;
    constructor(vectorProcessor: VectorProcessor);
    private registerCoreTools;
    private registerStructureTools;
    getAllTools(): MCPTool[];
    getTool(name: string): MCPTool | undefined;
    getToolDefinitions(): import("../types/mcp.js").ToolDefinition[];
    hasToolDefinition(name: string): boolean;
}
//# sourceMappingURL=registry.d.ts.map