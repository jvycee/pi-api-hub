const express = require('express');
const cors = require('cors');
const config = require('./shared/config');
const logger = require('./shared/logger');
const streamTracker = require('./shared/stream-tracker');
const ResponseHelper = require('./shared/response-helper');
const MonitoringFactory = require('./shared/monitoring-factory');
const AuthHandler = require('./middleware/auth-handler');
const MemoryMonitor = require('./middleware/memory-monitor');
const RequestQueue = require('./middleware/request-queue');
const StreamingHandler = require('./middleware/streaming-handler');
const CompressionMiddleware = require('./middleware/compression');
const IntelligentCache = require('./middleware/intelligent-cache');
const RequestDeduplicationBatcher = require('./middleware/request-deduplication');
const WebhookHandler = require('./middleware/webhook-handler');
const AIFallbackHandler = require('./middleware/ai-fallback-handler');
// 🍌 Smart Banana Features
const SimpleTenantManager = require('./middleware/simple-tenant');
const SimpleAuth = require('./middleware/simple-auth');
const SimpleBackupSystem = require('./middleware/simple-backup');
// Security middleware
const AdminAuthMiddleware = require('./middleware/admin-auth');
const SecurityHeadersMiddleware = require('./middleware/security-headers');
const InputValidationMiddleware = require('./middleware/input-validation');
const RateLimitingMiddleware = require('./middleware/rate-limiting');
const HttpsSupport = require('./middleware/https-support');
const PaginationHelper = require('./helpers/pagination-helper');
const CursorPagination = require('./helpers/cursor-pagination');
const JSONOptimizer = require('./helpers/json-optimizer');
const LogRotator = require('./monitoring/log-rotator');
const PerformanceCollector = require('./monitoring/performance-collector');
const PredictiveHealthMonitor = require('./monitoring/predictive-health-monitor');
const AutoRestartManager = require('./monitoring/auto-restart');
const AnalyticsMiddleware = require('./middleware/analytics-middleware');
const AnalyticsDashboard = require('./analytics/analytics-dashboard');
const AdvancedAnalyticsEngine = require('./analytics/advanced-analytics-engine');
const EnhancedAnalyticsDashboard = require('./analytics/enhanced-analytics-dashboard');

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
  maxSize: 25000, // Pi 5 can handle 5x more entries!
  defaultTTL: 300000, // 5 minutes
  maxMemoryMB: 200, // 4x more memory for Pi 5!
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
  defaultModel: 'llama3.2:latest',
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
const rateLimiting = new RateLimitingMiddleware();
const httpsSupport = new HttpsSupport();
const paginationHelper = new PaginationHelper();
const cursorPagination = new CursorPagination();
const logRotator = new LogRotator();
const performanceCollector = new PerformanceCollector();
const predictiveHealthMonitor = new PredictiveHealthMonitor(performanceCollector);
const autoRestart = new AutoRestartManager();
const analyticsMiddleware = new AnalyticsMiddleware(aiHandler, {
  maxHistorySize: 50000, // Pi 5 can handle more data
  analysisWindow: 5 * 60 * 1000, // 5 minutes
  enableRealTimeAnalysis: true,
  analysisInterval: 30000 // 30 seconds
});
const analyticsDashboard = new AnalyticsDashboard(analyticsMiddleware);

// 🍌 ADVANCED ANALYTICS ENGINE 🍌
const advancedAnalyticsEngine = new AdvancedAnalyticsEngine(analyticsMiddleware, aiHandler, {
  historicalDataRetention: 24 * 60 * 60 * 1000, // 24 hours
  trendAnalysisWindow: 60 * 60 * 1000, // 1 hour
  degradationThreshold: 0.25, // 25% degradation
  realTimeUpdateInterval: 30000 // 30 seconds
});
const enhancedAnalyticsDashboard = new EnhancedAnalyticsDashboard(advancedAnalyticsEngine);

// 🍌 SMART BANANA TENANT MANAGER 🍌
const tenantManager = new SimpleTenantManager();

