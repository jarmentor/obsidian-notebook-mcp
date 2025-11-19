import MarkdownIt from 'markdown-it';
import crypto from 'crypto';
import fetch from 'node-fetch';
import logger from './logger';
import type QdrantClientWrapper from './qdrantClient';

interface Document {
  id: string;
  path: string;
  content: string;
  frontmatter?: Record<string, any>;
  lastModified: string;
}

interface Chunk {
  text: string;
  start: number;
}

interface SearchResult {
  score: number;
  searchQuery: string;
  searchType: 'semantic' | 'full-text';
  file_path: string;
  chunk_index: number;
  text: string;
  title?: string;
  tags?: string[];
  frontmatter?: Record<string, any>;
  last_modified: string;
}

class VectorProcessor {
  private qdrantClient: QdrantClientWrapper;
  private ollamaUrl: string;
  private embedModel: string;
  private md: MarkdownIt;
  private collectionName: string;

  constructor(qdrantClient: QdrantClientWrapper) {
    this.qdrantClient = qdrantClient;
    this.ollamaUrl = process.env.OLLAMA_URL || 'http://host.docker.internal:11434';
    this.embedModel = process.env.EMBED_MODEL || 'nomic-embed-text:latest';
    this.md = new MarkdownIt();
    this.collectionName = 'obsidian_notes';
  }

  async initialize(): Promise<void> {
    try {
      await this.ensureCollection();
      logger.info('Vector processor initialized');
    } catch (error) {
      logger.error('Failed to initialize vector processor:', error);
      throw error;
    }
  }

  async ensureCollection(): Promise<void> {
    try {
      await this.qdrantClient.getCollection(this.collectionName);
      logger.info(`Collection '${this.collectionName}' already exists`);
    } catch (error) {
      logger.info(`Creating collection '${this.collectionName}'`);
      await this.qdrantClient.createCollection(this.collectionName, {
        vectors: {
          size: 768,
          distance: 'Cosine'
        }
      });
    }
  }

  async processDocument(document: Document): Promise<void> {
    try {
      logger.info(`Processing document: ${document.path}`);

      const chunks = this.chunkDocument(document);
      const points = [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const vector = await this.generateEmbedding(chunk.text);

        const pointId = this.generatePointId(document.id, i);

        points.push({
          id: pointId,
          vector,
          payload: {
            file_path: document.path,
            chunk_index: i,
            text: chunk.text,
            title: this.extractTitle(document),
            tags: this.extractTags(document),
            frontmatter: document.frontmatter,
            last_modified: document.lastModified
          }
        });
      }

      await this.qdrantClient.upsert(this.collectionName, {
        wait: true,
        points
      });

      logger.info(`Processed ${points.length} chunks for ${document.path}`);
    } catch (error) {
      logger.error(`Error processing document ${document.path}:`, error);
      throw error;
    }
  }

