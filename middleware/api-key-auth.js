const crypto = require('crypto');
const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED API KEY AUTHENTICATION MIDDLEWARE 🍌
 * 
 * Provides secure API key authentication with:
 * - API key validation
 * - Rate limiting per key
 * - Usage tracking
 * - Endpoint permissions
 * - Banana-level security! 🍌
 */
class APIKeyAuth {
  constructor() {
    // In-memory store for demo (should be Redis/database in production)
    this.apiKeys = new Map();
    this.keyUsage = new Map();
    this.rateLimits = new Map();
    
    // Default rate limits (per minute)
    this.defaultLimits = {
      basic: 60,      // 60 requests per minute
      premium: 300,   // 300 requests per minute
      admin: 1000     // 1000 requests per minute
    };
    
    // Endpoint permissions by tier
    this.permissions = {
      basic: [
        '/health',
        '/api/hubspot/contacts',
        '/monitoring/metrics'
      ],
      premium: [
        '/health',
        '/api/hubspot/*',
        '/monitoring/*',
        '/api/anthropic/messages'
      ],
      admin: ['*'] // All endpoints
    };
    
    // Create some default API keys for testing
    this.initializeDefaultKeys();
    
    logger.info('🍌 Banana-Powered API Key Auth initialized');
  }
  
  initializeDefaultKeys() {
    // Basic tier key
    this.createAPIKey('basic-user', 'basic', 'Basic access for testing');
    
    // Premium tier key  
    this.createAPIKey('premium-user', 'premium', 'Premium access for production');
    
    // Admin tier key
    this.createAPIKey('admin-user', 'admin', 'Admin access for management');
    
    // Security: Never log API keys in production
    const adminKeys = this.getKeysByTier('admin');
    if (adminKeys.length > 0) {
      logger.info('🍌 Admin API key initialized (key hidden for security)');
    }
    
    logger.info('🍌 Default API keys created', {
      basic: this.getKeysByTier('basic').length,
      premium: this.getKeysByTier('premium').length,
      admin: this.getKeysByTier('admin').length
    });
  }
  
  createAPIKey(name, tier = 'basic', description = '') {
    // Input validation and sanitization
    if (!name || typeof name !== 'string' || name.length < 1 || name.length > 100) {
      throw new Error('Invalid name: must be a string between 1-100 characters');
    }
    
    if (!['basic', 'premium', 'admin'].includes(tier)) {
      throw new Error('Invalid tier: must be basic, premium, or admin');
    }
    
    if (description && (typeof description !== 'string' || description.length > 500)) {
      throw new Error('Invalid description: must be a string under 500 characters');
    }
    
    // Sanitize inputs
    const sanitizedName = name.replace(/[<>\"'&]/g, '').trim();
    const sanitizedDescription = description ? description.replace(/[<>\"'&]/g, '').trim() : '';
    
    const apiKey = 'pk_' + crypto.randomBytes(32).toString('hex');
    
    this.apiKeys.set(apiKey, {
      name: sanitizedName,
      tier,
      description: sanitizedDescription,
      createdAt: new Date(),
      lastUsed: null,
      isActive: true,
      requests: 0,
      rateLimit: this.defaultLimits[tier] || this.defaultLimits.basic
    });
    
    // Initialize usage tracking
    this.keyUsage.set(apiKey, {
      totalRequests: 0,
      requestsThisMinute: 0,
      lastRequestTime: null,
      minuteStartTime: Date.now()
    });
    
    // Security: Never log full API keys
    if (tier === 'admin') {
      logger.info('🍌 Admin API key created (key hidden for security)');
    }
    
    logger.info('🍌 New API key created', {
      name,
      tier,
      keyPrefix: apiKey.substring(0, 12) + '...'
    });
    
    return apiKey;
  }
  
  validateAPIKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('pk_')) {
      return { valid: false, reason: 'Invalid API key format' };
    }
    
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return { valid: false, reason: 'API key not found' };
    }
    
    if (!keyData.isActive) {
      return { valid: false, reason: 'API key is disabled' };
    }
    
    return { valid: true, keyData };
  }
  
  checkRateLimit(apiKey) {
    const usage = this.keyUsage.get(apiKey);
    const keyData = this.apiKeys.get(apiKey);
    
    if (!usage || !keyData) {
      return { allowed: false, reason: 'Key not found' };
    }
    
    const now = Date.now();
    const minuteAgo = now - 60000; // 1 minute
    
    // Reset counter if a minute has passed
    if (now - usage.minuteStartTime > 60000) {
      usage.requestsThisMinute = 0;
      usage.minuteStartTime = now;
    }
    
    // Check if under rate limit
    if (usage.requestsThisMinute >= keyData.rateLimit) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded',
        limit: keyData.rateLimit,
        used: usage.requestsThisMinute,
        resetTime: usage.minuteStartTime + 60000
      };
    }
    