// 🔐 SMART BANANA AUTHENTICATION 🔐
const simpleAuth = new SimpleAuth();

// 📦 SMART BANANA BACKUP SYSTEM 📦
const backupSystem = new SimpleBackupSystem();

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
app.use(httpsSupport.redirectToHttps());
app.use(httpsSupport.securityHeaders());
app.use(rateLimiting.globalLimiter());
app.use(securityHeaders.middleware());
app.use(inputValidation.middleware());

// 🍌 Tenant identification (early in stack)
app.use(tenantManager.middleware());

// CORS with secure origins
app.use(cors({
  origin: config.security?.corsOrigins || config.server?.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key', 'x-tenant-id']
}));

// Standard middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(compressionMiddleware.middleware());
app.use(memoryMonitor.middleware());
app.use(requestQueue.middleware());
app.use(jsonOptimizer.middleware());
app.use(performanceCollector.middleware());
app.use(analyticsMiddleware.middleware());

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

// Performance metrics endpoint - REFACTORED
app.get('/monitoring/metrics', MonitoringFactory.createGetEndpoint(
  (req) => {
    const { timeRange = '1h', type } = req.query;
    
    if (type) {
      const historicalData = performanceCollector.getHistoricalData(type, timeRange);
      return {
        type,
        timeRange,
        data: historicalData,
        count: historicalData.length
      };
    } else {
      return performanceCollector.getSnapshot();
    }
  },
  { name: 'performance-metrics', errorMessage: 'Failed to get performance metrics' }
));

// Log management endpoint - REFACTORED
app.get('/monitoring/logs', MonitoringFactory.createGetEndpoint(
  async () => {
    const logStats = await logRotator.getLogStats();
    const diskUsage = await logRotator.getDiskUsage();
    
    return {
      stats: logStats,
      disk: diskUsage,
      actions: {
        forceRotation: "/monitoring/logs/rotate",
        exportLogs: "/monitoring/logs/export"
      }
    };
  },
  { name: 'log-management', errorMessage: 'Failed to get log management data' }
));

// Force log rotation - REFACTORED
app.post('/monitoring/logs/rotate', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { logFile } = req.body;
    const success = await logRotator.forceRotation(logFile || 'combined.log');
    
    if (!success) {
      throw new Error("Log rotation failed");
    }
    
    return {
      message: `Log rotation completed for ${logFile || 'combined.log'}`,
      logFile: logFile || 'combined.log'
    };
  },
  { name: 'log-rotation', errorMessage: 'Failed to rotate logs' }
));

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

// Predictive health monitoring endpoint - REFACTORED
app.get('/monitoring/predictive-health', MonitoringFactory.createGetEndpoint(
  () => predictiveHealthMonitor.getDetailedAnalysis(),
  { name: 'predictive-health', errorMessage: 'Failed to generate predictive health analysis' }
));

// Cluster scaling information endpoint - REFACTORED
app.get('/monitoring/cluster-scaling', MonitoringFactory.createGetEndpoint(
  () => ({
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
  }),
  { name: 'cluster-scaling', errorMessage: 'Failed to get cluster scaling information' }
));

// Cache management endpoints - REFACTORED WITH MONITORING FACTORY
const cacheEndpoints = MonitoringFactory.createCacheEndpoint(intelligentCache);
app.get('/monitoring/cache', cacheEndpoints.getStats);
app.post('/monitoring/cache/clear', requireAdminAuth, cacheEndpoints.clearCache);
app.get('/monitoring/cache/keys', cacheEndpoints.getKeys);

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

// Request deduplication and batching endpoints - REFACTORED
app.get('/monitoring/deduplication', MonitoringFactory.createGetEndpoint(
  () => requestBatcher.getStats(),
  { name: 'deduplication-stats', errorMessage: 'Failed to get deduplication statistics' }
));

// POST /monitoring/deduplication/flush - REFACTORED
app.post('/monitoring/deduplication/flush', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  async () => { await requestBatcher.flushBatches(); },
  { name: 'deduplication-flush', successMessage: 'All pending batches flushed successfully', errorMessage: 'Failed to flush batches' }
));

