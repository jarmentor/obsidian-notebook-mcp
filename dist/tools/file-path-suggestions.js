"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FilePathSuggestionTool = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const base_js_1 = require("./base.js");
class FilePathSuggestionTool extends base_js_1.BaseTool {
    constructor() {
        super(...arguments);
        this.definition = {
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
        this.handler = async (args) => {
            const { content_type, filename, content_preview = '', date } = args;
            try {
                const basePath = this.getNotebookPath();
                const existingStructure = await this.analyzeExistingStructure(basePath);
                const suggestions = await this.generatePathSuggestions(content_type, filename, content_preview, date, existingStructure);
                return this.createResponse({
                    content_type,
                    suggestions,
                    existing_structure: existingStructure,
                    message: `Generated ${suggestions.length} path suggestions`
                });
            }
            catch (error) {
                return this.createResponse({
                    error: `Could not generate path suggestions: ${error.message}`,
                    content_type
                });
            }
        };
    }
    async analyzeExistingStructure(basePath) {
        const structure = {};
        try {
            const entries = await fs_1.promises.readdir(basePath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory() && !entry.name.startsWith('.')) {
                    structure[entry.name] = [];
                    try {
                        const subEntries = await fs_1.promises.readdir(path.join(basePath, entry.name), { withFileTypes: true });
                        for (const subEntry of subEntries) {
                            if (subEntry.isDirectory()) {
                                structure[entry.name].push(subEntry.name);
                            }
                        }
                    }
                    catch {
                        // Can't read subdirectory, that's okay
                    }
                }
            }
        }
        catch (error) {
            // If we can't read the base path, return empty structure
        }
        return structure;
    }
    async generatePathSuggestions(contentType, filename, contentPreview, date, existingStructure) {
        const suggestions = [];
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
    generateDailyNoteSuggestions(date, structure) {
        const suggestions = [];
        const dateStr = date || new Date().toISOString().split('T')[0];
        // Check existing daily note directories
        const dailyDirs = Object.keys(structure || {}).filter(dir => dir.toLowerCase().includes('daily') || dir.toLowerCase().includes('journal'));
        if (dailyDirs.length === 0) {
            // No existing daily directories, suggest creating one
            suggestions.push({
                suggested_path: `daily/${dateStr}.md`,
                confidence: 0.8,
                reason: 'Standard daily notes structure (no existing daily directory found)'
            });
        }
        else {
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
    generateProjectSuggestions(filename, content, structure) {
        const suggestions = [];
        const projectDirs = Object.keys(structure || {}).filter(dir => dir.toLowerCase().includes('project') || dir.toLowerCase().includes('client'));
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
        }
        else {
            suggestions.push({
                suggested_path: `projects/${baseFilename}.md`,
                confidence: 0.8,
                reason: 'Standard projects structure (no existing projects directory found)'
            });
        }
        return suggestions;
    }
    generateMeetingSuggestions(filename, content, structure) {
        const suggestions = [];
        const meetingDirs = Object.keys(structure || {}).filter(dir => dir.toLowerCase().includes('meeting') || dir.toLowerCase().includes('call'));
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
        }
        else {
            suggestions.push({
                suggested_path: `meetings/${baseFilename}.md`,
                confidence: 0.8,
                reason: 'Standard meetings structure (no existing meetings directory found)'
            });
        }
        return suggestions;
    }
    generateTechnicalSuggestions(filename, content, structure) {
        const suggestions = [];
        const techDirs = Object.keys(structure || {}).filter(dir => dir.toLowerCase().includes('development') ||
            dir.toLowerCase().includes('technical') ||
            dir.toLowerCase().includes('code') ||
            dir.toLowerCase().includes('doc'));
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
                }
                else {
                    suggestions.push({
                        suggested_path: `${dir}/${baseFilename}.md`,
                        confidence: 0.8,
                        reason: `Using existing technical directory: ${dir}`,
                        existing_similar: [dir]
                    });
                }
            });
        }
        else {
            suggestions.push({
                suggested_path: `Development/Documentation/${baseFilename}.md`,
                confidence: 0.7,
                reason: 'Standard technical documentation structure'
            });
        }
        return suggestions;
    }
    generatePersonalSuggestions(filename, content, structure) {
        const suggestions = [];
        const personalDirs = Object.keys(structure || {}).filter(dir => dir.toLowerCase().includes('personal') || dir.toLowerCase().includes('private'));
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
        }
        else {
            suggestions.push({
                suggested_path: `personal/${baseFilename}.md`,
                confidence: 0.8,
                reason: 'Standard personal notes structure (no existing personal directory found)'
            });
        }
        return suggestions;
    }
}
exports.FilePathSuggestionTool = FilePathSuggestionTool;
//# sourceMappingURL=file-path-suggestions.js.map