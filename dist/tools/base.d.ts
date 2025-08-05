import { MCPTool, ToolDefinition, ToolHandler, ParsedNote } from '../types/mcp.js';
export declare abstract class BaseTool implements MCPTool {
    abstract definition: ToolDefinition;
    abstract handler: ToolHandler;
    protected getNotebookPath(): string;
    protected readNote(filePath: string): Promise<ParsedNote>;
    protected writeNote(filePath: string, content: string, frontmatter?: Record<string, any>): Promise<void>;
    protected fileExists(filePath: string): Promise<boolean>;
    protected getMarkdownFilesRecursive(dir: string): Promise<string[]>;
    protected createResponse(data: any): {
        content: Array<{
            type: 'text';
            text: string;
        }>;
    };
}
//# sourceMappingURL=base.d.ts.map