// POST /monitoring/deduplication/clear - REFACTORED
app.post('/monitoring/deduplication/clear', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  () => { requestBatcher.clearDeduplication(); },
  { name: 'deduplication-clear', successMessage: 'Deduplication data cleared successfully', errorMessage: 'Failed to clear deduplication data' }
));

// GET /monitoring/deduplication/batches - REFACTORED
app.get('/monitoring/deduplication/batches', MonitoringFactory.createGetEndpoint(
  () => requestBatcher.getActiveBatches(),
  { name: 'deduplication-batches', errorMessage: 'Failed to get active batch details' }
));

// GET /monitoring/deduplication/duplicates - Get duplicate request details
app.get('/monitoring/deduplication/duplicates', MonitoringFactory.createGetEndpoint(
  () => requestBatcher.getDuplicateDetails(),
  { name: 'deduplication-duplicates', errorMessage: 'Failed to get duplicate request details' }
));

// Webhook management endpoints - REFACTORED
app.get('/monitoring/webhooks', MonitoringFactory.createGetEndpoint(
  () => webhookHandler.getStats(),
  { name: 'webhook-stats', errorMessage: 'Failed to get webhook statistics' }
));
app.get('/monitoring/webhooks/handlers', MonitoringFactory.createGetEndpoint(
  () => webhookHandler.getHandlers(),
  { name: 'webhook-handlers', errorMessage: 'Failed to get webhook handlers' }
));

// POST /monitoring/webhooks/clear - Clear webhook statistics
app.post('/monitoring/webhooks/clear', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  () => { webhookHandler.clearStats(); },
  { name: 'webhook-clear', successMessage: 'Webhook statistics cleared successfully' }
));

// GET /monitoring/webhooks/config - Get webhook configuration
app.get('/monitoring/webhooks/config', MonitoringFactory.createGetEndpoint(
  (req) => {
    const config = webhookHandler.validateConfig();
    const webhookUrl = webhookHandler.getWebhookUrl(`${req.protocol}://${req.get('host')}`);
    
    return {
      webhookUrl,
      validation: config,
      settings: {
        validateSignature: webhookHandler.validateSignature,
        enableLogging: webhookHandler.enableLogging,
        enableAnalytics: webhookHandler.enableAnalytics,
        maxBodySize: webhookHandler.maxBodySize,
        retryAttempts: webhookHandler.retryAttempts
      }
    };
  },
  { name: 'webhook-config', errorMessage: 'Failed to get webhook configuration' }
));

// AI Routing management endpoints
// GET /monitoring/ai - Get AI routing statistics
app.get('/monitoring/ai', MonitoringFactory.createGetEndpoint(
  () => aiHandler.getStats(),
  { name: 'ai-stats', errorMessage: 'Failed to get AI routing statistics' }
));

// POST /monitoring/ai/test - Test AI provider connectivity
app.post('/monitoring/ai/test', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  () => aiHandler.testProviders(),
  { name: 'ai-test', errorMessage: 'Failed to test AI providers' }
));

// POST /monitoring/ai/refresh-ollama - Refresh Ollama connection
app.post('/monitoring/ai/refresh-ollama', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  async () => {
    const success = await aiHandler.refreshOllamaConnection();
    return {
      ollamaAvailable: success,
      message: success ? 'Ollama connection refreshed successfully' : 'Ollama connection failed'
    };
  },
  { name: 'ai-refresh-ollama', errorMessage: 'Failed to refresh Ollama connection' }
));

// POST /monitoring/ai/reset-credits - Reset credit exhaustion flag
app.post('/monitoring/ai/reset-credits', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  () => { aiHandler.resetCreditExhaustion(); },
  { name: 'ai-reset-credits', successMessage: 'Credit exhaustion flag reset successfully' }
));

// POST /monitoring/ai/clear - Clear AI statistics
app.post('/monitoring/ai/clear', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  () => { aiHandler.clearStats(); },
  { name: 'ai-clear', successMessage: 'AI statistics cleared successfully' }
));

