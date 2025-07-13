const crypto = require('crypto');
const logger = require('../shared/logger');

class BananaRequestSigning {
  constructor() {
    this.apiKeys = new Map();
    this.signingSecrets = new Map();
    this.signatureCache = new Map();
    this.nonceStore = new Map();
    this.signatureAlgorithm = 'sha256';
    this.signatureTimeout = 5 * 60 * 1000; // 5 minutes
    this.bananaSecurityLevel = 'SIGNATURE_FORTRESS';
    
    this.initializeBananaSigningSystem();
    this.setupDefaultApiKeys();
    this.startNonceCleanup();
  }

  initializeBananaSigningSystem() {
    logger.info('🍌✍️ BANANA REQUEST SIGNING FORTRESS ACTIVATED ✍️🍌', {
      service: 'banana-request-signing',
      algorithm: this.signatureAlgorithm,
      bananaLevel: 'SIGNATURE_MAXIMUM'
    });
  }

  // Setup default API keys (in production, load from secure database)
  setupDefaultApiKeys() {
    // Admin API keys
    this.registerApiKey('admin-banana-001', {
      name: 'Admin Master Key',
      secret: this.generateSecureSecret(),
      permissions: ['admin', 'api', 'monitoring'],
      rateLimitTier: 'admin',
      bananaLevel: 'MAXIMUM'
    });

    // Standard API keys
    this.registerApiKey('api-banana-002', {
      name: 'Standard API Key',
      secret: this.generateSecureSecret(),
      permissions: ['api', 'read'],
      rateLimitTier: 'standard',
      bananaLevel: 'STANDARD'
    });

    // Monitoring API keys
    this.registerApiKey('monitor-banana-003', {
      name: 'Monitoring Key',
      secret: this.generateSecureSecret(),
      permissions: ['monitoring', 'read'],
      rateLimitTier: 'monitoring',
      bananaLevel: 'ENHANCED'
    });

    logger.info('🍌 DEFAULT BANANA API KEYS REGISTERED', {
      totalKeys: this.apiKeys.size,
      bananaKeyring: 'LOADED'
    });
  }

  // Register API key
  registerApiKey(keyId, config) {
    this.apiKeys.set(keyId, {
      keyId,
      name: config.name,
      permissions: config.permissions || [],
      rateLimitTier: config.rateLimitTier || 'standard',
      createdAt: new Date().toISOString(),
      lastUsed: null,
      usageCount: 0,
      bananaLevel: config.bananaLevel || 'STANDARD'
    });

    this.signingSecrets.set(keyId, config.secret);
    
    logger.info('🍌 BANANA API KEY REGISTERED', {
      keyId,
      name: config.name,
      permissions: config.permissions,
      bananaLevel: config.bananaLevel
    });
  }

  // Generate secure secret
  generateSecureSecret() {
    return crypto.randomBytes(32).toString('hex');
  }

