const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} = require('@modelcontextprotocol/sdk/types.js');
const logger = require('./logger');

class MCPServer {
  constructor(vectorProcessor) {
    this.vectorProcessor = vectorProcessor;
    this.server = new Server(
      {
        name: 'ai-note-searcher',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.setupHandlers();
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
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
          },
          {
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
          },
          {
            name: 'create_note',
            description: 'Create a new Obsidian note with optional frontmatter',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Path for new file (e.g., "folder/note.md")',
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
          },
          {
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
          },
          {
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
          },
          {
            name: 'fix_daily_note_ids',
            description: 'Fix inconsistent frontmatter IDs in daily notes to match filenames',
            inputSchema: {
              type: 'object',
              properties: {
                dry_run: {
                  type: 'boolean',
                  description: 'Preview changes without applying them (default: true)',
                  default: true,
                },
              },
            },
          },
          {
            name: 'suggest_file_moves',
            description: 'Analyze files and suggest better folder organization based on content and tags',
            inputSchema: {
              type: 'object',
              properties: {
                folder_path: {
                  type: 'string',
                  description: 'Specific folder to analyze (default: analyze entire notebook)',
                },
              },
            },
          },
          {
            name: 'standardize_tags',
            description: 'Clean up tag formatting and suggest missing tags based on content',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Specific file to standardize (default: analyze all files)',
                },
                dry_run: {
                  type: 'boolean',
                  description: 'Preview changes without applying them (default: true)',
                  default: true,
                },
              },
            },
          },
          {
            name: 'validate_frontmatter',
            description: 'Check frontmatter consistency and identify missing required fields',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Specific file to validate (default: validate all files)',
                },
              },
            },
          },
          {
            name: 'organize_by_type',
            description: 'Move files to appropriate folders based on content analysis',
            inputSchema: {
              type: 'object',
              properties: {
                file_path: {
                  type: 'string',
                  description: 'Specific file to organize (default: organize misplaced files)',
                },
                dry_run: {
                  type: 'boolean',
                  description: 'Preview moves without executing them (default: true)',
                  default: true,
                },
              },
            },
          },
          {
            name: 'find_project_content',
            description: 'Scan daily notes for project-related content that could be consolidated',
            inputSchema: {
              type: 'object',
              properties: {
                project_name: {
                  type: 'string',
                  description: 'Specific project to search for (e.g., "greene ortho", "epic fcu")',
                },
                date_range_days: {
                  type: 'number',
                  description: 'Number of recent days to analyze (default: 30)',
                  default: 30,
                },
              },
            },
          },
          {
            name: 'suggest_consolidation',
            description: 'Analyze project content in daily notes and suggest consolidation opportunities',
            inputSchema: {
              type: 'object',
              properties: {
                project_name: {
                  type: 'string',
                  description: 'Specific project to analyze (default: analyze all projects)',
                },
                min_mentions: {
                  type: 'number',
                  description: 'Minimum mentions to suggest consolidation (default: 2)',
                  default: 2,
                },
              },
            },
          },
          {
            name: 'consolidate_to_project',
            description: 'Move daily note content to project notes with proper organization and backlinks',
            inputSchema: {
              type: 'object',
              properties: {
                project_name: {
                  type: 'string',
                  description: 'Target project for consolidation (e.g., "greene ortho")',
                },
                content_items: {
                  type: 'array',
                  description: 'Array of content items to consolidate',
                  items: {
                    type: 'object',
                    properties: {
                      daily_file: { type: 'string' },
                      content: { type: 'string' },
                      section_type: { type: 'string' }
                    }
                  }
                },
                dry_run: {
                  type: 'boolean',
                  description: 'Preview consolidation without making changes (default: true)',
                  default: true,
                },
              },
              required: ['project_name', 'content_items'],
            },
          },
          {
            name: 'extract_meetings',
            description: 'Extract meeting content from daily notes and add to project notes',
            inputSchema: {
              type: 'object',
              properties: {
                project_name: {
                  type: 'string',
                  description: 'Project to extract meetings for',
                },
                date_range_days: {
                  type: 'number',
                  description: 'Days to look back for meetings (default: 30)',
                  default: 30,
                },
                dry_run: {
                  type: 'boolean',
                  description: 'Preview extraction without making changes (default: true)',
                  default: true,
                },
              },
              required: ['project_name'],
            },
          },
          {
            name: 'generate_weekly_summary',
            description: 'Generate intelligent weekly summary from daily notes with insights and analytics',
            inputSchema: {
              type: 'object',
              properties: {
                week_ending: {
                  type: 'string',
                  description: 'End date for the week (YYYY-MM-DD format, default: latest Sunday)',
                },
                include_metrics: {
                  type: 'boolean',
                  description: 'Include productivity metrics and analytics (default: true)',
                  default: true,
                },
                create_note: {
                  type: 'boolean',
                  description: 'Create a weekly summary note file (default: false)',
                  default: false,
                },
              },
            },
          },
          {
            name: 'cross_reference_builder',
            description: 'Analyze content and build intelligent cross-references between related notes',
            inputSchema: {
              type: 'object',
              properties: {
                scope: {
                  type: 'string',
                  description: 'Scope of analysis: "all", "projects", "daily", or specific folder',
                  default: 'all',
                },
                min_confidence: {
                  type: 'number',
                  description: 'Minimum confidence score for link suggestions (0.0-1.0, default: 0.7)',
                  default: 0.7,
                },
                auto_link: {
                  type: 'boolean',
                  description: 'Automatically create high-confidence links (default: false)',
                  default: false,
                },
              },
            },
          },
          {
            name: 'time_travel_assistant',
            description: 'Explore historical context and patterns in your notebook',
            inputSchema: {
              type: 'object',
              properties: {
                mode: {
                  type: 'string',
                  description: 'Query mode: "what_was_i_doing", "compare_periods", "find_patterns", "anniversary"',
                  default: 'what_was_i_doing',
                },
                days_back: {
                  type: 'number',
                  description: 'Number of days to look back (default: 7)',
                  default: 7,
                },
                project_filter: {
                  type: 'string',
                  description: 'Filter results to specific project or client',
                },
                reference_date: {
                  type: 'string',
                  description: 'Reference date for comparison (YYYY-MM-DD, default: today)',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'search_notes':
            return await this.handleSearchNotes(args);
          case 'get_note_content':
            return await this.handleGetNoteContent(args);
          case 'create_note':
            return await this.handleCreateNote(args);
          case 'update_note':
            return await this.handleUpdateNote(args);
          case 'append_to_note':
            return await this.handleAppendToNote(args);
          case 'fix_daily_note_ids':
            return await this.handleFixDailyNoteIds(args);
          case 'suggest_file_moves':
            return await this.handleSuggestFileMoves(args);
          case 'standardize_tags':
            return await this.handleStandardizeTags(args);
          case 'validate_frontmatter':
            return await this.handleValidateFrontmatter(args);
          case 'organize_by_type':
            return await this.handleOrganizeByType(args);
          case 'find_project_content':
            return await this.handleFindProjectContent(args);
          case 'suggest_consolidation':
            return await this.handleSuggestConsolidation(args);
          case 'consolidate_to_project':
            return await this.handleConsolidateToProject(args);
          case 'extract_meetings':
            return await this.handleExtractMeetings(args);
          case 'generate_weekly_summary':
            return await this.handleGenerateWeeklySummary(args);
          case 'cross_reference_builder':
            return await this.handleCrossReferenceBuilder(args);
          case 'time_travel_assistant':
            return await this.handleTimeTravelAssistant(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        logger.error(`Error handling tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async handleSearchNotes(args) {
    const { query, limit = 10 } = args;
    
    if (!query) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Query parameter is required'
      );
    }

    try {
      const results = await this.vectorProcessor.search(query, limit);
    
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
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
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Search failed: ${error.message}`
      );
    }
  }

  async handleGetNoteContent(args) {
    const { file_path } = args;
    
    if (!file_path) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_path parameter is required'
      );
    }

    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const fullPath = path.join(process.env.NOTEBOOK_PATH || '/app/notebook', file_path);
      const content = await fs.readFile(fullPath, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              file_path,
              content,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Could not read file: ${error.message}`
      );
    }
  }

  async handleCreateNote(args) {
    const { file_path, content, frontmatter } = args;
    
    if (!file_path || !content) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_path and content parameters are required'
      );
    }

    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const fullPath = path.join(process.env.NOTEBOOK_PATH || '/app/notebook', file_path);
      
      // Ensure file has .md extension
      const finalPath = file_path.endsWith('.md') ? fullPath : fullPath + '.md';
      
      // Check if file already exists
      try {
        await fs.access(finalPath);
        throw new McpError(
          ErrorCode.InvalidParams,
          `File already exists: ${file_path}`
        );
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      
      // Create directory if needed
      await fs.mkdir(path.dirname(finalPath), { recursive: true });
      
      // Build file content with frontmatter
      let fileContent;
      if (frontmatter && Object.keys(frontmatter).length > 0) {
        fileContent = matter.stringify(content, frontmatter);
      } else {
        fileContent = content;
      }
      
      await fs.writeFile(finalPath, fileContent, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              file_path: file_path.endsWith('.md') ? file_path : file_path + '.md',
              message: 'Note created successfully'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not create file: ${error.message}`
      );
    }
  }

  async handleUpdateNote(args) {
    const { file_path, content, frontmatter } = args;
    
    if (!file_path || !content) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_path and content parameters are required'
      );
    }

    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const fullPath = path.join(process.env.NOTEBOOK_PATH || '/app/notebook', file_path);
      
      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch (error) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `File does not exist: ${file_path}`
        );
      }
      
      // Build file content with frontmatter
      let fileContent;
      if (frontmatter && Object.keys(frontmatter).length > 0) {
        fileContent = matter.stringify(content, frontmatter);
      } else {
        // If no frontmatter provided, preserve existing frontmatter
        const existingContent = await fs.readFile(fullPath, 'utf8');
        const parsed = matter(existingContent);
        fileContent = matter.stringify(content, parsed.data);
      }
      
      await fs.writeFile(fullPath, fileContent, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              file_path,
              message: 'Note updated successfully'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not update file: ${error.message}`
      );
    }
  }

  async handleAppendToNote(args) {
    const { file_path, content } = args;
    
    if (!file_path || !content) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'file_path and content parameters are required'
      );
    }

    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const fullPath = path.join(process.env.NOTEBOOK_PATH || '/app/notebook', file_path);
      
      // Check if file exists
      try {
        await fs.access(fullPath);
      } catch (error) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `File does not exist: ${file_path}`
        );
      }
      
      // Read existing content and append
      const existingContent = await fs.readFile(fullPath, 'utf8');
      const newContent = existingContent + '\n\n' + content;
      
      await fs.writeFile(fullPath, newContent, 'utf8');
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              file_path,
              message: 'Content appended successfully'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not append to file: ${error.message}`
      );
    }
  }

  async handleFixDailyNoteIds(args) {
    const { dry_run = true } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const dailyNotesPath = path.join(process.env.NOTEBOOK_PATH || '/app/notebook', 'daily');
      const files = await fs.readdir(dailyNotesPath);
      const issues = [];
      const fixes = [];
      
      for (const filename of files) {
        if (!filename.endsWith('.md')) continue;
        
        const filePath = path.join(dailyNotesPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = matter(content);
        
        // Extract expected ID from filename (YYYY-MM-DD format)
        const expectedId = filename.replace('.md', '');
        const currentId = parsed.data.id;
        
        if (currentId !== expectedId) {
          issues.push({
            file: filename,
            current_id: currentId,
            expected_id: expectedId,
            issue: 'ID mismatch'
          });
          
          if (!dry_run) {
            // Fix the frontmatter
            parsed.data.id = expectedId;
            const newContent = matter.stringify(parsed.content, parsed.data);
            await fs.writeFile(filePath, newContent, 'utf8');
            fixes.push(filename);
          }
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              dry_run,
              total_daily_notes: files.filter(f => f.endsWith('.md')).length,
              issues_found: issues.length,
              issues,
              fixes_applied: dry_run ? 0 : fixes.length,
              message: dry_run ? 'Preview mode - no changes made' : `Fixed ${fixes.length} daily note IDs`
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not fix daily note IDs: ${error.message}`
      );
    }
  }

  async handleSuggestFileMoves(args) {
    const { folder_path } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      const searchPath = folder_path ? path.join(basePath, folder_path) : basePath;
      
      const suggestions = [];
      
      // Get all markdown files in search path
      const files = await this.getMarkdownFilesRecursive(searchPath);
      
      for (const filePath of files) {
        const relativePath = path.relative(basePath, filePath);
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = matter(content);
        
        // Analyze file for proper placement
        const suggestion = this.analyzeFileForPlacement(relativePath, parsed, content);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              total_files_analyzed: files.length,
              suggestions_count: suggestions.length,
              suggestions,
              message: suggestions.length > 0 ? 'Found files that could be better organized' : 'All files appear to be well organized'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not analyze file organization: ${error.message}`
      );
    }
  }

  async handleStandardizeTags(args) {
    const { file_path, dry_run = true } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      const files = file_path ? [path.join(basePath, file_path)] : await this.getMarkdownFilesRecursive(basePath);
      
      const tagIssues = [];
      const fixes = [];
      
      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = matter(content);
        const relativePath = path.relative(basePath, filePath);
        
        const issues = this.analyzeTagsForStandardization(relativePath, parsed);
        if (issues.length > 0) {
          tagIssues.push({
            file: relativePath,
            issues
          });
          
          if (!dry_run) {
            // Apply tag standardizations
            const standardizedTags = this.standardizeTagArray(parsed.data.tags || []);
            parsed.data.tags = standardizedTags;
            const newContent = matter.stringify(parsed.content, parsed.data);
            await fs.writeFile(filePath, newContent, 'utf8');
            fixes.push(relativePath);
          }
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              dry_run,
              files_analyzed: files.length,
              files_with_tag_issues: tagIssues.length,
              tag_issues: tagIssues,
              fixes_applied: dry_run ? 0 : fixes.length,
              message: dry_run ? 'Preview mode - no changes made' : `Standardized tags in ${fixes.length} files`
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not standardize tags: ${error.message}`
      );
    }
  }

  async handleValidateFrontmatter(args) {
    const { file_path } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      const files = file_path ? [path.join(basePath, file_path)] : await this.getMarkdownFilesRecursive(basePath);
      
      const validationResults = [];
      
      for (const filePath of files) {
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = matter(content);
        const relativePath = path.relative(basePath, filePath);
        
        const validation = this.validateFrontmatterFields(relativePath, parsed);
        if (validation.issues.length > 0) {
          validationResults.push(validation);
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              files_validated: files.length,
              files_with_issues: validationResults.length,
              validation_results: validationResults,
              message: validationResults.length > 0 ? 'Found frontmatter validation issues' : 'All frontmatter appears valid'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not validate frontmatter: ${error.message}`
      );
    }
  }

  async handleOrganizeByType(args) {
    const { file_path, dry_run = true } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      
      // Get files to organize
      let filesToOrganize = [];
      if (file_path) {
        filesToOrganize = [path.join(basePath, file_path)];
      } else {
        // Find misplaced files (files in root that should be elsewhere)
        const rootFiles = await fs.readdir(basePath);
        for (const filename of rootFiles) {
          if (filename.endsWith('.md')) {
            const fullPath = path.join(basePath, filename);
            const stat = await fs.stat(fullPath);
            if (stat.isFile()) {
              filesToOrganize.push(fullPath);
            }
          }
        }
      }
      
      const moves = [];
      const errors = [];
      
      for (const filePath of filesToOrganize) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const parsed = matter(content);
          const relativePath = path.relative(basePath, filePath);
          
          const suggestedPath = this.suggestBetterPath(relativePath, parsed, content);
          if (suggestedPath && suggestedPath !== relativePath) {
            moves.push({
              from: relativePath,
              to: suggestedPath,
              reason: this.getReasonForMove(relativePath, parsed, content)
            });
            
            if (!dry_run) {
              const newFullPath = path.join(basePath, suggestedPath);
              await fs.mkdir(path.dirname(newFullPath), { recursive: true });
              await fs.rename(filePath, newFullPath);
            }
          }
        } catch (error) {
          errors.push({
            file: path.relative(basePath, filePath),
            error: error.message
          });
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              dry_run,
              files_analyzed: filesToOrganize.length,
              moves_suggested: moves.length,
              moves,
              moves_executed: dry_run ? 0 : moves.length,
              errors,
              message: dry_run ? 'Preview mode - no files moved' : `Moved ${moves.length} files to better locations`
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not organize files: ${error.message}`
      );
    }
  }

  // Helper methods for organization tools
  async getMarkdownFilesRecursive(dir) {
    const fs = require('fs').promises;
    const path = require('path');
    const files = [];
    
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

  analyzeFileForPlacement(relativePath, parsed, content) {
    const filename = relativePath.split('/').pop();
    const currentDir = relativePath.includes('/') ? relativePath.split('/')[0] : '';
    
    // Check for misplaced project files
    if (currentDir === '' && (
      filename.includes('epic-fcu') || 
      filename.includes('insurance-checker') ||
      parsed.data.tags?.includes('projects')
    )) {
      return {
        file: relativePath,
        current_location: 'root',
        suggested_location: 'projects/',
        reason: 'Project-related file should be in projects folder',
        confidence: 'high'
      };
    }
    
    // Check for misplaced technical documentation
    if (currentDir === '' && (
      filename.includes('divi-') ||
      filename.includes('submenu') ||
      content.includes('```') ||
      parsed.data.tags?.includes('development')
    )) {
      return {
        file: relativePath,
        current_location: 'root',
        suggested_location: 'Development/Documentation/',
        reason: 'Technical documentation should be in Development folder',
        confidence: 'high'
      };
    }
    
    return null;
  }

  analyzeTagsForStandardization(relativePath, parsed) {
    const issues = [];
    const tags = parsed.data.tags || [];
    
    // Check for empty tags array
    if (Array.isArray(tags) && tags.length === 0) {
      issues.push({
        type: 'empty_tags',
        message: 'Tags array is empty - consider adding relevant tags'
      });
    }
    
    // Check for inconsistent tag formatting
    tags.forEach(tag => {
      if (typeof tag === 'string') {
        if (tag.includes(' ') && !tag.includes('-')) {
          issues.push({
            type: 'space_in_tag',
            tag,
            suggestion: tag.replace(/\s+/g, '-').toLowerCase(),
            message: 'Consider using hyphens instead of spaces in tags'
          });
        }
        if (tag !== tag.toLowerCase()) {
          issues.push({
            type: 'case_inconsistency',
            tag,
            suggestion: tag.toLowerCase(),
            message: 'Consider using lowercase for tag consistency'
          });
        }
      }
    });
    
    return issues;
  }

  standardizeTagArray(tags) {
    if (!Array.isArray(tags)) return tags;
    
    return tags.map(tag => {
      if (typeof tag === 'string') {
        return tag.replace(/\s+/g, '-').toLowerCase();
      }
      return tag;
    });
  }

  validateFrontmatterFields(relativePath, parsed) {
    const issues = [];
    const data = parsed.data;
    
    // Check for required fields based on file type
    if (relativePath.startsWith('daily/')) {
      if (!data.id) {
        issues.push({
          type: 'missing_required_field',
          field: 'id',
          message: 'Daily notes should have an ID field'
        });
      }
      if (!data.tags || !data.tags.includes('daily-notes')) {
        issues.push({
          type: 'missing_tag',
          field: 'tags',
          message: 'Daily notes should include "daily-notes" tag'
        });
      }
    }
    
    if (relativePath.startsWith('projects/')) {
      if (!data.tags || !data.tags.includes('projects')) {
        issues.push({
          type: 'missing_tag',
          field: 'tags',
          message: 'Project notes should include "projects" tag'
        });
      }
    }
    
    return {
      file: relativePath,
      issues
    };
  }

  suggestBetterPath(relativePath, parsed, content) {
    const filename = relativePath.split('/').pop();
    
    // Project files should be in projects/
    if (filename.includes('epic-fcu') || filename.includes('insurance-checker') || 
        parsed.data.tags?.includes('projects')) {
      return `projects/${filename}`;
    }
    
    // Technical documentation
    if (filename.includes('divi-') || filename.includes('submenu') || 
        content.includes('```') || parsed.data.tags?.includes('development')) {
      return `Development/Documentation/${filename}`;
    }
    
    // Personal content (poetry, repairs, etc.)
    if (filename.includes('poetry') || filename.includes('repair') ||
        parsed.data.tags?.includes('personal')) {
      return `personal/${filename}`;
    }
    
    return relativePath;
  }

  getReasonForMove(relativePath, parsed, content) {
    const filename = relativePath.split('/').pop();
    
    if (filename.includes('epic-fcu') || filename.includes('insurance-checker')) {
      return 'Project-related content based on filename';
    }
    if (parsed.data.tags?.includes('projects')) {
      return 'Contains projects tag';
    }
    if (filename.includes('divi-') || content.includes('```')) {
      return 'Technical documentation content';
    }
    
    return 'Content analysis suggests better location';
  }

  async handleFindProjectContent(args) {
    const { project_name, date_range_days = 30 } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      const dailyPath = path.join(basePath, 'daily');
      
      // Get daily notes from recent days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - date_range_days);
      
      const dailyFiles = await fs.readdir(dailyPath);
      const recentFiles = dailyFiles.filter(filename => {
        if (!filename.endsWith('.md')) return false;
        const dateStr = filename.replace('.md', '');
        const fileDate = new Date(dateStr);
        return fileDate >= cutoffDate;
      });
      
      const projectContent = [];
      const projectPatterns = project_name ? 
        [project_name.toLowerCase()] : 
        ['greene', 'ortho', 'epic', 'fcu', 'milliken', 'medical', 'insurance', 'breastpumps'];
      
      for (const filename of recentFiles) {
        const filePath = path.join(dailyPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = matter(content);
        
        const matches = this.extractProjectMentions(filename, parsed, projectPatterns);
        if (matches.length > 0) {
          projectContent.push({
            daily_file: filename,
            matches
          });
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              search_criteria: {
                project_name: project_name || 'all projects',
                date_range_days,
                patterns_searched: projectPatterns
              },
              files_analyzed: recentFiles.length,
              files_with_content: projectContent.length,
              project_content,
              total_mentions: projectContent.reduce((sum, file) => sum + file.matches.length, 0)
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not find project content: ${error.message}`
      );
    }
  }

  async handleSuggestConsolidation(args) {
    const { project_name, min_mentions = 2 } = args;
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      // First find project content
      const contentResult = await this.handleFindProjectContent({ 
        project_name, 
        date_range_days: 30 
      });
      const contentData = JSON.parse(contentResult.content[0].text);
      
      // Analyze consolidation opportunities
      const suggestions = [];
      const projectGroups = {};
      
      // Group mentions by project
      if (contentData.project_content && Array.isArray(contentData.project_content)) {
        contentData.project_content.forEach(file => {
          if (file.matches && Array.isArray(file.matches)) {
            file.matches.forEach(match => {
              const projectKey = match.detected_project;
              if (!projectGroups[projectKey]) {
                projectGroups[projectKey] = [];
              }
              projectGroups[projectKey].push({
                daily_file: file.daily_file,
                ...match
              });
            });
          }
        });
      }
      
      // Generate suggestions for projects with enough mentions
      for (const [project, mentions] of Object.entries(projectGroups)) {
        if (mentions.length >= min_mentions) {
          const projectFile = await this.findProjectFile(project);
          suggestions.push({
            project_name: project,
            mention_count: mentions.length,
            project_file_exists: !!projectFile,
            suggested_project_file: projectFile || `projects/${this.sanitizeFilename(project)}.md`,
            mentions: mentions.map(m => ({
              daily_file: m.daily_file,
              content_preview: m.content.substring(0, 150) + '...',
              section_type: m.section_type,
              confidence: m.confidence
            })),
            consolidation_benefit: this.assessConsolidationBenefit(mentions)
          });
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              analysis_period: '30 days',
              min_mentions_threshold: min_mentions,
              consolidation_suggestions: suggestions,
              total_opportunities: suggestions.length,
              message: suggestions.length > 0 ? 
                `Found ${suggestions.length} consolidation opportunities` : 
                'No consolidation opportunities found'
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not suggest consolidation: ${error.message}`
      );
    }
  }

  async handleConsolidateToProject(args) {
    const { project_name, content_items, dry_run = true } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      
      // Find or create project file
      let projectFile = await this.findProjectFile(project_name);
      if (!projectFile) {
        projectFile = `projects/${this.sanitizeFilename(project_name)}.md`;
      }
      
      const projectPath = path.join(basePath, projectFile);
      let projectContent = '';
      let projectParsed = { content: '', data: {} };
      
      // Read existing project file or create new structure
      try {
        projectContent = await fs.readFile(projectPath, 'utf8');
        projectParsed = matter(projectContent);
      } catch (error) {
        // Create new project file structure
        projectParsed = {
          content: `# ${project_name}\n\n## Overview\n\n## Recent Updates\n\n## Meetings\n\n## Tasks\n\n`,
          data: {
            tags: ['projects', this.sanitizeFilename(project_name).toLowerCase()],
            created: new Date().toISOString().split('T')[0]
          }
        };
      }
      
      const consolidations = [];
      let updatedContent = projectParsed.content;
      
      // Process each content item
      for (const item of content_items) {
        const dateStr = item.daily_file.replace('.md', '');
        const sectionHeader = this.getSectionForContentType(item.section_type);
        
        // Format content with backlink
        const formattedContent = `### ${dateStr}\n${item.content}\n\n*Source: [[daily/${item.daily_file}]]*\n\n`;
        
        // Insert into appropriate section
        updatedContent = this.insertIntoSection(updatedContent, sectionHeader, formattedContent);
        
        consolidations.push({
          from: `daily/${item.daily_file}`,
          content_preview: item.content.substring(0, 100) + '...',
          added_to_section: sectionHeader
        });
        
        if (!dry_run) {
          // Add backlink reference in daily note
          await this.addBacklinkToDaily(item.daily_file, projectFile, item.content);
        }
      }
      
      if (!dry_run) {
        // Write updated project file
        const finalContent = matter.stringify(updatedContent, projectParsed.data);
        await fs.mkdir(path.dirname(projectPath), { recursive: true });
        await fs.writeFile(projectPath, finalContent, 'utf8');
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              dry_run,
              project_file: projectFile,
              consolidations_processed: consolidations.length,
              consolidations,
              message: dry_run ? 
                'Preview - no changes made' : 
                `Consolidated ${consolidations.length} items to ${projectFile}`
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not consolidate to project: ${error.message}`
      );
    }
  }

  async handleExtractMeetings(args) {
    const { project_name, date_range_days = 30, dry_run = true } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      const dailyPath = path.join(basePath, 'daily');
      
      // Get recent daily notes
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - date_range_days);
      
      const dailyFiles = await fs.readdir(dailyPath);
      const recentFiles = dailyFiles.filter(filename => {
        if (!filename.endsWith('.md')) return false;
        const dateStr = filename.replace('.md', '');
        const fileDate = new Date(dateStr);
        return fileDate >= cutoffDate;
      });
      
      const meetingExtractions = [];
      const projectPattern = project_name.toLowerCase();
      
      for (const filename of recentFiles) {
        const filePath = path.join(dailyPath, filename);
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = matter(content);
        
        const meetings = this.extractMeetingContent(parsed.content, projectPattern);
        if (meetings.length > 0) {
          meetingExtractions.push({
            daily_file: filename,
            meetings
          });
        }
      }
      
      if (!dry_run && meetingExtractions.length > 0) {
        // Consolidate meetings to project file
        const allMeetings = meetingExtractions.flatMap(file => 
          file.meetings.map(meeting => ({
            daily_file: file.daily_file,
            content: meeting.content,
            section_type: 'meeting'
          }))
        );
        
        await this.handleConsolidateToProject({
          project_name,
          content_items: allMeetings,
          dry_run: false
        });
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              dry_run,
              project_name,
              date_range_days,
              files_analyzed: recentFiles.length,
              files_with_meetings: meetingExtractions.length,
              total_meetings: meetingExtractions.reduce((sum, file) => sum + file.meetings.length, 0),
              meeting_extractions: meetingExtractions,
              message: dry_run ? 
                'Preview - no meetings extracted' : 
                `Extracted ${meetingExtractions.length} meetings to project note`
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not extract meetings: ${error.message}`
      );
    }
  }

  // Helper methods for consolidation tools
  extractProjectMentions(filename, parsed, projectPatterns) {
    const matches = [];
    const content = parsed.content;
    const lines = content.split('\n');
    
    let currentSection = 'general';
    let sectionContent = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track sections
      if (line.startsWith('##')) {
        // Process previous section if it had project mentions
        if (sectionContent) {
          const sectionMatches = this.findProjectInText(sectionContent, projectPatterns);
          sectionMatches.forEach(match => {
            matches.push({
              ...match,
              section_type: currentSection,
              line_number: i - sectionContent.split('\n').length + 1
            });
          });
        }
        
        currentSection = line.replace(/^#+\s*/, '').toLowerCase();
        sectionContent = '';
      } else {
        sectionContent += line + '\n';
      }
    }
    
    // Process final section
    if (sectionContent) {
      const sectionMatches = this.findProjectInText(sectionContent, projectPatterns);
      sectionMatches.forEach(match => {
        matches.push({
          ...match,
          section_type: currentSection
        });
      });
    }
    
    return matches;
  }

  findProjectInText(text, projectPatterns) {
    const matches = [];
    const lowerText = text.toLowerCase();
    
    for (const pattern of projectPatterns) {
      if (lowerText.includes(pattern)) {
        // Extract context around the mention
        const index = lowerText.indexOf(pattern);
        const start = Math.max(0, index - 50);
        const end = Math.min(text.length, index + pattern.length + 100);
        const context = text.substring(start, end);
        
        matches.push({
          detected_project: this.normalizeProjectName(pattern),
          pattern_matched: pattern,
          content: context.trim(),
          confidence: this.calculateMentionConfidence(text, pattern)
        });
      }
    }
    
    return matches;
  }

  normalizeProjectName(pattern) {
    const projectMap = {
      'greene': 'Greene Orthodontics',
      'ortho': 'Greene Orthodontics', 
      'epic': 'Epic FCU',
      'fcu': 'Epic FCU',
      'milliken': 'Milliken Medical',
      'medical': 'Milliken Medical',
      'insurance': 'Insurance Checker',
      'breastpumps': 'Breastpumps.com'
    };
    
    return projectMap[pattern] || pattern;
  }

  calculateMentionConfidence(text, pattern) {
    let confidence = 0.5;
    
    // Higher confidence for explicit project context
    if (text.toLowerCase().includes('project')) confidence += 0.2;
    if (text.toLowerCase().includes('meeting')) confidence += 0.2;
    if (text.toLowerCase().includes('client')) confidence += 0.1;
    if (text.includes('##')) confidence += 0.1; // Section header context
    
    return Math.min(confidence, 1.0);
  }

  async findProjectFile(projectName) {
    const fs = require('fs').promises;
    const path = require('path');
    const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
    const projectsPath = path.join(basePath, 'projects');
    
    try {
      const files = await fs.readdir(projectsPath);
      const normalizedName = projectName.toLowerCase();
      
      for (const filename of files) {
        if (filename.endsWith('.md') && filename.toLowerCase().includes(normalizedName)) {
          return `projects/${filename}`;
        }
      }
    } catch (error) {
      // Projects folder doesn't exist yet
    }
    
    return null;
  }

  sanitizeFilename(name) {
    return name.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  assessConsolidationBenefit(mentions) {
    const daySpread = new Set(mentions.map(m => m.daily_file)).size;
    const avgConfidence = mentions.reduce((sum, m) => sum + m.confidence, 0) / mentions.length;
    
    if (mentions.length >= 5 && daySpread >= 3) return 'high';
    if (mentions.length >= 3 && daySpread >= 2) return 'medium';
    return 'low';
  }

  getSectionForContentType(sectionType) {
    const sectionMap = {
      'meetings': '## Meetings',
      'meeting': '## Meetings',
      'tasks': '## Tasks',
      'focus areas': '## Recent Updates',
      'notes': '## Recent Updates',
      'general': '## Recent Updates'
    };
    
    return sectionMap[sectionType] || '## Recent Updates';
  }

  insertIntoSection(content, sectionHeader, newContent) {
    const lines = content.split('\n');
    let sectionIndex = -1;
    let nextSectionIndex = lines.length;
    
    // Find the target section
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] === sectionHeader) {
        sectionIndex = i;
        break;
      }
    }
    
    // If section doesn't exist, add it before the last section
    if (sectionIndex === -1) {
      const lastSectionIndex = lines.findLastIndex(line => line.startsWith('##'));
      const insertPoint = lastSectionIndex > 0 ? lastSectionIndex : lines.length;
      lines.splice(insertPoint, 0, '', sectionHeader, '');
      sectionIndex = insertPoint + 1;
    }
    
    // Find next section
    for (let i = sectionIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith('##')) {
        nextSectionIndex = i;
        break;
      }
    }
    
    // Insert content at the end of the section
    const insertIndex = nextSectionIndex;
    lines.splice(insertIndex, 0, newContent);
    
    return lines.join('\n');
  }

  async addBacklinkToDaily(dailyFile, projectFile, content) {
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      const dailyPath = path.join(basePath, 'daily', dailyFile);
      
      const dailyContent = await fs.readFile(dailyPath, 'utf8');
      const parsed = matter(dailyContent);
      
      // Add note about consolidation
      const consolidationNote = `\n---\n*Content about ${path.basename(projectFile, '.md')} moved to [[${projectFile}]]*\n`;
      
      // Find the content in the daily note and add reference
      const contentStart = parsed.content.indexOf(content.substring(0, 50));
      if (contentStart !== -1) {
        const beforeContent = parsed.content.substring(0, contentStart + content.length);
        const afterContent = parsed.content.substring(contentStart + content.length);
        const updatedContent = beforeContent + consolidationNote + afterContent;
        
        const finalContent = matter.stringify(updatedContent, parsed.data);
        await fs.writeFile(dailyPath, finalContent, 'utf8');
      }
    } catch (error) {
      logger.error(`Could not add backlink to ${dailyFile}:`, error);
    }
  }

  extractMeetingContent(content, projectPattern) {
    const meetings = [];
    const lines = content.split('\n');
    
    let inMeetingSection = false;
    let meetingContent = '';
    
    for (const line of lines) {
      if (line.toLowerCase().includes('meeting') && line.startsWith('##')) {
        inMeetingSection = true;
        meetingContent = line + '\n';
      } else if (line.startsWith('##') && inMeetingSection) {
        // End of meeting section
        if (meetingContent.toLowerCase().includes(projectPattern)) {
          meetings.push({
            content: meetingContent.trim(),
            type: 'meeting'
          });
        }
        inMeetingSection = false;
        meetingContent = '';
      } else if (inMeetingSection) {
        meetingContent += line + '\n';
      }
    }
    
    // Handle meeting section at end of file
    if (inMeetingSection && meetingContent.toLowerCase().includes(projectPattern)) {
      meetings.push({
        content: meetingContent.trim(),
        type: 'meeting'
      });
    }
    
    return meetings;
  }

  async handleGenerateWeeklySummary(args) {
    const { week_ending, include_metrics = true, create_note = false } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      
      // Calculate week dates
      const endDate = week_ending ? new Date(week_ending) : this.getLatestSunday();
      const startDate = new Date(endDate);
      startDate.setDate(startDate.getDate() - 6);
      
      // Get daily notes for the week
      const weekFiles = await this.getDailyNotesForPeriod(startDate, endDate);
      
      // Analyze weekly content
      const weeklyAnalysis = await this.analyzeWeeklyContent(weekFiles);
      
      // Generate summary structure
      const summary = this.buildWeeklySummary(weeklyAnalysis, startDate, endDate, include_metrics);
      
      let result = {
        week_period: `${this.formatDate(startDate)} to ${this.formatDate(endDate)}`,
        summary_generated: new Date().toISOString(),
        ...summary
      };
      
      // Create note file if requested
      if (create_note) {
        const summaryNote = this.formatWeeklySummaryNote(summary, startDate, endDate);
        const noteFileName = `weekly-summary-${this.formatDate(endDate)}.md`;
        const summaryPath = path.join(basePath, 'summaries', noteFileName);
        
        await fs.mkdir(path.dirname(summaryPath), { recursive: true });
        await fs.writeFile(summaryPath, summaryNote, 'utf8');
        
        result.note_created = `summaries/${noteFileName}`;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not generate weekly summary: ${error.message}`
      );
    }
  }

  async handleCrossReferenceBuilder(args) {
    const { scope = 'all', min_confidence = 0.7, auto_link = false } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      
      // Get files based on scope
      const files = await this.getFilesForScope(basePath, scope);
      
      // Build content index
      const contentIndex = await this.buildContentIndex(files);
      
      // Find cross-reference opportunities
      const linkSuggestions = this.findLinkOpportunities(contentIndex, min_confidence);
      
      const linksCreated = [];
      const errors = [];
      
      if (auto_link) {
        // Auto-create high-confidence links
        const highConfidenceLinks = linkSuggestions.filter(link => link.confidence >= 0.9);
        
        for (const link of highConfidenceLinks) {
          try {
            await this.createBidirectionalLink(link);
            linksCreated.push({
              from: link.source_file,
              to: link.target_file,
              confidence: link.confidence,
              reason: link.reason
            });
          } catch (error) {
            errors.push({
              link: `${link.source_file} -> ${link.target_file}`,
              error: error.message
            });
          }
        }
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              scope,
              files_analyzed: files.length,
              link_suggestions: linkSuggestions.length,
              high_confidence_suggestions: linkSuggestions.filter(l => l.confidence >= 0.9).length,
              medium_confidence_suggestions: linkSuggestions.filter(l => l.confidence >= 0.7 && l.confidence < 0.9).length,
              auto_link_enabled: auto_link,
              links_created: linksCreated.length,
              suggestions: linkSuggestions.slice(0, 20), // Top 20 suggestions
              links_created: linksCreated,
              errors
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Could not build cross references: ${error.message}`
      );
    }
  }

  async handleTimeTravelAssistant(args) {
    const { 
      mode = 'what_was_i_doing', 
      days_back = 7, 
      project_filter, 
      reference_date 
    } = args;
    const fs = require('fs').promises;
    const path = require('path');
    const matter = require('gray-matter');
    
    try {
      const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
      const refDate = reference_date ? new Date(reference_date) : new Date();
      
      let result = {};
      
      switch (mode) {
        case 'what_was_i_doing':
          result = await this.getHistoricalActivity(refDate, days_back, project_filter);
          break;
          
        case 'compare_periods':
          result = await this.comparePeriods(refDate, days_back, project_filter);
          break;
          
        case 'find_patterns':
          result = await this.findTemporalPatterns(refDate, days_back * 4, project_filter);
          break;
          
        case 'anniversary':
          result = await this.findAnniversaries(refDate, project_filter);
          break;
          
        default:
          throw new Error(`Unknown mode: ${mode}`);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              mode,
              reference_date: this.formatDate(refDate),
              days_analyzed: days_back,
              project_filter: project_filter || 'all projects',
              ...result
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Time travel assistant failed: ${error.message}`
      );
    }
  }

  // Helper methods for weekly summary
  getLatestSunday() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - dayOfWeek);
    return sunday;
  }

  async getDailyNotesForPeriod(startDate, endDate) {
    const fs = require('fs').promises;
    const path = require('path');
    const basePath = process.env.NOTEBOOK_PATH || '/app/notebook';
    const dailyPath = path.join(basePath, 'daily');
    
    const files = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = this.formatDate(currentDate);
      const fileName = `${dateStr}.md`;
      const filePath = path.join(dailyPath, fileName);
      
      try {
        const content = await fs.readFile(filePath, 'utf8');
        const parsed = matter(content);
        files.push({
          date: dateStr,
          file_path: `daily/${fileName}`,
          parsed,
          content: parsed.content
        });
      } catch (error) {
        // File doesn't exist for this date
      }
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return files;
  }

  async analyzeWeeklyContent(weekFiles) {
    const analysis = {
      total_days: weekFiles.length,
      projects_mentioned: new Set(),
      meetings_count: 0,
      accomplishments: [],
      blockers: [],
      decisions: [],
      focus_areas: new Map(),
      productivity_score: 0,
      word_count: 0,
      section_activity: new Map()
    };
    
    for (const file of weekFiles) {
      const content = file.content.toLowerCase();
      
      // Count words
      analysis.word_count += content.split(/\s+/).length;
      
      // Extract accomplishments (lines with checkmarks or "completed")
      const accomplishmentLines = file.content.split('\n').filter(line => 
        line.includes('✅') || line.includes('[x]') || line.toLowerCase().includes('completed')
      );
      analysis.accomplishments.push(...accomplishmentLines.map(line => ({
        date: file.date,
        content: line.trim()
      })));
      
      // Extract blockers
      const blockerLines = file.content.split('\n').filter(line => 
        line.toLowerCase().includes('blocked') || line.toLowerCase().includes('issue') || line.includes('⚠️')
      );
      analysis.blockers.push(...blockerLines.map(line => ({
        date: file.date,
        content: line.trim()
      })));
      
      // Find project mentions
      const projectPatterns = ['greene', 'ortho', 'epic', 'fcu', 'milliken', 'medical'];
      projectPatterns.forEach(pattern => {
        if (content.includes(pattern)) {
          analysis.projects_mentioned.add(this.normalizeProjectName(pattern));
        }
      });
      
      // Count meetings
      if (content.includes('meeting') || content.includes('## meetings')) {
        analysis.meetings_count++;
      }
      
      // Analyze sections
      const sections = file.content.split(/^##\s+/m);
      sections.forEach(section => {
        const sectionName = section.split('\n')[0]?.toLowerCase() || 'general';
        const currentCount = analysis.section_activity.get(sectionName) || 0;
        analysis.section_activity.set(sectionName, currentCount + 1);
      });
    }
    
    // Calculate productivity score
    analysis.productivity_score = this.calculateProductivityScore(analysis);
    analysis.projects_mentioned = Array.from(analysis.projects_mentioned);
    
    return analysis;
  }

  buildWeeklySummary(analysis, startDate, endDate, includeMetrics) {
    const summary = {
      overview: {
        period: `${this.formatDate(startDate)} to ${this.formatDate(endDate)}`,
        days_with_notes: analysis.total_days,
        total_word_count: analysis.word_count,
        avg_daily_words: Math.round(analysis.word_count / Math.max(analysis.total_days, 1))
      },
      key_accomplishments: analysis.accomplishments.slice(0, 10),
      active_projects: analysis.projects_mentioned,
      meetings_held: analysis.meetings_count,
      blockers_identified: analysis.blockers.length,
      top_focus_areas: Array.from(analysis.section_activity.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([section, count]) => ({ section, mentions: count }))
    };
    
    if (includeMetrics) {
      summary.productivity_metrics = {
        overall_score: analysis.productivity_score,
        completion_rate: analysis.accomplishments.length / Math.max(analysis.total_days, 1),
        blocker_rate: analysis.blockers.length / Math.max(analysis.total_days, 1),
        project_engagement: analysis.projects_mentioned.length,
        meeting_frequency: analysis.meetings_count / Math.max(analysis.total_days, 1)
      };
    }
    
    return summary;
  }

  calculateProductivityScore(analysis) {
    let score = 50; // Base score
    
    // Boost for accomplishments
    score += Math.min(analysis.accomplishments.length * 5, 30);
    
    // Penalty for blockers
    score -= Math.min(analysis.blockers.length * 3, 20);
    
    // Boost for consistent daily notes
    score += (analysis.total_days / 7) * 20;
    
    // Boost for project engagement
    score += Math.min(analysis.projects_mentioned.size * 3, 15);
    
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  formatWeeklySummaryNote(summary, startDate, endDate) {
    const frontmatter = {
      type: 'weekly-summary',
      week_start: this.formatDate(startDate),
      week_end: this.formatDate(endDate),
      generated: new Date().toISOString().split('T')[0],
      tags: ['weekly-summary', 'productivity']
    };
    
    const content = `# Weekly Summary: ${this.formatDate(startDate)} to ${this.formatDate(endDate)}

## Overview
- **Days with notes:** ${summary.overview.days_with_notes}/7
- **Total words written:** ${summary.overview.total_word_count}
- **Average daily words:** ${summary.overview.avg_daily_words}

## Key Accomplishments ✅
${summary.key_accomplishments.map(acc => `- ${acc.content} *(${acc.date})*`).join('\n')}

## Active Projects
${summary.active_projects.map(project => `- ${project}`).join('\n')}

## Focus Areas
${summary.top_focus_areas.map(area => `- **${area.section}** (${area.mentions} mentions)`).join('\n')}

${summary.productivity_metrics ? `## Productivity Metrics
- **Overall Score:** ${summary.productivity_metrics.overall_score}/100
- **Completion Rate:** ${summary.productivity_metrics.completion_rate.toFixed(2)} items/day
- **Project Engagement:** ${summary.productivity_metrics.project_engagement} active projects
- **Meeting Frequency:** ${summary.productivity_metrics.meeting_frequency.toFixed(2)} meetings/day
` : ''}

---
*Generated automatically by AI Note Searcher*`;

    return matter.stringify(content, frontmatter);
  }

  // Helper methods for cross-reference builder
  async getFilesForScope(basePath, scope) {
    const fs = require('fs').promises;
    const path = require('path');
    
    switch (scope) {
      case 'projects':
        return await this.getMarkdownFilesRecursive(path.join(basePath, 'projects'));
      case 'daily':
        return await this.getMarkdownFilesRecursive(path.join(basePath, 'daily'));
      case 'all':
        return await this.getMarkdownFilesRecursive(basePath);
      default:
        return await this.getMarkdownFilesRecursive(path.join(basePath, scope));
    }
  }

  async buildContentIndex(files) {
    const fs = require('fs').promises;
    const matter = require('gray-matter');
    const index = [];
    
    for (const filePath of files) {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = matter(content);
      const path = require('path');
      const relativePath = path.relative(process.env.NOTEBOOK_PATH || '/app/notebook', filePath);
      
      index.push({
        file_path: relativePath,
        title: this.extractTitleFromDocument({ content: parsed.content, frontmatter: parsed.data, path: relativePath }),
        content: parsed.content,
        tags: parsed.data.tags || [],
        aliases: parsed.data.aliases || [],
        word_count: parsed.content.split(/\s+/).length
      });
    }
    
    return index;
  }

  findLinkOpportunities(contentIndex, minConfidence) {
    const opportunities = [];
    
    for (let i = 0; i < contentIndex.length; i++) {
      for (let j = i + 1; j < contentIndex.length; j++) {
        const file1 = contentIndex[i];
        const file2 = contentIndex[j];
        
        const linkScore = this.calculateLinkConfidence(file1, file2);
        
        if (linkScore.confidence >= minConfidence) {
          opportunities.push({
            source_file: file1.file_path,
            target_file: file2.file_path,
            confidence: linkScore.confidence,
            reason: linkScore.reason,
            link_type: linkScore.type
          });
        }
      }
    }
    
    return opportunities.sort((a, b) => b.confidence - a.confidence);
  }

  calculateLinkConfidence(file1, file2) {
    let confidence = 0;
    let reasons = [];
    let linkType = 'content';
    
    // Check for explicit mentions
    const file1Lower = file1.content.toLowerCase();
    const file2Lower = file2.content.toLowerCase();
    const file1Title = file1.title.toLowerCase();
    const file2Title = file2.title.toLowerCase();
    
    // Title mentions
    if (file1Lower.includes(file2Title) || file2Lower.includes(file1Title)) {
      confidence += 0.4;
      reasons.push('title mentioned in content');
      linkType = 'reference';
    }
    
    // Tag overlap
    const tagOverlap = file1.tags.filter(tag => file2.tags.includes(tag));
    if (tagOverlap.length > 0) {
      confidence += Math.min(tagOverlap.length * 0.1, 0.3);
      reasons.push(`shared tags: ${tagOverlap.join(', ')}`);
    }
    
    // Project/client name matching
    const projectNames = ['greene', 'ortho', 'epic', 'fcu', 'milliken'];
    const file1Projects = projectNames.filter(name => file1Lower.includes(name));
    const file2Projects = projectNames.filter(name => file2Lower.includes(name));
    const sharedProjects = file1Projects.filter(project => file2Projects.includes(project));
    
    if (sharedProjects.length > 0) {
      confidence += 0.3;
      reasons.push(`shared project: ${sharedProjects.join(', ')}`);
      linkType = 'project';
    }
    
    // Date proximity for daily notes
    if (file1.file_path.includes('daily/') && file2.file_path.includes('daily/')) {
      const date1 = file1.file_path.match(/(\d{4}-\d{2}-\d{2})/)?.[0];
      const date2 = file2.file_path.match(/(\d{4}-\d{2}-\d{2})/)?.[0];
      
      if (date1 && date2) {
        const daysDiff = Math.abs(new Date(date1) - new Date(date2)) / (1000 * 60 * 60 * 24);
        if (daysDiff <= 3) {
          confidence += 0.2;
          reasons.push('consecutive daily notes');
          linkType = 'temporal';
        }
      }
    }
    
    return {
      confidence: Math.min(confidence, 1.0),
      reason: reasons.join('; '),
      type: linkType
    };
  }

  async createBidirectionalLink(linkSuggestion) {
    // Implementation would add [[links]] to both files
    // For now, this is a placeholder for the actual linking logic
    logger.info(`Would create link: ${linkSuggestion.source_file} <-> ${linkSuggestion.target_file}`);
  }

  // Helper methods for time travel assistant
  async getHistoricalActivity(refDate, daysBack, projectFilter) {
    const historicalDate = new Date(refDate);
    historicalDate.setDate(historicalDate.getDate() - daysBack);
    
    const historicalFiles = await this.getDailyNotesForPeriod(historicalDate, historicalDate);
    
    if (historicalFiles.length === 0) {
      return {
        historical_date: this.formatDate(historicalDate),
        activity_found: false,
        message: `No daily note found for ${this.formatDate(historicalDate)}`
      };
    }
    
    const file = historicalFiles[0];
    let analysis = {
      historical_date: this.formatDate(historicalDate),
      activity_found: true,
      sections: this.extractSectionsFromContent(file.content),
      word_count: file.content.split(/\s+/).length,
      projects_mentioned: []
    };
    
    // Filter by project if specified
    if (projectFilter) {
      const projectContent = this.filterContentByProject(file.content, projectFilter);
      analysis.filtered_content = projectContent;
      analysis.project_focus = projectFilter;
    }
    
    return analysis;
  }

  async comparePeriods(refDate, daysBack, projectFilter) {
    const period1End = new Date(refDate);
    const period1Start = new Date(refDate);
    period1Start.setDate(period1Start.getDate() - daysBack);
    
    const period2End = new Date(refDate);
    period2End.setDate(period2End.getDate() - daysBack);
    const period2Start = new Date(period2End);
    period2Start.setDate(period2Start.getDate() - daysBack);
    
    const period1Files = await this.getDailyNotesForPeriod(period1Start, period1End);
    const period2Files = await this.getDailyNotesForPeriod(period2Start, period2End);
    
    const period1Analysis = await this.analyzeWeeklyContent(period1Files);
    const period2Analysis = await this.analyzeWeeklyContent(period2Files);
    
    return {
      period_1: {
        dates: `${this.formatDate(period1Start)} to ${this.formatDate(period1End)}`,
        summary: this.summarizePeriod(period1Analysis)
      },
      period_2: {
        dates: `${this.formatDate(period2Start)} to ${this.formatDate(period2End)}`,
        summary: this.summarizePeriod(period2Analysis)
      },
      comparison: this.comparePeriodAnalyses(period1Analysis, period2Analysis)
    };
  }

  async findTemporalPatterns(refDate, totalDays, projectFilter) {
    // Analyze patterns over a longer period
    const patterns = {
      weekly_cycles: {},
      productivity_trends: [],
      project_evolution: {},
      recurring_themes: []
    };
    
    // Implementation would analyze multiple weeks of data
    // This is a simplified version
    
    return {
      analysis_period: `${totalDays} days`,
      patterns_found: Object.keys(patterns).length,
      patterns
    };
  }

  async findAnniversaries(refDate, projectFilter) {
    // Look for events from 1 week, 1 month, 3 months, 6 months, 1 year ago
    const anniversaryPeriods = [7, 30, 90, 180, 365];
    const anniversaries = [];
    
    for (const days of anniversaryPeriods) {
      const anniversaryDate = new Date(refDate);
      anniversaryDate.setDate(anniversaryDate.getDate() - days);
      
      const files = await this.getDailyNotesForPeriod(anniversaryDate, anniversaryDate);
      if (files.length > 0) {
        anniversaries.push({
          period: `${days} days ago`,
          date: this.formatDate(anniversaryDate),
          preview: files[0].content.substring(0, 200) + '...',
          significant_events: this.extractSignificantEvents(files[0].content)
        });
      }
    }
    
    return {
      anniversaries_found: anniversaries.length,
      anniversaries
    };
  }

  // Utility methods
  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  extractSectionsFromContent(content) {
    const sections = [];
    const lines = content.split('\n');
    let currentSection = null;
    let currentContent = [];
    
    for (const line of lines) {
      if (line.startsWith('##')) {
        if (currentSection) {
          sections.push({
            title: currentSection,
            content: currentContent.join('\n').trim()
          });
        }
        currentSection = line.replace(/^#+\s*/, '');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    
    if (currentSection) {
      sections.push({
        title: currentSection,
        content: currentContent.join('\n').trim()
      });
    }
    
    return sections;
  }

  filterContentByProject(content, projectFilter) {
    const lowerContent = content.toLowerCase();
    const lowerProject = projectFilter.toLowerCase();
    
    return content.split('\n').filter(line => 
      line.toLowerCase().includes(lowerProject)
    ).join('\n');
  }

  summarizePeriod(analysis) {
    return {
      days_active: analysis.total_days,
      accomplishments: analysis.accomplishments.length,
      projects: analysis.projects_mentioned.length,
      productivity_score: analysis.productivity_score,
      word_count: analysis.word_count
    };
  }

  comparePeriodAnalyses(period1, period2) {
    return {
      productivity_change: period1.productivity_score - period2.productivity_score,
      accomplishments_change: period1.accomplishments.length - period2.accomplishments.length,
      word_count_change: period1.word_count - period2.word_count,
      new_projects: period1.projects_mentioned.filter(p => !period2.projects_mentioned.includes(p)),
      discontinued_projects: period2.projects_mentioned.filter(p => !period1.projects_mentioned.includes(p))
    };
  }

  extractSignificantEvents(content) {
    // Look for patterns that indicate significant events
    const significantLines = content.split('\n').filter(line => {
      const lower = line.toLowerCase();
      return lower.includes('completed') || 
             lower.includes('launched') || 
             lower.includes('started') ||
             lower.includes('meeting') ||
             line.includes('✅') ||
             line.includes('🎉');
    });
    
    return significantLines.slice(0, 3); // Top 3 significant events
  }

  extractTitleFromDocument(document) {
    if (document.frontmatter && document.frontmatter.title) {
      return document.frontmatter.title;
    }
    
    const lines = document.content.split('\n');
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)$/);
      if (match) {
        return match[1].trim();
      }
    }
    
    return document.path.replace(/\.md$/, '').split('/').pop();
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP server started');
  }
}

module.exports = MCPServer;