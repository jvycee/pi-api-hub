const crypto = require('crypto');
const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED CSRF PROTECTION MIDDLEWARE 🍌
 * 
 * Protects against Cross-Site Request Forgery attacks
 */
class CSRFProtection {
  constructor() {
    this.tokens = new Map();
    this.secretKey = process.env.CSRF_SECRET || crypto.randomBytes(32).toString('hex');
    this.tokenTimeout = 3600000; // 1 hour
    
    // Cleanup expired tokens every 10 minutes
    setInterval(() => this.cleanupExpiredTokens(), 600000);
    
    logger.info('🍌 CSRF Protection initialized');
  }

  generateToken(sessionId) {
    const timestamp = Date.now();
    const randomBytes = crypto.randomBytes(16).toString('hex');
    const tokenData = `${sessionId}:${timestamp}:${randomBytes}`;
    
    const hmac = crypto.createHmac('sha256', this.secretKey);
    hmac.update(tokenData);
    const signature = hmac.digest('hex');
    
    const token = `${tokenData}:${signature}`;
    const encodedToken = Buffer.from(token).toString('base64');
    
    // Store token with expiration
    this.tokens.set(encodedToken, {
      sessionId,
      timestamp,
      expires: timestamp + this.tokenTimeout
    });
    
    return encodedToken;
  }

  validateToken(token, sessionId) {
    if (!token || !sessionId) {
      return false;
    }

    try {
      const tokenData = this.tokens.get(token);
      if (!tokenData) {
        return false;
      }

      // Check if token expired
      if (Date.now() > tokenData.expires) {
        this.tokens.delete(token);
        return false;
      }

      // Check session match
      if (tokenData.sessionId !== sessionId) {
        return false;
      }

      // Verify HMAC signature
      const decodedToken = Buffer.from(token, 'base64').toString();
      const parts = decodedToken.split(':');
      if (parts.length !== 4) {
        return false;
      }

      const [storedSessionId, timestamp, randomBytes, signature] = parts;
      const tokenData2 = `${storedSessionId}:${timestamp}:${randomBytes}`;
      
      const hmac = crypto.createHmac('sha256', this.secretKey);
      hmac.update(tokenData2);
      const expectedSignature = hmac.digest('hex');

      if (signature !== expectedSignature) {
        return false;
      }

      // Token is valid - remove it (one-time use)
      this.tokens.delete(token);
      return true;

    } catch (error) {
      logger.warn('CSRF token validation error', { error: error.message });
      return false;
    }
  }

  cleanupExpiredTokens() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [token, data] of this.tokens.entries()) {
      if (now > data.expires) {
        this.tokens.delete(token);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`🍌 Cleaned up ${cleaned} expired CSRF tokens`);
    }
  }

  // Middleware for generating CSRF tokens
  tokenMiddleware() {
    return (req, res, next) => {
      // Generate session ID if not exists
      if (!req.session?.id) {
        req.session = req.session || {};
        req.session.id = crypto.randomUUID();
      }

      // Generate CSRF token
      req.csrfToken = () => this.generateToken(req.session.id);
      
      next();
    };
  }

  // Middleware for validating CSRF tokens
  validateMiddleware() {
    return (req, res, next) => {
      // Skip CSRF for GET, HEAD, OPTIONS (safe methods)
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      // Skip for API endpoints with API key auth (different protection mechanism)
      if (req.apiKey) {
        return next();
      }

      const token = req.headers['x-csrf-token'] || 
                   req.headers['csrf-token'] || 
                   req.body._csrf ||
                   req.query._csrf;

      const sessionId = req.session?.id;

      if (!this.validateToken(token, sessionId)) {
        logger.warn('🚨 CSRF token validation failed', {
          ip: req.ip,
          method: req.method,
          path: req.path,
          hasToken: !!token,
          hasSession: !!sessionId
        });

        return res.status(403).json({
          success: false,
          error: 'CSRF token validation failed',
          code: 'CSRF_INVALID',
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }

  // Origin validation middleware
  originValidation() {
    return (req, res, next) => {
      // Skip for safe methods
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
      }

      const origin = req.get('Origin');
      const referer = req.get('Referer');
      const host = req.get('Host');

      // Allow same-origin requests
      const allowedOrigins = [
        `http://${host}`,
        `https://${host}`,
        'http://localhost:3000',
        'https://localhost:3000'
      ];

      let isValidOrigin = false;

      if (origin && allowedOrigins.includes(origin)) {
        isValidOrigin = true;
      } else if (referer) {
        // Check referer if origin not present
        try {
          const refererUrl = new URL(referer);
          const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
          isValidOrigin = allowedOrigins.includes(refererOrigin);
        } catch (error) {
          isValidOrigin = false;
        }
      }

      if (!isValidOrigin) {
        logger.warn('🚨 Invalid origin/referer detected', {
          ip: req.ip,
          origin,
          referer,
          host,
          method: req.method,
          path: req.path
        });

        return res.status(403).json({
          success: false,
          error: 'Invalid origin',
          code: 'ORIGIN_INVALID',
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }

  getStats() {
    return {
      activeTokens: this.tokens.size,
      secretKeySet: !!this.secretKey,
      tokenTimeout: this.tokenTimeout
    };
  }
}

module.exports = CSRFProtection;