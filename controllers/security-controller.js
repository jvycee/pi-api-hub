const EndpointWrapper = require('../helpers/endpoint-wrapper');
const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED SECURITY CONTROLLER 🍌
 */
class SecurityController {
  constructor(dependencyScanner, csrfProtection, sessionSecurity) {
    this.dependencyScanner = dependencyScanner;
    this.csrfProtection = csrfProtection;
    this.sessionSecurity = sessionSecurity;
    
    // Bind methods to preserve context
    this.getSecurityOverview = this.getSecurityOverview.bind(this);
    this.getDependencyVulnerabilities = this.getDependencyVulnerabilities.bind(this);
    this.scanDependencies = this.scanDependencies.bind(this);
    this.getSessionStats = this.getSessionStats.bind(this);
    this.getCSRFStats = this.getCSRFStats.bind(this);
    this.getSecurityEvents = this.getSecurityEvents.bind(this);
    
    logger.info('🍌 Security Controller initialized');
  }

  // Get security overview
  getSecurityOverview = EndpointWrapper.createHandler(async (req, res) => {
    const vulnerabilities = this.dependencyScanner.getVulnerabilityCount();
    const csrfStats = this.csrfProtection.getStats();
    const sessionStats = this.sessionSecurity.getStats();
    
    // Calculate security score
    const securityScore = this.calculateSecurityScore(vulnerabilities, csrfStats, sessionStats);
    
    const overview = {
      securityScore,
      vulnerabilities,
      csrf: csrfStats,
      sessions: sessionStats,
      lastDependencyScan: this.dependencyScanner.getStats().lastScan,
      securityFeatures: {
        csrfProtection: true,
        sessionSecurity: true,
        dependencyScanning: true,
        securityHeaders: true,
        apiKeyAuth: true,
        inputValidation: true
      }
    };
    
    return overview;
  });

  // Get dependency vulnerabilities
  getDependencyVulnerabilities = EndpointWrapper.createHandler(async (req, res) => {
    const vulnerabilities = this.dependencyScanner.getVulnerabilities();
    const stats = this.dependencyScanner.getStats();
    
    return {
      vulnerabilities,
      stats,
      summary: this.dependencyScanner.getVulnerabilityCount()
    };
  });

  // Trigger dependency scan
  scanDependencies = EndpointWrapper.createHandler(async (req, res) => {
    logger.info('🍌 Manual dependency scan triggered', { 
      requestedBy: req.apiKeyData?.name || 'unknown',
      ip: req.ip 
    });
    
    const result = await this.dependencyScanner.scanDependencies();
    
    return {
      scanResult: result,
      message: result.success ? 'Dependency scan completed successfully' : 'Dependency scan failed'
    };
  });

  // Get session statistics
  getSessionStats = EndpointWrapper.createHandler(async (req, res) => {
    const stats = this.sessionSecurity.getStats();
    
    return {
      sessionStats: stats,
      recommendations: this.getSessionRecommendations(stats)
    };
  });

  // Get CSRF statistics
  getCSRFStats = EndpointWrapper.createHandler(async (req, res) => {
    const stats = this.csrfProtection.getStats();
    
    return {
      csrfStats: stats,
      recommendations: this.getCSRFRecommendations(stats)
    };
  });

  // Get security events (mock implementation)
  getSecurityEvents = EndpointWrapper.createHandler(async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const offset = parseInt(req.query.offset) || 0;
    
    // Mock security events (in production, this would come from a log aggregation system)
    const events = [
      {
        id: 'sec-001',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'authentication',
        severity: 'info',
        message: 'API key authenticated successfully',
        details: { tier: 'admin', success: true }
      },
      {
        id: 'sec-002',
        timestamp: new Date(Date.now() - 600000).toISOString(),
        type: 'session',
        severity: 'warning',
        message: 'Session fingerprint mismatch detected',
        details: { action: 'session_terminated', reason: 'fingerprint_mismatch' }
      },
      {
        id: 'sec-003',
        timestamp: new Date(Date.now() - 900000).toISOString(),
        type: 'csrf',
        severity: 'error',
        message: 'CSRF token validation failed',
        details: { ip: '192.168.1.100', blocked: true }
      },
      {
        id: 'sec-004',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
        type: 'dependency',
        severity: 'high',
        message: 'High severity vulnerability detected',
        details: { package: 'example-package', cve: 'CVE-2023-12345' }
      }
    ];
    
    const filteredEvents = events.slice(offset, offset + limit);
    
    return {
      events: filteredEvents,
      pagination: {
        total: events.length,
        limit,
        offset,
        hasMore: offset + limit < events.length
      }
    };
  });

  // Calculate security score based on various factors
  calculateSecurityScore(vulnerabilities, csrfStats, sessionStats) {
    let score = 100;
    
    // Reduce score based on vulnerabilities
    score -= vulnerabilities.critical * 20;
    score -= vulnerabilities.high * 10;
    score -= vulnerabilities.moderate * 5;
    score -= vulnerabilities.low * 1;
    
    // Reduce score if CSRF protection is not properly configured
    if (!csrfStats.secretKeySet) {
      score -= 15;
    }
    
    // Reduce score if too many active sessions
    if (sessionStats.activeSessions > 50) {
      score -= 5;
    }
    
    // Ensure score stays within bounds
    score = Math.max(0, Math.min(100, score));
    
    return {
      score,
      grade: this.getSecurityGrade(score),
      factors: {
        vulnerabilities: vulnerabilities.total,
        csrfProtection: csrfStats.secretKeySet,
        sessionSecurity: sessionStats.activeSessions < 50
      }
    };
  }

  getSecurityGrade(score) {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  getSessionRecommendations(stats) {
    const recommendations = [];
    
    if (stats.activeSessions > 50) {
      recommendations.push({
        type: 'warning',
        message: 'High number of active sessions detected',
        action: 'Consider implementing session cleanup or reducing session timeout'
      });
    }
    
    if (stats.sessionTimeout > 7200000) { // 2 hours
      recommendations.push({
        type: 'info',
        message: 'Session timeout is quite long',
        action: 'Consider reducing session timeout for better security'
      });
    }
    
    return recommendations;
  }

  getCSRFRecommendations(stats) {
    const recommendations = [];
    
    if (!stats.secretKeySet) {
      recommendations.push({
        type: 'error',
        message: 'CSRF secret key not properly configured',
        action: 'Set CSRF_SECRET environment variable'
      });
    }
    
    if (stats.tokenTimeout > 7200000) { // 2 hours
      recommendations.push({
        type: 'warning',
        message: 'CSRF token timeout is very long',
        action: 'Consider reducing token timeout for better security'
      });
    }
    
    return recommendations;
  }
}

module.exports = SecurityController;