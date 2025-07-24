A dockerized thing.

a connection to host folder "/Volumes/Development/Notebook/" (this is my obsidian notebook folder).
A qdrant instance with persistent data storage
Application/thing should watch for changes in that notebook and creates/updates vectors in qdrant
MCP server for an LLM to search the qdrant semantically
Might be good to have some level of caching or something idk