  async deleteDocument(filePath: string): Promise<void> {
    try {
      logger.info(`Deleting document: ${filePath}`);

      await this.qdrantClient.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: 'file_path',
              match: { value: filePath }
            }
          ]
        }
      });

      logger.info(`Deleted document: ${filePath}`);
    } catch (error) {
      logger.error(`Error deleting document ${filePath}:`, error);
      throw error;
    }
  }

  chunkDocument(document: Document): Chunk[] {
    const text = document.content;
    const maxChunkSize = 1000;
    const overlap = 100;
    const chunks: Chunk[] = [];

    const paragraphs = text.split(/\n\s*\n/);
    let currentChunk = '';

    for (const paragraph of paragraphs) {
      if (currentChunk.length + paragraph.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push({
          text: currentChunk.trim(),
          start: chunks.length * (maxChunkSize - overlap)
        });

        currentChunk = currentChunk.slice(-overlap) + paragraph;
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        text: currentChunk.trim(),
        start: chunks.length * (maxChunkSize - overlap)
      });
    }

    return chunks.length > 0 ? chunks : [{ text: text.trim(), start: 0 }];
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: this.embedModel,
          prompt: text
        })
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as { embedding: number[] };
      return data.embedding;
    } catch (error) {
      logger.error('Error generating embedding:', error);
      throw error;
    }
  }

  extractTitle(document: Document): string {
    if (document.frontmatter && document.frontmatter.title) {
      return document.frontmatter.title;
    }

    const lines = document.content.split('\n');
    for (const line of lines) {
      const match = line.match(/^#\s+(.+)$/);
      if (match) {
        return match[1].trim();
      }
    }

    return document.path.replace(/\.md$/, '').split('/').pop() || document.path;
  }

  extractTags(document: Document): string[] {
    const tags: string[] = [];

    if (document.frontmatter && document.frontmatter.tags) {
      if (Array.isArray(document.frontmatter.tags)) {
        tags.push(...document.frontmatter.tags);
      } else {
        tags.push(document.frontmatter.tags);
      }
    }

    const tagMatches = document.content.match(/#[\w-]+/g);
    if (tagMatches) {
      tags.push(...tagMatches.map(tag => tag.substring(1)));
    }

    return [...new Set(tags)];
  }

  generatePointId(filePath: string, chunkIndex: number): string {
    const input = `${filePath}_chunk_${chunkIndex}`;
    return crypto.createHash('md5').update(input).digest('hex');
  }

  async search(query: string, limit: number = 10): Promise<SearchResult[]> {
    try {
      // Enhance query with multiple variations
      const queries = this.expandQuery(query);
      console.error(`[DEBUG] Expanded "${query}" into ${queries.length} queries:`, queries);
      const allResults = new Map<string, SearchResult>();

      // 1. SEMANTIC SEARCH
      for (const searchQuery of queries) {
        const queryVector = await this.generateEmbedding(searchQuery);

        const searchResult = await this.qdrantClient.search(this.collectionName, {
          vector: queryVector,
          limit: limit * 2,
          with_payload: true,
          score_threshold: 0.3
        });

        console.error(`[DEBUG] Semantic query "${searchQuery}" returned ${searchResult.length} results`);

        searchResult.forEach((point: any) => {
          const key = `${point.payload.file_path}_${point.payload.chunk_index}`;
          if (!allResults.has(key) || allResults.get(key)!.score < point.score) {
            allResults.set(key, {
              score: point.score,
              searchQuery,
              searchType: 'semantic',
              ...point.payload
            });
          }
        });
      }

      // 2. FULL-TEXT SEARCH
      await this.addFullTextResults(queries, allResults, limit);

      // Sort by score and return top results
      return Array.from(allResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

    } catch (error) {
      logger.error('Error searching:', error);
      throw error;
    }
  }

  async addFullTextResults(queries: string[], allResults: Map<string, SearchResult>, limit: number): Promise<void> {
    try {
      for (const searchQuery of queries) {
        // Use Qdrant's scroll function to get all documents, then filter by text
        const scrollResult = await this.qdrantClient.rawClient.scroll(this.collectionName, {
          filter: {
            should: [
              {
                key: 'text',
                match: {
                  text: searchQuery
                }
              },
              {
                key: 'title',
                match: {
                  text: searchQuery
                }
              },
              {
                key: 'file_path',
                match: {
                  text: searchQuery
                }
              }
            ]
          },
          limit: limit * 2,
          with_payload: true
        });

        console.error(`[DEBUG] Full-text query "${searchQuery}" returned ${scrollResult.points?.length || 0} results`);

        // Process full-text results
        scrollResult.points?.forEach((point: any) => {
          const key = `${point.payload.file_path}_${point.payload.chunk_index}`;

          // Calculate full-text score based on match quality
          let textScore = this.calculateTextScore(searchQuery, point.payload);

          // Boost score for exact matches
          if (point.payload.text.toLowerCase().includes(searchQuery.toLowerCase())) {
            textScore += 0.2;
          }

          if (!allResults.has(key) || allResults.get(key)!.score < textScore) {
            allResults.set(key, {
              score: textScore,
              searchQuery,
              searchType: 'full-text',
              ...point.payload
            });
          }
        });
      }
    } catch (error: any) {
      console.error('[DEBUG] Full-text search error:', error.message);
      // Don't throw - full-text search is supplementary
    }
  }

  calculateTextScore(query: string, payload: any): number {
    const queryLower = query.toLowerCase();
    const text = payload.text.toLowerCase();
    const title = payload.title?.toLowerCase() || '';
    const filePath = payload.file_path.toLowerCase();

    let score = 0.5; // Base score for any match

    // Boost for exact phrase matches
    if (text.includes(queryLower)) score += 0.3;
    if (title.includes(queryLower)) score += 0.4;
    if (filePath.includes(queryLower)) score += 0.2;

    // Boost for word matches
    const queryWords = queryLower.split(/\s+/);
    queryWords.forEach(word => {
      if (word.length > 2) {
        if (text.includes(word)) score += 0.1;
        if (title.includes(word)) score += 0.15;
        if (filePath.includes(word)) score += 0.05;
      }
    });

    // Boost for matches at the beginning of text
    if (text.startsWith(queryLower)) score += 0.2;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  expandQuery(query: string): string[] {
    const queries = [query];
    const lowerQuery = query.toLowerCase();

    // Handle date patterns more aggressively
    const monthMap: Record<string, string> = {
      january: '01', february: '02', march: '03', april: '04',
      may: '05', june: '06', july: '07', august: '08',
      september: '09', october: '10', november: '11', december: '12'
    };

    // Extract and convert dates with many variations
    let match;
    if ((match = lowerQuery.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/))) {
      const month = monthMap[match[1]];
      const day = match[2].padStart(2, '0');
      const year = new Date().getFullYear();

      // Add ALL possible date formats
      const dateVariations = [
        `${month}-${day}`,           // 07-22
        `${year}-${month}-${day}`,   // 2025-07-22
        `${month}/${day}`,           // 07/22
        `${month}${day}`,            // 0722
        `${year}${month}${day}`,     // 20250722
        `${match[1]} ${match[2]}`,   // July 22
        `${match[1]}-${match[2]}`,   // July-22
        day,                         // 22
        month                        // 07
      ];

      dateVariations.forEach(date => queries.push(date));

      // CRITICAL: Try just the date without other context
      dateVariations.forEach(date => {
        queries.push(date); // Just the date alone
      });
    }

    // Aggressive keyword extraction - try each meaningful word individually
    const meaningfulWords = lowerQuery.split(/\s+/).filter(word =>
      word.length > 2 &&
      !['the', 'and', 'for', 'from', 'about', 'can', 'you', 'tell', 'anything', 'notes'].includes(word)
    );

    meaningfulWords.forEach(word => {
      queries.push(word);
    });

    // Add context-aware variations
    if (lowerQuery.includes('meeting')) {
      queries.push('## Meetings');
      queries.push('Meetings & Appointments');
      queries.push('meeting notes');
      queries.push('appointment');
      queries.push('Meeting');
      queries.push('meetings');
    }

    if (lowerQuery.includes('daily')) {
      queries.push('daily note');
      queries.push('## Daily');
      queries.push('Daily');
      queries.push('today');
    }

    if (lowerQuery.includes('appointment')) {
      queries.push('## Appointments');
      queries.push('meeting');
      queries.push('schedule');
      queries.push('Appointment');
    }

    // Try combinations of date + context
    if (match && lowerQuery.includes('meeting')) {
      const month = monthMap[match[1]];
      const day = match[2].padStart(2, '0');

      queries.push(`${month}-${day} meeting`);
      queries.push(`${month}-${day} Meeting`);
      queries.push(`Meeting ${month}-${day}`);
    }

    return [...new Set(queries)]; // Remove duplicates
  }
}

export default VectorProcessor;