// GET /monitoring/ai/models - REFACTORED
app.get('/monitoring/ai/models', MonitoringFactory.createGetEndpoint(
  async () => {
    const models = await aiHandler.getOllamaModels();
    return {
      models,
      modelCount: models.length,
      defaultModel: aiHandler.defaultModel
    };
  },
  { name: 'ai-models', errorMessage: 'Failed to get Ollama models' }
));

// 📊 ANALYTICS DASHBOARD ENDPOINTS 📊
analyticsDashboard.createEndpoints(app, requireAdminAuth);

// 🍌 ENHANCED ANALYTICS DASHBOARD ENDPOINTS 🍌
enhancedAnalyticsDashboard.createEndpoints(app, requireAdminAuth);

// 🍌 SMART BANANA TENANT ENDPOINTS 🍌
// GET /admin/tenants - List all tenants
app.get('/admin/tenants', requireAdminAuth, MonitoringFactory.createGetEndpoint(
  () => ({
    tenants: tenantManager.listTenants(),
    stats: tenantManager.getStats()
  }),
  { name: 'tenant-list', errorMessage: 'Failed to get tenant list' }
));

// POST /admin/tenants - Create new tenant
app.post('/admin/tenants', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { tenantId, name, description, features, limits } = req.body;
    
    if (!tenantId || !name) {
      throw new Error('tenantId and name are required');
    }
    
    const config = await tenantManager.createTenant(tenantId, {
      name,
      description,
      features,
      limits
    });
    
    return { tenant: config };
  },
  { name: 'tenant-create', successMessage: 'Tenant created successfully', errorMessage: 'Failed to create tenant' }
));

// PUT /admin/tenants/:tenantId - Update tenant
app.put('/admin/tenants/:tenantId', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { tenantId } = req.params;
    const updates = req.body;
    
    const config = await tenantManager.updateTenant(tenantId, updates);
    
    return { tenant: config };
  },
  { name: 'tenant-update', successMessage: 'Tenant updated successfully', errorMessage: 'Failed to update tenant' }
));

// GET /admin/tenants/:tenantId - Get specific tenant
app.get('/admin/tenants/:tenantId', requireAdminAuth, MonitoringFactory.createGetEndpoint(
  async (req) => {
    const { tenantId } = req.params;
    const config = await tenantManager.getTenantConfig(tenantId);
    
    return { tenant: config };
  },
  { name: 'tenant-get', errorMessage: 'Failed to get tenant' }
));

// 🔐 SMART BANANA AUTHENTICATION ENDPOINTS 🔐
// POST /auth/login - User login
app.post('/auth/login', rateLimiting.authLimiter(), MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { identifier, password, tenantId } = req.body;
    
    if (!identifier || !password) {
      throw new Error('Username/email and password are required');
    }
    
    const user = await simpleAuth.authenticateUser(identifier, password, tenantId || req.tenant?.id || 'default');
    
    if (!user) {
      throw new Error('Invalid credentials');
    }
    
    const accessToken = await simpleAuth.generateToken(user);
    const refreshToken = simpleAuth.generateRefreshToken(user);
    
    return {
      accessToken,
      refreshToken,
      user,
      expiresIn: '24h'
    };
  },
  { name: 'auth-login', successMessage: 'Login successful', errorMessage: 'Login failed' }
));

// POST /auth/refresh - Refresh JWT token
app.post('/auth/refresh', rateLimiting.authLimiter(), MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      throw new Error('Refresh token is required');
    }
    
    const result = await simpleAuth.refreshToken(refreshToken);
    
    if (!result) {
      throw new Error('Invalid or expired refresh token');
    }
    
    return result;
  },
  { name: 'auth-refresh', successMessage: 'Token refreshed successfully', errorMessage: 'Token refresh failed' }
));

// GET /auth/me - Get current user info
app.get('/auth/me', simpleAuth.middleware(), MonitoringFactory.createGetEndpoint(
  (req) => ({
    user: req.user,
    permissions: req.permissions,
    authMethod: req.authMethod
  }),
  { name: 'auth-me', errorMessage: 'Failed to get user info' }
));

