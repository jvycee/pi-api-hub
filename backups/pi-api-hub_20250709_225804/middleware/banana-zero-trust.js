const crypto = require('crypto');
const logger = require('../shared/logger');

class BananaZeroTrust {
  constructor() {
    this.trustedDevices = new Map();
    this.requestSignatures = new Map();
    this.deviceFingerprints = new Map();
    this.networkSegments = new Map();
    this.accessPolicies = new Map();
    this.bananaSecurityLevel = 'ZERO_TRUST_MAXIMUM';
    
    this.initializeBananaZeroTrust();
    this.setupDefaultPolicies();
  }

  initializeBananaZeroTrust() {
    logger.info('🍌🛡️ BANANA ZERO-TRUST FORTRESS ACTIVATED 🛡️🍌', {
      service: 'banana-zero-trust',
      trustLevel: 'ZERO',
      bananaLevel: 'MAXIMUM'
    });
  }

  // 🍌 Setup default access policies 🍌
  setupDefaultPolicies() {
    // Admin access policy
    this.accessPolicies.set('admin', {
      requireMFA: true,
      requireDeviceVerification: true,
      allowedNetworks: ['internal', 'vpn'],
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      requireSignedRequests: true,
      maxSimultaneousSessions: 2,
      bananaSecurityLevel: 'MAXIMUM'
    });

    // API access policy
    this.accessPolicies.set('api', {
      requireSignedRequests: true,
      rateLimitStrict: true,
      allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
      requireApiKey: true,
      bananaSecurityLevel: 'HIGH'
    });

    // Public access policy
    this.accessPolicies.set('public', {
      rateLimitBasic: true,
      allowedEndpoints: ['/health', '/api/test-connections'],
      requireDeviceFingerprint: true,
      bananaSecurityLevel: 'STANDARD'
    });

    logger.info('🍌 BANANA ZERO-TRUST POLICIES LOADED', {
      totalPolicies: this.accessPolicies.size,
      bananaFortress: 'OPERATIONAL'
    });
  }