    return { allowed: true };
  }
  
  checkPermissions(apiKey, path) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return { allowed: false, reason: 'Key not found' };
    }
    
    const allowedPaths = this.permissions[keyData.tier] || [];
    
    // Admin has access to everything
    if (allowedPaths.includes('*')) {
      return { allowed: true };
    }
    
    // Check exact matches first
    if (allowedPaths.includes(path)) {
      return { allowed: true };
    }
    
    // Check wildcard matches
    for (const allowedPath of allowedPaths) {
      if (allowedPath.endsWith('*')) {
        const basePath = allowedPath.slice(0, -1);
        if (path.startsWith(basePath)) {
          return { allowed: true };
        }
      }
    }
    
    return {
      allowed: false,
      reason: `Path ${path} not allowed for tier ${keyData.tier}`,
      allowedPaths
    };
  }
  
  recordUsage(apiKey, path, success = true) {
    const usage = this.keyUsage.get(apiKey);
    const keyData = this.apiKeys.get(apiKey);
    
    if (usage && keyData) {
      usage.totalRequests++;
      usage.requestsThisMinute++;
      usage.lastRequestTime = Date.now();
      
      keyData.requests++;
      keyData.lastUsed = new Date();
      
      logger.debug('🍌 API key usage recorded', {
        keyName: keyData.name,
        path,
        success,
        totalRequests: usage.totalRequests,
        requestsThisMinute: usage.requestsThisMinute
      });
    }
  }
  
  getKeysByTier(tier) {
    const keys = [];
    for (const [apiKey, data] of this.apiKeys.entries()) {
      if (data.tier === tier) {
        keys.push({
          key: apiKey.substring(0, 12) + '...',
          ...data
        });
      }
    }
    return keys;
  }
  
  getAllKeys() {
    const keys = [];
    for (const [apiKey, data] of this.apiKeys.entries()) {
      const usage = this.keyUsage.get(apiKey);
      keys.push({
        key: apiKey.substring(0, 12) + '...',
        keyId: crypto.createHash('sha256').update(apiKey).digest('hex').substring(0, 16), // Safe identifier
        ...data,
        usage: usage || {}
      });
    }
    return keys;
  }

  // Separate method for setup only - returns full key
  getAdminKeyForSetup() {
    const adminKeys = this.getKeysByTier('admin');
    if (adminKeys.length > 0) {
      // Find the full key for the first admin
      for (const [apiKey, data] of this.apiKeys.entries()) {
        if (data.tier === 'admin') {
          return apiKey;
        }
      }
    }
    return null;
  }
  
  // Express middleware function
  middleware() {
    return (req, res, next) => {
      // Skip authentication for truly public endpoints only
      const publicEndpoints = ['/health', '/setup/admin-key', '/dashboard.html'];
      const publicPrefixes = ['/dashboard'];
      
      if (publicEndpoints.includes(req.path) || 
          publicPrefixes.some(prefix => req.path.startsWith(prefix))) {
        return next();
      }
      
      // Monitoring endpoints require authentication except health
      if (req.path.startsWith('/monitoring/') && req.path !== '/monitoring/health') {
        // Continue to authentication check below
      } else if (req.path.startsWith('/monitoring/')) {
        return next(); // Only /monitoring/health is public
      }
      
      // Extract API key from header
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      
      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API key required',
          message: 'Include X-API-Key header or Authorization: Bearer <key>',
          timestamp: new Date().toISOString()
        });
      }
      
      // Validate API key
      const validation = this.validateAPIKey(apiKey);
      if (!validation.valid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid API key',
          reason: validation.reason,
          timestamp: new Date().toISOString()
        });
      }
      
      // Check rate limits
      const rateCheck = this.checkRateLimit(apiKey);
      if (!rateCheck.allowed) {
        const resetTime = new Date(rateCheck.resetTime || Date.now() + 60000);
        res.set({
          'X-RateLimit-Limit': rateCheck.limit,
          'X-RateLimit-Used': rateCheck.used,
          'X-RateLimit-Reset': Math.ceil(resetTime.getTime() / 1000)
        });
        
        return res.status(429).json({
          success: false,
          error: 'Rate limit exceeded',
          message: rateCheck.reason,
          limit: rateCheck.limit,
          used: rateCheck.used,
          resetTime: resetTime.toISOString(),
          timestamp: new Date().toISOString()
        });
      }
      
      // Check permissions
      const permissionCheck = this.checkPermissions(apiKey, req.path);
      if (!permissionCheck.allowed) {
        this.recordUsage(apiKey, req.path, false);
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          message: permissionCheck.reason,
          allowedPaths: permissionCheck.allowedPaths,
          timestamp: new Date().toISOString()
        });
      }
      
      // Record successful usage
      this.recordUsage(apiKey, req.path, true);
      
      // Add key info to request for downstream middleware
      req.apiKeyData = validation.keyData;
      req.apiKey = apiKey;
      
      // Set rate limit headers
      const usage = this.keyUsage.get(apiKey);
      res.set({
        'X-RateLimit-Limit': validation.keyData.rateLimit,
        'X-RateLimit-Used': usage.requestsThisMinute,
        'X-RateLimit-Remaining': Math.max(0, validation.keyData.rateLimit - usage.requestsThisMinute)
      });
      
      next();
    };
  }
}

module.exports = APIKeyAuth;