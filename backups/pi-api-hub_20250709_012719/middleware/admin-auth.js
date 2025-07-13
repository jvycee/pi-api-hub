const crypto = require('crypto');
const logger = require('../shared/logger');

class AdminAuthMiddleware {
  constructor(options = {}) {
    this.adminApiKey = process.env.ADMIN_API_KEY;
    this.sessionTimeout = options.sessionTimeout || 30 * 60 * 1000; // 30 minutes
    this.activeSessions = new Map(); // In production, use Redis
    this.rateLimiter = new Map(); // Track failed attempts
    this.maxAttempts = options.maxAttempts || 5;
    this.lockoutTime = options.lockoutTime || 15 * 60 * 1000; // 15 minutes
    
    if (!this.adminApiKey) {
      logger.error('ADMIN_API_KEY environment variable is required for admin authentication');
      throw new Error('Admin API key not configured');
    }
  }

  // Generate a secure session token
  generateSessionToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Check if IP is rate limited
  isRateLimited(ip) {
    const attempts = this.rateLimiter.get(ip);
    if (!attempts) return false;
    
    if (attempts.count >= this.maxAttempts) {
      const timeSinceLastAttempt = Date.now() - attempts.lastAttempt;
      return timeSinceLastAttempt < this.lockoutTime;
    }
    
    return false;
  }

  // Track failed authentication attempt
  trackFailedAttempt(ip) {
    const attempts = this.rateLimiter.get(ip) || { count: 0, lastAttempt: 0 };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.rateLimiter.set(ip, attempts);
    
    logger.warn('Failed admin authentication attempt', {
      ip,
      attempts: attempts.count,
      lockoutTime: this.lockoutTime / 1000 / 60
    });
  }

  // Clear failed attempts after successful auth
  clearFailedAttempts(ip) {
    this.rateLimiter.delete(ip);
  }

  // Authenticate admin request
  authenticate(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    
    // Check rate limiting first
    if (this.isRateLimited(ip)) {
      logger.warn('Admin authentication blocked due to rate limiting', { ip });
      return res.status(429).json({
        success: false,
        error: 'Too many failed authentication attempts. Please try again later.',
        retryAfter: this.lockoutTime / 1000,
        timestamp: new Date().toISOString()
      });
    }

    // Check for API key in header
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-admin-api-key'];
    
    let providedKey = null;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      providedKey = authHeader.substring(7);
    } else if (apiKey) {
      providedKey = apiKey;
    }

    if (!providedKey) {
      this.trackFailedAttempt(ip);
      return res.status(401).json({
        success: false,
        error: 'Admin authentication required. Provide API key in Authorization header or x-admin-api-key header.',
        timestamp: new Date().toISOString()
      });
    }

    // Use timing-safe comparison to prevent timing attacks
    const expectedKey = Buffer.from(this.adminApiKey, 'utf8');
    const providedKeyBuffer = Buffer.from(providedKey, 'utf8');
    
    if (expectedKey.length !== providedKeyBuffer.length || 
        !crypto.timingSafeEqual(expectedKey, providedKeyBuffer)) {
      this.trackFailedAttempt(ip);
      return res.status(401).json({
        success: false,
        error: 'Invalid admin API key',
        timestamp: new Date().toISOString()
      });
    }

    // Authentication successful
    this.clearFailedAttempts(ip);
    
    // Generate and store session token for this request
    const sessionToken = this.generateSessionToken();
    this.activeSessions.set(sessionToken, {
      ip,
      createdAt: Date.now(),
      lastUsed: Date.now()
    });

    // Add session info to request
    req.adminSession = {
      token: sessionToken,
      ip,
      authenticated: true
    };

    logger.info('Admin authentication successful', { ip, sessionToken });
    next();
  }

  // Middleware function
  middleware() {
    return (req, res, next) => {
      this.authenticate(req, res, next);
    };
  }

  // Clean up expired sessions
  cleanupSessions() {
    const now = Date.now();
    for (const [token, session] of this.activeSessions.entries()) {
      if (now - session.lastUsed > this.sessionTimeout) {
        this.activeSessions.delete(token);
      }
    }
  }

  // Get authentication statistics
  getStats() {
    this.cleanupSessions();
    
    return {
      activeSessions: this.activeSessions.size,
      rateLimitedIPs: Array.from(this.rateLimiter.entries())
        .filter(([ip, attempts]) => attempts.count >= this.maxAttempts)
        .map(([ip, attempts]) => ({
          ip,
          attempts: attempts.count,
          lastAttempt: new Date(attempts.lastAttempt).toISOString()
        })),
      sessionTimeout: this.sessionTimeout,
      maxAttempts: this.maxAttempts,
      lockoutTime: this.lockoutTime
    };
  }
}

module.exports = AdminAuthMiddleware;