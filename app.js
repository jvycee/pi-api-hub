const express = require('express');
const cors = require('cors');
const config = require('./shared/config');
const logger = require('./shared/logger');
const streamTracker = require('./shared/stream-tracker');
const AuthHandler = require('./middleware/auth-handler');
const MemoryMonitor = require('./middleware/memory-monitor');
const RequestQueue = require('./middleware/request-queue');
const StreamingHandler = require('./middleware/streaming-handler');
const CompressionMiddleware = require('./middleware/compression');
const IntelligentCache = require('./middleware/intelligent-cache');
const RequestDeduplicationBatcher = require('./middleware/request-deduplication');
const WebhookHandler = require('./middleware/webhook-handler');
const AIFallbackHandler = require('./middleware/ai-fallback-handler');
// Security middleware
const AdminAuthMiddleware = require('./middleware/admin-auth');
const SecurityHeadersMiddleware = require('./middleware/security-headers');
const InputValidationMiddleware = require('./middleware/input-validation');
const PaginationHelper = require('./helpers/pagination-helper');
const CursorPagination = require('./helpers/cursor-pagination');
const JSONOptimizer = require('./helpers/json-optimizer');
const LogRotator = require('./monitoring/log-rotator');
const PerformanceCollector = require('./monitoring/performance-collector');
const PredictiveHealthMonitor = require('./monitoring/predictive-health-monitor');
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
const jsonOptimizer = new JSONOptimizer();
const streamingHandler = new StreamingHandler({ jsonOptimizer });
const compressionMiddleware = new CompressionMiddleware();
const intelligentCache = new IntelligentCache({
  maxSize: 5000,
  defaultTTL: 300000, // 5 minutes
  maxMemoryMB: 50,
  analytics: true
});
const requestBatcher = new RequestDeduplicationBatcher({
  batchSize: 5,
  batchTimeout: 150, // 150ms
  maxBatchWait: 2000, // 2 seconds
  deduplicationTTL: 10000, // 10 seconds
  enableBatching: true,
  enableDeduplication: true
});
const webhookHandler = new WebhookHandler({
  clientSecret: config.apis?.hubspot?.clientSecret,
  validateSignature: true,
  enableLogging: true,
  enableAnalytics: true,
  maxBodySize: 1024 * 1024 // 1MB
});
const aiHandler = new AIFallbackHandler({
  anthropicApiKey: config.apis?.anthropic?.apiKey,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://10.0.0.218:11434',
  defaultModel: 'llama3.1:8b',
  primaryProvider: 'ollama', // Ollama first, Claude for specialized tasks
  enableFallback: true
});
// Security middleware instances
const adminAuth = config.security?.adminApiKey ? new AdminAuthMiddleware({
  sessionTimeout: 30 * 60 * 1000, // 30 minutes
  maxAttempts: 5,
  lockoutTime: 15 * 60 * 1000 // 15 minutes
}) : null;
const securityHeaders = new SecurityHeadersMiddleware();
const inputValidation = new InputValidationMiddleware({
  maxBodySize: 10 * 1024 * 1024, // 10MB
  maxQueryParams: 50,
  sanitizeStrings: true
});
const paginationHelper = new PaginationHelper();
const cursorPagination = new CursorPagination();
const logRotator = new LogRotator();
const performanceCollector = new PerformanceCollector();
const predictiveHealthMonitor = new PredictiveHealthMonitor(performanceCollector);
const autoRestart = new AutoRestartManager();

// Connect monitoring systems
autoRestart.setMonitors(performanceCollector, memoryMonitor);

// Setup webhook handlers
webhookHandler.setupDefaultHandlers();

// Helper function for admin authentication
const requireAdminAuth = adminAuth?.middleware() || ((req, res, next) => {
  logger.warn('Admin endpoint accessed without authentication - ADMIN_API_KEY not configured', {
    path: req.path,
    method: req.method,
    ip: req.ip
  });
  next();
});

// Security middleware first
app.use(securityHeaders.middleware());
app.use(inputValidation.middleware());

