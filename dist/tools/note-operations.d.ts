import { BaseTool } from './base.js';
import { ToolDefinition, ToolHandler, VectorProcessor } from '../types/mcp.js';
export declare class SearchNotesTool extends BaseTool {
    private vectorProcessor;
    constructor(vectorProcessor: VectorProcessor);
    definition: ToolDefinition;
    handler: ToolHandler;
}
export declare class GetNoteContentTool extends BaseTool {
    definition: ToolDefinition;
    handler: ToolHandler;
}
export declare class CreateNoteTool extends BaseTool {
    definition: ToolDefinition;
    handler: ToolHandler;
    private validateDirectory;
    private calculateStringSimilarity;
    private levenshteinDistance;
}
export declare class UpdateNoteTool extends BaseTool {
    definition: ToolDefinition;
    handler: ToolHandler;
}
export declare class AppendToNoteTool extends BaseTool {
    definition: ToolDefinition;
    handler: ToolHandler;
}
//# sourceMappingURL=note-operations.d.ts.map