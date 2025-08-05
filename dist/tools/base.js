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
exports.BaseTool = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const matter = require('gray-matter');
class BaseTool {
    getNotebookPath() {
        return process.env.NOTEBOOK_PATH || '/app/notebook';
    }
    async readNote(filePath) {
        const fullPath = path.join(this.getNotebookPath(), filePath);
        const content = await fs_1.promises.readFile(fullPath, 'utf8');
        return matter(content);
    }
    async writeNote(filePath, content, frontmatter) {
        const fullPath = path.join(this.getNotebookPath(), filePath);
        await fs_1.promises.mkdir(path.dirname(fullPath), { recursive: true });
        let fileContent;
        if (frontmatter && Object.keys(frontmatter).length > 0) {
            fileContent = matter.stringify(content, frontmatter);
        }
        else {
            fileContent = content;
        }
        await fs_1.promises.writeFile(fullPath, fileContent, 'utf8');
    }
    async fileExists(filePath) {
        try {
            const fullPath = path.join(this.getNotebookPath(), filePath);
            await fs_1.promises.access(fullPath);
            return true;
        }
        catch {
            return false;
        }
    }
    async getMarkdownFilesRecursive(dir) {
        const files = [];
        const entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                const subFiles = await this.getMarkdownFilesRecursive(fullPath);
                files.push(...subFiles);
            }
            else if (entry.isFile() && entry.name.endsWith('.md')) {
                files.push(fullPath);
            }
        }
        return files;
    }
    createResponse(data) {
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
exports.BaseTool = BaseTool;
//# sourceMappingURL=base.js.map