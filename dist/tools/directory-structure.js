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
exports.DirectoryStructureTool = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const base_js_1 = require("./base.js");
class DirectoryStructureTool extends base_js_1.BaseTool {
    constructor() {
        super(...arguments);
        this.definition = {
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
        this.handler = async (args) => {
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
            }
            catch (error) {
                return this.createResponse({
                    error: `Could not read directory structure: ${error.message}`,
                    notebook_path: basePath,
                    folder_filter
                });
            }
        };
    }
    async buildDirectoryStructure(currentPath, basePath, maxDepth, includeFiles, currentDepth) {
        if (currentDepth >= maxDepth) {
            return {};
        }
        const structure = {};
        try {
            const entries = await fs_1.promises.readdir(currentPath, { withFileTypes: true });
            for (const entry of entries) {
                // Skip hidden files and node_modules
                if (entry.name.startsWith('.') || entry.name === 'node_modules') {
                    continue;
                }
                const fullPath = path.join(currentPath, entry.name);
                if (entry.isDirectory()) {
                    structure[entry.name] = await this.buildDirectoryStructure(fullPath, basePath, maxDepth, includeFiles, currentDepth + 1);
                }
                else if (entry.isFile() && includeFiles) {
                    if (!structure['_files']) {
                        structure['_files'] = [];
                    }
                    structure['_files'].push(entry.name);
                }
            }
        }
        catch (error) {
            // If we can't read a directory, just mark it as inaccessible
            structure['_error'] = ['Access denied or directory not found'];
        }
        return structure;
    }
}
exports.DirectoryStructureTool = DirectoryStructureTool;
//# sourceMappingURL=directory-structure.js.map