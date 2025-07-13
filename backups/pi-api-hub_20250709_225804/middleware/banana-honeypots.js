const logger = require('../shared/logger');
const path = require('path');
const fs = require('fs');

class BananaHoneypots {
  constructor() {
    this.honeypots = new Map();
    this.honeypotHits = new Map();
    this.attackPatterns = new Map();
    this.suspiciousIPs = new Map();
    this.bannedIPs = new Set();
    this.bananaSecurityLevel = 'HONEYPOT_MAXIMUM';
    this.banThreshold = 3; // Ban after 3 honeypot hits
    this.banDuration = 60 * 60 * 1000; // 1 hour
    
    this.initializeBananaHoneypots();
    this.setupHoneypotEndpoints();
    this.startHoneypotMonitoring();
  }

  initializeBananaHoneypots() {
    logger.info('🍌🍯 BANANA HONEYPOT TRAPS ACTIVATED 🍯🍌', {
      service: 'banana-honeypots',
      trapLevel: 'MAXIMUM',
      bananaLevel: 'HONEYPOT_FORTRESS'
    });
  }

  // Setup honeypot endpoints
  setupHoneypotEndpoints() {
    // Common admin panels
    this.registerHoneypot('/admin', 'ADMIN_PANEL', 'HIGH');
    this.registerHoneypot('/admin/', 'ADMIN_PANEL', 'HIGH');
    this.registerHoneypot('/admin.php', 'ADMIN_PANEL', 'HIGH');
    this.registerHoneypot('/administrator', 'ADMIN_PANEL', 'HIGH');
    this.registerHoneypot('/wp-admin/', 'WORDPRESS_ADMIN', 'HIGH');
    this.registerHoneypot('/wp-admin/admin.php', 'WORDPRESS_ADMIN', 'HIGH');
    this.registerHoneypot('/wp-login.php', 'WORDPRESS_LOGIN', 'HIGH');
    this.registerHoneypot('/phpmyadmin/', 'PHPMYADMIN', 'HIGH');
    this.registerHoneypot('/pma/', 'PHPMYADMIN', 'HIGH');
    this.registerHoneypot('/phpMyAdmin/', 'PHPMYADMIN', 'HIGH');
    this.registerHoneypot('/cpanel', 'CPANEL', 'HIGH');
    this.registerHoneypot('/cPanel', 'CPANEL', 'HIGH');
    
    // Configuration files
    this.registerHoneypot('/.env', 'CONFIG_FILE', 'CRITICAL');
    this.registerHoneypot('/config.php', 'CONFIG_FILE', 'CRITICAL');
    this.registerHoneypot('/configuration.php', 'CONFIG_FILE', 'CRITICAL');
    this.registerHoneypot('/wp-config.php', 'CONFIG_FILE', 'CRITICAL');
    this.registerHoneypot('/database.yml', 'CONFIG_FILE', 'CRITICAL');
    this.registerHoneypot('/settings.php', 'CONFIG_FILE', 'CRITICAL');
    this.registerHoneypot('/.htaccess', 'CONFIG_FILE', 'HIGH');
    
    // System files
    this.registerHoneypot('/etc/passwd', 'SYSTEM_FILE', 'CRITICAL');
    this.registerHoneypot('/etc/shadow', 'SYSTEM_FILE', 'CRITICAL');
    this.registerHoneypot('/etc/hosts', 'SYSTEM_FILE', 'HIGH');
    this.registerHoneypot('/proc/version', 'SYSTEM_FILE', 'HIGH');
    this.registerHoneypot('/proc/cpuinfo', 'SYSTEM_FILE', 'MEDIUM');
    
    // Database files
    this.registerHoneypot('/database.sql', 'DATABASE_FILE', 'HIGH');
    this.registerHoneypot('/backup.sql', 'DATABASE_FILE', 'HIGH');
    this.registerHoneypot('/dump.sql', 'DATABASE_FILE', 'HIGH');
    this.registerHoneypot('/db.sqlite', 'DATABASE_FILE', 'HIGH');
    
    // Development files
    this.registerHoneypot('/.git/', 'GIT_DIRECTORY', 'MEDIUM');
    this.registerHoneypot('/.git/config', 'GIT_CONFIG', 'HIGH');
    this.registerHoneypot('/.svn/', 'SVN_DIRECTORY', 'MEDIUM');
    this.registerHoneypot('/composer.json', 'COMPOSER_FILE', 'LOW');
    this.registerHoneypot('/package.json', 'PACKAGE_FILE', 'LOW');
    this.registerHoneypot('/Dockerfile', 'DOCKER_FILE', 'MEDIUM');
    this.registerHoneypot('/docker-compose.yml', 'DOCKER_COMPOSE', 'MEDIUM');
    
    // Backup files
    this.registerHoneypot('/backup.zip', 'BACKUP_FILE', 'HIGH');
    this.registerHoneypot('/backup.tar.gz', 'BACKUP_FILE', 'HIGH');
    this.registerHoneypot('/site.zip', 'BACKUP_FILE', 'HIGH');
    this.registerHoneypot('/backup/', 'BACKUP_DIRECTORY', 'HIGH');
    
    // Common vulnerability endpoints
    this.registerHoneypot('/shell.php', 'WEBSHELL', 'CRITICAL');
    this.registerHoneypot('/c99.php', 'WEBSHELL', 'CRITICAL');
    this.registerHoneypot('/r57.php', 'WEBSHELL', 'CRITICAL');
    this.registerHoneypot('/cmd.php', 'WEBSHELL', 'CRITICAL');
    this.registerHoneypot('/eval.php', 'WEBSHELL', 'CRITICAL');
    this.registerHoneypot('/upload.php', 'UPLOAD_ENDPOINT', 'HIGH');
    this.registerHoneypot('/fileupload.php', 'UPLOAD_ENDPOINT', 'HIGH');
    
    // API endpoints that shouldn't exist
    this.registerHoneypot('/api/admin/users', 'API_ADMIN', 'HIGH');
    this.registerHoneypot('/api/admin/config', 'API_ADMIN', 'HIGH');
    this.registerHoneypot('/api/internal/debug', 'API_INTERNAL', 'HIGH');
    this.registerHoneypot('/api/v1/admin', 'API_ADMIN', 'HIGH');
    this.registerHoneypot('/api/v2/admin', 'API_ADMIN', 'HIGH');
    
    // Robots.txt bait
    this.registerHoneypot('/secret/', 'ROBOTS_BAIT', 'MEDIUM');
    this.registerHoneypot('/private/', 'ROBOTS_BAIT', 'MEDIUM');
    this.registerHoneypot('/hidden/', 'ROBOTS_BAIT', 'MEDIUM');
    this.registerHoneypot('/confidential/', 'ROBOTS_BAIT', 'MEDIUM');
    
    // Banana-specific honeypots
    this.registerHoneypot('/banana-admin/', 'BANANA_ADMIN', 'HIGH');
    this.registerHoneypot('/banana-config', 'BANANA_CONFIG', 'HIGH');
    this.registerHoneypot('/banana-secret/', 'BANANA_SECRET', 'HIGH');
    this.registerHoneypot('/api/banana/admin', 'BANANA_API_ADMIN', 'HIGH');

    logger.info('🍌 BANANA HONEYPOT TRAPS SET', {
      totalHoneypots: this.honeypots.size,
      bananaTraps: 'ARMED_AND_READY'
    });
  }

