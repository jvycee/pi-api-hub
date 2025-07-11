const AuthHandler = require('./auth-handler');
const AIFallbackHandler = require('./ai-fallback-handler');
const AdminAuth = require('./admin-auth');
const APIKeyAuth = require('./api-key-auth');
const SecurityHeadersMiddleware = require('./security-headers');
const InputValidationMiddleware = require('./input-validation');
const CompressionMiddleware = require('./compression');
const RequestQueue = require('./request-queue');
const IntelligentCache = require('./intelligent-cache');
const MemoryMonitor = require('./memory-monitor');
const WebhookHandler = require('./webhook-handler');
const StreamingHandler = require('./streaming-handler');
const RequestDeduplicationBatcher = require('./request-deduplication');
const AnalyticsMiddleware = require('./analytics-middleware');
const JSONOptimizer = require('../helpers/json-optimizer');

/**
 * 🍌 BANANA-POWERED MIDDLEWARE FACTORY 🍌
 * 
 * Consolidates middleware creation and configuration
 * Reduces code duplication and improves maintainability
 */
class MiddlewareFactory {
  constructor(config = {}) {
    this.config = config;
    this.instances = new Map();
  }

  createCore() {
    return {
      authHandler: this.getInstance('authHandler', () => new AuthHandler()),
      aiHandler: this.getInstance('aiHandler', () => new AIFallbackHandler()),
      adminAuth: this.getInstance('adminAuth', () => new AdminAuth()),
      apiKeyAuth: this.getInstance('apiKeyAuth', () => new APIKeyAuth())
    };
  }

  createSecurity() {
    return {
      securityHeaders: this.getInstance('securityHeaders', () => 
        new SecurityHeadersMiddleware()),
      inputValidation: this.getInstance('inputValidation', () => 
        new InputValidationMiddleware({
          maxBodySize: 10 * 1024 * 1024, // 10MB
          maxQueryParams: 50,
          sanitizeStrings: true
        }))
    };
  }

  createPerformance() {
    return {
      compression: this.getInstance('compression', () => new CompressionMiddleware()),
      requestQueue: this.getInstance('requestQueue', () => new RequestQueue()),
      intelligentCache: this.getInstance('intelligentCache', () => new IntelligentCache()),
      memoryMonitor: this.getInstance('memoryMonitor', () => new MemoryMonitor()),
      requestDeduplication: this.getInstance('requestDeduplication', () => 
        new RequestDeduplicationBatcher({
          intelligentCache: this.getInstance('intelligentCache', () => new IntelligentCache())
        }))
    };
  }

  createHandlers() {
    return {
      webhookHandler: this.getInstance('webhookHandler', () => {
        const handler = new WebhookHandler();
        handler.setupDefaultHandlers();
        return handler;
      }),
      streamingHandler: this.getInstance('streamingHandler', () => 
        new StreamingHandler({ 
          jsonOptimizer: this.getInstance('jsonOptimizer', () => new JSONOptimizer())
        }))
    };
  }

  createAnalytics() {
    const { aiHandler } = this.createCore();
    
    return {
      analyticsMiddleware: this.getInstance('analyticsMiddleware', () => 
        new AnalyticsMiddleware(aiHandler, {
          maxHistorySize: 50000,
          analysisWindow: 5 * 60 * 1000, // 5 minutes
          enableRealTimeAnalysis: true,
          analysisInterval: 30000 // 30 seconds
        }))
    };
  }

  createAll() {
    return {
      ...this.createCore(),
      ...this.createSecurity(),
      ...this.createPerformance(),
      ...this.createHandlers(),
      ...this.createAnalytics()
    };
  }

  getInstance(name, factory) {
    if (!this.instances.has(name)) {
      this.instances.set(name, factory());
    }
    return this.instances.get(name);
  }

  // Get helper for admin authentication
  getAdminAuthMiddleware() {
    const { adminAuth } = this.createCore();
    return adminAuth?.middleware() || ((req, res, next) => {
      console.warn('Admin endpoint accessed without authentication - ADMIN_API_KEY not configured');
      next();
    });
  }

  // Setup interconnections between middleware
  setupConnections() {
    const all = this.createAll();
    
    // Connect monitoring systems
    if (all.autoRestart && all.performanceCollector && all.memoryMonitor) {
      all.autoRestart.setMonitors(all.performanceCollector, all.memoryMonitor);
    }

    // Setup webhook handlers
    if (all.webhookHandler?.setupDefaultHandlers) {
      all.webhookHandler.setupDefaultHandlers();
    }

    return all;
  }
}

module.exports = MiddlewareFactory;