# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI Note Searcher 5000 is a dockerized semantic search system for Obsidian notes. It watches a local Obsidian notebook folder, creates vector embeddings using Ollama, stores them in Qdrant, and provides an MCP (Model Context Protocol) server for LLMs to search notes semantically.

## Architecture

### Core Components

- **AINotesearcher** (`src/index.js`): Main orchestrator class that initializes all components
- **FileWatcher** (`src/fileWatcher.js`): Monitors Obsidian notebook folder using chokidar, processes .md files
- **VectorProcessor** (`src/vectorProcessor.js`): Handles text chunking, embedding generation via Ollama, and hybrid search (semantic + full-text)
- **QdrantClient** (`src/qdrantClient.js`): Wrapper for Qdrant vector database operations
- **MCPServer** (`src/mcpServer.js`): Model Context Protocol server providing search tools to LLMs

### Data Flow

1. FileWatcher detects .md file changes in mounted Obsidian folder
2. Files are parsed (frontmatter + content) and chunked for optimal embedding
3. VectorProcessor generates embeddings using Ollama's `nomic-embed-text:latest` model
4. Vectors stored in Qdrant with metadata (file path, title, tags, etc.)
5. MCP server exposes `search_notes` and `get_note_content` tools for LLM interaction

### Deployment Architecture

- **Docker Compose**: Two services (qdrant + ai-note-searcher)
- **Volume Mounts**: `/Volumes/Development/Notebook` → `/app/notebook` (read-only)
- **Networking**: Qdrant on localhost:6333, Ollama on host via `host.docker.internal:11434`
- **Persistence**: Qdrant data stored in `./qdrant_data/` directory

## Development Commands

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

### Local Development
```bash
# Install dependencies
npm install

# Development with auto-reload (requires local Qdrant/Ollama)
npm run dev

# Run main application
npm start
```

### MCP Server for Claude Desktop
```bash
# Standalone MCP server (bypasses Docker)
node mcp-server.js
```

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

### Search Strategy
VectorProcessor implements hybrid search combining:
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