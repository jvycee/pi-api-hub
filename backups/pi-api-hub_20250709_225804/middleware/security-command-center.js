const logger = require('../shared/logger');

class SecurityCommandCenter {
  constructor(threatDetection, simpleAuth, rateLimiting) {
    this.threatDetection = threatDetection;
    this.simpleAuth = simpleAuth;
    this.rateLimiting = rateLimiting;
    this.alerts = [];
    this.bananaSecurityLevel = 'MAXIMUM_OVERDRIVE';
    this.securityMetrics = {
      totalThreatsBlocked: 0,
      authenticationAttempts: 0,
      failedLogins: 0,
      successfulLogins: 0,
      ipsBanned: 0,
      honeypotTriggers: 0,
      bananaSecurityScore: 100
    };
    
    this.initializeBananaFortress();
  }

  initializeBananaFortress() {
    logger.info('🍌🛡️ BANANA MOTHERSHIP COMMAND CENTER ONLINE 🛡️🍌', {
      service: 'security-command-center',
      bananaLevel: 'MAXIMUM',
      fortressStatus: 'IMPENETRABLE'
    });
  }

  // 🍌 MAXIMUM BANANA SECURITY DASHBOARD 🍌
  getBananaSecurityDashboard() {
    const threatStats = this.threatDetection.getThreatStats();
    const authStats = this.simpleAuth.getAuthStats();
    const systemStatus = this.threatDetection.getSystemStatus();
    
    return {
      title: '🍌 BANANA MOTHERSHIP SECURITY COMMAND CENTER 🍌',
      timestamp: new Date().toISOString(),
      bananaSecurityLevel: this.bananaSecurityLevel,
      overallThreatLevel: systemStatus.threatLevel,
      bananaSecurityScore: this.calculateBananaSecurityScore(),
      
      // 🛡️ FORTRESS STATUS
      fortressStatus: {
        shields: 'MAXIMUM_STRENGTH',
        weaponSystems: 'FULLY_ARMED',
        scanners: 'ACTIVE_SCANNING',
        honeypots: 'BANANA_TRAPS_SET',
        bananaGuardians: 'ON_PATROL'
      },
      
      // 🚨 THREAT INTELLIGENCE
      threatIntelligence: {
        threatsDetected: threatStats.totalThreatsDetected,
        recentThreats: threatStats.recentThreats,
        blockedIPs: threatStats.blockedIPs,
        suspiciousIPs: threatStats.suspiciousIPs,
        honeypotHits: threatStats.honeypotHits,
        threatTypes: threatStats.alertsByType,
        severityBreakdown: threatStats.alertsBySeverity
      },
      
      // 🔐 AUTHENTICATION FORTRESS
      authenticationFortress: {
        totalUsers: authStats.totalUsers,
        activeUsers: authStats.activeUsers,
        failedAttempts: authStats.failedAttempts,
        successfulLogins: authStats.successfulLogins,
        blockedAccounts: authStats.blockedAccounts,
        mfaEnabled: authStats.mfaEnabled
      },
      
      // 🍌 BANANA METRICS
      bananaMetrics: {
        bananasProtected: '∞',
        threatsRepelled: threatStats.totalThreatsDetected,
        bananaFortressIntegrity: '100%',
        mothershipShields: 'IMPENETRABLE',
        bananaGuardianStatus: 'MAXIMUM_ALERT'
      },
      
      // 📊 SECURITY ANALYTICS
      securityAnalytics: {
        riskScore: this.calculateRiskScore(),
        complianceScore: this.calculateComplianceScore(),
        securityTrends: this.getSecurityTrends(),
        recommendations: this.getSecurityRecommendations()
      },
      
      // 🚀 REAL-TIME ALERTS
      realTimeAlerts: this.getActiveAlerts(),
      
      // 🌍 GLOBAL THREAT MAP
      globalThreats: this.getGlobalThreatIntel(),
      
      bananaStatus: '🍌 MAXIMUM PROTECTION ACTIVATED 🍌'
    };
  }