  // Register honeypot
  registerHoneypot(path, type, severity) {
    this.honeypots.set(path, {
      path,
      type,
      severity,
      created: new Date().toISOString(),
      hits: 0,
      lastHit: null,
      bananaLevel: this.getBananaLevelForSeverity(severity)
    });
  }

  // Get banana level for severity
  getBananaLevelForSeverity(severity) {
    const levelMap = {
      'CRITICAL': 'BANANA_MAXIMUM_TRAP',
      'HIGH': 'BANANA_HIGH_TRAP',
      'MEDIUM': 'BANANA_MEDIUM_TRAP',
      'LOW': 'BANANA_LOW_TRAP'
    };
    return levelMap[severity] || 'BANANA_STANDARD_TRAP';
  }

  // 🍌 Honeypot middleware 🍌
  honeypotMiddleware() {
    return (req, res, next) => {
      const requestPath = req.path;
      const clientIP = this.getClientIP(req);
      
      // Check if IP is banned
      if (this.bannedIPs.has(clientIP)) {
        logger.warn('🚫 BANNED IP HONEYPOT ACCESS', {
          ip: clientIP,
          path: requestPath,
          bananaStatus: 'BANNED_BLOCKED'
        });
        
        return res.status(403).json({
          error: 'Access denied',
          bananaMessage: '🚫🍌 You have been banned from the banana fortress! 🍌🚫'
        });
      }
      
      // Check if this is a honeypot endpoint
      const honeypot = this.honeypots.get(requestPath);
      if (honeypot) {
        this.triggerHoneypot(req, honeypot);
        return this.sendHoneypotResponse(req, res, honeypot);
      }
      
      // Check for fuzzy honeypot matches (case insensitive, trailing slashes)
      const fuzzyMatch = this.findFuzzyHoneypotMatch(requestPath);
      if (fuzzyMatch) {
        this.triggerHoneypot(req, fuzzyMatch);
        return this.sendHoneypotResponse(req, res, fuzzyMatch);
      }
      
      next();
    };
  }

