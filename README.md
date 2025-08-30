# AI Note Searcher 5000

A dockerized semantic search system for Obsidian notes that provides intelligent search capabilities through vector embeddings and an MCP (Model Context Protocol) server for LLM integration.

## Overview

AI Note Searcher 5000 watches your Obsidian notebook folder, creates vector embeddings using Ollama, stores them in Qdrant, and provides semantic search capabilities through an MCP server that LLMs can use to search your notes intelligently.

## Features

- **Real-time File Watching**: Automatically processes markdown files as they're added or modified
- **Semantic Search**: Vector-based similarity search using embeddings
- **Hybrid Search**: Combines semantic and full-text search for better results
- **MCP Server**: Model Context Protocol server for LLM integration
- **Docker Deployment**: Fully containerized with persistent storage
- **Obsidian Integration**: Designed specifically for Obsidian note structures
- **Frontmatter Support**: Parses YAML frontmatter for metadata extraction

## Architecture

### Core Components

- **AINotesearcher**: Main orchestrator that initializes all components
- **FileWatcher**: Monitors Obsidian folder using chokidar for file changes
- **VectorProcessor**: Handles text chunking and embedding generation via Ollama
- **QdrantClient**: Vector database operations wrapper
- **MCPServer**: Exposes search tools to LLMs via Model Context Protocol

### Technology Stack

- **Node.js/TypeScript**: Core application runtime
- **Qdrant**: Vector database for embeddings storage
- **Ollama**: Local embedding generation (`nomic-embed-text:latest`)
- **Docker Compose**: Container orchestration
- **MCP SDK**: Model Context Protocol implementation

## Quick Start

### Prerequisites

- Docker and Docker Compose
- [Ollama](https://ollama.ai) running locally with `nomic-embed-text:latest` model
- An Obsidian vault/notebook folder

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-note-searcher-5000
```

2. Update the notebook path in `docker-compose.yml`:
```yaml
volumes:
  - /path/to/your/obsidian/notebook:/app/notebook:ro
```

3. Pull the Ollama model:
```bash
ollama pull nomic-embed-text:latest
```

4. Start the services:
```bash
docker-compose up
```

The system will automatically:
- Start Qdrant vector database on `localhost:6333`
- Begin watching your notebook folder for changes
- Process existing markdown files and create embeddings
- Start the MCP server for LLM integration

## Usage

### Docker Commands

```bash
# Start the full stack
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

# Build TypeScript
npm run build

# Development with auto-reload
npm run dev

# Start the application
npm start
```

### MCP Server Integration

For Claude Desktop integration, update your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ai-note-searcher": {
      "command": "node",
      "args": ["/path/to/ai-note-searcher-5000/mcp-server.js"],
      "env": {
        "QDRANT_URL": "http://127.0.0.1:6333",
        "OLLAMA_URL": "http://127.0.0.1:11434",
        "NOTEBOOK_PATH": "/path/to/your/notebook",
        "MCP_SERVER": "true"
      }
    }
  }
}
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `QDRANT_URL` | `http://qdrant:6333` | Vector database connection |
| `OLLAMA_URL` | `http://host.docker.internal:11434` | Ollama API endpoint |
| `NOTEBOOK_PATH` | `/app/notebook` | Path to Obsidian folder |
| `EMBED_MODEL` | `nomic-embed-text:latest` | Ollama embedding model |
| `MCP_SERVER` | `false` | Disable console logging for MCP mode |

### Search Features

- **Semantic similarity**: Vector-based search using embeddings
- **Full-text matching**: Literal text search in titles and content
- **Query expansion**: Automatic date format conversion and keyword extraction
- **Low similarity threshold**: 0.3 for maximum search fuzziness
- **Metadata search**: Searches through frontmatter tags and properties

## File Processing

- Supports YAML frontmatter parsing
- Chunks documents at ~1000 characters with 100 character overlap
- Extracts titles from frontmatter or first H1 heading
- Parses hashtags from content and frontmatter
- Generates MD5 hashes as unique Qdrant point identifiers

## MCP Tools Available

When integrated with an LLM via MCP, the following tools are available:

- `search_notes`: Semantic search through your note collection
- `get_note_content`: Retrieve full content of specific notes
- Additional file management and directory tools

## Monitoring

- **Qdrant Dashboard**: http://localhost:6333/dashboard
- **Docker Logs**: `docker-compose logs --tail 50 ai-note-searcher`
- **File Processing**: Logs show chunk counts and processing status

## Troubleshooting

### Common Issues

- **"fetch failed" errors**: Use `127.0.0.1` instead of `localhost` for URLs
- **No search results**: Check Docker logs to verify file processing
- **MCP JSON parsing errors**: Ensure `MCP_SERVER=true` to disable console logging
- **Connection refused**: Verify Ollama is running and accessible

### Development

For local development without Docker:
1. Start Qdrant locally or use the Docker service
2. Ensure Ollama is running on localhost:11434
3. Set environment variables appropriately
4. Use `npm run dev` for auto-reload

## License

MIT License

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions, please use the GitHub issue tracker.