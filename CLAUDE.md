# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Note Searcher 5000 is a dockerized semantic search system for Obsidian notes. It watches a local Obsidian notebook folder, creates vector embeddings using Ollama, stores them in Qdrant, and provides an MCP (Model Context Protocol) server for LLMs to search and manage notes semantically.

## Architecture

### Core Components

- **AINotesearcher** (`src/index.ts`): Main orchestrator class that initializes all components
- **FileWatcher** (`src/fileWatcher.js`): Monitors Obsidian notebook folder using chokidar, processes .md files
- **VectorProcessor** (`src/vectorProcessor.js`): Handles text chunking, embedding generation via Ollama, and hybrid search (semantic + full-text)
- **QdrantClient** (`src/qdrantClient.js`): Wrapper for Qdrant vector database operations
- **MCPServer** (`src/mcpServer.ts`): TypeScript MCP server using modular tool architecture
- **ToolRegistry** (`src/tools/registry.ts`): Manages registration and lookup of MCP tools

### MCP Tool Architecture

The project uses a modular tool system with base classes and specialized implementations:

- **BaseTool** (`src/tools/base.ts`): Abstract base class for all MCP tools
- **Core Tools** (`src/tools/note-operations.ts`): Search, create, update, append note operations
- **Structure Tools** (`src/tools/directory-structure.ts`, `file-path-suggestions.ts`): Directory navigation and file organization helpers
- **Daily Note Tools** (`src/tools/daily-notes-tool.ts`): Daily note-specific operations like retrieving the latest daily note

The TypeScript MCP server (`src/mcpServer.ts`) delegates tool execution to the ToolRegistry, which maintains a map of tool instances. Each tool implements the `MCPTool` interface with a definition (name, description, schema) and handler function.

### Data Flow

1. FileWatcher detects .md file changes in mounted Obsidian folder
2. Files are parsed (frontmatter + content) and chunked for optimal embedding
3. VectorProcessor generates embeddings using Ollama's `nomic-embed-text:latest` model
4. Vectors stored in Qdrant with metadata (file path, title, tags, etc.)
5. MCP server exposes tools via ToolRegistry for LLM interaction

### Deployment Architecture

- **Docker Compose**: Two services (qdrant + ai-note-searcher)
- **Volume Mounts**: `/Volumes/Development/Notebook` → `/app/notebook` (read-only)
- **Networking**: Qdrant on localhost:6333, Ollama on host via `host.docker.internal:11434`
- **Persistence**: Qdrant data stored in `./qdrant_data/` directory
- **Dual Runtime**: Mixed JavaScript (core processing) and TypeScript (MCP server) codebase

## Development Commands

### Building
```bash
# Install dependencies
npm install

# Build TypeScript to JavaScript
npm run build

# Watch mode for development
npm run watch
```

### Running
```bash
# Run main application (requires build first)
npm start

# Development with auto-reload using ts-node
npm run dev

# Alternative development with nodemon
npm run dev:nodemon
```

### Docker Operations
```bash
# Start full stack
docker-compose up

# Rebuild after code changes
docker-compose build ai-note-searcher

# Force reindex all notes
docker-compose restart ai-note-searcher

# Clear vector database completely
docker-compose down && rm -rf qdrant_data && docker-compose up
```

### MCP Server for Claude Desktop
```bash
# Standalone MCP server (bypasses Docker)
node mcp-server.js
```

### Adding New MCP Tools

When adding new tools to the MCP server:

1. Create a new tool class in `src/tools/` extending `BaseTool`
2. Implement the `definition` property with name, description, and inputSchema
3. Implement the `handler` method with tool logic
4. Register the tool in `src/tools/registry.ts` in the appropriate category
5. Run `npm run build` to compile TypeScript
6. Restart the MCP server or Docker container

## Configuration

### Environment Variables
- `QDRANT_URL`: Vector database connection (default: `http://qdrant:6333` in Docker)
- `OLLAMA_URL`: Embedding service connection (default: `http://host.docker.internal:11434`)
- `NOTEBOOK_PATH`: Obsidian folder path (default: `/app/notebook`)
- `EMBED_MODEL`: Ollama model for embeddings (default: `nomic-embed-text:latest`)
- `MCP_SERVER`: Set to "true" to disable console logging for MCP protocol compatibility

### Claude Desktop Integration
Update `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "ai-note-searcher": {
      "command": "node",
      "args": ["/path/to/ai-note-searcher-5000/mcp-server.js"],
      "env": {
        "QDRANT_URL": "http://127.0.0.1:6333",
        "OLLAMA_URL": "http://127.0.0.1:11434",
        "NOTEBOOK_PATH": "/Volumes/Development/Notebook",
        "MCP_SERVER": "true"
      }
    }
  }
}
```

## Key Implementation Details

### TypeScript/JavaScript Hybrid Architecture

The project uses a mixed JavaScript and TypeScript codebase:

- **Core processing** (FileWatcher, VectorProcessor, QdrantClient): JavaScript for stability and simplicity
- **MCP server and tools**: TypeScript for type safety and modern tooling
- **Build process**: TypeScript compiles to `dist/`, JavaScript files run directly
- **Type definitions**: `.d.ts` files provide TypeScript definitions for JavaScript modules

When working on the codebase:
- Changes to `src/tools/*.ts` or `src/mcpServer.ts` require `npm run build`
- Changes to `src/*.js` files (core processing) don't require compilation
- The main entry point `src/index.ts` orchestrates both JS and TS components

### Search Strategy

VectorProcessor (`src/vectorProcessor.js`) implements hybrid search combining:
- **Semantic search**: Vector similarity using embeddings
- **Full-text search**: Literal text matching in content/titles/paths
- **Query expansion**: Aggressive date format conversion and keyword extraction
- **Low similarity threshold**: 0.3 for maximum fuzziness

### File Processing
- Supports frontmatter parsing with gray-matter
- Chunks documents at ~1000 chars with 100 char overlap
- Extracts titles from frontmatter or first H1
- Parses hashtags from content and frontmatter
- Generates MD5 hashes as Qdrant point IDs

### Error Handling
- Logging via Winston (files + console, disabled in MCP mode)
- Network issues don't crash the system
- Individual file processing errors are logged but don't stop batch operations
- MCP tools catch errors and wrap them in McpError with appropriate error codes

## Debugging

### Common Issues
- **"fetch failed"**: Usually IPv6 localhost resolution - use `127.0.0.1` instead of `localhost`
- **No search results**: Check if files are being processed in Docker logs
- **MCP JSON parsing errors**: Ensure `MCP_SERVER=true` to disable console logging

### Monitoring
- Check Docker logs: `docker-compose logs --tail 50 ai-note-searcher`
- Qdrant dashboard: http://localhost:6333/dashboard
- File processing logs show chunk counts per document
- MCP logs in Claude Desktop show search query expansions and result counts