  // Find fuzzy honeypot match
  findFuzzyHoneypotMatch(requestPath) {
    const normalizedPath = requestPath.toLowerCase().replace(/\/+$/, '');
    
    for (const [honeypotPath, honeypotData] of this.honeypots.entries()) {
      const normalizedHoneypotPath = honeypotPath.toLowerCase().replace(/\/+$/, '');
      
      if (normalizedPath === normalizedHoneypotPath ||
          normalizedPath.startsWith(normalizedHoneypotPath + '/') ||
          normalizedHoneypotPath.startsWith(normalizedPath + '/')) {
        return honeypotData;
      }
    }
    
    return null;
  }

  // Trigger honeypot
  triggerHoneypot(req, honeypot) {
    const clientIP = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    const timestamp = new Date().toISOString();
    
    // Update honeypot stats
    honeypot.hits++;
    honeypot.lastHit = timestamp;
    
    // Track IP hits
    const ipKey = clientIP;
    if (!this.honeypotHits.has(ipKey)) {
      this.honeypotHits.set(ipKey, {
        ip: clientIP,
        hits: 0,
        honeypots: new Set(),
        firstHit: timestamp,
        lastHit: timestamp,
        userAgents: new Set(),
        bananaRiskLevel: 'LOW'
      });
    }
    
    const ipData = this.honeypotHits.get(ipKey);
    ipData.hits++;
    ipData.honeypots.add(honeypot.path);
    ipData.lastHit = timestamp;
    ipData.userAgents.add(userAgent);
    ipData.bananaRiskLevel = this.calculateIPRiskLevel(ipData);
    
    // Check if IP should be banned
    if (ipData.hits >= this.banThreshold) {
      this.banIP(clientIP, 'Multiple honeypot hits');
    }
    
    // Analyze attack pattern
    this.analyzeAttackPattern(req, honeypot);
    
    logger.warn('🍯 BANANA HONEYPOT TRIGGERED', {
      ip: clientIP,
      path: honeypot.path,
      type: honeypot.type,
      severity: honeypot.severity,
      ipHits: ipData.hits,
      userAgent,
      bananaLevel: honeypot.bananaLevel,
      riskLevel: ipData.bananaRiskLevel
    });
  }

  // Calculate IP risk level
  calculateIPRiskLevel(ipData) {
    let riskScore = 0;
    
    // More hits = higher risk
    riskScore += ipData.hits * 10;
    
    // Multiple honeypots = higher risk
    riskScore += ipData.honeypots.size * 5;
    
    // Multiple user agents = higher risk (bot behavior)
    riskScore += ipData.userAgents.size * 3;
    
    // Recent activity = higher risk
    const timeSinceLastHit = Date.now() - new Date(ipData.lastHit).getTime();
    if (timeSinceLastHit < 60000) riskScore += 20; // Last minute
    else if (timeSinceLastHit < 300000) riskScore += 10; // Last 5 minutes
    
    if (riskScore >= 50) return 'CRITICAL';
    if (riskScore >= 30) return 'HIGH';
    if (riskScore >= 15) return 'MEDIUM';
    return 'LOW';
  }

