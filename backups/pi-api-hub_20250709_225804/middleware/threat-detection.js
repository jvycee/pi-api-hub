const logger = require('../shared/logger');

class ThreatDetectionSystem {
  constructor() {
    this.attackPatterns = new Map();
    this.suspiciousIPs = new Map();
    this.alertThresholds = {
      failedLogins: 10,
      rapidRequests: 100,
      suspiciousPatterns: 5,
      timeWindow: 5 * 60 * 1000 // 5 minutes
    };
    this.blockedIPs = new Set();
    this.honeypots = new Set(['/admin.php', '/wp-admin/', '/.env', '/config.php', '/phpinfo.php']);
    this.threatLevels = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      CRITICAL: 4
    };
    this.alerts = [];
    this.maxAlerts = 1000;
    
    // Start cleanup interval
    this.startCleanup();
    
    logger.info('🍌 BANANA MOTHERSHIP THREAT DETECTION ACTIVATED 🍌', {
      service: 'threat-detection',
      patterns: this.attackPatterns.size,
      honeypots: this.honeypots.size
    });
  }

  // Main threat detection middleware
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const clientIP = this.getClientIP(req);
      const userAgent = req.get('User-Agent') || '';
      const path = req.path;
      const method = req.method;

      // Check if IP is blocked
      if (this.blockedIPs.has(clientIP)) {
        logger.warn('🚨 BLOCKED IP ATTEMPT', {
          ip: clientIP,
          path,
          method,
          userAgent,
          reason: 'IP_BLOCKED'
        });
        return res.status(403).json({
          success: false,
          error: 'Access denied - IP blocked due to suspicious activity',
          code: 'IP_BLOCKED'
        });
      }

      // Check honeypot endpoints
      if (this.isHoneypotEndpoint(path)) {
        this.handleHoneypotAccess(clientIP, path, userAgent);
        return res.status(404).json({
          success: false,
          error: 'Not found'
        });
      }

      // Analyze request for threats
      const threatLevel = this.analyzeRequest(req, clientIP);
      
      if (threatLevel >= this.threatLevels.HIGH) {
        this.handleHighThreat(clientIP, req, threatLevel);
        return res.status(429).json({
          success: false,
          error: 'Request blocked due to security policy',
          code: 'THREAT_DETECTED'
        });
      }

      // Track request patterns
      this.trackRequestPattern(clientIP, path, method, userAgent);

      // Continue to next middleware
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.trackResponsePattern(clientIP, res.statusCode, responseTime);
      });

      next();
    };
  }

  // Analyze incoming request for threats
  analyzeRequest(req, clientIP) {
    let threatLevel = this.threatLevels.LOW;
    const path = req.path;
    const userAgent = req.get('User-Agent') || '';
    const query = JSON.stringify(req.query);
    const body = JSON.stringify(req.body);

    // Check for SQL injection patterns
    if (this.detectSQLInjection(query + body + path)) {
      threatLevel = Math.max(threatLevel, this.threatLevels.HIGH);
      this.logThreat(clientIP, 'SQL_INJECTION', { path, query: req.query });
    }

    // Check for XSS patterns
    if (this.detectXSS(query + body + path)) {
      threatLevel = Math.max(threatLevel, this.threatLevels.MEDIUM);
      this.logThreat(clientIP, 'XSS_ATTEMPT', { path, query: req.query });
    }

    // Check for path traversal
    if (this.detectPathTraversal(path)) {
      threatLevel = Math.max(threatLevel, this.threatLevels.HIGH);
      this.logThreat(clientIP, 'PATH_TRAVERSAL', { path });
    }

    // Check for suspicious user agents
    if (this.detectSuspiciousUserAgent(userAgent)) {
      threatLevel = Math.max(threatLevel, this.threatLevels.MEDIUM);
      this.logThreat(clientIP, 'SUSPICIOUS_USER_AGENT', { userAgent });
    }

    // Check for rapid requests from same IP
    if (this.detectRapidRequests(clientIP)) {
      threatLevel = Math.max(threatLevel, this.threatLevels.MEDIUM);
      this.logThreat(clientIP, 'RAPID_REQUESTS', { requestCount: this.getRequestCount(clientIP) });
    }

    return threatLevel;
  }

  // SQL injection detection
  detectSQLInjection(input) {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER)\b.*\b(FROM|INTO|SET|WHERE|TABLE)\b)/i,
      /(\'|\"|;|--|\||&|\*)/,
      /(\bOR\b.*=.*\bOR\b|\bAND\b.*=.*\bAND\b)/i,
      /(1=1|1\s*=\s*1|\'=\'|\"=\")/,
      /(\bunion\b.*\bselect\b|\bselect\b.*\bfrom\b)/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(input));
  }

  // XSS detection
  detectXSS(input) {
    const xssPatterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe[^>]*>/gi,
      /<object[^>]*>/gi,
      /<embed[^>]*>/gi,
      /vbscript:/gi,
      /data:text\/html/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(input));
  }

  // Path traversal detection
  detectPathTraversal(path) {
    const traversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i,
      /\.\.%2f/i,
      /\.\.%5c/i
    ];
    
    return traversalPatterns.some(pattern => pattern.test(path));
  }

  // Suspicious user agent detection
  detectSuspiciousUserAgent(userAgent) {
    const suspiciousPatterns = [
      /sqlmap/i,
      /nikto/i,
      /nmap/i,
      /burp/i,
      /nessus/i,
      /acunetix/i,
      /w3af/i,
      /masscan/i,
      /zap/i,
      /bot.*crawler/i
    ];
    
    if (!userAgent || userAgent.length < 10) {
      return true; // Suspicious if no user agent or too short
    }
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  // Rapid request detection
  detectRapidRequests(clientIP) {
    const now = Date.now();
    const windowStart = now - this.alertThresholds.timeWindow;
    
    if (!this.attackPatterns.has(clientIP)) {
      this.attackPatterns.set(clientIP, { requests: [], lastSeen: now });
    }
    
    const ipData = this.attackPatterns.get(clientIP);
    
    // Clean old requests
    ipData.requests = ipData.requests.filter(time => time > windowStart);
    
    // Add current request
    ipData.requests.push(now);
    ipData.lastSeen = now;
    
    return ipData.requests.length > this.alertThresholds.rapidRequests;
  }

  // Check if endpoint is a honeypot
  isHoneypotEndpoint(path) {
    return this.honeypots.has(path) || 
           this.honeypots.has(path.toLowerCase()) ||
           Array.from(this.honeypots).some(honeypot => path.includes(honeypot));
  }

  // Handle honeypot access
  handleHoneypotAccess(clientIP, path, userAgent) {
    logger.warn('🍯 HONEYPOT TRIGGERED - SUSPICIOUS ACTIVITY DETECTED', {
      ip: clientIP,
      path,
      userAgent,
      timestamp: new Date().toISOString()
    });

    this.logThreat(clientIP, 'HONEYPOT_ACCESS', { path, userAgent });
    this.addSuspiciousIP(clientIP, 'HONEYPOT_ACCESS');
    
    // Increase threat level for this IP
    this.escalateThreatLevel(clientIP);
  }

  // Handle high threat scenarios
  handleHighThreat(clientIP, req, threatLevel) {
    logger.error('🚨 HIGH THREAT DETECTED - BLOCKING REQUEST', {
      ip: clientIP,
      path: req.path,
      method: req.method,
      threatLevel,
      userAgent: req.get('User-Agent')
    });

    if (threatLevel >= this.threatLevels.CRITICAL) {
      this.blockIP(clientIP, 'CRITICAL_THREAT');
    }

    this.createAlert({
      type: 'HIGH_THREAT_BLOCKED',
      ip: clientIP,
      path: req.path,
      threatLevel,
      timestamp: new Date().toISOString()
    });
  }

  // Log threat for analysis
  logThreat(clientIP, threatType, details) {
    logger.warn(`🚨 THREAT DETECTED: ${threatType}`, {
      ip: clientIP,
      threatType,
      details,
      timestamp: new Date().toISOString()
    });

    this.createAlert({
      type: threatType,
      ip: clientIP,
      details,
      timestamp: new Date().toISOString(),
      severity: this.getThreatSeverity(threatType)
    });
  }

  // Get threat severity
  getThreatSeverity(threatType) {
    const severityMap = {
      'SQL_INJECTION': 'HIGH',
      'XSS_ATTEMPT': 'MEDIUM',
      'PATH_TRAVERSAL': 'HIGH',
      'SUSPICIOUS_USER_AGENT': 'LOW',
      'RAPID_REQUESTS': 'MEDIUM',
      'HONEYPOT_ACCESS': 'HIGH',
      'CRITICAL_THREAT': 'CRITICAL'
    };
    
    return severityMap[threatType] || 'LOW';
  }

  // Track request patterns
  trackRequestPattern(clientIP, path, method, userAgent) {
    if (!this.attackPatterns.has(clientIP)) {
      this.attackPatterns.set(clientIP, {
        requests: [],
        paths: new Set(),
        methods: new Set(),
        userAgents: new Set(),
        lastSeen: Date.now()
      });
    }

    const ipData = this.attackPatterns.get(clientIP);
    ipData.paths.add(path);
    ipData.methods.add(method);
    ipData.userAgents.add(userAgent);
    ipData.lastSeen = Date.now();
  }

  // Track response patterns
  trackResponsePattern(clientIP, statusCode, responseTime) {
    if (this.attackPatterns.has(clientIP)) {
      const ipData = this.attackPatterns.get(clientIP);
      if (!ipData.responses) {
        ipData.responses = [];
      }
      ipData.responses.push({
        statusCode,
        responseTime,
        timestamp: Date.now()
      });
    }
  }

  // Add suspicious IP
  addSuspiciousIP(clientIP, reason) {
    this.suspiciousIPs.set(clientIP, {
      reason,
      timestamp: Date.now(),
      escalationLevel: (this.suspiciousIPs.get(clientIP)?.escalationLevel || 0) + 1
    });
  }

  // Escalate threat level for IP
  escalateThreatLevel(clientIP) {
    const suspiciousData = this.suspiciousIPs.get(clientIP);
    if (suspiciousData && suspiciousData.escalationLevel >= 3) {
      this.blockIP(clientIP, 'ESCALATED_THREAT');
    }
  }

  // Block IP address
  blockIP(clientIP, reason) {
    this.blockedIPs.add(clientIP);
    logger.error('🚫 IP BLOCKED', {
      ip: clientIP,
      reason,
      timestamp: new Date().toISOString()
    });

    this.createAlert({
      type: 'IP_BLOCKED',
      ip: clientIP,
      reason,
      timestamp: new Date().toISOString(),
      severity: 'CRITICAL'
    });
  }

  // Create security alert
  createAlert(alertData) {
    this.alerts.unshift({
      id: this.generateAlertId(),
      ...alertData
    });

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }
  }

  // Generate unique alert ID
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get client IP address
  getClientIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           req.ip ||
           'unknown';
  }

  // Get request count for IP
  getRequestCount(clientIP) {
    const ipData = this.attackPatterns.get(clientIP);
    return ipData ? ipData.requests.length : 0;
  }

  // Get threat statistics
  getThreatStats() {
    const now = Date.now();
    const recentAlerts = this.alerts.filter(alert => 
      now - new Date(alert.timestamp).getTime() < this.alertThresholds.timeWindow
    );

    return {
      totalThreatsDetected: this.alerts.length,
      recentThreats: recentAlerts.length,
      blockedIPs: this.blockedIPs.size,
      suspiciousIPs: this.suspiciousIPs.size,
      monitoredIPs: this.attackPatterns.size,
      honeypotHits: this.alerts.filter(a => a.type === 'HONEYPOT_ACCESS').length,
      alertsByType: this.getAlertsByType(),
      alertsBySeverity: this.getAlertsBySeverity()
    };
  }

  // Get alerts by type
  getAlertsByType() {
    const types = {};
    this.alerts.forEach(alert => {
      types[alert.type] = (types[alert.type] || 0) + 1;
    });
    return types;
  }

  // Get alerts by severity
  getAlertsBySeverity() {
    const severities = {};
    this.alerts.forEach(alert => {
      const severity = alert.severity || 'LOW';
      severities[severity] = (severities[severity] || 0) + 1;
    });
    return severities;
  }

  // Get recent alerts
  getRecentAlerts(limit = 50) {
    return this.alerts.slice(0, limit);
  }

  // Unblock IP (admin function)
  unblockIP(clientIP) {
    this.blockedIPs.delete(clientIP);
    this.suspiciousIPs.delete(clientIP);
    logger.info('🔓 IP UNBLOCKED', { ip: clientIP });
  }

  // Clear suspicious IP
  clearSuspiciousIP(clientIP) {
    this.suspiciousIPs.delete(clientIP);
    logger.info('🧹 SUSPICIOUS IP CLEARED', { ip: clientIP });
  }

  // Start cleanup process
  startCleanup() {
    setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  // Cleanup old data
  cleanupOldData() {
    const now = Date.now();
    const cleanupWindow = 30 * 60 * 1000; // 30 minutes

    // Clean old attack patterns
    for (const [ip, data] of this.attackPatterns.entries()) {
      if (now - data.lastSeen > cleanupWindow) {
        this.attackPatterns.delete(ip);
      }
    }

    // Clean old suspicious IPs
    for (const [ip, data] of this.suspiciousIPs.entries()) {
      if (now - data.timestamp > cleanupWindow) {
        this.suspiciousIPs.delete(ip);
      }
    }

    logger.info('🧹 THREAT DETECTION CLEANUP COMPLETED', {
      monitoredIPs: this.attackPatterns.size,
      suspiciousIPs: this.suspiciousIPs.size,
      blockedIPs: this.blockedIPs.size
    });
  }

  // Get system status
  getSystemStatus() {
    return {
      status: 'BANANA FORTRESS ACTIVE',
      uptime: process.uptime(),
      threatsBlocked: this.alerts.length,
      activeMonitoring: true,
      honeypotStatus: 'ACTIVE',
      threatLevel: this.calculateOverallThreatLevel()
    };
  }

  // Calculate overall threat level
  calculateOverallThreatLevel() {
    const recentAlerts = this.alerts.filter(alert => 
      Date.now() - new Date(alert.timestamp).getTime() < this.alertThresholds.timeWindow
    );

    if (recentAlerts.length > 20) return 'HIGH';
    if (recentAlerts.length > 10) return 'MEDIUM';
    if (recentAlerts.length > 0) return 'LOW';
    return 'MINIMAL';
  }
}

module.exports = ThreatDetectionSystem;