  // 🍌 Request signing middleware 🍌
  requireSignedRequest(options = {}) {
    const {
      requiredPermissions = [],
      strictTiming = true,
      allowUnsigned = false
    } = options;

    return (req, res, next) => {
      const startTime = Date.now();
      
      try {
        // Check if signature is required
        if (allowUnsigned && !req.headers['x-banana-signature']) {
          logger.info('🍌 UNSIGNED REQUEST ALLOWED', {
            path: req.path,
            method: req.method,
            bananaMode: 'PERMISSIVE'
          });
          return next();
        }

        // Extract signature components
        const signature = req.headers['x-banana-signature'];
        const timestamp = req.headers['x-banana-timestamp'];
        const nonce = req.headers['x-banana-nonce'];
        const apiKey = req.headers['x-api-key'];

        if (!signature || !timestamp || !apiKey) {
          logger.warn('🚫 BANANA SIGNATURE MISSING COMPONENTS', {
            hasSignature: !!signature,
            hasTimestamp: !!timestamp,
            hasApiKey: !!apiKey,
            path: req.path
          });

          return res.status(401).json({
            success: false,
            error: 'Missing required signature components',
            required: ['x-banana-signature', 'x-banana-timestamp', 'x-api-key'],
            bananaMessage: '🚫🍌 Banana signature required! 🍌🚫'
          });
        }

        // Verify API key exists
        const keyData = this.apiKeys.get(apiKey);
        if (!keyData) {
          logger.warn('🚫 INVALID BANANA API KEY', {
            apiKey,
            path: req.path,
            ip: this.getClientIP(req)
          });

          return res.status(401).json({
            success: false,
            error: 'Invalid API key',
            bananaMessage: '🚫🍌 Unknown banana key! 🍌🚫'
          });
        }

        // Verify timestamp
        const timestampValid = this.verifyTimestamp(timestamp, strictTiming);
        if (!timestampValid) {
          logger.warn('🚫 BANANA SIGNATURE TIMESTAMP INVALID', {
            timestamp,
            currentTime: Date.now(),
            path: req.path,
            apiKey
          });

          return res.status(401).json({
            success: false,
            error: 'Request timestamp invalid or expired',
            bananaMessage: '🚫🍌 Banana signature too old! 🍌🚫'
          });
        }

        // Verify nonce (prevent replay attacks)
        if (nonce && !this.verifyNonce(nonce, apiKey)) {
          logger.warn('🚫 BANANA SIGNATURE NONCE REUSED', {
            nonce,
            apiKey,
            path: req.path
          });

          return res.status(401).json({
            success: false,
            error: 'Nonce already used (replay attack detected)',
            bananaMessage: '🚫🍌 Banana replay attack detected! 🍌🚫'
          });
        }

        // Verify signature
        const signatureValid = this.verifySignature(req, apiKey, signature, timestamp, nonce);
        if (!signatureValid) {
          logger.warn('🚫 BANANA SIGNATURE VERIFICATION FAILED', {
            apiKey,
            path: req.path,
            method: req.method,
            ip: this.getClientIP(req)
          });

          return res.status(401).json({
            success: false,
            error: 'Invalid request signature',
            bananaMessage: '🚫🍌 Banana signature invalid! 🍌🚫'
          });
        }

        // Check permissions
        if (requiredPermissions.length > 0) {
          const hasPermission = requiredPermissions.some(permission => 
            keyData.permissions.includes(permission)
          );

          if (!hasPermission) {
            logger.warn('🚫 BANANA PERMISSION DENIED', {
              apiKey,
              requiredPermissions,
              availablePermissions: keyData.permissions,
              path: req.path
            });

            return res.status(403).json({
              success: false,
              error: 'Insufficient permissions',
              required: requiredPermissions,
              available: keyData.permissions,
              bananaMessage: '🚫🍌 Banana permission denied! 🍌🚫'
            });
          }
        }

        // Update API key usage
        this.updateApiKeyUsage(apiKey);

        // Store nonce to prevent replay
        if (nonce) {
          this.storeNonce(nonce, apiKey);
        }

        // Attach signing info to request
        req.bananaSignature = {
          verified: true,
          apiKey,
          keyData,
          timestamp,
          nonce,
          verificationTime: Date.now() - startTime,
          bananaLevel: keyData.bananaLevel
        };

        logger.info('🍌 BANANA SIGNATURE VERIFIED', {
          apiKey,
          path: req.path,
          method: req.method,
          verificationTime: req.bananaSignature.verificationTime,
          bananaLevel: keyData.bananaLevel
        });

        next();

      } catch (error) {
        logger.error('🚨 BANANA SIGNATURE VERIFICATION ERROR', {
          error: error.message,
          path: req.path,
          method: req.method
        });

        res.status(500).json({
          success: false,
          error: 'Signature verification failed',
          bananaMessage: '🚨🍌 Banana signature system error! 🍌🚨'
        });
      }
    };
  }

  // Verify request signature
  verifySignature(req, apiKey, signature, timestamp, nonce = '') {
    try {
      const secret = this.signingSecrets.get(apiKey);
      if (!secret) return false;

      const signaturePayload = this.buildSignaturePayload(req, timestamp, nonce);
      const expectedSignature = this.generateSignature(signaturePayload, secret);

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

    } catch (error) {
      logger.error('🚨 SIGNATURE VERIFICATION ERROR', {
        error: error.message,
        apiKey
      });
      return false;
    }
  }