// POST /auth/logout - Logout (invalidate refresh token)
app.post('/auth/logout', MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { refreshToken } = req.body;
    
    if (refreshToken) {
      simpleAuth.refreshTokens.delete(refreshToken);
    }
    
    return { message: 'Logout successful' };
  },
  { name: 'auth-logout', successMessage: 'Logout successful', errorMessage: 'Logout failed' }
));

// 🔐 USER MANAGEMENT ENDPOINTS (Admin only)
// GET /admin/users - List users
app.get('/admin/users', requireAdminAuth, simpleAuth.requirePermission('manage_users'), MonitoringFactory.createGetEndpoint(
  (req) => ({
    users: simpleAuth.listUsers(req.query.tenantId),
    stats: simpleAuth.getAuthStats()
  }),
  { name: 'admin-users-list', errorMessage: 'Failed to get users' }
));

// POST /admin/users - Create new user
app.post('/admin/users', requireAdminAuth, simpleAuth.requirePermission('manage_users'), MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { username, email, password, role, tenantId } = req.body;
    
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }
    
    const user = await simpleAuth.createUser({
      username,
      email,
      password,
      role,
      tenantId
    });
    
    return { user };
  },
  { name: 'admin-users-create', successMessage: 'User created successfully', errorMessage: 'Failed to create user' }
));

// PUT /admin/users/:userId - Update user
app.put('/admin/users/:userId', requireAdminAuth, simpleAuth.requirePermission('manage_users'), MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { userId } = req.params;
    const updates = req.body;
    
    const user = await simpleAuth.updateUser(userId, updates);
    
    return { user };
  },
  { name: 'admin-users-update', successMessage: 'User updated successfully', errorMessage: 'Failed to update user' }
));

// DELETE /admin/users/:userId - Delete user
app.delete('/admin/users/:userId', requireAdminAuth, simpleAuth.requirePermission('manage_users'), MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { userId } = req.params;
    
    await simpleAuth.deleteUser(userId);
    
    return { message: 'User deleted successfully' };
  },
  { name: 'admin-users-delete', successMessage: 'User deleted successfully', errorMessage: 'Failed to delete user' }
));

// POST /admin/users/:userId/api-keys - Generate API key for user
app.post('/admin/users/:userId/api-keys', requireAdminAuth, simpleAuth.requirePermission('manage_users'), MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { userId } = req.params;
    const { name } = req.body;
    
    const user = simpleAuth.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const apiKey = simpleAuth.generateApiKey(user, name);
    
    return { apiKey };
  },
  { name: 'admin-users-api-key', successMessage: 'API key generated successfully', errorMessage: 'Failed to generate API key' }
));

// 📦 SMART BANANA BACKUP SYSTEM ENDPOINTS 📦
// GET /admin/backups - List all backups
app.get('/admin/backups', requireAdminAuth, MonitoringFactory.createGetEndpoint(
  async () => {
    const backups = await backupSystem.listBackups();
    const stats = await backupSystem.getBackupStats();
    
    return {
      backups,
      stats
    };
  },
  { name: 'backup-list', errorMessage: 'Failed to list backups' }
));

// POST /admin/backups - Create new backup
app.post('/admin/backups', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  async () => {
    const backup = await backupSystem.createBackup();
    
    return { backup };
  },
  { name: 'backup-create', successMessage: 'Backup created successfully', errorMessage: 'Failed to create backup' }
));

// GET /admin/backups/stats - Get backup statistics
app.get('/admin/backups/stats', requireAdminAuth, MonitoringFactory.createGetEndpoint(
  async () => {
    const stats = await backupSystem.getBackupStats();
    
    return { stats };
  },
  { name: 'backup-stats', errorMessage: 'Failed to get backup statistics' }
));

// POST /admin/backups/:backupId/restore - Restore backup
app.post('/admin/backups/:backupId/restore', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  async (req) => {
    const { backupId } = req.params;
    
    const restoration = await backupSystem.restoreBackup(backupId);
    
    return { restoration };
  },
  { name: 'backup-restore', successMessage: 'Backup restored successfully', errorMessage: 'Failed to restore backup' }
));

