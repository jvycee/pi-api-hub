const crypto = require('crypto');
const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

class WebhookHandler {
  constructor(options = {}) {
    this.clientSecret = options.clientSecret || process.env.HUBSPOT_CLIENT_SECRET;
    this.maxBodySize = options.maxBodySize || 1024 * 1024; // 1MB
    this.validateSignature = options.validateSignature !== false;
    this.enableLogging = options.enableLogging !== false;
    this.enableAnalytics = options.enableAnalytics !== false;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Event handlers
    this.eventHandlers = new Map();
    this.globalHandlers = [];
    
    // Analytics and statistics
    this.stats = {
      totalWebhooks: 0,
      successfulWebhooks: 0,
      failedWebhooks: 0,
      invalidSignatures: 0,
      eventTypes: new Map(),
      avgProcessingTime: 0,
      lastWebhookTime: null,
      bytesProcessed: 0,
      errorsByType: new Map(),
      recentWebhooks: []
    };
    
    // Rate limiting
    this.rateLimit = {
      windowMs: 60000, // 1 minute
      maxRequests: 100,
      requests: new Map()
    };
    
    logger.info('🍌 Webhook Handler initialized', {
      validateSignature: this.validateSignature,
      enableLogging: this.enableLogging,
      enableAnalytics: this.enableAnalytics,
      maxBodySize: this.maxBodySize,
      retryAttempts: this.retryAttempts
    });
  }

  // Verify HubSpot webhook signature
  verifySignature(body, signature, timestamp) {
    if (!this.validateSignature || !this.clientSecret) {
      return true;
    }
    
    try {
      const sourceString = `POST/webhooks/hubspot${body}${timestamp}`;
      const hash = crypto.createHmac('sha256', this.clientSecret)
        .update(sourceString, 'utf8')
        .digest('hex');
      
      return hash === signature;
    } catch (error) {
      logger.error('Signature verification failed', { error: error.message });
      return false;
    }
  }

  // Check rate limiting
  checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - this.rateLimit.windowMs;
    
    // Clean old entries
    for (const [clientIp, requests] of this.rateLimit.requests.entries()) {
      const validRequests = requests.filter(time => time > windowStart);
      if (validRequests.length === 0) {
        this.rateLimit.requests.delete(clientIp);
      } else {
        this.rateLimit.requests.set(clientIp, validRequests);
      }
    }
    
    // Check current IP
    const clientRequests = this.rateLimit.requests.get(ip) || [];
    const validRequests = clientRequests.filter(time => time > windowStart);
    
    if (validRequests.length >= this.rateLimit.maxRequests) {
      return false;
    }
    
    // Add current request
    validRequests.push(now);
    this.rateLimit.requests.set(ip, validRequests);
    