  // 🍌 Zero-trust middleware 🍌
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      try {
        // Step 1: Identity Verification
        const identity = this.extractIdentity(req);
        
        // Step 2: Device Verification
        const deviceTrust = this.verifyDevice(req, identity);
        
        // Step 3: Network Context
        const networkContext = this.analyzeNetworkContext(req);
        
        // Step 4: Request Integrity
        const requestIntegrity = this.verifyRequestIntegrity(req);
        
        // Step 5: Access Policy Evaluation
        const accessDecision = this.evaluateAccess(req, {
          identity,
          deviceTrust,
          networkContext,
          requestIntegrity
        });

        // Step 6: Apply Security Headers
        this.applyZeroTrustHeaders(res, accessDecision);

        if (!accessDecision.allowed) {
          logger.warn('🚫🍌 ZERO-TRUST ACCESS DENIED', {
            identity: identity.id,
            reason: accessDecision.reason,
            path: req.path,
            ip: this.getClientIP(req)
          });

          return res.status(403).json({
            success: false,
            error: 'Access denied by zero-trust policy',
            reason: accessDecision.reason,
            bananaMessage: '🚫🍌 Banana fortress says NO! 🍌🚫',
            requiresVerification: accessDecision.requiresVerification
          });
        }

        // Attach security context to request
        req.bananaZeroTrust = {
          identity,
          deviceTrust,
          networkContext,
          accessDecision,
          verificationLevel: this.calculateVerificationLevel(accessDecision)
        };

        // Track successful access
        this.trackAccess(req, accessDecision);

        logger.info('🍌 ZERO-TRUST ACCESS GRANTED', {
          identity: identity.id,
          verificationLevel: req.bananaZeroTrust.verificationLevel,
          path: req.path,
          processingTime: Date.now() - startTime
        });

        next();

      } catch (error) {
        logger.error('🚨 ZERO-TRUST MIDDLEWARE ERROR', {
          error: error.message,
          path: req.path,
          ip: this.getClientIP(req)
        });

        res.status(500).json({
          success: false,
          error: 'Zero-trust verification failed',
          bananaMessage: '🚨🍌 Banana fortress malfunction! 🍌🚨'
        });
      }
    };
  }

  // Extract identity from request
  extractIdentity(req) {
    return {
      id: req.user?.id || 'anonymous',
      type: req.user ? 'authenticated' : 'anonymous',
      roles: req.user?.roles || [],
      permissions: req.permissions || [],
      sessionId: req.sessionId || null,
      bananaLevel: req.user ? 'VERIFIED' : 'UNVERIFIED'
    };
  }

  // Verify device trust
  verifyDevice(req, identity) {
    const deviceFingerprint = this.generateDeviceFingerprint(req);
    const clientIP = this.getClientIP(req);
    const userAgent = req.get('User-Agent');

    // Check if device is known
    const deviceKey = `${identity.id}_${deviceFingerprint}`;
    const trustedDevice = this.trustedDevices.get(deviceKey);

    const deviceTrust = {
      fingerprint: deviceFingerprint,
      isKnown: !!trustedDevice,
      trustLevel: this.calculateDeviceTrustLevel(req, trustedDevice),
      lastSeen: trustedDevice?.lastSeen || null,
      ipHistory: trustedDevice?.ipHistory || [],
      bananaStatus: trustedDevice ? '🍌 KNOWN BANANA DEVICE 🍌' : '🔍 UNKNOWN DEVICE 🔍'
    };

    // Update device record
    if (identity.type === 'authenticated') {
      this.updateDeviceRecord(deviceKey, {
        fingerprint: deviceFingerprint,
        ip: clientIP,
        userAgent,
        lastSeen: new Date().toISOString(),
        trustLevel: deviceTrust.trustLevel
      });
    }

    return deviceTrust;
  }

  // Generate device fingerprint
  generateDeviceFingerprint(req) {
    const components = [
      req.get('User-Agent') || '',
      req.get('Accept-Language') || '',
      req.get('Accept-Encoding') || '',
      req.get('Accept') || '',
      this.getClientIP(req)
    ];

    return crypto
      .createHash('sha256')
      .update(components.join('|'))
      .digest('hex')
      .substring(0, 16);
  }

  // Calculate device trust level
  calculateDeviceTrustLevel(req, trustedDevice) {
    if (!trustedDevice) return 'UNKNOWN';

    const daysSinceLastSeen = trustedDevice.lastSeen ? 
      (Date.now() - new Date(trustedDevice.lastSeen).getTime()) / (24 * 60 * 60 * 1000) : 999;

    if (daysSinceLastSeen < 1) return 'HIGH';
    if (daysSinceLastSeen < 7) return 'MEDIUM';
    if (daysSinceLastSeen < 30) return 'LOW';
    return 'STALE';
  }

  // Analyze network context
  analyzeNetworkContext(req) {
    const clientIP = this.getClientIP(req);
    const isPrivateIP = this.isPrivateIP(clientIP);
    const geolocation = this.getGeoLocation(clientIP);
    const networkSegment = this.determineNetworkSegment(clientIP);

    return {
      ip: clientIP,
      isPrivateIP,
      geolocation,
      networkSegment,
      trustLevel: this.calculateNetworkTrustLevel(clientIP, isPrivateIP, networkSegment),
      bananaStatus: isPrivateIP ? '🍌 INTERNAL BANANA NETWORK 🍌' : '🌍 EXTERNAL NETWORK 🌍'
    };
  }

  // Verify request integrity
  verifyRequestIntegrity(req) {
    const hasSignature = !!req.headers['x-banana-signature'];
    const signatureValid = hasSignature ? this.verifyRequestSignature(req) : false;
    const hasTimestamp = !!req.headers['x-banana-timestamp'];
    const timestampValid = hasTimestamp ? this.verifyTimestamp(req.headers['x-banana-timestamp']) : false;

    return {
      hasSignature,
      signatureValid,
      hasTimestamp,
      timestampValid,
      integrityScore: this.calculateIntegrityScore(hasSignature, signatureValid, hasTimestamp, timestampValid),
      bananaStatus: signatureValid ? '🍌 SIGNED BANANA REQUEST 🍌' : '📝 UNSIGNED REQUEST 📝'
    };
  }

  // Verify request signature
  verifyRequestSignature(req) {
    try {
      const signature = req.headers['x-banana-signature'];
      const timestamp = req.headers['x-banana-timestamp'];
      const apiKey = req.headers['x-api-key'] || req.headers['authorization'];

      if (!signature || !timestamp || !apiKey) return false;

      // In production, use proper API key lookup
      const secretKey = this.getApiKeySecret(apiKey);
      if (!secretKey) return false;

      const payload = `${req.method}:${req.path}:${timestamp}:${JSON.stringify(req.body || {})}`;
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payload)
        .digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

    } catch (error) {
      logger.warn('🚨 SIGNATURE VERIFICATION FAILED', { error: error.message });
      return false;
    }
  }

  // Verify timestamp
  verifyTimestamp(timestamp) {
    try {
      const requestTime = parseInt(timestamp);
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes

      return Math.abs(now - requestTime) <= maxAge;
    } catch (error) {
      return false;
    }
  }

  // Calculate integrity score
  calculateIntegrityScore(hasSignature, signatureValid, hasTimestamp, timestampValid) {
    let score = 0;
    if (hasSignature) score += 25;
    if (signatureValid) score += 25;
    if (hasTimestamp) score += 25;
    if (timestampValid) score += 25;
    return score;
  }

  // Evaluate access decision
  evaluateAccess(req, context) {
    const { identity, deviceTrust, networkContext, requestIntegrity } = context;
    const path = req.path;
    const method = req.method;

    // Determine required policy
    const policyType = this.determinePolicyType(path, identity);
    const policy = this.accessPolicies.get(policyType);

    if (!policy) {
      return {
        allowed: false,
        reason: 'NO_POLICY_FOUND',
        policyType,
        bananaMessage: '🚫🍌 No banana policy for this request! 🍌🚫'
      };
    }

    // Check policy requirements
    const checks = [];

    // MFA requirement
    if (policy.requireMFA && identity.type === 'authenticated') {
      checks.push({
        name: 'MFA',
        required: true,
        passed: req.session?.mfaVerified || false,
        message: '🔐 MFA verification required'
      });
    }

    // Device verification
    if (policy.requireDeviceVerification) {
      checks.push({
        name: 'DEVICE_TRUST',
        required: true,
        passed: deviceTrust.trustLevel !== 'UNKNOWN',
        message: '📱 Device verification required'
      });
    }

    // Network restrictions
    if (policy.allowedNetworks) {
      checks.push({
        name: 'NETWORK',
        required: true,
        passed: policy.allowedNetworks.includes(networkContext.networkSegment),
        message: '🌐 Network access restricted'
      });
    }

    // Signed requests
    if (policy.requireSignedRequests) {
      checks.push({
        name: 'SIGNATURE',
        required: true,
        passed: requestIntegrity.signatureValid,
        message: '✍️ Request signature required'
      });
    }

    // API key requirement
    if (policy.requireApiKey) {
      checks.push({
        name: 'API_KEY',
        required: true,
        passed: !!(req.headers['x-api-key'] || req.headers['authorization']),
        message: '🔑 API key required'
      });
    }

    // Evaluate all checks
    const failedChecks = checks.filter(check => check.required && !check.passed);
    const allowed = failedChecks.length === 0;

    return {
      allowed,
      reason: failedChecks.length > 0 ? failedChecks[0].name : 'POLICY_SATISFIED',
      failedChecks,
      policyType,
      requiresVerification: failedChecks.map(check => check.name),
      bananaMessage: allowed ? 
        '🍌 Banana fortress grants access! 🍌' : 
        `🚫🍌 ${failedChecks[0]?.message || 'Access denied'} 🍌🚫`
    };
  }

  // Determine policy type based on request
  determinePolicyType(path, identity) {
    if (path.startsWith('/admin/') || path.includes('admin')) return 'admin';
    if (path.startsWith('/api/')) return 'api';
    return 'public';
  }

  // Apply zero-trust security headers
  applyZeroTrustHeaders(res, accessDecision) {
    res.setHeader('X-Banana-Zero-Trust', 'ACTIVE');
    res.setHeader('X-Banana-Policy', accessDecision.policyType || 'UNKNOWN');
    res.setHeader('X-Banana-Access', accessDecision.allowed ? 'GRANTED' : 'DENIED');
    res.setHeader('X-Banana-Fortress', 'MAXIMUM_SECURITY');
  }

  // Calculate verification level
  calculateVerificationLevel(accessDecision) {
    if (!accessDecision.allowed) return 'DENIED';
    
    const checks = accessDecision.failedChecks?.length || 0;
    if (checks === 0 && accessDecision.policyType === 'admin') return 'MAXIMUM';
    if (checks === 0) return 'HIGH';
    if (checks <= 2) return 'MEDIUM';
    return 'LOW';
  }

  // Track access for analytics
  trackAccess(req, accessDecision) {
    const accessLog = {
      timestamp: new Date().toISOString(),
      identity: req.bananaZeroTrust.identity.id,
      path: req.path,
      method: req.method,
      allowed: accessDecision.allowed,
      verificationLevel: req.bananaZeroTrust.verificationLevel,
      policyType: accessDecision.policyType,
      ip: this.getClientIP(req),
      bananaLevel: 'TRACKED'
    };

    // In production, store in database
    logger.info('🍌 ZERO-TRUST ACCESS TRACKED', accessLog);
  }

  // Update device record
  updateDeviceRecord(deviceKey, deviceData) {
    const existingDevice = this.trustedDevices.get(deviceKey) || {
      ipHistory: [],
      accessCount: 0
    };

    existingDevice.fingerprint = deviceData.fingerprint;
    existingDevice.lastSeen = deviceData.lastSeen;
    existingDevice.userAgent = deviceData.userAgent;
    existingDevice.trustLevel = deviceData.trustLevel;
    existingDevice.accessCount = (existingDevice.accessCount || 0) + 1;

    // Track IP history
    if (!existingDevice.ipHistory.includes(deviceData.ip)) {
      existingDevice.ipHistory.push(deviceData.ip);
      // Keep only last 10 IPs
      if (existingDevice.ipHistory.length > 10) {
        existingDevice.ipHistory = existingDevice.ipHistory.slice(-10);
      }
    }

    this.trustedDevices.set(deviceKey, existingDevice);
  }

  // Check if IP is private
  isPrivateIP(ip) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^localhost$/,
      /^::1$/
    ];

    return privateRanges.some(range => range.test(ip));
  }

  // Get geo location (simplified)
  getGeoLocation(ip) {
    // In production, use proper geo IP service
    if (this.isPrivateIP(ip)) {
      return { country: 'LOCAL', region: 'INTERNAL', city: 'BANANA_FORTRESS' };
    }
    return { country: 'UNKNOWN', region: 'UNKNOWN', city: 'UNKNOWN' };
  }

  // Determine network segment
  determineNetworkSegment(ip) {
    if (this.isPrivateIP(ip)) return 'internal';
    if (ip.startsWith('10.0.0.')) return 'banana_network';
    return 'external';
  }

  // Calculate network trust level
  calculateNetworkTrustLevel(ip, isPrivateIP, networkSegment) {
    if (isPrivateIP && networkSegment === 'internal') return 'HIGH';
    if (isPrivateIP) return 'MEDIUM';
    return 'LOW';
  }

  // Get API key secret (simplified)
  getApiKeySecret(apiKey) {
    // In production, lookup in secure database
    const apiKeys = {
      'banana-key-123': 'secret-banana-123',
      'admin-key-456': 'secret-admin-456'
    };
    
    return apiKeys[apiKey] || null;
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

  // 🍌 BANANA ZERO-TRUST DASHBOARD 🍌
  getBananaZeroTrustDashboard() {
    return {
      title: '🍌🛡️ BANANA ZERO-TRUST COMMAND CENTER 🛡️🍌',
      timestamp: new Date().toISOString(),
      fortressStatus: 'MAXIMUM_SECURITY',
      
      trustMetrics: {
        totalDevices: this.trustedDevices.size,
        trustedDevices: Array.from(this.trustedDevices.values()).filter(d => d.trustLevel === 'HIGH').length,
        unknownDevices: Array.from(this.trustedDevices.values()).filter(d => d.trustLevel === 'UNKNOWN').length,
        activePolicies: this.accessPolicies.size,
        bananaSecurityLevel: this.bananaSecurityLevel
      },
      
      accessStats: this.getAccessStats(),
      deviceTrustLevels: this.getDeviceTrustStats(),
      networkSegments: this.getNetworkSegmentStats(),
      bananaRecommendations: this.getZeroTrustRecommendations(),
      
      bananaStatus: '🍌 ZERO-TRUST BANANA FORTRESS OPERATIONAL 🍌'
    };
  }

  // Get access statistics
  getAccessStats() {
    // In production, query from database
    return {
      totalRequests: 0,
      allowedRequests: 0,
      deniedRequests: 0,
      mfaVerified: 0,
      signedRequests: 0,
      bananaVerificationRate: '100%'
    };
  }

  // Get device trust statistics
  getDeviceTrustStats() {
    const devices = Array.from(this.trustedDevices.values());
    const trustLevels = {};
    
    devices.forEach(device => {
      trustLevels[device.trustLevel] = (trustLevels[device.trustLevel] || 0) + 1;
    });
    
    return trustLevels;
  }

  // Get network segment statistics
  getNetworkSegmentStats() {
    const segments = Array.from(this.networkSegments.values());
    const segmentCounts = {};
    
    segments.forEach(segment => {
      segmentCounts[segment] = (segmentCounts[segment] || 0) + 1;
    });
    
    return segmentCounts;
  }

  // Get zero-trust recommendations
  getZeroTrustRecommendations() {
    const recommendations = [];
    
    const unknownDevices = Array.from(this.trustedDevices.values())
      .filter(d => d.trustLevel === 'UNKNOWN').length;
    
    if (unknownDevices > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Review and verify unknown devices',
        count: unknownDevices,
        bananaMessage: '🔍🍌 Unknown banana devices detected! 🍌🔍'
      });
    }
    
    if (this.accessPolicies.size < 5) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Create more granular access policies',
        bananaMessage: '📋🍌 More banana policies needed! 🍌📋'
      });
    }
    
    return recommendations;
  }

  // 🍌 TRUST DEVICE 🍌
  trustDevice(deviceKey, trustLevel = 'HIGH') {
    const device = this.trustedDevices.get(deviceKey);
    if (device) {
      device.trustLevel = trustLevel;
      device.manuallyTrusted = true;
      device.trustedAt = new Date().toISOString();
      
      logger.info('🍌 DEVICE MANUALLY TRUSTED', {
        deviceKey,
        trustLevel,
        bananaStatus: 'DEVICE_TRUSTED'
      });
      
      return true;
    }
    return false;
  }

  // 🍌 REVOKE DEVICE TRUST 🍌
  revokeDeviceTrust(deviceKey) {
    const device = this.trustedDevices.get(deviceKey);
    if (device) {
      device.trustLevel = 'REVOKED';
      device.revokedAt = new Date().toISOString();
      
      logger.warn('🚫 DEVICE TRUST REVOKED', {
        deviceKey,
        bananaStatus: 'DEVICE_UNTRUSTED'
      });
      
      return true;
    }
    return false;
  }
}

module.exports = BananaZeroTrust;