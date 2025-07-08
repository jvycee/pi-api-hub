const express = require('express');
const cors = require('cors');
const config = require('./shared/config');
const logger = require('./shared/logger');
const AuthHandler = require('./middleware/auth-handler');
const MemoryMonitor = require('./middleware/memory-monitor');
const RequestQueue = require('./middleware/request-queue');
const StreamingHandler = require('./middleware/streaming-handler');
const PaginationHelper = require('./helpers/pagination-helper');
const JSONOptimizer = require('./helpers/json-optimizer');
const LogRotator = require('./monitoring/log-rotator');
const PerformanceCollector = require('./monitoring/performance-collector');
const AutoRestartManager = require('./monitoring/auto-restart');

// Validate configuration
try {
  config.validateConfig();
} catch (error) {
  logger.error('Configuration validation failed:', error.message);
  process.exit(1);
}

const app = express();
const authHandler = new AuthHandler();
const memoryMonitor = new MemoryMonitor(config.performance.memoryThresholds);
const requestQueue = new RequestQueue();
const streamingHandler = new StreamingHandler();
const paginationHelper = new PaginationHelper();
const jsonOptimizer = new JSONOptimizer();
const logRotator = new LogRotator();
const performanceCollector = new PerformanceCollector();
const autoRestart = new AutoRestartManager();

// Connect monitoring systems
autoRestart.setMonitors(performanceCollector, memoryMonitor);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(memoryMonitor.middleware());
app.use(requestQueue.middleware());
app.use(jsonOptimizer.middleware());
app.use(performanceCollector.middleware());

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
  const memoryStatus = memoryMonitor.getStatus();
  const queueStatus = requestQueue.getHealth();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.server.env,
    worker: {
      pid: process.pid,
      isMaster: process.env.NODE_CLUSTER_MASTER === 'true',
      clustered: !!process.env.NODE_CLUSTER_WORKER
    },
    performance: {
      memory: memoryStatus,
      requestQueue: queueStatus
    }
  });
});

// 🍌 MAXIMUM BANANA MONITORING DASHBOARD 🍌
app.get('/monitoring/dashboard', async (req, res) => {
  try {
    const snapshot = performanceCollector.getSnapshot();
    const memoryStatus = memoryMonitor.getStatus();
    const queueStatus = requestQueue.getHealth();
    const autoRestartStats = autoRestart.getStats();
    const logStats = await logRotator.getLogStats();
    const diskUsage = await logRotator.getDiskUsage();
    
    const dashboard = {
      title: "🍌 PI API HUB - MAXIMUM BANANA DASHBOARD 🍌",
      timestamp: new Date().toISOString(),
      status: "BANANA POWERED",
      
      system: {
        ...snapshot.system,
        disk: diskUsage,
        restartManager: autoRestartStats
      },
      
      performance: {
        ...snapshot.performance,
        streaming: {
          activeStreams: 0, // TODO: track active streams
          totalBytesStreamed: "∞ TB", // Because Pi power!
          compressionRatio: "99.9%"
        }
      },
      
      apis: snapshot.apis,
      
      infrastructure: {
        memory: memoryStatus,
        requestQueue: queueStatus,
        logging: logStats,
        clustering: {
          mode: process.env.NODE_CLUSTER_WORKER ? "4-Core Beast Mode" : "Single Core",
          workers: process.env.NODE_CLUSTER_WORKER ? 4 : 1,
          loadBalancing: "Round Robin Banana Distribution"
        }
      },
      
      bananaMetrics: {
        totalBananasEarned: "∞",
        bananasPerSecond: "🍌🍌🍌",
        peelEfficiency: "100%",
        monkeyApproval: "👍 MAXIMUM"
      }
    };
    
    res.json(dashboard);
    
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(500).json({
      error: "Dashboard temporarily unavailable",
      message: "Even bananas need rest sometimes 🍌😴"
    });
  }
});

// Performance metrics endpoint
app.get('/monitoring/metrics', (req, res) => {
  const { timeRange = '1h', type } = req.query;
  
  if (type) {
    const historicalData = performanceCollector.getHistoricalData(type, timeRange);
    res.json({
      type,
      timeRange,
      data: historicalData,
      count: historicalData.length
    });
  } else {
    const snapshot = performanceCollector.getSnapshot();
    res.json(snapshot);
  }
});

// Log management endpoint
app.get('/monitoring/logs', async (req, res) => {
  const logStats = await logRotator.getLogStats();
  const diskUsage = await logRotator.getDiskUsage();
  
  res.json({
    stats: logStats,
    disk: diskUsage,
    actions: {
      forceRotation: "/monitoring/logs/rotate",
      exportLogs: "/monitoring/logs/export"
    }
  });
});

