const rateLimit = require('express-rate-limit');
const logger = require('../shared/logger');

class RateLimitingMiddleware {
  constructor() {
    this.rateLimiters = new Map();
    this.setupRateLimiters();
  }

  setupRateLimiters() {
    // Global rate limiting
    this.rateLimiters.set('global', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // Generous limit for local development
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          userAgent: req.get('User-Agent')
        });
        res.status(429).json({
          success: false,
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: '15 minutes'
        });
      }
    }));

    // API endpoints rate limiting
    this.rateLimiters.set('api', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // API requests per window
      message: {
        success: false,
        error: 'Too many API requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('API rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        res.status(429).json({
          success: false,
          error: 'Too many API requests from this IP, please try again later.',
          retryAfter: '15 minutes'
        });
      }
    }));

    // Authentication endpoints rate limiting (strict)
    this.rateLimiters.set('auth', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // Login attempts per window
      message: {
        success: false,
        error: 'Too many authentication attempts from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Authentication rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        res.status(429).json({
          success: false,
          error: 'Too many authentication attempts from this IP, please try again later.',
          retryAfter: '15 minutes'
        });
      }
    }));

    // Admin endpoints rate limiting (very strict)
    this.rateLimiters.set('admin', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Admin actions per window
      message: {
        success: false,
        error: 'Too many admin requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Admin rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        res.status(429).json({
          success: false,
          error: 'Too many admin requests from this IP, please try again later.',
          retryAfter: '15 minutes'
        });
      }
    }));

    // Monitoring endpoints rate limiting
    this.rateLimiters.set('monitoring', rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 60, // Monitoring requests per minute
      message: {
        success: false,
        error: 'Too many monitoring requests from this IP, please try again later.',
        retryAfter: '1 minute'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Monitoring rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          method: req.method
        });
        res.status(429).json({
          success: false,
          error: 'Too many monitoring requests from this IP, please try again later.',
          retryAfter: '1 minute'
        });
      }
    }));
  }

  // Get rate limiter by name
  getLimiter(name) {
    return this.rateLimiters.get(name);
  }

  // Middleware for global rate limiting
  globalLimiter() {
    return this.rateLimiters.get('global');
  }

  // Middleware for API rate limiting
  apiLimiter() {
    return this.rateLimiters.get('api');
  }

  // Middleware for authentication rate limiting
  authLimiter() {
    return this.rateLimiters.get('auth');
  }

  // Middleware for admin rate limiting
  adminLimiter() {
    return this.rateLimiters.get('admin');
  }

  // Middleware for monitoring rate limiting
  monitoringLimiter() {
    return this.rateLimiters.get('monitoring');
  }

  // Create custom rate limiter
  createCustomLimiter(options = {}) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100,
      message: {
        success: false,
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Custom rate limit exceeded', {
          ip: req.ip,
          path: req.path,
          method: req.method,
          limiterName: options.name || 'custom'
        });
        res.status(429).json({
          success: false,
          error: options.message?.error || 'Too many requests from this IP, please try again later.',
          retryAfter: options.message?.retryAfter || '15 minutes'
        });
      }
    };

    return rateLimit({ ...defaultOptions, ...options });
  }

  // Get statistics for all rate limiters
  getStats() {
    const stats = {};
    
    for (const [name, limiter] of this.rateLimiters) {
      // Note: express-rate-limit doesn't expose internal stats by default
      // This is a placeholder for future implementation
      stats[name] = {
        windowMs: limiter.windowMs,
        max: limiter.max,
        enabled: true
      };
    }
    
    return stats;
  }

  // Security headers for rate limiting
  addSecurityHeaders() {
    return (req, res, next) => {
      // Add security headers related to rate limiting
      res.setHeader('X-RateLimit-Policy', 'Applied');
      res.setHeader('X-Security-Enhanced', 'true');
      next();
    };
  }
}

module.exports = RateLimitingMiddleware;