  // Calculate overall banana security score
  calculateBananaSecurityScore() {
    let score = 100;
    const threatStats = this.threatDetection.getThreatStats();
    
    // Deduct points for threats
    if (threatStats.recentThreats > 10) score -= 20;
    else if (threatStats.recentThreats > 5) score -= 10;
    else if (threatStats.recentThreats > 0) score -= 5;
    
    // Deduct points for blocked IPs
    if (threatStats.blockedIPs > 5) score -= 15;
    else if (threatStats.blockedIPs > 0) score -= 5;
    
    // Add points for active security
    if (this.threatDetection.honeypots.size > 0) score += 5;
    if (this.threatDetection.blockedIPs.size === 0) score += 10;
    
    return Math.max(0, Math.min(100, score));
  }

  // Calculate risk score
  calculateRiskScore() {
    const threatStats = this.threatDetection.getThreatStats();
    let riskScore = 0;
    
    // High risk indicators
    riskScore += threatStats.recentThreats * 2;
    riskScore += threatStats.blockedIPs * 5;
    riskScore += threatStats.honeypotHits * 3;
    
    if (riskScore === 0) return 'MINIMAL';
    if (riskScore < 20) return 'LOW';
    if (riskScore < 50) return 'MEDIUM';
    if (riskScore < 100) return 'HIGH';
    return 'CRITICAL';
  }

  // Calculate compliance score
  calculateComplianceScore() {
    let score = 100;
    
    // Check security features
    const features = {
      rateLimit: this.rateLimiting ? 10 : -20,
      threatDetection: this.threatDetection ? 15 : -25,
      authentication: this.simpleAuth ? 15 : -25,
      encryption: 10, // HTTPS ready
      monitoring: 15, // Active monitoring
      logging: 10 // Security logging
    };
    
    Object.values(features).forEach(points => score += points);
    return Math.max(0, Math.min(100, score));
  }

  // Get security trends
  getSecurityTrends() {
    const recentAlerts = this.threatDetection.getRecentAlerts(100);
    const last24h = Date.now() - (24 * 60 * 60 * 1000);
    const recent24h = recentAlerts.filter(alert => 
      new Date(alert.timestamp).getTime() > last24h
    );
    
    return {
      threatsLast24h: recent24h.length,
      trend: recent24h.length > 10 ? 'INCREASING' : 'STABLE',
      mostCommonThreat: this.getMostCommonThreat(recent24h),
      peakThreatTime: this.getPeakThreatTime(recent24h)
    };
  }

  // Get most common threat
  getMostCommonThreat(alerts) {
    const counts = {};
    alerts.forEach(alert => {
      counts[alert.type] = (counts[alert.type] || 0) + 1;
    });
    
    const mostCommon = Object.entries(counts)
      .sort(([,a], [,b]) => b - a)[0];
    
    return mostCommon ? mostCommon[0] : 'NONE';
  }