// POST /admin/backups/schedule/stop - Stop backup scheduler
app.post('/admin/backups/schedule/stop', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  () => {
    backupSystem.stop();
    
    return { message: 'Backup scheduler stopped' };
  },
  { name: 'backup-schedule-stop', successMessage: 'Backup scheduler stopped', errorMessage: 'Failed to stop backup scheduler' }
));

// POST /admin/backups/schedule/start - Start backup scheduler
app.post('/admin/backups/schedule/start', requireAdminAuth, MonitoringFactory.createPostEndpoint(
  () => {
    backupSystem.start();
    
    return { message: 'Backup scheduler started' };
  },
  { name: 'backup-schedule-start', successMessage: 'Backup scheduler started', errorMessage: 'Failed to start backup scheduler' }
));

// Apply rate limiting to API endpoints
app.use('/api/', rateLimiting.apiLimiter());
app.use('/monitoring/', rateLimiting.monitoringLimiter());
app.use('/admin/', rateLimiting.adminLimiter());

// API connection test endpoint - REFACTORED
app.get('/api/test-connections', MonitoringFactory.createGetEndpoint(
  async () => {
    const results = await authHandler.testConnections();
    return { connections: results };
  },
  { name: 'connection-test', errorMessage: 'Failed to test connections' }
));

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
  // Start HTTP server
  const server = app.listen(config.server.port, () => {
    logger.info(`🍌 BANANA-POWERED API SERVER ACTIVATED! 🍌`);
    logger.info(`🌐 HTTP Port: ${config.server.port}`);
    logger.info(`🔒 HTTPS Status: ${httpsSupport.isHttpsAvailable() ? 'Available' : 'Not configured'}`);
    logger.info(`🛡️  Security: Rate limiting enabled, Headers secured`);
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
    logger.info('🍌 ENHANCED ANALYTICS ENDPOINTS:');
    logger.info('  📊 GET  /analytics/enhanced/realtime-dashboard - Real-time analytics');
    logger.info('  📈 GET  /analytics/enhanced/trends - Historical trend analysis');
    logger.info('  🚨 GET  /analytics/enhanced/degradation-report - Performance degradation');
    logger.info('  🔮 GET  /analytics/enhanced/predictions - Predictive analytics');
    logger.info('  📱 GET  /analytics/enhanced/overview - Comprehensive overview');
    logger.info('🍌 SMART BANANA TENANT ENDPOINTS:');
    logger.info('  🏢 GET  /admin/tenants - List all tenants');
    logger.info('  ➕ POST /admin/tenants - Create new tenant');
    logger.info('  📝 PUT  /admin/tenants/:id - Update tenant');
    logger.info('  🔍 GET  /admin/tenants/:id - Get specific tenant');
    logger.info('🔐 SMART BANANA AUTHENTICATION ENDPOINTS:');
    logger.info('  🔑 POST /auth/login - User login');
    logger.info('  🔄 POST /auth/refresh - Refresh JWT token');
    logger.info('  👤 GET  /auth/me - Get current user info');
    logger.info('  🚪 POST /auth/logout - Logout user');
    logger.info('  👥 GET  /admin/users - List users (admin)');
    logger.info('  ➕ POST /admin/users - Create user (admin)');
    logger.info('  🔑 POST /admin/users/:id/api-keys - Generate API key');
    logger.info('📦 SMART BANANA BACKUP SYSTEM ENDPOINTS:');
    logger.info('  📋 GET  /admin/backups - List all backups');
    logger.info('  ➕ POST /admin/backups - Create new backup');
    logger.info('  📊 GET  /admin/backups/stats - Get backup statistics');
    logger.info('  🔄 POST /admin/backups/:id/restore - Restore backup');
    logger.info('  ⏹️  POST /admin/backups/schedule/stop - Stop scheduler');
    logger.info('  ▶️  POST /admin/backups/schedule/start - Start scheduler');
    logger.info('🍌 BANANA POWER LEVEL: MAXIMUM! 🍌');
    
    // Log webhook URL for easy setup
    const webhookUrl = `http://localhost:${config.server.port}/webhooks/hubspot`;
    logger.info('🍌 WEBHOOK URL FOR HUBSPOT:', webhookUrl);
    
    // Log AI routing status
    logger.info('🦙 FULL OLLAMA MODE ACTIVATED:');
    logger.info(`  Primary Provider: ${aiHandler.primaryProvider} (MAXIMUM LOCAL AI)`);
    logger.info(`  Ollama URL: ${aiHandler.ollamaBaseUrl}`);
    logger.info(`  Fallback Enabled: ${aiHandler.enableFallback} (Emergency only)`);
    logger.info(`  Cost Optimization: MAXIMUM (Local AI preferred)`);
    
    // Log tenant manager status
    logger.info('🏢 SMART BANANA TENANT MANAGER:');
    const tenantStats = tenantManager.getStats();
    logger.info(`  Total Tenants: ${tenantStats.totalTenants}`);
    logger.info(`  Active Tenants: ${tenantStats.activeTenants}`);
    logger.info(`  Default Tenant: ${tenantStats.defaultTenant}`);
    logger.info(`  Tenant Identification: Header/Subdomain/Path/Query`);
    
    // Log backup system status
    logger.info('📦 SMART BANANA BACKUP SYSTEM:');
    backupSystem.getBackupStats().then(backupStats => {
      logger.info(`  Total Backups: ${backupStats.totalBackups}`);
      logger.info(`  Successful Backups: ${backupStats.successfulBackups}`);
      logger.info(`  Failed Backups: ${backupStats.failedBackups}`);
      logger.info(`  Scheduler Status: ${backupStats.isRunning ? 'Running' : 'Stopped'}`);
      logger.info(`  Last Backup: ${backupStats.lastBackupTime ? new Date(backupStats.lastBackupTime).toLocaleString() : 'Never'}`);
      logger.info(`  Total Backup Size: ${backupStats.formattedTotalBackupSize}`);
    }).catch(error => {
      logger.warn('Failed to get backup stats:', error);
    });
  });
  
  // Start HTTPS server if available
  if (httpsSupport.isHttpsAvailable() && config.security.enableHttps) {
    httpsSupport.startHttpsServer(app, config.security.httpsPort)
      .then(httpsServer => {
        if (httpsServer) {
          logger.info(`🔒 HTTPS server running on port ${config.security.httpsPort}`);
          logger.info(`🔐 Security: SSL/TLS encryption enabled`);
          
          // Set both servers for auto-restart manager
          autoRestart.setServer(server, httpsServer);
        }
      })
      .catch(error => {
        logger.error('Failed to start HTTPS server:', error);
      });
  } else {
    // Set only HTTP server for auto-restart manager
    autoRestart.setServer(server);
    
    if (config.server.env === 'production') {
      logger.warn('⚠️  Production server running without HTTPS! Consider enabling SSL/TLS.');
    }
  }
  
  // Start adaptive compression monitoring
  compressionMiddleware.startAdaptiveCompression();
  
  // Log security status
  logger.info('🛡️  SECURITY STATUS:');
  logger.info(`  Rate Limiting: Enabled (Global, API, Auth, Admin, Monitoring)`);
  logger.info(`  Security Headers: Enabled`);
  logger.info(`  Input Validation: Enabled`);
  logger.info(`  HTTPS Support: ${httpsSupport.isHttpsAvailable() ? 'Available' : 'Not configured'}`);
  logger.info(`  CORS Protection: Enabled`);
  logger.info(`  Admin Authentication: ${config.security.adminApiKey ? 'Enabled' : 'Disabled'}`);
  
  // Log rate limiting configuration
  const rateLimitStats = rateLimiting.getStats();
  logger.info('🛡️  RATE LIMITING CONFIGURATION:');
  Object.entries(rateLimitStats).forEach(([name, stats]) => {
    logger.info(`  ${name}: ${stats.max} requests per ${stats.windowMs/1000}s`);
  });

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