  // Ban IP
  banIP(ip, reason) {
    this.bannedIPs.add(ip);
    
    // Auto-unban after duration
    setTimeout(() => {
      this.bannedIPs.delete(ip);
      logger.info('🍌 IP UNBANNED', {
        ip,
        reason: 'Ban duration expired',
        bananaStatus: 'UNBANNED'
      });
    }, this.banDuration);
    
    logger.error('🚫 IP BANNED BY HONEYPOT', {
      ip,
      reason,
      banDuration: this.banDuration / 1000 + ' seconds',
      bananaStatus: 'BANNED'
    });
  }

  // Analyze attack pattern
  analyzeAttackPattern(req, honeypot) {
    const clientIP = this.getClientIP(req);
    const userAgent = req.get('User-Agent') || 'unknown';
    const method = req.method;
    const path = req.path;
    const timestamp = new Date().toISOString();
    
    const patternKey = `${honeypot.type}_${method}`;
    
    if (!this.attackPatterns.has(patternKey)) {
      this.attackPatterns.set(patternKey, {
        type: honeypot.type,
        method,
        count: 0,
        ips: new Set(),
        userAgents: new Set(),
        paths: new Set(),
        firstSeen: timestamp,
        lastSeen: timestamp,
        bananaPattern: 'IDENTIFIED'
      });
    }
    
    const pattern = this.attackPatterns.get(patternKey);
    pattern.count++;
    pattern.ips.add(clientIP);
    pattern.userAgents.add(userAgent);
    pattern.paths.add(path);
    pattern.lastSeen = timestamp;
  }

  // Send honeypot response
  sendHoneypotResponse(req, res, honeypot) {
    const responses = this.getHoneypotResponses(honeypot);
    const response = responses[Math.floor(Math.random() * responses.length)];
    
    // Add honeypot headers
    res.setHeader('X-Banana-Honeypot', 'TRIGGERED');
    res.setHeader('X-Banana-Trap-Type', honeypot.type);
    res.setHeader('X-Banana-Trap-Level', honeypot.bananaLevel);
    
    // Send response based on type
    if (response.type === 'redirect') {
      res.redirect(response.status || 302, response.location);
    } else if (response.type === 'file') {
      res.status(response.status || 200);
      res.setHeader('Content-Type', response.contentType);
      res.send(response.content);
    } else {
      res.status(response.status || 404);
      res.json(response.content);
    }
  }