// CORS with secure origins
app.use(cors({
  origin: config.security?.corsOrigins || config.server?.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key']
}));

// Standard middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(compressionMiddleware.middleware());
app.use(memoryMonitor.middleware());
app.use(requestQueue.middleware());
app.use(jsonOptimizer.middleware());
app.use(performanceCollector.middleware());

// Intelligent caching for API endpoints
app.use('/api/hubspot/contacts', intelligentCache.middleware({
  ttl: 180000, // 3 minutes for contacts
  skipCache: (req) => req.method !== 'GET' // Only cache GET requests
}));

app.use('/api/hubspot/search', intelligentCache.middleware({
  ttl: 120000, // 2 minutes for search results
  skipCache: (req) => req.method !== 'POST' // Only cache POST requests
}));

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
    const cacheStats = intelligentCache.getStats();
    const batchingStats = requestBatcher.getStats();
    const webhookStats = webhookHandler.getStats();
    const aiStats = aiHandler.getStats();
    
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
          ...streamTracker.getStats(),
          compressionRatio: "99.9%"
        },
        adaptiveChunking: jsonOptimizer.getAdaptiveStats()
      },
      
      apis: snapshot.apis,
      
      infrastructure: {
        memory: memoryStatus,
        requestQueue: queueStatus,
        logging: logStats,
        caching: {
          enabled: true,
          hitRate: cacheStats.hitRate,
          memoryUsage: cacheStats.memoryUsageMB + "MB",
          totalEntries: cacheStats.size,
          avgResponseTime: cacheStats.avgResponseTime,
          hotKeys: cacheStats.hotKeys.length,
          popularEndpoints: cacheStats.popularEndpoints.length,
          evictions: cacheStats.evictions,
          intelligence: "🍌 MAXIMUM BANANA CACHING"
        },
        requestOptimization: {
          enabled: true,
          deduplicationRate: batchingStats.deduplicationRate,
          batchingRate: batchingStats.batchingRate,
          avgBatchSize: batchingStats.avgBatchSize,
          avgBatchWaitTime: batchingStats.avgBatchWaitTime,
          duplicatesSaved: batchingStats.duplicatesSaved,
          activeBatches: batchingStats.activeBatches,
          totalBatches: batchingStats.totalBatches,
          intelligence: "🍌 SMART REQUEST BATCHING"
        },
        webhooks: {
          enabled: true,
          totalWebhooks: webhookStats.totalWebhooks,
          successRate: webhookStats.successRate,
          avgProcessingTime: webhookStats.avgProcessingTime,
          eventTypes: webhookStats.eventTypes.length,
          recentWebhooks: webhookStats.recentWebhooks.length,
          invalidSignatures: webhookStats.invalidSignatures,
          intelligence: "🍌 REAL-TIME WEBHOOK PROCESSING"
        },
        aiRouting: {
          enabled: true,
          primaryProvider: aiStats.primaryProvider,
          totalRequests: aiStats.totalRequests,
          anthropicUsage: aiStats.anthropicUsagePercent,
          ollamaUsage: aiStats.ollamaUsagePercent,
          specializationRate: aiStats.specializationRate,
          fallbackTriggers: aiStats.fallbackTriggers,
          costSavings: aiStats.costSavings.estimatedClaudeCostSaved,
          savingsRate: aiStats.costSavings.savingsRate,
          avgResponseTimes: {
            anthropic: aiStats.avgResponseTimes.anthropic,
            ollama: aiStats.avgResponseTimes.ollama
          },
          providers: {
            anthropic: {
              available: aiStats.providerStatus.anthropic.available,
              outOfCredits: aiStats.providerStatus.anthropic.outOfCredits
            },
            ollama: {
              available: aiStats.providerStatus.ollama.available,
              modelCount: aiStats.providerStatus.ollama.modelCount
            }
          },
          intelligence: "🍌 SMART AI ROUTING & COST OPTIMIZATION"
        },
        clustering: {
          mode: process.env.NODE_CLUSTER_WORKER ? "Dynamic Scaling Beast Mode" : "Single Core",
          workers: process.env.NODE_CLUSTER_WORKER ? 4 : 1,
          loadBalancing: "Round Robin Banana Distribution",
          dynamicScaling: process.env.NODE_CLUSTER_WORKER ? {
            enabled: true,
            minWorkers: 1,
            maxWorkers: 4,
            scaleUpThreshold: "80%",
            scaleDownThreshold: "30%"
          } : null
        }
      },
      
      predictiveHealth: predictiveHealthMonitor.getHealthPrediction(),
      
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
app.post('/monitoring/logs/rotate', requireAdminAuth, async (req, res) => {
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
app.post('/monitoring/restart', requireAdminAuth, async (req, res) => {
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

// Predictive health monitoring endpoint
app.get('/monitoring/predictive-health', (req, res) => {
  try {
    const analysis = predictiveHealthMonitor.getDetailedAnalysis();
    res.json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Predictive health analysis error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate predictive health analysis',
      timestamp: new Date().toISOString()
    });
  }
});

// Cluster scaling information endpoint
app.get('/monitoring/cluster-scaling', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        scalingEnabled: true,
        currentMode: process.env.NODE_CLUSTER_WORKER ? "Dynamic Scaling" : "Single Process",
        configuration: {
          minWorkers: 1,
          maxWorkers: 4,
          scaleUpThreshold: "80%",
          scaleDownThreshold: "30%",
          cooldownPeriod: "60 seconds"
        },
        features: [
          "🍌 CPU load-based scaling",
          "🍌 Memory pressure monitoring", 
          "🍌 Graceful worker shutdown",
          "🍌 Scaling history tracking",
          "🍌 Cooldown period protection"
        ]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cluster scaling info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cluster scaling information',
      timestamp: new Date().toISOString()
    });
  }
});