// Force log rotation
app.post('/monitoring/logs/rotate', async (req, res) => {
  const { logFile } = req.body;
  
  try {
    const success = await logRotator.forceRotation(logFile || 'combined.log');
    
    if (success) {
      res.json({
        success: true,
        message: `Log rotation completed for ${logFile || 'combined.log'}`,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(400).json({
        success: false,
        error: "Log rotation failed"
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// System restart endpoint (emergency banana button)
app.post('/monitoring/restart', async (req, res) => {
  const { reason = "Manual restart via dashboard" } = req.body;
  
  logger.warn('System restart requested via dashboard', { reason });
  
  res.json({
    success: true,
    message: "🍌 EMERGENCY BANANA RESTART INITIATED! 🍌",
    reason,
    timestamp: new Date().toISOString()
  });
  
  // Initiate restart after response is sent
  setTimeout(() => {
    autoRestart.forceRestart(reason);
  }, 1000);
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

// HubSpot proxy endpoints with streaming support
app.get('/api/hubspot/contacts', async (req, res) => {
  const monitor = streamingHandler.monitorStreamMemory('hubspot-contacts');
  
  try {
    const { stream = false } = req.query;
    
    if (stream === 'true') {
      // Use streaming pagination for large datasets
      const paginatedEndpoint = paginationHelper.createPaginatedEndpoint(
        authHandler.hubspotClient, 
        '/crm/v3/objects/contacts'
      );
      return await paginatedEndpoint(req, res);
    } else {
      // Standard response
      const { limit = 10, after } = req.query;
      let endpoint = `/crm/v3/objects/contacts?limit=${limit}`;
      if (after) endpoint += `&after=${after}`;

      const data = await authHandler.callHubSpot(endpoint);
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.message || error.message,
      timestamp: new Date().toISOString()
    });
  } finally {
    monitor.end();
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

// HubSpot GraphQL endpoint with streaming support
app.post('/api/hubspot/graphql', async (req, res) => {
  const monitor = streamingHandler.monitorStreamMemory('hubspot-graphql');
  
  try {
    const { query, variables = {}, stream = false } = req.body;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'GraphQL query is required',
        timestamp: new Date().toISOString()
      });
    }

    if (stream === true) {
      // Stream large GraphQL responses
      const response = await authHandler.hubspotClient.post('/collector/graphql', {
        query,
        variables
      }, { responseType: 'stream' });
      
      await streamingHandler.handleGraphQLStream(response, res);
    } else {
      // Standard GraphQL response
      const data = await authHandler.callHubSpotGraphQL(query, variables);
      
      res.json({
        success: true,
        data,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(error.response?.status || 500).json({
      success: false,
      error: error.response?.data?.errors?.[0]?.message || error.message,
      errors: error.response?.data?.errors,
      timestamp: new Date().toISOString()
    });
  } finally {
    monitor.end();
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
  logger.info(`🍌 BANANA-POWERED API SERVER ACTIVATED! 🍌`);
  logger.info(`Port: ${config.server.port}`);
  logger.info(`Environment: ${config.server.env}`);
  logger.info(`Mode: ${process.env.NODE_CLUSTER_WORKER ? '4-Core Beast Mode' : 'Single Core'}`);
  logger.info('🚀 MAXIMUM BANANA ENDPOINTS:');
  logger.info('  🏥 GET  /health - Health check');
  logger.info('  🍌 GET  /monitoring/dashboard - MAXIMUM BANANA DASHBOARD');
  logger.info('  📊 GET  /monitoring/metrics - Performance metrics');
  logger.info('  📝 GET  /monitoring/logs - Log management');
  logger.info('  🔄 POST /monitoring/logs/rotate - Force log rotation');
  logger.info('  🚨 POST /monitoring/restart - Emergency banana restart');
  logger.info('  🔗 GET  /api/test-connections - Test API connections');
  logger.info('  👥 GET  /api/hubspot/contacts - Get HubSpot contacts (streaming!)');
  logger.info('  ➕ POST /api/hubspot/contacts - Create HubSpot contact');
  logger.info('  🔍 POST /api/hubspot/search/:objectType - Search HubSpot objects');
  logger.info('  📊 POST /api/hubspot/graphql - HubSpot GraphQL (streaming!)');
  logger.info('  🤖 POST /api/anthropic/messages - Send message to Claude');
  logger.info('  🌐 ALL  /api/hubspot/* - Proxy to any HubSpot endpoint');
  logger.info('🍌 BANANA POWER LEVEL: MAXIMUM! 🍌');
});

// Set server for auto-restart manager
autoRestart.setServer(server);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = app;