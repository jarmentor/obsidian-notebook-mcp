import { promises as fs } from 'fs';
import * as path from 'path';
import { BaseTool } from './base.js';
import { ToolDefinition, ToolHandler, FilePathSuggestion } from '../types/mcp.js';

export class FilePathSuggestionTool extends BaseTool {
  definition: ToolDefinition = {
    name: 'suggest_file_path',
    description: 'Get intelligent suggestions for file paths based on content type and existing structure',
    inputSchema: {
      type: 'object',
      properties: {
        content_type: {
          type: 'string',
          description: 'Type of content: "daily-note", "project", "meeting", "technical", "personal"',
        },
        filename: {
          type: 'string',
          description: 'Desired filename (without extension)',
        },
        content_preview: {
          type: 'string',
          description: 'Preview of content to help suggest best location',
        },
        date: {
          type: 'string',
          description: 'Date for daily notes (YYYY-MM-DD format)',
        },
      },
      required: ['content_type'],
    },
  };

  handler: ToolHandler = async (args) => {
    const { content_type, filename, content_preview = '', date } = args;
    
    try {
      const basePath = this.getNotebookPath();
      const existingStructure = await this.analyzeExistingStructure(basePath);
      
      const suggestions = await this.generatePathSuggestions(
        content_type,
        filename,
        content_preview,
        date,
        existingStructure
      );
      
      return this.createResponse({
        content_type,
        suggestions,
        existing_structure: existingStructure,
        message: `Generated ${suggestions.length} path suggestions`
      });
    } catch (error: any) {
      return this.createResponse({
        error: `Could not generate path suggestions: ${error.message}`,
        content_type
      });
    }
  };

  private async analyzeExistingStructure(basePath: string): Promise<Record<string, string[]>> {
    const structure: Record<string, string[]> = {};
    
    try {
      const entries = await fs.readdir(basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          structure[entry.name] = [];
          
          try {
            const subEntries = await fs.readdir(path.join(basePath, entry.name), { withFileTypes: true });
            for (const subEntry of subEntries) {
              if (subEntry.isDirectory()) {
                structure[entry.name].push(subEntry.name);
              }
            }
          } catch {
            // Can't read subdirectory, that's okay
          }
        }
      }
    } catch (error) {
      // If we can't read the base path, return empty structure
    }
    
