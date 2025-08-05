import { BaseTool } from './base.js';
import { ToolDefinition, ToolHandler } from '../types/mcp.js';
export declare class FilePathSuggestionTool extends BaseTool {
    definition: ToolDefinition;
    handler: ToolHandler;
    private analyzeExistingStructure;
    private generatePathSuggestions;
    private generateDailyNoteSuggestions;
    private generateProjectSuggestions;
    private generateMeetingSuggestions;
    private generateTechnicalSuggestions;
    private generatePersonalSuggestions;
}
//# sourceMappingURL=file-path-suggestions.d.ts.map