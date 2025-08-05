"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToolRegistry = void 0;
const directory_structure_js_1 = require("./directory-structure.js");
const file_path_suggestions_js_1 = require("./file-path-suggestions.js");
const note_operations_js_1 = require("./note-operations.js");
class ToolRegistry {
    constructor(vectorProcessor) {
        this.tools = new Map();
        this.registerCoreTools(vectorProcessor);
        this.registerStructureTools();
    }
    registerCoreTools(vectorProcessor) {
        const coreTools = [
            new note_operations_js_1.SearchNotesTool(vectorProcessor),
            new note_operations_js_1.GetNoteContentTool(),
            new note_operations_js_1.CreateNoteTool(),
            new note_operations_js_1.UpdateNoteTool(),
            new note_operations_js_1.AppendToNoteTool(),
        ];
        coreTools.forEach(tool => {
            this.tools.set(tool.definition.name, tool);
        });
    }
    registerStructureTools() {
        const structureTools = [
            new directory_structure_js_1.DirectoryStructureTool(),
            new file_path_suggestions_js_1.FilePathSuggestionTool(),
        ];
        structureTools.forEach(tool => {
            this.tools.set(tool.definition.name, tool);
        });
    }
    getAllTools() {
        return Array.from(this.tools.values());
    }
    getTool(name) {
        return this.tools.get(name);
    }
    getToolDefinitions() {
        return Array.from(this.tools.values()).map(tool => tool.definition);
    }
    hasToolDefinition(name) {
        return this.tools.has(name);
    }
}
exports.ToolRegistry = ToolRegistry;
//# sourceMappingURL=registry.js.map