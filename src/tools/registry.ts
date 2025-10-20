import { MCPTool, VectorProcessor } from '../types/mcp.js';
import { DirectoryStructureTool } from './directory-structure.js';
import { FilePathSuggestionTool } from './file-path-suggestions.js';
import {
  SearchNotesTool,
  GetNoteContentTool,
  CreateNoteTool,
  UpdateNoteTool,
  AppendToNoteTool
} from './note-operations.js';
import { GetLatestDailyNoteTool } from './daily-notes-tool.js';

export class ToolRegistry {
  private tools: Map<string, MCPTool> = new Map();

  constructor(vectorProcessor: VectorProcessor) {
    this.registerCoreTools(vectorProcessor);
    this.registerStructureTools();
    this.registerDailyNoteTools();
  }

  private registerCoreTools(vectorProcessor: VectorProcessor): void {
    const coreTools = [
      new SearchNotesTool(vectorProcessor),
      new GetNoteContentTool(),
      new CreateNoteTool(),
      new UpdateNoteTool(),
      new AppendToNoteTool(),
    ];

    coreTools.forEach(tool => {
      this.tools.set(tool.definition.name, tool);
    });
  }

  private registerStructureTools(): void {
    const structureTools = [
      new DirectoryStructureTool(),
      new FilePathSuggestionTool(),
    ];

    structureTools.forEach(tool => {
      this.tools.set(tool.definition.name, tool);
    });
  }

  private registerDailyNoteTools(): void {
    const dailyNoteTools = [
      new GetLatestDailyNoteTool(),
    ];

    dailyNoteTools.forEach(tool => {
      this.tools.set(tool.definition.name, tool);
    });
  }

  public getAllTools(): MCPTool[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): MCPTool | undefined {
    return this.tools.get(name);
  }

  public getToolDefinitions() {
    return Array.from(this.tools.values()).map(tool => tool.definition);
  }

  public hasToolDefinition(name: string): boolean {
    return this.tools.has(name);
  }
}