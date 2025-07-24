const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs').promises;
const matter = require('gray-matter');
const logger = require('./logger');

class FileWatcher {
  constructor(notebookPath, vectorProcessor) {
    this.notebookPath = notebookPath;
    this.vectorProcessor = vectorProcessor;
    this.watcher = null;
  }

  async start() {
    logger.info(`Starting file watcher for: ${this.notebookPath}`);
    
    this.watcher = chokidar.watch('**/*.md', {
      cwd: this.notebookPath,
      ignored: /(^|[\/\\])\../,
      persistent: true
    });

    this.watcher
      .on('add', (filePath) => this.handleFileChange(filePath, 'add'))
      .on('change', (filePath) => this.handleFileChange(filePath, 'change'))
      .on('unlink', (filePath) => this.handleFileDelete(filePath))
      .on('ready', () => {
        logger.info('File watcher ready');
        this.processExistingFiles();
      })
      .on('error', (error) => {
        logger.error('File watcher error:', error);
      });
  }

  async handleFileChange(filePath, eventType) {
    try {
      const fullPath = path.join(this.notebookPath, filePath);
      logger.info(`File ${eventType}: ${filePath}`);
      
      const content = await fs.readFile(fullPath, 'utf8');
      const parsed = matter(content);
      
      const document = {
        id: filePath,
        path: filePath,
        content: parsed.content,
        frontmatter: parsed.data,
        lastModified: new Date().toISOString()
      };

      await this.vectorProcessor.processDocument(document);
    } catch (error) {
      logger.error(`Error processing file ${filePath}:`, error);
    }
  }

  async handleFileDelete(filePath) {
    try {
      logger.info(`File deleted: ${filePath}`);
      await this.vectorProcessor.deleteDocument(filePath);
    } catch (error) {
      logger.error(`Error deleting file ${filePath}:`, error);
    }
  }

  async processExistingFiles() {
    try {
      const files = await this.getMarkdownFiles(this.notebookPath);
      logger.info(`Processing ${files.length} existing files`);
      
      for (const filePath of files) {
        const relativePath = path.relative(this.notebookPath, filePath);
        await this.handleFileChange(relativePath, 'initial');
      }
    } catch (error) {
      logger.error('Error processing existing files:', error);
    }
  }

  async getMarkdownFiles(dir) {
    const files = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        const subFiles = await this.getMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      logger.info('File watcher stopped');
    }
  }
}

module.exports = FileWatcher;