    return true;
  }

  // Register event handler
  onEvent(eventType, handler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType).push(handler);
    
    logger.info('🍌 Webhook event handler registered', {
      eventType,
      handlersCount: this.eventHandlers.get(eventType).length
    });
  }

  // Register global handler (processes all events)
  onAnyEvent(handler) {
    this.globalHandlers.push(handler);
    
    logger.info('🍌 Global webhook handler registered', {
      globalHandlersCount: this.globalHandlers.length
    });
  }

  // Process webhook event
  async processWebhookEvent(eventData, req) {
    const startTime = performance.now();
    const eventType = eventData.subscriptionType || eventData.eventType || 'unknown';
    
    try {
      // Update statistics
      this.updateStats(eventType, eventData, true);
      
      // Process global handlers
      for (const handler of this.globalHandlers) {
        try {
          await handler(eventData, req);
        } catch (error) {
          logger.error('Global webhook handler error', {
            eventType,
            error: error.message,
            handler: handler.name || 'anonymous'
          });
        }
      }
      
      // Process specific event handlers
      const handlers = this.eventHandlers.get(eventType) || [];
      for (const handler of handlers) {
        try {
          await handler(eventData, req);
        } catch (error) {
          logger.error('Event webhook handler error', {
            eventType,
            error: error.message,
            handler: handler.name || 'anonymous'
          });
        }
      }
      
      // Update processing time
      const processingTime = performance.now() - startTime;
      this.updateProcessingTime(processingTime);
      
      logger.info('🍌 Webhook event processed', {
        eventType,
        objectId: eventData.objectId,
        processingTime: processingTime.toFixed(2) + 'ms',
        handlersExecuted: this.globalHandlers.length + handlers.length
      });
      
      return true;
    } catch (error) {
      this.updateStats(eventType, eventData, false);
      logger.error('Webhook event processing failed', {
        eventType,
        error: error.message,
        stack: error.stack
      });
      return false;
    }
  }

  // Update statistics
  updateStats(eventType, eventData, success) {
    this.stats.totalWebhooks++;
    
    if (success) {
      this.stats.successfulWebhooks++;
    } else {
      this.stats.failedWebhooks++;
    }
    
    // Track event types
    const count = this.stats.eventTypes.get(eventType) || 0;
    this.stats.eventTypes.set(eventType, count + 1);
    
    // Update last webhook time
    this.stats.lastWebhookTime = Date.now();
    
    // Track recent webhooks
    this.stats.recentWebhooks.unshift({
      eventType,
      objectId: eventData.objectId,
      timestamp: Date.now(),
      success
    });
    
    // Keep only last 50 webhooks
    if (this.stats.recentWebhooks.length > 50) {
      this.stats.recentWebhooks = this.stats.recentWebhooks.slice(0, 50);
    }
    
    // Update bytes processed
    this.stats.bytesProcessed += Buffer.byteLength(JSON.stringify(eventData));
  }

  // Update processing time
  updateProcessingTime(processingTime) {
    const total = this.stats.successfulWebhooks + this.stats.failedWebhooks;
    if (total > 0) {
      this.stats.avgProcessingTime = (
        (this.stats.avgProcessingTime * (total - 1) + processingTime) / total
      );
    }
  }

  // Express middleware
  middleware() {
    return async (req, res, next) => {
      const startTime = performance.now();
      
      try {
        // Check rate limiting
        const clientIp = req.ip || req.connection.remoteAddress;
        if (!this.checkRateLimit(clientIp)) {
          logger.warn('Webhook rate limit exceeded', { clientIp });
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded',
            message: 'Too many webhook requests from this IP'
          });
        }
        
        // Check content type
        if (!req.is('application/json')) {
          logger.warn('Invalid webhook content type', {
            contentType: req.get('Content-Type')
          });
          return res.status(400).json({
            success: false,
            error: 'Invalid content type',
            message: 'Webhook must be application/json'
          });
        }
        
        // Check body size
        const contentLength = parseInt(req.get('Content-Length') || '0');
        if (contentLength > this.maxBodySize) {
          logger.warn('Webhook body too large', {
            contentLength,
            maxBodySize: this.maxBodySize
          });
          return res.status(413).json({
            success: false,
            error: 'Payload too large',
            message: 'Webhook body exceeds maximum size'
          });
        }
        
        // Get raw body for signature verification
        const rawBody = JSON.stringify(req.body);
        
        // Verify signature if enabled
        if (this.validateSignature) {
          const signature = req.get('X-HubSpot-Signature-v3');
          const timestamp = req.get('X-HubSpot-Request-Timestamp');
          
          if (!signature || !timestamp) {
            logger.warn('Missing webhook signature headers');
            this.stats.invalidSignatures++;
            return res.status(401).json({
              success: false,
              error: 'Missing signature',
              message: 'X-HubSpot-Signature-v3 and X-HubSpot-Request-Timestamp headers required'
            });
          }
          
          if (!this.verifySignature(rawBody, signature, timestamp)) {
            logger.warn('Invalid webhook signature', {
              signature: signature.substring(0, 16) + '...',
              timestamp
            });
            this.stats.invalidSignatures++;
            return res.status(401).json({
              success: false,
              error: 'Invalid signature',
              message: 'Webhook signature verification failed'
            });
          }
        }
        
        // Process webhook events
        const events = Array.isArray(req.body) ? req.body : [req.body];
        const results = [];
        
        for (const eventData of events) {
          const result = await this.processWebhookEvent(eventData, req);
          results.push(result);
        }
        
        // Log webhook processing
        if (this.enableLogging) {
          const processingTime = performance.now() - startTime;
          logger.info('🍌 Webhook batch processed', {
            eventCount: events.length,
            successCount: results.filter(r => r).length,
            failedCount: results.filter(r => !r).length,
            processingTime: processingTime.toFixed(2) + 'ms',
            clientIp
          });
        }
        
        // Send response
        res.json({
          success: true,
          message: 'Webhook processed successfully',
          eventsProcessed: events.length,
          results: results,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        logger.error('Webhook middleware error', {
          error: error.message,
          stack: error.stack,
          path: req.path
        });
        
        this.stats.failedWebhooks++;
        
        res.status(500).json({
          success: false,
          error: 'Webhook processing failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  // Get webhook statistics
  getStats() {
    const successRate = this.stats.totalWebhooks > 0 
      ? (this.stats.successfulWebhooks / this.stats.totalWebhooks) * 100 
      : 0;
    
    return {
      ...this.stats,
      successRate: successRate.toFixed(2) + '%',
      avgProcessingTime: this.stats.avgProcessingTime.toFixed(2) + 'ms',
      bytesProcessedMB: (this.stats.bytesProcessed / (1024 * 1024)).toFixed(2),
      eventTypes: Array.from(this.stats.eventTypes.entries()).map(([type, count]) => ({
        type,
        count
      })).sort((a, b) => b.count - a.count),
      recentWebhooks: this.stats.recentWebhooks,
      rateLimit: {
        windowMs: this.rateLimit.windowMs,
        maxRequests: this.rateLimit.maxRequests,
        currentClients: this.rateLimit.requests.size
      }
    };
  }

  // Get registered handlers
  getHandlers() {
    return {
      eventHandlers: Array.from(this.eventHandlers.entries()).map(([type, handlers]) => ({
        eventType: type,
        handlerCount: handlers.length
      })),
      globalHandlers: this.globalHandlers.length
    };
  }

  // Clear statistics
  clearStats() {
    this.stats = {
      totalWebhooks: 0,
      successfulWebhooks: 0,
      failedWebhooks: 0,
      invalidSignatures: 0,
      eventTypes: new Map(),
      avgProcessingTime: 0,
      lastWebhookTime: null,
      bytesProcessed: 0,
      errorsByType: new Map(),
      recentWebhooks: []
    };
    
    logger.info('🍌 Webhook statistics cleared');
  }

  // Default event handlers for common HubSpot events
  setupDefaultHandlers() {
    // Contact created/updated
    this.onEvent('contact.creation', async (eventData) => {
      logger.info('🍌 Contact created', {
        contactId: eventData.objectId,
        portalId: eventData.portalId
      });
    });
    
    this.onEvent('contact.propertyChange', async (eventData) => {
      logger.info('🍌 Contact updated', {
        contactId: eventData.objectId,
        portalId: eventData.portalId,
        properties: eventData.propertyName
      });
    });
    
    // Deal events
    this.onEvent('deal.creation', async (eventData) => {
      logger.info('🍌 Deal created', {
        dealId: eventData.objectId,
        portalId: eventData.portalId
      });
    });
    
    this.onEvent('deal.propertyChange', async (eventData) => {
      logger.info('🍌 Deal updated', {
        dealId: eventData.objectId,
        portalId: eventData.portalId,
        properties: eventData.propertyName
      });
    });
    
    // Company events
    this.onEvent('company.creation', async (eventData) => {
      logger.info('🍌 Company created', {
        companyId: eventData.objectId,
        portalId: eventData.portalId
      });
    });
    
    this.onEvent('company.propertyChange', async (eventData) => {
      logger.info('🍌 Company updated', {
        companyId: eventData.objectId,
        portalId: eventData.portalId,
        properties: eventData.propertyName
      });
    });
    
    logger.info('🍌 Default webhook handlers setup completed');
  }

  // Create webhook URL helper
  getWebhookUrl(baseUrl, endpoint = '/webhooks/hubspot') {
    return `${baseUrl}${endpoint}`;
  }

  // Validate webhook configuration
  validateConfig() {
    const issues = [];
    
    if (this.validateSignature && !this.clientSecret) {
      issues.push('Client secret is required for signature validation');
    }
    
    if (this.maxBodySize < 1024) {
      issues.push('Maximum body size should be at least 1KB');
    }
    
    if (this.rateLimit.maxRequests < 1) {
      issues.push('Rate limit max requests should be at least 1');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = WebhookHandler;