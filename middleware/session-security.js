const crypto = require('crypto');
const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED SESSION SECURITY MIDDLEWARE 🍌
 * 
 * Provides secure session management with:
 * - Secure session ID generation
 * - Session timeout and cleanup
 * - Session fingerprinting for security
 * - Brute force protection
 */
class SessionSecurity {
  constructor(options = {}) {
    this.options = {
      sessionTimeout: options.sessionTimeout || 3600000, // 1 hour
      maxSessions: options.maxSessions || 100,
      cleanupInterval: options.cleanupInterval || 300000, // 5 minutes
      fingerprintSalt: options.fingerprintSalt || crypto.randomBytes(32).toString('hex'),
      ...options
    };
    
    // In-memory session store (use Redis in production)
    this.sessions = new Map();
    this.sessionAttempts = new Map();
    
    // Cleanup expired sessions periodically
    setInterval(() => this.cleanupExpiredSessions(), this.options.cleanupInterval);
    
    logger.info('🍌 Session Security initialized');
  }

  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  generateFingerprint(req) {
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || req.connection.remoteAddress;
    const acceptLanguage = req.get('Accept-Language') || '';
    
    // Create fingerprint from stable client characteristics
    const fingerprintData = `${userAgent}:${ip}:${acceptLanguage}`;
    const hmac = crypto.createHmac('sha256', this.options.fingerprintSalt);
    hmac.update(fingerprintData);
    
    return hmac.digest('hex');
  }

  createSession(req, data = {}) {
    const sessionId = this.generateSessionId();
    const fingerprint = this.generateFingerprint(req);
    const now = Date.now();
    
    // Clean up old sessions if we're at the limit
    if (this.sessions.size >= this.options.maxSessions) {
      this.cleanupOldestSessions(10);
    }
    
    const session = {
      id: sessionId,
      fingerprint,
      createdAt: now,
      lastActivity: now,
      expires: now + this.options.sessionTimeout,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      data: { ...data },
      isActive: true
    };
    
    this.sessions.set(sessionId, session);
    
    logger.info('🍌 New session created', {
      sessionId: sessionId.substring(0, 8) + '...',
      ip: session.ip,
      userAgent: session.userAgent ? session.userAgent.substring(0, 50) + '...' : 'Unknown'
    });
    
    return session;
  }

  getSession(sessionId) {
    if (!sessionId) {
      return null;
    }
    
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    
    // Check if session expired
    if (Date.now() > session.expires) {
      this.sessions.delete(sessionId);
      return null;
    }
    
    return session;
  }

  updateSession(sessionId, data = {}) {
    const session = this.getSession(sessionId);
    if (!session) {
      return false;
    }
    
    // Update session data and extend expiry
    session.data = { ...session.data, ...data };
    session.lastActivity = Date.now();
    session.expires = Date.now() + this.options.sessionTimeout;
    
    return true;
  }

  validateSession(req, sessionId) {
    const session = this.getSession(sessionId);
    if (!session) {
      return { valid: false, reason: 'Session not found or expired' };
    }
    
    // Validate fingerprint to prevent session hijacking
    const currentFingerprint = this.generateFingerprint(req);
    if (session.fingerprint !== currentFingerprint) {
      logger.warn('🚨 Session fingerprint mismatch detected', {
        sessionId: sessionId.substring(0, 8) + '...',
        ip: req.ip,
        storedFingerprint: session.fingerprint.substring(0, 8) + '...',
        currentFingerprint: currentFingerprint.substring(0, 8) + '...'
      });
      
      // Invalidate session on fingerprint mismatch
      this.destroySession(sessionId);
      return { valid: false, reason: 'Session security validation failed' };
    }
    
    // Check for suspicious activity patterns
    if (this.detectSuspiciousActivity(req, session)) {
      logger.warn('🚨 Suspicious session activity detected', {
        sessionId: sessionId.substring(0, 8) + '...',
        ip: req.ip
      });
      
      this.destroySession(sessionId);
      return { valid: false, reason: 'Suspicious activity detected' };
    }
    
    return { valid: true, session };
  }

  detectSuspiciousActivity(req, session) {
    // Check for rapid IP changes
    if (session.ip !== req.ip) {
      const timeSinceCreation = Date.now() - session.createdAt;
      if (timeSinceCreation < 300000) { // 5 minutes
        return true;
      }
    }
    
    // Check for too many rapid requests
    const attempts = this.sessionAttempts.get(session.id) || [];
    const recentAttempts = attempts.filter(time => Date.now() - time < 60000); // 1 minute
    
    if (recentAttempts.length > 100) { // More than 100 requests per minute
      return true;
    }
    
    return false;
  }

  recordSessionActivity(sessionId) {
    const attempts = this.sessionAttempts.get(sessionId) || [];
    attempts.push(Date.now());
    
    // Keep only last 150 attempts
    if (attempts.length > 150) {
      attempts.splice(0, attempts.length - 150);
    }
    
    this.sessionAttempts.set(sessionId, attempts);
  }

  destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.sessionAttempts.delete(sessionId);
      
      logger.info('🍌 Session destroyed', {
        sessionId: sessionId.substring(0, 8) + '...',
        duration: Date.now() - session.createdAt
      });
    }
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expires) {
        this.sessions.delete(sessionId);
        this.sessionAttempts.delete(sessionId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug(`🍌 Cleaned up ${cleaned} expired sessions`);
    }
  }

  cleanupOldestSessions(count = 10) {
    const sessions = Array.from(this.sessions.entries())
      .sort((a, b) => a[1].lastActivity - b[1].lastActivity)
      .slice(0, count);
    
    for (const [sessionId] of sessions) {
      this.destroySession(sessionId);
    }
    
    logger.debug(`🍌 Cleaned up ${sessions.length} oldest sessions`);
  }

  // Middleware function
  middleware() {
    return (req, res, next) => {
      // Get session ID from header or cookie
      const sessionId = req.get('x-session-id') || req.cookies?.sessionId;
      
      if (sessionId) {
        const validation = this.validateSession(req, sessionId);
        if (validation.valid) {
          req.session = validation.session;
          this.recordSessionActivity(sessionId);
          this.updateSession(sessionId); // Extend session
        } else {
          // Clear invalid session cookie
          res.clearCookie('sessionId');
          req.session = null;
        }
      }
      
      // Helper function to create new session
      req.createSession = (data = {}) => {
        const session = this.createSession(req, data);
        
        // Set secure session cookie
        res.cookie('sessionId', session.id, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: this.options.sessionTimeout
        });
        
        req.session = session;
        return session;
      };
      
      // Helper function to destroy session
      req.destroySession = () => {
        if (req.session) {
          this.destroySession(req.session.id);
          res.clearCookie('sessionId');
          req.session = null;
        }
      };
      
      next();
    };
  }

  getStats() {
    const now = Date.now();
    let activeSessions = 0;
    let expiredSessions = 0;
    
    for (const session of this.sessions.values()) {
      if (now > session.expires) {
        expiredSessions++;
      } else {
        activeSessions++;
      }
    }
    
    return {
      totalSessions: this.sessions.size,
      activeSessions,
      expiredSessions,
      sessionTimeout: this.options.sessionTimeout,
      maxSessions: this.options.maxSessions
    };
  }
}

module.exports = SessionSecurity;