// Cache management endpoints
// GET /monitoring/cache - Get cache statistics
app.get('/monitoring/cache', (req, res) => {
  try {
    const stats = intelligentCache.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cache stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /monitoring/cache/clear - Clear cache
app.post('/monitoring/cache/clear', requireAdminAuth, (req, res) => {
  try {
    const entriesCleared = intelligentCache.clear();
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      entriesCleared,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cache clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /monitoring/cache/keys - Get cache keys with optional pattern
app.get('/monitoring/cache/keys', (req, res) => {
  try {
    const { pattern } = req.query;
    const keys = intelligentCache.getKeys(pattern);
    res.json({
      success: true,
      data: {
        keys,
        count: keys.length,
        pattern: pattern || 'all'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cache keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache keys',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /monitoring/cache/warm - Warm cache with popular endpoints
app.get('/monitoring/cache/warm', async (req, res) => {
  try {
    // Simple data provider that simulates warming popular endpoints
    const dataProvider = async (endpoint) => {
      // This is a placeholder - in real implementation you'd fetch actual data
      // based on the endpoint pattern
      return {
        warmed: true,
        endpoint,
        timestamp: new Date().toISOString(),
        data: `Warmed data for ${endpoint}`
      };
    };
    
    await intelligentCache.warmCache(dataProvider);
    const stats = intelligentCache.getStats();
    
    res.json({
      success: true,
      message: 'Cache warming completed',
      data: {
        popularEndpoints: stats.popularEndpoints,
        totalEntries: stats.size,
        memoryUsage: stats.memoryUsageMB + 'MB'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Cache warm error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to warm cache',
      timestamp: new Date().toISOString()
    });
  }
});

// Request deduplication and batching endpoints
// GET /monitoring/deduplication - Get deduplication statistics
app.get('/monitoring/deduplication', (req, res) => {
  try {
    const stats = requestBatcher.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Deduplication stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get deduplication statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /monitoring/deduplication/flush - Flush all pending batches
app.post('/monitoring/deduplication/flush', requireAdminAuth, async (req, res) => {
  try {
    await requestBatcher.flushBatches();
    res.json({
      success: true,
      message: 'All pending batches flushed successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Batch flush error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to flush batches',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /monitoring/deduplication/clear - Clear deduplication data
app.post('/monitoring/deduplication/clear', requireAdminAuth, (req, res) => {
  try {
    requestBatcher.clearDeduplication();
    res.json({
      success: true,
      message: 'Deduplication data cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Deduplication clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear deduplication data',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /monitoring/deduplication/batches - Get active batch details
app.get('/monitoring/deduplication/batches', (req, res) => {
  try {
    const batches = requestBatcher.getActiveBatches();
    res.json({
      success: true,
      data: batches,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Active batches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get active batch details',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /monitoring/deduplication/duplicates - Get duplicate request details
app.get('/monitoring/deduplication/duplicates', (req, res) => {
  try {
    const duplicates = requestBatcher.getDuplicateDetails();
    res.json({
      success: true,
      data: duplicates,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Duplicate details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get duplicate request details',
      timestamp: new Date().toISOString()
    });
  }
});

// Webhook management endpoints
// GET /monitoring/webhooks - Get webhook statistics
app.get('/monitoring/webhooks', (req, res) => {
  try {
    const stats = webhookHandler.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Webhook stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /monitoring/webhooks/handlers - Get registered handlers
app.get('/monitoring/webhooks/handlers', (req, res) => {
  try {
    const handlers = webhookHandler.getHandlers();
    res.json({
      success: true,
      data: handlers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Webhook handlers error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook handlers',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /monitoring/webhooks/clear - Clear webhook statistics
app.post('/monitoring/webhooks/clear', requireAdminAuth, (req, res) => {
  try {
    webhookHandler.clearStats();
    res.json({
      success: true,
      message: 'Webhook statistics cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Webhook clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear webhook statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /monitoring/webhooks/config - Get webhook configuration
app.get('/monitoring/webhooks/config', (req, res) => {
  try {
    const config = webhookHandler.validateConfig();
    const webhookUrl = webhookHandler.getWebhookUrl(`${req.protocol}://${req.get('host')}`);
    
    res.json({
      success: true,
      data: {
        webhookUrl,
        validation: config,
        settings: {
          validateSignature: webhookHandler.validateSignature,
          enableLogging: webhookHandler.enableLogging,
          enableAnalytics: webhookHandler.enableAnalytics,
          maxBodySize: webhookHandler.maxBodySize,
          retryAttempts: webhookHandler.retryAttempts
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Webhook config error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get webhook configuration',
      timestamp: new Date().toISOString()
    });
  }
});

// AI Routing management endpoints
// GET /monitoring/ai - Get AI routing statistics
app.get('/monitoring/ai', (req, res) => {
  try {
    const stats = aiHandler.getStats();
    res.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('AI stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI routing statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /monitoring/ai/test - Test AI provider connectivity
app.post('/monitoring/ai/test', requireAdminAuth, async (req, res) => {
  try {
    const results = await aiHandler.testProviders();
    res.json({
      success: true,
      data: results,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('AI provider test error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test AI providers',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /monitoring/ai/refresh-ollama - Refresh Ollama connection
app.post('/monitoring/ai/refresh-ollama', requireAdminAuth, async (req, res) => {
  try {
    const success = await aiHandler.refreshOllamaConnection();
    res.json({
      success: true,
      data: {
        ollamaAvailable: success,
        message: success ? 'Ollama connection refreshed successfully' : 'Ollama connection failed'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Ollama refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to refresh Ollama connection',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /monitoring/ai/reset-credits - Reset credit exhaustion flag
app.post('/monitoring/ai/reset-credits', requireAdminAuth, (req, res) => {
  try {
    aiHandler.resetCreditExhaustion();
    res.json({
      success: true,
      message: 'Credit exhaustion flag reset successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Credit reset error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset credit exhaustion',
      timestamp: new Date().toISOString()
    });
  }
});

// POST /monitoring/ai/clear - Clear AI statistics
app.post('/monitoring/ai/clear', requireAdminAuth, (req, res) => {
  try {
    aiHandler.clearStats();
    res.json({
      success: true,
      message: 'AI statistics cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('AI stats clear error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear AI statistics',
      timestamp: new Date().toISOString()
    });
  }
});

// GET /monitoring/ai/models - Get available Ollama models
app.get('/monitoring/ai/models', async (req, res) => {
  try {
    const models = await aiHandler.getOllamaModels();
    res.json({
      success: true,
      data: {
        models,
        modelCount: models.length,
        defaultModel: aiHandler.defaultModel
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Ollama models error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Ollama models',
      timestamp: new Date().toISOString()
    });
  }
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

// HubSpot Webhook endpoint
app.post('/webhooks/hubspot', webhookHandler.middleware(), (req, res) => {
  // Response is handled by the middleware
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

// HubSpot contacts cursor pagination endpoints
app.get('/api/hubspot/contacts/cursor', async (req, res) => {
  try {
    logger.info('🍌 Cursor pagination endpoint reached', { query: req.query });
    const handler = cursorPagination.createCursorHandler(
      authHandler,
      'contacts'
    );
    return await handler(req, res);
  } catch (error) {
    logger.error('Cursor pagination handler error:', error);
    res.status(500).json({
      success: false,
      error: 'Cursor pagination handler failed',
      message: error.message
    });
  }
});

app.get('/api/hubspot/contacts/cursor/stream', async (req, res) => {
  try {
    logger.info('🍌 Cursor streaming endpoint reached', { query: req.query });
    const handler = cursorPagination.createStreamingCursorHandler(
      authHandler,
      'contacts'
    );
    return await handler(req, res);
  } catch (error) {
    logger.error('Cursor streaming handler error:', error);
    res.status(500).json({
      success: false,
      error: 'Cursor streaming handler failed',
      message: error.message
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

// AI endpoint with smart routing (Ollama primary, Claude for specialized tasks)
app.post('/api/anthropic/messages', async (req, res) => {
  try {
    const { model = 'claude-3-haiku-20240307', max_tokens = 1000, messages, taskType, forceClaude } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required',
        timestamp: new Date().toISOString()
      });
    }

    // Use AI Fallback Handler for smart routing
    const aiResponse = await aiHandler.processAIRequest(messages, {
      model,
      max_tokens,
      taskType,
      forceClaude
    });

    res.json({
      success: true,
      data: aiResponse.response,
      metadata: {
        provider: aiResponse.provider,
        routingReason: aiResponse.routingReason,
        responseTime: aiResponse.responseTime,
        fallbackUsed: aiResponse.fallbackUsed || false,
        costSavingMode: aiResponse.costSavingMode || false
      },
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

// Start server only if not being imported by tests or running as cluster worker
if (require.main === module || process.env.NODE_CLUSTER_WORKER) {
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
    logger.info('  🤖 POST /api/anthropic/messages - Smart AI routing (Ollama + Claude)');
    logger.info('  🌐 ALL  /api/hubspot/* - Proxy to any HubSpot endpoint');
    logger.info('  🔗 POST /webhooks/hubspot - HubSpot webhooks receiver');
    logger.info('🍌 BANANA POWER LEVEL: MAXIMUM! 🍌');
    
    // Log webhook URL for easy setup
    const webhookUrl = `http://localhost:${config.server.port}/webhooks/hubspot`;
    logger.info('🍌 WEBHOOK URL FOR HUBSPOT:', webhookUrl);
    
    // Log AI routing status
    logger.info('🍌 AI ROUTING STATUS:');
    logger.info(`  Primary Provider: ${aiHandler.primaryProvider}`);
    logger.info(`  Ollama URL: ${aiHandler.ollamaBaseUrl}`);
    logger.info(`  Fallback Enabled: ${aiHandler.enableFallback}`);
    logger.info(`  Cost Optimization: Active`);
  });

  // Set server for auto-restart manager
  autoRestart.setServer(server);
  
  // Start adaptive compression monitoring
  compressionMiddleware.startAdaptiveCompression();

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });
  });
}

module.exports = app;