    return structure;
  }

  private async generatePathSuggestions(
    contentType: string,
    filename?: string,
    contentPreview?: string,
    date?: string,
    existingStructure?: Record<string, string[]>
  ): Promise<FilePathSuggestion[]> {
    const suggestions: FilePathSuggestion[] = [];
    const lower = contentPreview?.toLowerCase() || '';
    
    switch (contentType) {
      case 'daily-note':
        suggestions.push(...this.generateDailyNoteSuggestions(date, existingStructure));
        break;
        
      case 'project':
        suggestions.push(...this.generateProjectSuggestions(filename, lower, existingStructure));
        break;
        
      case 'meeting':
        suggestions.push(...this.generateMeetingSuggestions(filename, lower, existingStructure));
        break;
        
      case 'technical':
        suggestions.push(...this.generateTechnicalSuggestions(filename, lower, existingStructure));
        break;
        
      case 'personal':
        suggestions.push(...this.generatePersonalSuggestions(filename, lower, existingStructure));
        break;
        
      default:
        suggestions.push({
          suggested_path: filename ? `${filename}.md` : 'untitled.md',
          confidence: 0.3,
          reason: 'Unknown content type, suggesting root directory',
        });
    }
    
    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  private generateDailyNoteSuggestions(date?: string, structure?: Record<string, string[]>): FilePathSuggestion[] {
    const suggestions: FilePathSuggestion[] = [];
    const dateStr = date || new Date().toISOString().split('T')[0];
    
    // Check existing daily note directories
    const dailyDirs = Object.keys(structure || {}).filter(dir => 
      dir.toLowerCase().includes('daily') || dir.toLowerCase().includes('journal')
    );
    
    if (dailyDirs.length === 0) {
      // No existing daily directories, suggest creating one
      suggestions.push({
        suggested_path: `daily/${dateStr}.md`,
        confidence: 0.8,
        reason: 'Standard daily notes structure (no existing daily directory found)'
      });
    } else {
      // Use existing daily directories, prioritize exact matches
      dailyDirs.forEach(dir => {
        const confidence = dir === 'daily' ? 0.95 : 0.7;
        suggestions.push({
          suggested_path: `${dir}/${dateStr}.md`,
          confidence,
          reason: `Using existing daily notes directory: ${dir}`,
          existing_similar: [dir]
        });
      });
    }
    
    return suggestions;
  }

  private generateProjectSuggestions(filename?: string, content?: string, structure?: Record<string, string[]>): FilePathSuggestion[] {
    const suggestions: FilePathSuggestion[] = [];
    const projectDirs = Object.keys(structure || {}).filter(dir => 
      dir.toLowerCase().includes('project') || dir.toLowerCase().includes('client')
    );
    
    const baseFilename = filename || 'new-project';
    
    if (projectDirs.length > 0) {
      projectDirs.forEach(dir => {
        suggestions.push({
          suggested_path: `${dir}/${baseFilename}.md`,
          confidence: 0.9,
          reason: `Using existing projects directory: ${dir}`,
          existing_similar: [dir]
        });
      });
    } else {
      suggestions.push({
        suggested_path: `projects/${baseFilename}.md`,
        confidence: 0.8,
        reason: 'Standard projects structure (no existing projects directory found)'
      });
    }
    
    return suggestions;
  }

  private generateMeetingSuggestions(filename?: string, content?: string, structure?: Record<string, string[]>): FilePathSuggestion[] {
    const suggestions: FilePathSuggestion[] = [];
    const meetingDirs = Object.keys(structure || {}).filter(dir => 
      dir.toLowerCase().includes('meeting') || dir.toLowerCase().includes('call')
    );
    
    const baseFilename = filename || `meeting-${new Date().toISOString().split('T')[0]}`;
    
    if (meetingDirs.length > 0) {
      meetingDirs.forEach(dir => {
        suggestions.push({
          suggested_path: `${dir}/${baseFilename}.md`,
          confidence: 0.9,
          reason: `Using existing meetings directory: ${dir}`,
          existing_similar: [dir]
        });
      });
    } else {
      suggestions.push({
        suggested_path: `meetings/${baseFilename}.md`,
        confidence: 0.8,
        reason: 'Standard meetings structure (no existing meetings directory found)'
      });
    }
    
    return suggestions;
  }

  private generateTechnicalSuggestions(filename?: string, content?: string, structure?: Record<string, string[]>): FilePathSuggestion[] {
    const suggestions: FilePathSuggestion[] = [];
    const techDirs = Object.keys(structure || {}).filter(dir => 
      dir.toLowerCase().includes('development') || 
      dir.toLowerCase().includes('technical') ||
      dir.toLowerCase().includes('code') ||
      dir.toLowerCase().includes('doc')
    );
    
    const baseFilename = filename || 'technical-note';
    
    if (techDirs.length > 0) {
      techDirs.forEach(dir => {
        const subDirs = structure?.[dir] || [];
        if (subDirs.includes('Documentation')) {
          suggestions.push({
            suggested_path: `${dir}/Documentation/${baseFilename}.md`,
            confidence: 0.95,
            reason: `Using existing technical documentation directory: ${dir}/Documentation`,
            existing_similar: [`${dir}/Documentation`]
          });
        } else {
          suggestions.push({
            suggested_path: `${dir}/${baseFilename}.md`,
            confidence: 0.8,
            reason: `Using existing technical directory: ${dir}`,
            existing_similar: [dir]
          });
        }
      });
    } else {
      suggestions.push({
        suggested_path: `Development/Documentation/${baseFilename}.md`,
        confidence: 0.7,
        reason: 'Standard technical documentation structure'
      });
    }
    
    return suggestions;
  }

  private generatePersonalSuggestions(filename?: string, content?: string, structure?: Record<string, string[]>): FilePathSuggestion[] {
    const suggestions: FilePathSuggestion[] = [];
    const personalDirs = Object.keys(structure || {}).filter(dir => 
      dir.toLowerCase().includes('personal') || dir.toLowerCase().includes('private')
    );
    
    const baseFilename = filename || 'personal-note';
    
    if (personalDirs.length > 0) {
      personalDirs.forEach(dir => {
        suggestions.push({
          suggested_path: `${dir}/${baseFilename}.md`,
          confidence: 0.9,
          reason: `Using existing personal directory: ${dir}`,
          existing_similar: [dir]
        });
      });
    } else {
      suggestions.push({
        suggested_path: `personal/${baseFilename}.md`,
        confidence: 0.8,
        reason: 'Standard personal notes structure (no existing personal directory found)'
      });
    }
    
    return suggestions;
  }
}