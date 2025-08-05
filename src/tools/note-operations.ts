import * as path from 'path';
import { BaseTool } from './base.js';
import { ToolDefinition, ToolHandler, VectorProcessor } from '../types/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export class SearchNotesTool extends BaseTool {
  constructor(private vectorProcessor: VectorProcessor) {
    super();
  }

  definition: ToolDefinition = {
    name: 'search_notes',
    description: 'Search through Obsidian notes using semantic similarity',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to find relevant notes',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
          default: 10,
        },
      },
      required: ['query'],
    },
  };

  handler: ToolHandler = async (args) => {
    const { query, limit = 10 } = args;
    
    if (!query) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Query parameter is required'
      );
    }

    try {
      const results = await this.vectorProcessor.search(query, limit);
    
      return this.createResponse({
        query,
        results: results.map(result => ({
          file_path: result.file_path,
          title: result.title,
          score: result.score,
          search_type: result.searchType || 'semantic',
          search_query_used: result.searchQuery,
          text_preview: result.text.substring(0, 200) + '...',
          tags: result.tags,
          chunk_index: result.chunk_index,
        })),
        total_results: results.length,
      });
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InternalError,
        `Search failed: ${error.message}`
      );
    }
  };
}

export class GetNoteContentTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'get_note_content',
    description: 'Get the full content of a specific note by file path',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The file path of the note to retrieve',
        },
      },
      required: ['file_path'],
    },
  };

  handler: ToolHandler = async (args) => {
    const { file_path } = args;
    
    if (!file_path) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_path parameter is required'
      );
    }

    try {
      const parsed = await this.readNote(file_path);
      
      return this.createResponse({
        file_path,
        content: parsed.content,
        frontmatter: parsed.data,
      });
    } catch (error: any) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Could not read file: ${error.message}`
      );
    }
  };
}

export class CreateNoteTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'create_note',
    description: 'Create a new Obsidian note with optional frontmatter (validates against existing directory structure)',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path for new file (e.g., "folder/note.md"). Use get_directory_structure and suggest_file_path tools first for guidance.',
        },
        content: {
          type: 'string',
          description: 'Markdown content of the note',
        },
        frontmatter: {
          type: 'object',
          description: 'Optional YAML frontmatter as key-value pairs',
        },
      },
      required: ['file_path', 'content'],
    },
  };

  handler: ToolHandler = async (args) => {
    const { file_path, content, frontmatter } = args;
    
    if (!file_path || !content) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_path and content parameters are required'
      );
    }

    try {
      // Ensure file has .md extension
      const finalPath = file_path.endsWith('.md') ? file_path : file_path + '.md';
      
      // Check if file already exists
      if (await this.fileExists(finalPath)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `File already exists: ${finalPath}`
        );
      }
      
      // Validate directory structure
      const directoryValidation = await this.validateDirectory(finalPath);
      
      await this.writeNote(finalPath, content, frontmatter);
      
      return this.createResponse({
        success: true,
        file_path: finalPath,
        directory_validation: directoryValidation,
        message: 'Note created successfully'
      });
    } catch (error: any) {
      if (error instanceof McpError) throw error;
      
      throw new McpError(
        ErrorCode.InternalError,
        `Could not create file: ${error.message}`
      );
    }
  };

  private async validateDirectory(filePath: string): Promise<{ 
    directory_exists: boolean; 
    similar_directories: string[]; 
    suggestion?: string 
  }> {
    const dir = path.dirname(filePath);
    const basePath = this.getNotebookPath();
    const fullDirPath = path.join(basePath, dir);
    
    try {
      await require('fs').promises.access(fullDirPath);
      return {
        directory_exists: true,
        similar_directories: [],
      };
    } catch {
      // Directory doesn't exist, find similar ones
      const parentDir = path.dirname(fullDirPath);
      const targetDirName = path.basename(dir).toLowerCase();
      
      try {
        const entries = await require('fs').promises.readdir(parentDir, { withFileTypes: true });
        const similarDirs = entries
          .filter((entry: any) => entry.isDirectory())
          .map((entry: any) => entry.name)
          .filter((name: string) => {
            const similarity = this.calculateStringSimilarity(name.toLowerCase(), targetDirName);
            return similarity > 0.6; // 60% similarity threshold
          });

        return {
          directory_exists: false,
          similar_directories: similarDirs,
          suggestion: similarDirs.length > 0 
            ? `Consider using existing directory: ${similarDirs[0]}` 
            : 'Directory will be created'
        };
      } catch {
        return {
          directory_exists: false,
          similar_directories: [],
          suggestion: 'Directory will be created'
        };
      }
    }
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}

export class UpdateNoteTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'update_note',
    description: 'Replace the entire content of an existing note',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The file path of the note to update',
        },
        content: {
          type: 'string',
          description: 'New markdown content to replace existing content',
        },
        frontmatter: {
          type: 'object',
          description: 'Optional YAML frontmatter as key-value pairs',
        },
      },
      required: ['file_path', 'content'],
    },
  };

  handler: ToolHandler = async (args) => {
    const { file_path, content, frontmatter } = args;
    
    if (!file_path || !content) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_path and content parameters are required'
      );
    }

    try {
      // Check if file exists
      if (!(await this.fileExists(file_path))) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `File does not exist: ${file_path}`
        );
      }
      
      // If no frontmatter provided, preserve existing frontmatter
      let finalFrontmatter = frontmatter;
      if (!frontmatter || Object.keys(frontmatter).length === 0) {
        const existing = await this.readNote(file_path);
        finalFrontmatter = existing.data;
      }
      
      await this.writeNote(file_path, content, finalFrontmatter);
      
      return this.createResponse({
        success: true,
        file_path,
        message: 'Note updated successfully'
      });
    } catch (error: any) {
      if (error instanceof McpError) throw error;
      
      throw new McpError(
        ErrorCode.InternalError,
        `Could not update file: ${error.message}`
      );
    }
  };
}

export class AppendToNoteTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'append_to_note',
    description: 'Add content to the end of an existing note',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'The file path of the note to append to',
        },
        content: {
          type: 'string',
          description: 'Content to append to the note',
        },
      },
      required: ['file_path', 'content'],
    },
  };

  handler: ToolHandler = async (args) => {
    const { file_path, content } = args;
    
    if (!file_path || !content) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_path and content parameters are required'
      );
    }

    try {
      // Check if file exists
      if (!(await this.fileExists(file_path))) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `File does not exist: ${file_path}`
        );
      }
      
      // Read existing content and append
      const existing = await this.readNote(file_path);
      const newContent = existing.content + '\n\n' + content;
      
      await this.writeNote(file_path, newContent, existing.data);
      
      return this.createResponse({
        success: true,
        file_path,
        message: 'Content appended successfully'
      });
    } catch (error: any) {
      if (error instanceof McpError) throw error;
      
      throw new McpError(
        ErrorCode.InternalError,
        `Could not append to file: ${error.message}`
      );
    }
  };
}