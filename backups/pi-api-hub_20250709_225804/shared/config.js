require('dotenv').config();

// Shared CORS configuration - single source of truth
const corsOrigins = process.env.CORS_ORIGINS ? 
  process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : 
  (process.env.NODE_ENV === 'production' ? ['https://your-domain.com'] : ['http://localhost:3000']);

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
      timeout: 60000 // Increased for Pi ARM CPU
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: 'https://api.anthropic.com',
      timeout: 60000, // Increased for Pi ARM CPU
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
  },

  performance: {
    maxResponseSize: parseInt(process.env.MAX_RESPONSE_SIZE) || 100 * 1024 * 1024, // 100MB max response - Pi 5 can handle it!
    maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS) || 25, // 25 concurrent - unleash the Pi 5 power!
    memoryThresholds: {
      warning: parseInt(process.env.MEMORY_WARNING_THRESHOLD) || 7 * 1024 * 1024 * 1024, // 7GB - 87.5% of 8GB
      critical: parseInt(process.env.MEMORY_CRITICAL_THRESHOLD) || 7.5 * 1024 * 1024 * 1024 // 7.5GB - 93.75% of 8GB  
    }
  },

  security: {
    adminApiKey: process.env.ADMIN_API_KEY,
    enableSecurityHeaders: process.env.ENABLE_SECURITY_HEADERS !== 'false',
    enableInputValidation: process.env.ENABLE_INPUT_VALIDATION !== 'false',
    enableHttps: process.env.ENABLE_HTTPS === 'true',
    sslCertPath: process.env.SSL_CERT_PATH,
    sslKeyPath: process.env.SSL_KEY_PATH,
    httpsPort: parseInt(process.env.HTTPS_PORT) || 443,
    rateLimitAdmin: {
      windowMs: parseInt(process.env.ADMIN_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX_REQUESTS) || 10 // Very restrictive for admin
    },
    rateLimitAuth: {
      windowMs: parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS) || 50 // Auth endpoints
    },
    rateLimitApi: {
      windowMs: parseInt(process.env.API_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS) || 500 // API endpoints
    },
    rateLimitMonitoring: {
      windowMs: parseInt(process.env.MONITORING_RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute
      max: parseInt(process.env.MONITORING_RATE_LIMIT_MAX_REQUESTS) || 60 // Monitoring endpoints
    }
  },

  // Shared CORS origins used throughout the application
  corsOrigins
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

  // Security warnings
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.ADMIN_API_KEY) {
      console.warn('🚨 WARNING: ADMIN_API_KEY not set in production! Admin endpoints will be disabled.');
    }
    
    if (!process.env.CORS_ORIGINS) {
      console.warn('🚨 WARNING: CORS_ORIGINS not set in production! Using default restrictive origins.');
    }
    
    // Only warn about SSL if HTTPS is intended to be enabled
    if (process.env.ENABLE_HTTPS === 'true') {
      if (!process.env.SSL_CERT_PATH || !process.env.SSL_KEY_PATH) {
        console.warn('🚨 WARNING: SSL certificates not configured but HTTPS enabled! HTTPS will not work.');
      }
    }
  }
}

module.exports = {
  ...config,
  validateConfig
};