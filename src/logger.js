const winston = require('winston');
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// For MCP server, create a silent logger to avoid stdout interference
const transports = [];

if (!process.env.MCP_SERVER) {
  // Normal operation - use file logging
  transports.push(
    new winston.transports.File({ filename: path.join(logsDir, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'combined.log') })
  );
  
  // Add console transport in development
  if (process.env.NODE_ENV !== 'production') {
    transports.push(new winston.transports.Console({
      format: winston.format.simple()
    }));
  }
} else {
  // MCP server mode - only log to files to avoid stdout interference
  transports.push(
    new winston.transports.File({ filename: path.join(logsDir, 'mcp-error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(logsDir, 'mcp-combined.log') })
  );
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-note-searcher' },
  transports,
  silent: process.env.MCP_SERVER === 'true' // Completely silence when MCP_SERVER is true
});

module.exports = logger;