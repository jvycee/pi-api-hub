const express = require('express');
const cors = require('cors');
const { getConfigManager } = require('./shared/config-manager');
const { getErrorHandler } = require('./shared/error-handler');
const logger = require('./shared/logger');
const streamTracker = require('./shared/stream-tracker');
const ResponseHelper = require('./shared/response-helper');
const MonitoringFactory = require('./shared/monitoring-factory');
const MiddlewareFactory = require('./middleware/middleware-factory');
const EndpointWrapper = require('./helpers/endpoint-wrapper');
const CSRFProtection = require('./middleware/csrf-protection');
const SessionSecurity = require('./middleware/session-security');
const PaginationHelper = require('./helpers/pagination-helper');
const CursorPagination = require('./helpers/cursor-pagination');
const JSONOptimizer = require('./helpers/json-optimizer');
const LogRotator = require('./monitoring/log-rotator');
const PerformanceCollector = require('./monitoring/performance-collector');
const PredictiveHealthMonitor = require('./monitoring/predictive-health-monitor');
const AutoRestartManager = require('./monitoring/auto-restart');
const AnalyticsDashboard = require('./analytics/analytics-dashboard');
const DependencyScanner = require('./security/dependency-scanner');
const InputValidationSchemas = require('./middleware/input-validation-schemas');
const cleanupHandler = require('./middleware/cleanup-handler');

// Initialize configuration and error handling
const config = getConfigManager();
const errorHandler = getErrorHandler();

// Validate configuration
try {
  config.validateConfiguration();
} catch (error) {
  logger.error('Configuration validation failed:', error.message);
  process.exit(1);
}

const app = express();

// 🍌 BANANA-POWERED MIDDLEWARE FACTORY 🍌
const middlewareFactory = new MiddlewareFactory(config);
const {
  authHandler,
  aiHandler,
  adminAuth,
  apiKeyAuth,
  securityHeaders,
  inputValidation,
  compression: compressionMiddleware,
  requestQueue,
  intelligentCache,
  memoryMonitor,
  webhookHandler,
  streamingHandler,
  requestDeduplication: requestDeduplicationBatcher,
  analyticsMiddleware
} = middlewareFactory.setupConnections();

// Additional components
const jsonOptimizer = new JSONOptimizer();
const paginationHelper = new PaginationHelper();
const cursorPagination = new CursorPagination();
const logRotator = new LogRotator();
const performanceCollector = new PerformanceCollector();
const predictiveHealthMonitor = new PredictiveHealthMonitor(performanceCollector);
const autoRestart = new AutoRestartManager();
const analyticsDashboard = new AnalyticsDashboard(analyticsMiddleware);
const dependencyScanner = new DependencyScanner();

// Connect monitoring systems
autoRestart.setMonitors(performanceCollector, memoryMonitor);

// Initialize additional components
const inputValidator = new InputValidationSchemas();
const requireAdminAuth = middlewareFactory.getAdminAuthMiddleware();
const csrfProtection = new CSRFProtection();
const sessionSecurity = new SessionSecurity();

// Register services for cleanup
cleanupHandler.registerService(performanceCollector, 'PerformanceCollector');
cleanupHandler.registerService(memoryMonitor, 'MemoryMonitor');
cleanupHandler.registerService(autoRestart, 'AutoRestartManager');

// Security middleware first
app.use(securityHeaders.middleware());
app.use(sessionSecurity.middleware());
app.use(inputValidation.middleware());

// 🍌 BANANA-POWERED API KEY AUTHENTICATION 🍌
app.use(apiKeyAuth.middleware());

// 🛡️ CSRF Protection
app.use(csrfProtection.tokenMiddleware());
app.use(csrfProtection.originValidation());
app.use(csrfProtection.validateMiddleware());

// CORS with secure origins from centralized config
app.use(cors({
  origin: config.getSecurityConfig().corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-api-key', 'x-api-key', 'x-csrf-token', 'csrf-token']
}));

// Standard middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size

// 🍌 Serve static files for dashboard
app.use(express.static('public'));
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

// Health check endpoint with limited public info
app.get('/health', (req, res) => {
  // Public health check - minimal information
  const basicHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'pi-api-hub'
  };
  
  // Detailed health info requires authentication
  if (req.apiKeyData) {
    const memoryStatus = memoryMonitor.getStatus();
    const queueStatus = requestQueue.getHealth();
    
    basicHealth.detailed = {
      uptime: Math.floor(process.uptime() / 60) + ' minutes', // Rounded for privacy
      environment: config.getEnvironment(),
      worker: {
        clustered: !!process.env.NODE_CLUSTER_WORKER
      },
      performance: {
        memory: {
          status: memoryStatus.heapUtilization > 90 ? 'high' : 'normal'
        },
        requestQueue: {
          status: queueStatus.health === 'healthy' ? 'normal' : 'degraded'
        }
      },
      configuration: config.healthCheck(),
      errors: errorHandler.healthCheck()
    };
  }
  
  res.json(basicHealth);
});

