import { promises as fs } from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import { ToolDefinition, ToolHandler } from '../types/mcp.js';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export class GetLatestDailyNoteTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'get_latest_daily_note',
    description: 'Get the most recent daily note from the daily notes folder',
    inputSchema: {
      type: 'object',
      properties: {
        include_content: {
          type: 'boolean',
          description: 'Include the full note content (default: true)',
          default: true,
        },
      },
    },
  };

  handler: ToolHandler = async (args) => {
    const { include_content = true } = args;

    try {
      const dailyPath = path.join(this.getNotebookPath(), 'daily');

      // Check if daily folder exists
      try {
        await fs.access(dailyPath);
      } catch {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Daily notes folder does not exist'
        );
      }

      // Read all files in daily folder
      const files = await fs.readdir(dailyPath);

      // Filter for markdown files with YYYY-MM-DD format
      const dailyNotes = files.filter(file => {
        return file.endsWith('.md') && /^\d{4}-\d{2}-\d{2}\.md$/.test(file);
      });

      if (dailyNotes.length === 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'No daily notes found'
        );
      }

      // Sort by date (descending) - most recent first
      dailyNotes.sort((a, b) => {
        const dateA = a.replace('.md', '');
        const dateB = b.replace('.md', '');
        return dateB.localeCompare(dateA);
      });

      const latestFile = dailyNotes[0];
      const latestFilePath = `daily/${latestFile}`;

      let response: any = {
        file_path: latestFilePath,
        date: latestFile.replace('.md', ''),
        total_daily_notes: dailyNotes.length,
      };

      if (include_content) {
        const parsed = await this.readNote(latestFilePath);
        response.content = parsed.content;
        response.frontmatter = parsed.data;
      }

      return this.createResponse(response);
    } catch (error: any) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get latest daily note: ${error.message}`
      );
    }
  };
}
