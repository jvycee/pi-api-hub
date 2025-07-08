require('dotenv').config();

const config = {
  server: {
    port: parseInt(process.env.PORT) || 3000,
    mcpPort: parseInt(process.env.MCP_PORT) || 3001,
    env: process.env.NODE_ENV || 'development'
  },
  
  apis: {
    hubspot: {
      apiKey: process.env.HUBSPOT_API_KEY,
      baseUrl: 'https://api.hubapi.com',
      timeout: 30000
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: 'https://api.anthropic.com',
      timeout: 30000,
      version: '2023-06-01'
    }
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100 // limit each IP to 100 requests per windowMs
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: process.env.LOG_FILE_PATH || './logs/app.log'
  }
};

// Validation
function validateConfig() {
  const required = [
    'HUBSPOT_API_KEY',
    'ANTHROPIC_API_KEY'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  ...config,
  validateConfig
};