// Monitoring routes
app.use('/monitoring', require('./routes/monitoring')({
  performanceCollector,
  logRotator,
  predictiveHealthMonitor,
  intelligentCache,
  requestDeduplicationBatcher,
  webhookHandler,
  aiHandler,
  autoRestart,
  memoryMonitor,
  requestQueue,
  dependencyScanner,
  csrfProtection,
  sessionSecurity
}, requireAdminAuth));

// All monitoring endpoints now handled by /routes/monitoring.js

// 📊 ANALYTICS DASHBOARD ENDPOINTS 📊
analyticsDashboard.createEndpoints(app, requireAdminAuth);

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

// HubSpot API routes
app.use('/api/hubspot', require('./routes/hubspot')({
  authHandler,
  streamingHandler,
  paginationHelper,
  cursorPagination
}, inputValidator));

// 🐐 Mark AI Assistant routes
app.use('/api/mark', require('./routes/mark-routes'));

// 🐘 Mark2 General Purpose AI Assistant routes
app.use('/api/mark2', require('./routes/mark2-routes'));

// AI endpoint with smart routing
const AIController = require('./controllers/ai-controller');
const aiController = new AIController(aiHandler);
app.post('/api/anthropic/messages', inputValidator.validateRequest('anthropicMessage'), 
  aiController.processMessages
);

// 🍌 BANANA-POWERED API KEY MANAGEMENT ROUTES 🍌
const apiKeyRoutes = require('./routes/api-keys')(apiKeyAuth);
app.use('/api/keys', apiKeyRoutes);

// SECURITY: Setup endpoint with enhanced security
const setupAttempts = new Map();
app.get('/setup/admin-key', (req, res) => {
  // Proper IP validation - no spoofing possible
  const clientIP = req.socket.remoteAddress || req.connection.remoteAddress;
  const allowedIPs = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  
  if (!allowedIPs.includes(clientIP)) {
    logger.warn('🚨 Unauthorized setup access attempt', { 
      ip: clientIP, 
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });
    return res.status(403).json({
      success: false,
      error: 'Access denied - localhost only',
      timestamp: new Date().toISOString()
    });
  }

  // Rate limiting for setup endpoint
  const now = Date.now();
  const attempts = setupAttempts.get(clientIP) || [];
  const recentAttempts = attempts.filter(time => now - time < 60000); // 1 minute window
  
  if (recentAttempts.length >= 3) {
    logger.warn('🚨 Setup endpoint rate limit exceeded', { ip: clientIP });
    return res.status(429).json({
      success: false,
      error: 'Too many attempts - try again later',
      timestamp: new Date().toISOString()
    });
  }
  
  recentAttempts.push(now);
  setupAttempts.set(clientIP, recentAttempts);

  // Additional security header validation
  const userAgent = req.get('User-Agent');
  if (!userAgent || userAgent.length < 10) {
    return res.status(403).json({
      success: false,
      error: 'Invalid request',
      timestamp: new Date().toISOString()
    });
  }
  
  const adminKey = apiKeyAuth.getAdminKeyForSetup();
  if (adminKey) {
    logger.info('🍌 Admin key accessed from localhost', { ip: clientIP });
    res.json({
      success: true,
      adminKey: adminKey,
      warning: '🚨 SECURITY: This endpoint should be removed in production!',
      expires: new Date(Date.now() + 300000).toISOString() // 5 min warning
    });
  } else {
    res.json({ success: false, error: 'No admin keys found' });
  }
});

// Ollama status endpoint now handled by /routes/monitoring.js

// Centralized error handling middleware
app.use(errorHandler.middleware());

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
  const serverConfig = config.getServerConfig();
  const server = app.listen(serverConfig.port, serverConfig.host, () => {
    logger.info(`🍌 BANANA-POWERED API SERVER ACTIVATED! 🍌 (GitHub Actions Test)`);
    logger.info(`Port: ${serverConfig.port}`);
    logger.info(`Environment: ${serverConfig.env}`);
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
    const webhookUrl = `http://localhost:${serverConfig.port}/webhooks/hubspot`;
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