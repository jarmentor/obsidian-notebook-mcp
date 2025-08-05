import { promises as fs } from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import { ToolDefinition, ToolHandler, DirectoryStructure } from '../types/mcp.js';

export class DirectoryStructureTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'get_directory_structure',
    description: 'Get the current directory structure of the notebook to understand existing organization',
    inputSchema: {
      type: 'object',
      properties: {
        max_depth: {
          type: 'number',
          description: 'Maximum depth to traverse (default: 3)',
          default: 3,
        },
        include_files: {
          type: 'boolean',
          description: 'Include file names in structure (default: false)',
          default: false,
        },
        folder_filter: {
          type: 'string',
          description: 'Only show structure under specific folder (e.g., "daily", "projects")',
        },
      },
    },
  };

  handler: ToolHandler = async (args) => {
    const { max_depth = 3, include_files = false, folder_filter } = args;
    
    const basePath = this.getNotebookPath();
    const startPath = folder_filter ? path.join(basePath, folder_filter) : basePath;
    
    try {
      const structure = await this.buildDirectoryStructure(startPath, basePath, max_depth, include_files, 0);
      
      return this.createResponse({
        notebook_path: basePath,
        structure,
        scanned_from: folder_filter || 'root',
        max_depth,
        include_files,
        message: 'Directory structure retrieved successfully'
      });
    } catch (error: any) {
      return this.createResponse({
        error: `Could not read directory structure: ${error.message}`,
        notebook_path: basePath,
        folder_filter
      });
    }
  };

  private async buildDirectoryStructure(
    currentPath: string,
    basePath: string,
    maxDepth: number,
    includeFiles: boolean,
    currentDepth: number
  ): Promise<DirectoryStructure> {
    if (currentDepth >= maxDepth) {
      return {};
    }

    const structure: DirectoryStructure = {};
    
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });
      
      for (const entry of entries) {
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        
        const fullPath = path.join(currentPath, entry.name);
        
        if (entry.isDirectory()) {
          structure[entry.name] = await this.buildDirectoryStructure(
            fullPath,
            basePath,
            maxDepth,
            includeFiles,
            currentDepth + 1
          );
        } else if (entry.isFile() && includeFiles) {
          if (!structure['_files']) {
            structure['_files'] = [];
          }
          (structure['_files'] as string[]).push(entry.name);
        }
      }
    } catch (error) {
      // If we can't read a directory, just mark it as inaccessible
      structure['_error'] = ['Access denied or directory not found'];
    }
    
    return structure;
  }
}