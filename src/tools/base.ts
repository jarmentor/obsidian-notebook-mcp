import { promises as fs } from 'fs';
import * as path from 'path';
const matter = require('gray-matter');
import { MCPTool, ToolDefinition, ToolHandler, ParsedNote } from '../types/mcp.js';

export abstract class BaseTool implements MCPTool {
  abstract definition: ToolDefinition;
  abstract handler: ToolHandler;

  protected getNotebookPath(): string {
    return process.env.NOTEBOOK_PATH || '/app/notebook';
  }

  protected async readNote(filePath: string): Promise<ParsedNote> {
    const fullPath = path.join(this.getNotebookPath(), filePath);
    const content = await fs.readFile(fullPath, 'utf8');
    return matter(content);
  }

  protected async writeNote(filePath: string, content: string, frontmatter?: Record<string, any>): Promise<void> {
    const fullPath = path.join(this.getNotebookPath(), filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    
    let fileContent: string;
    if (frontmatter && Object.keys(frontmatter).length > 0) {
      fileContent = matter.stringify(content, frontmatter);
    } else {
      fileContent = content;
    }
    
    await fs.writeFile(fullPath, fileContent, 'utf8');
  }

  protected async fileExists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.getNotebookPath(), filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  protected async getMarkdownFilesRecursive(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.getMarkdownFilesRecursive(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  protected createResponse(data: any): { content: Array<{ type: 'text'; text: string }> } {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  }
}