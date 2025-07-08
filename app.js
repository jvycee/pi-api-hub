const express = require('express');
const cors = require('cors');
const config = require('./shared/config');
const logger = require('./shared/logger');
const AuthHandler = require('./middleware/auth-handler');

// Validate configuration
try {
  config.validateConfig();
} catch (error) {
  logger.error('Configuration validation failed:', error.message);
  process.exit(1);
}

const app = express();
const authHandler = new AuthHandler();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.env
  });
});

// API connection test endpoint
app.get('/api/test-connections', async (req, res) => {
  try {
    const results = await authHandler.testConnections();
    res.json({
      success: true,
      connections: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test connections',
      timestamp: new Date().toISOString()
    });
  }
});

// HubSpot proxy endpoints
app.get('/api/hubspot/contacts', async (req, res) => {
  try {
    const { limit = 10, after } = req.query;
    let endpoint = `/crm/v3/objects/contacts?limit=${limit}`;
    if (after) endpoint += `&after=${after}`;

    const data = await authHandler.callHubSpot(endpoint);
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.post('/api/hubspot/contacts', async (req, res) => {
  try {
    const contactData = req.body;
    const data = await authHandler.callHubSpot('/crm/v3/objects/contacts', 'POST', {
      properties: contactData
    });
    
    res.status(201).json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// HubSpot Search endpoints
app.post('/api/hubspot/search/:objectType', async (req, res) => {
  try {
    const { objectType } = req.params;
    const searchRequest = req.body;
    
    // Validate object type
    const validObjectTypes = ['contacts', 'companies', 'deals', 'tickets', 'products'];
    if (!validObjectTypes.includes(objectType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid object type. Must be one of: ${validObjectTypes.join(', ')}`,
        timestamp: new Date().toISOString()
      });
    }

    const data = await authHandler.searchHubSpot(objectType, searchRequest);
    
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      category: error.response?.data?.category,
      timestamp: new Date().toISOString()
    });
  }
});

// HubSpot GraphQL endpoint
app.post('/api/hubspot/graphql', async (req, res) => {
  try {
    const { query, variables = {} } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'GraphQL query is required',
        timestamp: new Date().toISOString()
      });
    }

    const data = await authHandler.callHubSpotGraphQL(query, variables);
    
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors?.[0]?.message || error.message,
      errors: error.response?.data?.errors,
      timestamp: new Date().toISOString()
    });
  }
});

// Anthropic proxy endpoint
app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const { model = 'claude-3-haiku-20240307', max_tokens = 1000, messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required',
        timestamp: new Date().toISOString()
      });
    }

    const data = await authHandler.callAnthropic({
      model,
      max_tokens,
      messages
    });

    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.error?.message || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Generic HubSpot proxy for any endpoint
app.all('/api/hubspot/*', async (req, res) => {
  try {
    const endpoint = req.path.replace('/api/hubspot', '');
    const data = await authHandler.callHubSpot(endpoint, req.method, req.body);
    
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(config.server.port, () => {
  logger.info(`API Middleware server running on port ${config.server.port}`);
  logger.info(`Environment: ${config.server.env}`);
  logger.info('Available endpoints:');
  logger.info('  GET  /health - Health check');
  logger.info('  GET  /api/test-connections - Test API connections');
  logger.info('  GET  /api/hubspot/contacts - Get HubSpot contacts');
  logger.info('  POST /api/hubspot/contacts - Create HubSpot contact');
  logger.info('  POST /api/anthropic/messages - Send message to Claude');
  logger.info('  POST /api/hubspot/search/:objectType - Search HubSpot objects');
  logger.info('  POST /api/hubspot/search/:objectType - Search HubSpot objects');
  logger.info('  POST /api/hubspot/graphql - HubSpot GraphQL queries');
  logger.info('  ALL  /api/hubspot/* - Proxy to any HubSpot endpoint');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;