  // Get honeypot responses
  getHoneypotResponses(honeypot) {
    const baseResponses = [
      {
        type: 'json',
        status: 404,
        content: {
          error: 'Not Found',
          message: 'The requested resource was not found',
          bananaMessage: '🍌 Nothing to see here! 🍌'
        }
      },
      {
        type: 'json',
        status: 403,
        content: {
          error: 'Forbidden',
          message: 'Access denied',
          bananaMessage: '🚫🍌 No bananas for you! 🍌🚫'
        }
      },
      {
        type: 'json',
        status: 401,
        content: {
          error: 'Unauthorized',
          message: 'Authentication required',
          bananaMessage: '🔐🍌 Banana authentication needed! 🍌🔐'
        }
      }
    ];
    
    // Type-specific responses
    const typeResponses = {
      'ADMIN_PANEL': [
        {
          type: 'file',
          status: 200,
          contentType: 'text/html',
          content: `
<!DOCTYPE html>
<html>
<head><title>Admin Login</title></head>
<body>
<h1>Admin Panel</h1>
<form>
  <input type="text" placeholder="Username" name="username">
  <input type="password" placeholder="Password" name="password">
  <button type="submit">Login</button>
</form>
<p>🍌 Banana Admin Portal 🍌</p>
</body>
</html>
          `
        }
      ],
      'CONFIG_FILE': [
        {
          type: 'file',
          status: 200,
          contentType: 'text/plain',
          content: `# Configuration File
# This is a honeypot - you've been logged!
BANANA_SECRET=fake_secret_key
DATABASE_URL=sqlite:///fake.db
API_KEY=banana_fake_key_123
🍌 BANANA TRAP ACTIVATED 🍌
`
        }
      ],
      'WEBSHELL': [
        {
          type: 'file',
          status: 200,
          contentType: 'text/html',
          content: `
<?php
// Web Shell - Honeypot
echo "<h1>🍌 Banana Web Shell 🍌</h1>";
echo "<p>Access logged and reported!</p>";
echo "<p>Your IP has been flagged for suspicious activity.</p>";
// This is a honeypot - you've been trapped!
?>
          `
        }
      ]
    };
    
    return typeResponses[honeypot.type] || baseResponses;
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

  // Start honeypot monitoring
  startHoneypotMonitoring() {
    // Clean old data every hour
    setInterval(() => {
      this.cleanOldData();
    }, 60 * 60 * 1000);
    
    // Generate reports every 6 hours
    setInterval(() => {
      this.generateHoneypotReport();
    }, 6 * 60 * 60 * 1000);
    
    logger.info('🍌 HONEYPOT MONITORING STARTED', {
      cleanupInterval: '1 hour',
      reportInterval: '6 hours',
      bananaMonitoring: 'ACTIVE'
    });
  }

  // Clean old data
  cleanOldData() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    
    // Clean old IP hits
    for (const [ip, data] of this.honeypotHits.entries()) {
      if (new Date(data.lastHit).getTime() < cutoff) {
        this.honeypotHits.delete(ip);
      }
    }
    
    logger.info('🍌 HONEYPOT DATA CLEANED', {
      cutoffTime: new Date(cutoff).toISOString(),
      remainingIPs: this.honeypotHits.size,
      bananaCleanup: 'COMPLETE'
    });
  }

  // Generate honeypot report
  generateHoneypotReport() {
    const report = this.getBananaHoneypotDashboard();
    
    logger.info('🍌 HONEYPOT REPORT GENERATED', {
      totalHoneypots: report.honeypotMetrics.totalHoneypots,
      totalHits: report.honeypotMetrics.totalHits,
      uniqueIPs: report.honeypotMetrics.uniqueIPs,
      bannedIPs: report.honeypotMetrics.bannedIPs,
      bananaReport: 'GENERATED'
    });
  }

  // 🍌 Banana honeypot dashboard 🍌
  getBananaHoneypotDashboard() {
    const totalHits = Array.from(this.honeypots.values()).reduce((sum, h) => sum + h.hits, 0);
    const uniqueIPs = this.honeypotHits.size;
    const bannedIPs = this.bannedIPs.size;
    const topHoneypots = this.getTopHoneypots(10);
    const topAttackers = this.getTopAttackers(10);
    
    return {
      title: '🍌🍯 BANANA HONEYPOT COMMAND CENTER 🍯🍌',
      timestamp: new Date().toISOString(),
      honeypotStatus: 'TRAPS_ACTIVE',
      
      honeypotMetrics: {
        totalHoneypots: this.honeypots.size,
        totalHits: totalHits,
        uniqueIPs: uniqueIPs,
        bannedIPs: bannedIPs,
        attackPatterns: this.attackPatterns.size,
        bananaSecurityLevel: this.bananaSecurityLevel
      },
      
      threatIntelligence: {
        topHoneypots: topHoneypots,
        topAttackers: topAttackers,
        attackPatterns: this.getAttackPatternSummary(),
        riskLevels: this.getRiskLevelDistribution()
      },
      
      recentActivity: this.getRecentHoneypotActivity(),
      securityAlerts: this.getSecurityAlerts(),
      bananaRecommendations: this.getHoneypotRecommendations(),
      
      bananaStatus: '🍌 HONEYPOT FORTRESS OPERATIONAL 🍌'
    };
  }

