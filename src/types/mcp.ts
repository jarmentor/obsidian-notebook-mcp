import { CallToolRequestSchema, ListToolsRequestSchema, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export interface ToolHandler {
  (args: any): Promise<ToolResponse>;
}

export interface ToolResponse extends CallToolResult {}

export interface MCPTool {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export interface VectorProcessor {
  search(query: string, limit?: number): Promise<any[]>;
}

export interface ParsedNote {
  content: string;
  data: Record<string, any>;
}

export interface DirectoryStructure {
  [key: string]: DirectoryStructure | string[];
}

export interface FilePathSuggestion {
  suggested_path: string;
  confidence: number;
  reason: string;
  existing_similar?: string[];
}