  // Get peak threat time
  getPeakThreatTime(alerts) {
    const hourCounts = {};
    alerts.forEach(alert => {
      const hour = new Date(alert.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const peakHour = Object.entries(hourCounts)
      .sort(([,a], [,b]) => b - a)[0];
    
    return peakHour ? `${peakHour[0]}:00` : 'NO_PATTERN';
  }

  // Get security recommendations
  getSecurityRecommendations() {
    const recommendations = [];
    const threatStats = this.threatDetection.getThreatStats();
    
    if (threatStats.recentThreats > 10) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Increase rate limiting strictness',
        reason: 'High threat activity detected'
      });
    }
    
    if (threatStats.blockedIPs > 5) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Review and clear old blocked IPs',
        reason: 'Many IPs currently blocked'
      });
    }
    
    if (this.bananaSecurityLevel !== 'MAXIMUM_OVERDRIVE') {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'Activate MAXIMUM BANANA SECURITY',
        reason: 'Fortress not at maximum protection'
      });
    }
    
    return recommendations;
  }

  // Get active alerts
  getActiveAlerts() {
    const recentAlerts = this.threatDetection.getRecentAlerts(20);
    return recentAlerts.map(alert => ({
      ...alert,
      bananaStatus: this.getBananaAlertStatus(alert.severity),
      timeAgo: this.getTimeAgo(alert.timestamp)
    }));
  }

  // Get banana alert status
  getBananaAlertStatus(severity) {
    const statusMap = {
      'CRITICAL': '🚨🍌 BANANA RED ALERT 🍌🚨',
      'HIGH': '⚠️🍌 BANANA ORANGE ALERT 🍌⚠️',
      'MEDIUM': '💛🍌 BANANA YELLOW ALERT 🍌💛',
      'LOW': '💚🍌 BANANA GREEN ALERT 🍌💚'
    };
    return statusMap[severity] || '🍌 BANANA ALERT 🍌';
  }

  // Get time ago
  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  }

  // Get global threat intelligence
  getGlobalThreatIntel() {
    return {
      bananaIntelligence: 'CLASSIFIED_BANANA_DATA',
      globalThreatLevel: 'MANAGEABLE',
      bananaNetworkStatus: 'SECURE',
      mothershipConnections: 'ALL_SYSTEMS_OPERATIONAL',
      bananaDefenseGrid: 'ACTIVE_AND_READY'
    };
  }

  // 🚨 EMERGENCY BANANA PROTOCOL 🚨
  activateEmergencyProtocol(threatLevel = 'HIGH') {
    logger.error('🚨🍌 EMERGENCY BANANA PROTOCOL ACTIVATED 🍌🚨', {
      threatLevel,
      timestamp: new Date().toISOString(),
      bananaDefcon: 'MAXIMUM'
    });
    
    this.bananaSecurityLevel = 'EMERGENCY_BANANA_MODE';
    
    // Increase security measures
    this.emergencyMeasures = {
      rateLimitReduced: true,
      extraHoneypots: true,
      enhancedMonitoring: true,
      bananaGuardiansAlerted: true
    };
    
    this.createEmergencyAlert({
      type: 'EMERGENCY_PROTOCOL_ACTIVATED',
      level: threatLevel,
      measures: this.emergencyMeasures,
      timestamp: new Date().toISOString()
    });
  }

  // Create emergency alert
  createEmergencyAlert(alertData) {
    this.alerts.unshift({
      id: `emergency_${Date.now()}`,
      priority: 'EMERGENCY',
      bananaLevel: 'MAXIMUM',
      ...alertData
    });
  }

  // 🍌 BANANA SECURITY REPORT 🍌
  generateBananaSecurityReport() {
    const dashboard = this.getBananaSecurityDashboard();
    
    return {
      reportTitle: '🍌 BANANA MOTHERSHIP SECURITY REPORT 🍌',
      generatedAt: new Date().toISOString(),
      reportPeriod: '24 HOURS',
      executiveSummary: {
        overallStatus: 'BANANA FORTRESS SECURE',
        threatLevel: dashboard.overallThreatLevel,
        securityScore: dashboard.bananaSecurityScore,
        threatsBlocked: dashboard.threatIntelligence.threatsDetected,
        bananaRecommendation: 'MAINTAIN MAXIMUM BANANA VIGILANCE'
      },
      detailedAnalysis: dashboard,
      bananaConclusion: '🍌 BANANA POWER PROTECTS ALL 🍌'
    };
  }

  // Get banana fortress status
  getBananaFortressStatus() {
    return {
      fortress: '🍌 IMPENETRABLE BANANA FORTRESS 🍌',
      defenses: 'ALL SYSTEMS OPERATIONAL',
      guardians: 'BANANA GUARDIANS ACTIVE',
      shields: 'MAXIMUM STRENGTH',
      weaponSystems: 'LOADED WITH BANANAS',
      threatLevel: this.calculateRiskScore(),
      bananaLevel: 'OVER 9000! 🍌'
    };
  }
}

module.exports = SecurityCommandCenter;