  // Build signature payload
  buildSignaturePayload(req, timestamp, nonce = '') {
    const method = req.method.toUpperCase();
    const path = req.path;
    const body = req.body ? JSON.stringify(req.body) : '';
    const queryString = req.url.includes('?') ? req.url.split('?')[1] : '';
    
    // Include important headers in signature
    const headers = {
      'content-type': req.headers['content-type'] || '',
      'user-agent': req.headers['user-agent'] || ''
    };
    
    const headerString = Object.entries(headers)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');

    return [
      method,
      path,
      queryString,
      body,
      headerString,
      timestamp,
      nonce
    ].join('\n');
  }

  // Generate signature
  generateSignature(payload, secret) {
    return crypto
      .createHmac(this.signatureAlgorithm, secret)
      .update(payload)
      .digest('hex');
  }

  // Verify timestamp
  verifyTimestamp(timestamp, strict = true) {
    try {
      const requestTime = parseInt(timestamp);
      const now = Date.now();
      const maxAge = strict ? this.signatureTimeout : this.signatureTimeout * 2;

      return Math.abs(now - requestTime) <= maxAge;
    } catch (error) {
      return false;
    }
  }

  // Verify nonce (prevent replay attacks)
  verifyNonce(nonce, apiKey) {
    const nonceKey = `${apiKey}:${nonce}`;
    return !this.nonceStore.has(nonceKey);
  }

  // Store nonce
  storeNonce(nonce, apiKey) {
    const nonceKey = `${apiKey}:${nonce}`;
    const expiryTime = Date.now() + this.signatureTimeout;
    
    this.nonceStore.set(nonceKey, {
      apiKey,
      nonce,
      timestamp: Date.now(),
      expiryTime
    });
  }

  // Update API key usage
  updateApiKeyUsage(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (keyData) {
      keyData.lastUsed = new Date().toISOString();
      keyData.usageCount = (keyData.usageCount || 0) + 1;
    }
  }

  // Start nonce cleanup
  startNonceCleanup() {
    // Clean expired nonces every minute
    setInterval(() => {
      const now = Date.now();
      for (const [key, data] of this.nonceStore.entries()) {
        if (data.expiryTime <= now) {
          this.nonceStore.delete(key);
        }
      }
    }, 60 * 1000);

    logger.info('🍌 NONCE CLEANUP STARTED', {
      interval: '60 seconds',
      bananaCleanup: 'ACTIVE'
    });
  }