  // Get top honeypots
  getTopHoneypots(limit = 10) {
    return Array.from(this.honeypots.values())
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit)
      .map(h => ({
        path: h.path,
        type: h.type,
        severity: h.severity,
        hits: h.hits,
        lastHit: h.lastHit,
        bananaLevel: h.bananaLevel
      }));
  }

  // Get top attackers
  getTopAttackers(limit = 10) {
    return Array.from(this.honeypotHits.values())
      .sort((a, b) => b.hits - a.hits)
      .slice(0, limit)
      .map(ip => ({
        ip: ip.ip,
        hits: ip.hits,
        uniqueHoneypots: ip.honeypots.size,
        uniqueUserAgents: ip.userAgents.size,
        firstHit: ip.firstHit,
        lastHit: ip.lastHit,
        riskLevel: ip.bananaRiskLevel,
        banned: this.bannedIPs.has(ip.ip)
      }));
  }

  // Get attack pattern summary
  getAttackPatternSummary() {
    return Array.from(this.attackPatterns.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(pattern => ({
        type: pattern.type,
        method: pattern.method,
        count: pattern.count,
        uniqueIPs: pattern.ips.size,
        uniqueUserAgents: pattern.userAgents.size,
        firstSeen: pattern.firstSeen,
        lastSeen: pattern.lastSeen,
        bananaPattern: pattern.bananaPattern
      }));
  }

  // Get risk level distribution
  getRiskLevelDistribution() {
    const distribution = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    
    this.honeypotHits.forEach(ip => {
      distribution[ip.bananaRiskLevel]++;
    });
    
    return distribution;
  }

  // Get recent honeypot activity
  getRecentHoneypotActivity(limit = 20) {
    const activities = [];
    
    this.honeypotHits.forEach(ip => {
      activities.push({
        ip: ip.ip,
        hits: ip.hits,
        lastHit: ip.lastHit,
        riskLevel: ip.bananaRiskLevel,
        banned: this.bannedIPs.has(ip.ip)
      });
    });
    
    return activities
      .sort((a, b) => new Date(b.lastHit) - new Date(a.lastHit))
      .slice(0, limit);
  }

  // Get security alerts
  getSecurityAlerts() {
    const alerts = [];
    
    // High-risk IPs
    this.honeypotHits.forEach(ip => {
      if (ip.bananaRiskLevel === 'CRITICAL' || ip.bananaRiskLevel === 'HIGH') {
        alerts.push({
          type: 'HIGH_RISK_IP',
          severity: ip.bananaRiskLevel,
          message: `High-risk IP ${ip.ip} detected`,
          details: {
            ip: ip.ip,
            hits: ip.hits,
            honeypots: ip.honeypots.size,
            lastHit: ip.lastHit
          },
          bananaAlert: '🚨🍌 High-risk banana attacker! 🍌🚨'
        });
      }
    });
    
    // Frequent attack patterns
    this.attackPatterns.forEach(pattern => {
      if (pattern.count > 10) {
        alerts.push({
          type: 'ATTACK_PATTERN',
          severity: 'MEDIUM',
          message: `Frequent attack pattern detected: ${pattern.type}`,
          details: {
            type: pattern.type,
            method: pattern.method,
            count: pattern.count,
            uniqueIPs: pattern.ips.size
          },
          bananaAlert: '⚠️🍌 Banana attack pattern detected! 🍌⚠️'
        });
      }
    });
    
    return alerts.sort((a, b) => {
      const severityOrder = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  // Get honeypot recommendations
  getHoneypotRecommendations() {
    const recommendations = [];
    
    // Check for inactive honeypots
    const inactiveHoneypots = Array.from(this.honeypots.values())
      .filter(h => h.hits === 0).length;
    
    if (inactiveHoneypots > 0) {
      recommendations.push({
        priority: 'LOW',
        action: 'Review inactive honeypots',
        details: `${inactiveHoneypots} honeypots have never been triggered`,
        bananaMessage: '🍌 Some banana traps are unused! 🍌'
      });
    }
    
    // Check for high-activity honeypots
    const highActivityHoneypots = Array.from(this.honeypots.values())
      .filter(h => h.hits > 50).length;
    
    if (highActivityHoneypots > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Analyze high-activity honeypots',
        details: `${highActivityHoneypots} honeypots receiving high traffic`,
        bananaMessage: '🍯🍌 Popular banana traps detected! 🍌🍯'
      });
    }
    
    // Check for banned IPs
    if (this.bannedIPs.size > 0) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Review banned IPs',
        details: `${this.bannedIPs.size} IPs currently banned`,
        bananaMessage: '🚫🍌 Banned banana attackers need review! 🍌🚫'
      });
    }
    
    return recommendations;
  }

  // 🍌 Manual IP ban 🍌
  manualBanIP(ip, reason, duration = null) {
    this.bannedIPs.add(ip);
    
    if (duration) {
      setTimeout(() => {
        this.bannedIPs.delete(ip);
        logger.info('🍌 MANUAL IP BAN EXPIRED', {
          ip,
          reason: 'Manual ban duration expired',
          bananaStatus: 'UNBANNED'
        });
      }, duration);
    }
    
    logger.warn('🚫 MANUAL IP BAN', {
      ip,
      reason,
      duration: duration ? duration / 1000 + ' seconds' : 'permanent',
      bananaStatus: 'MANUALLY_BANNED'
    });
    
    return {
      success: true,
      ip,
      reason,
      duration: duration ? duration / 1000 + ' seconds' : 'permanent',
      bananaMessage: '🚫🍌 IP manually banned from banana fortress! 🍌🚫'
    };
  }

  // 🍌 Unban IP 🍌
  unbanIP(ip) {
    const wasBanned = this.bannedIPs.has(ip);
    this.bannedIPs.delete(ip);
    
    if (wasBanned) {
      logger.info('🍌 IP UNBANNED', {
        ip,
        reason: 'Manual unban',
        bananaStatus: 'UNBANNED'
      });
      
      return {
        success: true,
        ip,
        bananaMessage: '🍌 IP unbanned from banana fortress! 🍌'
      };
    } else {
      return {
        success: false,
        ip,
        error: 'IP was not banned',
        bananaMessage: '🍌 IP was not banned! 🍌'
      };
    }
  }

  // 🍌 Add custom honeypot 🍌
  addCustomHoneypot(path, type, severity, response = null) {
    this.registerHoneypot(path, type, severity);
    
    if (response) {
      // Store custom response (would be implemented in production)
      logger.info('🍌 CUSTOM HONEYPOT RESPONSE SET', {
        path,
        type,
        bananaCustom: 'CONFIGURED'
      });
    }
    
    logger.info('🍌 CUSTOM HONEYPOT ADDED', {
      path,
      type,
      severity,
      bananaLevel: this.getBananaLevelForSeverity(severity)
    });
    
    return {
      success: true,
      honeypot: {
        path,
        type,
        severity,
        bananaLevel: this.getBananaLevelForSeverity(severity)
      },
      bananaMessage: '🍌 Custom banana trap set! 🍌'
    };
  }

  // 🍌 Generate robots.txt with honeypot bait 🍌
  generateRobotsTxt() {
    const baitPaths = Array.from(this.honeypots.keys())
      .filter(path => this.honeypots.get(path).type === 'ROBOTS_BAIT');
    
    let robotsTxt = `# Banana Fortress Robots.txt
# 🍌 Protected by Banana Security 🍌
User-agent: *
Allow: /
Disallow: /admin/
Disallow: /wp-admin/
Disallow: /.env

# The following paths are monitored honeypots
# Accessing them will result in your IP being logged and potentially banned
`;
    
    baitPaths.forEach(path => {
      robotsTxt += `Disallow: ${path}\n`;
    });
    
    robotsTxt += `
# 🍌 Banana Fortress Security Notice 🍌
# This site is protected by advanced security measures
# Unauthorized access attempts are logged and reported
`;
    
    return robotsTxt;
  }
}

module.exports = BananaHoneypots;