  // Get client IP
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           'unknown';
  }

  // 🍌 Generate signed request example 🍌
  generateSignedRequestExample(method, path, body = null, apiKey = null) {
    const exampleApiKey = apiKey || Array.from(this.apiKeys.keys())[0];
    const secret = this.signingSecrets.get(exampleApiKey);
    
    if (!secret) {
      return { error: 'API key not found' };
    }

    const timestamp = Date.now().toString();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    // Build mock request object
    const mockReq = {
      method: method.toUpperCase(),
      path,
      body,
      headers: {
        'content-type': 'application/json',
        'user-agent': 'banana-client/1.0'
      },
      url: path
    };

    const payload = this.buildSignaturePayload(mockReq, timestamp, nonce);
    const signature = this.generateSignature(payload, secret);

    return {
      method: method.toUpperCase(),
      path,
      headers: {
        'x-api-key': exampleApiKey,
        'x-banana-signature': signature,
        'x-banana-timestamp': timestamp,
        'x-banana-nonce': nonce,
        'content-type': 'application/json'
      },
      body,
      signaturePayload: payload,
      bananaExample: '🍌 Ready to sign! 🍌'
    };
  }

  // 🍌 Banana signing dashboard 🍌
  getBananaSigningDashboard() {
    const totalKeys = this.apiKeys.size;
    const activeKeys = Array.from(this.apiKeys.values())
      .filter(key => key.lastUsed && 
        (Date.now() - new Date(key.lastUsed).getTime()) < 24 * 60 * 60 * 1000).length;
    
    return {
      title: '🍌✍️ BANANA REQUEST SIGNING DASHBOARD ✍️🍌',
      timestamp: new Date().toISOString(),
      signingStatus: 'FORTRESS_ACTIVE',
      
      signingMetrics: {
        totalApiKeys: totalKeys,
        activeKeys: activeKeys,
        inactiveKeys: totalKeys - activeKeys,
        totalNonces: this.nonceStore.size,
        algorithm: this.signatureAlgorithm,
        timeout: this.signatureTimeout / 1000 + ' seconds',
        bananaSecurityLevel: this.bananaSecurityLevel
      },
      
      keyStatistics: this.getKeyStatistics(),
      recentActivity: this.getRecentSigningActivity(),
      securityMetrics: this.getSigningSecurityMetrics(),
      
      bananaRecommendations: this.getSigningRecommendations(),
      bananaStatus: '🍌 SIGNATURE FORTRESS OPERATIONAL 🍌'
    };
  }

  // Get key statistics
  getKeyStatistics() {
    const keys = Array.from(this.apiKeys.values());
    const stats = {
      byTier: {},
      byPermission: {},
      byUsage: { high: 0, medium: 0, low: 0, unused: 0 }
    };

    keys.forEach(key => {
      // By tier
      stats.byTier[key.rateLimitTier] = (stats.byTier[key.rateLimitTier] || 0) + 1;
      
      // By permission
      key.permissions.forEach(permission => {
        stats.byPermission[permission] = (stats.byPermission[permission] || 0) + 1;
      });
      
      // By usage
      const usage = key.usageCount || 0;
      if (usage === 0) stats.byUsage.unused++;
      else if (usage > 1000) stats.byUsage.high++;
      else if (usage > 100) stats.byUsage.medium++;
      else stats.byUsage.low++;
    });

    return stats;
  }

  // Get recent signing activity
  getRecentSigningActivity() {
    const keys = Array.from(this.apiKeys.values())
      .filter(key => key.lastUsed)
      .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
      .slice(0, 10);

    return keys.map(key => ({
      keyId: key.keyId,
      name: key.name,
      lastUsed: key.lastUsed,
      usageCount: key.usageCount,
      permissions: key.permissions,
      bananaLevel: key.bananaLevel
    }));
  }

  // Get signing security metrics
  getSigningSecurityMetrics() {
    const now = Date.now();
    const recentNonces = Array.from(this.nonceStore.values())
      .filter(nonce => (now - nonce.timestamp) < 60 * 60 * 1000); // Last hour

    return {
      activeNonces: this.nonceStore.size,
      recentNonces: recentNonces.length,
      nonceHitRate: this.calculateNonceHitRate(),
      signatureTimeouts: this.getSignatureTimeouts(),
      bananaSecurityScore: this.calculateSigningSecurityScore()
    };
  }

  // Calculate nonce hit rate
  calculateNonceHitRate() {
    // In production, track from actual metrics
    return {
      total: this.nonceStore.size,
      unique: this.nonceStore.size,
      duplicates: 0,
      hitRate: '100%'
    };
  }

  // Get signature timeouts
  getSignatureTimeouts() {
    // In production, track from actual metrics
    return {
      total: 0,
      recent: 0,
      rate: '0%'
    };
  }

  // Calculate signing security score
  calculateSigningSecurityScore() {
    let score = 100;
    
    // Deduct for inactive keys
    const inactiveKeys = Array.from(this.apiKeys.values())
      .filter(key => !key.lastUsed || 
        (Date.now() - new Date(key.lastUsed).getTime()) > 30 * 24 * 60 * 60 * 1000).length;
    
    score -= inactiveKeys * 5;
    
    // Deduct for old nonces
    const oldNonces = Array.from(this.nonceStore.values())
      .filter(nonce => (Date.now() - nonce.timestamp) > 60 * 60 * 1000).length;
    
    score -= oldNonces * 2;
    
    return Math.max(0, score);
  }

  // Get signing recommendations
  getSigningRecommendations() {
    const recommendations = [];
    
    const inactiveKeys = Array.from(this.apiKeys.values())
      .filter(key => !key.lastUsed || 
        (Date.now() - new Date(key.lastUsed).getTime()) > 30 * 24 * 60 * 60 * 1000).length;
    
    if (inactiveKeys > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Review and revoke inactive API keys',
        count: inactiveKeys,
        bananaMessage: '🔑🍌 Inactive banana keys detected! 🍌🔑'
      });
    }
    
    const oldNonces = Array.from(this.nonceStore.values())
      .filter(nonce => (Date.now() - nonce.timestamp) > 60 * 60 * 1000).length;
    
    if (oldNonces > 100) {
      recommendations.push({
        priority: 'LOW',
        action: 'Increase nonce cleanup frequency',
        count: oldNonces,
        bananaMessage: '🍌 Old banana nonces need cleanup! 🍌'
      });
    }
    
    return recommendations;
  }

  // 🍌 Revoke API key 🍌
  revokeApiKey(apiKey, reason = 'Manual revocation') {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return {
        success: false,
        error: 'API key not found',
        bananaMessage: '🚫🍌 Banana key not found! 🍌🚫'
      };
    }

    // Remove from active keys
    this.apiKeys.delete(apiKey);
    this.signingSecrets.delete(apiKey);

    // Remove associated nonces
    for (const [nonceKey, nonceData] of this.nonceStore.entries()) {
      if (nonceData.apiKey === apiKey) {
        this.nonceStore.delete(nonceKey);
      }
    }

    logger.warn('🍌 BANANA API KEY REVOKED', {
      apiKey,
      reason,
      keyName: keyData.name,
      timestamp: new Date().toISOString()
    });

    return {
      success: true,
      revokedKey: {
        keyId: apiKey,
        name: keyData.name,
        reason,
        revokedAt: new Date().toISOString()
      },
      bananaMessage: '🍌 Banana key revoked successfully! 🍌'
    };
  }

  // 🍌 Generate client signing helper 🍌
  generateClientSigningHelper(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    if (!keyData) {
      return { error: 'API key not found' };
    }

    const secret = this.signingSecrets.get(apiKey);
    
    return {
      title: '🍌✍️ BANANA CLIENT SIGNING HELPER ✍️🍌',
      apiKey,
      keyName: keyData.name,
      
      // JavaScript/Node.js example
      javascriptExample: `
const crypto = require('crypto');

function signBananaRequest(method, path, body, apiKey, secret) {
  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const payload = [
    method.toUpperCase(),
    path,
    '', // query string
    body ? JSON.stringify(body) : '',
    'content-type:application/json|user-agent:banana-client/1.0',
    timestamp,
    nonce
  ].join('\\n');
  
  const signature = crypto.createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return {
    'x-api-key': apiKey,
    'x-banana-signature': signature,
    'x-banana-timestamp': timestamp,
    'x-banana-nonce': nonce,
    'content-type': 'application/json'
  };
}

// Example usage:
const headers = signBananaRequest('POST', '/api/test', {test: true}, '${apiKey}', '${secret}');
      `,
      
      // Python example
      pythonExample: `
import hashlib
import hmac
import json
import time
import secrets

def sign_banana_request(method, path, body, api_key, secret):
    timestamp = str(int(time.time() * 1000))
    nonce = secrets.token_hex(16)
    
    payload_parts = [
        method.upper(),
        path,
        '',  # query string
        json.dumps(body) if body else '',
        'content-type:application/json|user-agent:banana-client/1.0',
        timestamp,
        nonce
    ]
    
    payload = '\\n'.join(payload_parts)
    signature = hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
    
    return {
        'x-api-key': api_key,
        'x-banana-signature': signature,
        'x-banana-timestamp': timestamp,
        'x-banana-nonce': nonce,
        'content-type': 'application/json'
    }

# Example usage:
headers = sign_banana_request('POST', '/api/test', {'test': True}, '${apiKey}', '${secret}')
      `,
      
      bananaMessage: '🍌 Ready to sign banana requests! 🍌'
    };
  }
}

module.exports = BananaRequestSigning;