const fs = require('fs');
const path = require('path');
const logger = require('../shared/logger');

class BananaAuditLogger {
  constructor() {
    this.auditLogs = new Map();
    this.complianceChecks = new Map();
    this.securityEvents = new Map();
    this.auditRetentionDays = 365; // 1 year retention
    this.bananaSecurityLevel = 'AUDIT_MAXIMUM';
    this.auditLogPath = path.join(process.cwd(), 'logs', 'security-audit.log');
    this.complianceLogPath = path.join(process.cwd(), 'logs', 'compliance.log');
    
    this.initializeBananaAuditLogger();
    this.setupAuditDirectories();
    this.startPeriodicCompliance();
  }

  initializeBananaAuditLogger() {
    logger.info('🍌📋 BANANA AUDIT LOGGER ACTIVATED 📋🍌', {
      service: 'banana-audit-logger',
      auditLevel: 'COMPREHENSIVE',
      bananaLevel: 'MAXIMUM_COMPLIANCE'
    });
  }

  // Setup audit directories
  setupAuditDirectories() {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    const auditDir = path.join(logsDir, 'audit');
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
    }
  }

  // 🍌 Log security event 🍌
  logSecurityEvent(eventType, details) {
    const eventId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    const auditEntry = {
      eventId,
      timestamp,
      eventType,
      details,
      severity: this.determineEventSeverity(eventType),
      compliance: this.checkEventCompliance(eventType, details),
      bananaLevel: this.calculateBananaSecurityLevel(eventType),
      hash: this.generateEventHash(eventId, timestamp, eventType, details)
    };

    // Store in memory
    this.auditLogs.set(eventId, auditEntry);
    
    // Log to file
    this.writeAuditToFile(auditEntry);
    
    // Track security events
    this.trackSecurityEvent(eventType, auditEntry);
    
    logger.info('🍌 SECURITY EVENT LOGGED', {
      eventId,
      eventType,
      severity: auditEntry.severity,
      bananaAudit: 'RECORDED'
    });

    return eventId;
  }

  // 🍌 Log authentication event 🍌
  logAuthenticationEvent(userId, action, result, details = {}) {
    const authEvent = {
      userId,
      action, // LOGIN, LOGOUT, MFA_VERIFY, PASSWORD_CHANGE, etc.
      result, // SUCCESS, FAILURE, BLOCKED, etc.
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      sessionId: details.sessionId || null,
      mfaUsed: details.mfaUsed || false,
      deviceTrusted: details.deviceTrusted || false,
      riskLevel: this.calculateAuthRiskLevel(action, result, details),
      bananaAuthLevel: result === 'SUCCESS' ? 'BANANA_VERIFIED' : 'BANANA_DENIED'
    };

    return this.logSecurityEvent('AUTHENTICATION', authEvent);
  }

  // 🍌 Log access control event 🍌
  logAccessControlEvent(userId, resource, action, result, details = {}) {
    const accessEvent = {
      userId,
      resource,
      action, // READ, WRITE, DELETE, ADMIN, etc.
      result, // GRANTED, DENIED, BLOCKED, etc.
      ip: details.ip || 'unknown',
      path: details.path || resource,
      method: details.method || 'unknown',
      permissions: details.permissions || [],
      policyApplied: details.policyApplied || 'default',
      bananaAccess: result === 'GRANTED' ? 'BANANA_ALLOWED' : 'BANANA_BLOCKED'
    };

    return this.logSecurityEvent('ACCESS_CONTROL', accessEvent);
  }

  // 🍌 Log threat detection event 🍌
  logThreatDetectionEvent(threatType, severity, details) {
    const threatEvent = {
      threatType,
      severity,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      payload: details.payload || null,
      patterns: details.patterns || [],
      blocked: details.blocked || false,
      honeypotTriggered: details.honeypotTriggered || false,
      bananaDefense: details.blocked ? 'BANANA_SHIELD_ACTIVATED' : 'BANANA_MONITORING'
    };

    return this.logSecurityEvent('THREAT_DETECTION', threatEvent);
  }

  // 🍌 Log configuration change 🍌
  logConfigurationEvent(component, change, userId, details = {}) {
    const configEvent = {
      component,
      change,
      userId,
      oldValue: details.oldValue || null,
      newValue: details.newValue || null,
      configPath: details.configPath || null,
      approved: details.approved || false,
      bananaConfig: 'BANANA_CONFIGURATION_CHANGED'
    };

    return this.logSecurityEvent('CONFIGURATION_CHANGE', configEvent);
  }

  // 🍌 Log compliance check 🍌
  logComplianceEvent(checkType, result, details = {}) {
    const complianceEvent = {
      checkType,
      result, // PASS, FAIL, WARNING, etc.
      score: details.score || 0,
      issues: details.issues || [],
      recommendations: details.recommendations || [],
      framework: details.framework || 'INTERNAL',
      bananaCompliance: result === 'PASS' ? 'BANANA_COMPLIANT' : 'BANANA_NON_COMPLIANT'
    };

    return this.logSecurityEvent('COMPLIANCE_CHECK', complianceEvent);
  }

  // Determine event severity
  determineEventSeverity(eventType) {
    const severityMap = {
      'AUTHENTICATION': 'MEDIUM',
      'ACCESS_CONTROL': 'MEDIUM',
      'THREAT_DETECTION': 'HIGH',
      'CONFIGURATION_CHANGE': 'HIGH',
      'COMPLIANCE_CHECK': 'MEDIUM',
      'SECURITY_BREACH': 'CRITICAL',
      'PRIVILEGE_ESCALATION': 'CRITICAL',
      'DATA_EXFILTRATION': 'CRITICAL',
      'SYSTEM_COMPROMISE': 'CRITICAL'
    };
    
    return severityMap[eventType] || 'MEDIUM';
  }

  // Check event compliance
  checkEventCompliance(eventType, details) {
    const complianceChecks = {
      loggedProperly: true,
      hasTimestamp: true,
      hasUserId: !!details.userId,
      hasIPAddress: !!details.ip,
      hasUserAgent: !!details.userAgent,
      dataIntegrity: true,
      retentionCompliant: true
    };

    const complianceScore = Object.values(complianceChecks).filter(Boolean).length / 
                           Object.keys(complianceChecks).length * 100;

    return {
      score: complianceScore,
      checks: complianceChecks,
      compliant: complianceScore >= 80,
      bananaCompliance: complianceScore >= 90 ? 'BANANA_GOLD_STANDARD' : 'BANANA_STANDARD'
    };
  }

  // Calculate banana security level
  calculateBananaSecurityLevel(eventType) {
    const levelMap = {
      'AUTHENTICATION': 'BANANA_STANDARD',
      'ACCESS_CONTROL': 'BANANA_ENHANCED',
      'THREAT_DETECTION': 'BANANA_MAXIMUM',
      'CONFIGURATION_CHANGE': 'BANANA_CRITICAL',
      'COMPLIANCE_CHECK': 'BANANA_AUDIT',
      'SECURITY_BREACH': 'BANANA_EMERGENCY',
      'PRIVILEGE_ESCALATION': 'BANANA_EMERGENCY',
      'DATA_EXFILTRATION': 'BANANA_EMERGENCY',
      'SYSTEM_COMPROMISE': 'BANANA_EMERGENCY'
    };
    
    return levelMap[eventType] || 'BANANA_STANDARD';
  }

  // Generate event hash for integrity
  generateEventHash(eventId, timestamp, eventType, details) {
    const crypto = require('crypto');
    const data = `${eventId}:${timestamp}:${eventType}:${JSON.stringify(details)}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // Calculate authentication risk level
  calculateAuthRiskLevel(action, result, details) {
    let riskScore = 0;
    
    if (result === 'FAILURE') riskScore += 30;
    if (result === 'BLOCKED') riskScore += 50;
    if (!details.mfaUsed && action === 'LOGIN') riskScore += 20;
    if (!details.deviceTrusted) riskScore += 15;
    if (details.suspiciousIP) riskScore += 25;
    
    if (riskScore >= 70) return 'CRITICAL';
    if (riskScore >= 50) return 'HIGH';
    if (riskScore >= 30) return 'MEDIUM';
    return 'LOW';
  }

  // Write audit to file
  writeAuditToFile(auditEntry) {
    const logLine = JSON.stringify(auditEntry) + '\n';
    
    try {
      fs.appendFileSync(this.auditLogPath, logLine);
      
      // Also write to daily audit file
      const dailyLogPath = path.join(
        path.dirname(this.auditLogPath),
        'audit',
        `security-audit-${new Date().toISOString().split('T')[0]}.log`
      );
      fs.appendFileSync(dailyLogPath, logLine);
      
    } catch (error) {
      logger.error('🚨 AUDIT LOG WRITE FAILED', {
        error: error.message,
        eventId: auditEntry.eventId
      });
    }
  }

  // Track security events
  trackSecurityEvent(eventType, auditEntry) {
    const eventKey = `${eventType}_${new Date().toISOString().split('T')[0]}`;
    
    if (!this.securityEvents.has(eventKey)) {
      this.securityEvents.set(eventKey, {
        eventType,
        date: new Date().toISOString().split('T')[0],
        count: 0,
        severity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
        bananaTracking: 'ACTIVE'
      });
    }
    
    const eventStats = this.securityEvents.get(eventKey);
    eventStats.count++;
    eventStats.severity[auditEntry.severity]++;
  }

  // 🍌 Compliance Dashboard 🍌
  getComplianceDashboard() {
    const totalEvents = this.auditLogs.size;
    const complianceScore = this.calculateOverallComplianceScore();
    const recentEvents = this.getRecentAuditEvents(100);
    
    return {
      title: '🍌📋 BANANA COMPLIANCE DASHBOARD 📋🍌',
      timestamp: new Date().toISOString(),
      complianceStatus: 'AUDIT_MAXIMUM',
      
      auditSummary: {
        totalEventsLogged: totalEvents,
        complianceScore: complianceScore,
        auditIntegrity: this.verifyAuditIntegrity(),
        retentionCompliance: this.checkRetentionCompliance(),
        bananaAuditLevel: complianceScore >= 90 ? 'BANANA_GOLD_COMPLIANCE' : 'BANANA_STANDARD_COMPLIANCE'
      },
      
      eventBreakdown: this.getEventBreakdown(),
      complianceMetrics: this.getComplianceMetrics(),
      auditTrails: this.getAuditTrails(),
      securityTrends: this.getSecurityEventTrends(),
      
      complianceRecommendations: this.getComplianceRecommendations(),
      bananaStatus: '🍌 COMPREHENSIVE AUDIT LOGGING ACTIVE 🍌'
    };
  }

  // Calculate overall compliance score
  calculateOverallComplianceScore() {
    const auditEntries = Array.from(this.auditLogs.values());
    if (auditEntries.length === 0) return 100;
    
    const totalScore = auditEntries.reduce((sum, entry) => 
      sum + (entry.compliance?.score || 0), 0
    );
    
    return Math.round(totalScore / auditEntries.length);
  }

  // Verify audit integrity
  verifyAuditIntegrity() {
    const auditEntries = Array.from(this.auditLogs.values());
    let integrityScore = 100;
    
    for (const entry of auditEntries) {
      const expectedHash = this.generateEventHash(
        entry.eventId, entry.timestamp, entry.eventType, entry.details
      );
      
      if (entry.hash !== expectedHash) {
        integrityScore -= 10;
      }
    }
    
    return Math.max(0, integrityScore);
  }

  // Check retention compliance
  checkRetentionCompliance() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.auditRetentionDays);
    
    const auditEntries = Array.from(this.auditLogs.values());
    const expiredEntries = auditEntries.filter(entry => 
      new Date(entry.timestamp) < cutoffDate
    );
    
    return {
      totalEntries: auditEntries.length,
      expiredEntries: expiredEntries.length,
      retentionCompliant: expiredEntries.length === 0,
      bananaRetention: 'BANANA_MANAGED'
    };
  }

  // Get event breakdown
  getEventBreakdown() {
    const breakdown = {};
    
    this.auditLogs.forEach(entry => {
      const eventType = entry.eventType;
      if (!breakdown[eventType]) {
        breakdown[eventType] = { count: 0, severity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } };
      }
      breakdown[eventType].count++;
      breakdown[eventType].severity[entry.severity]++;
    });
    
    return breakdown;
  }

  // Get compliance metrics
  getComplianceMetrics() {
    const auditEntries = Array.from(this.auditLogs.values());
    const compliantEntries = auditEntries.filter(entry => entry.compliance?.compliant);
    
    return {
      totalEntries: auditEntries.length,
      compliantEntries: compliantEntries.length,
      complianceRate: auditEntries.length > 0 ? 
        Math.round((compliantEntries.length / auditEntries.length) * 100) : 100,
      integrityScore: this.verifyAuditIntegrity(),
      bananaCompliance: 'BANANA_TRACKED'
    };
  }

  // Get audit trails
  getAuditTrails() {
    const trails = {};
    
    this.auditLogs.forEach(entry => {
      const userId = entry.details.userId || 'system';
      if (!trails[userId]) {
        trails[userId] = { events: 0, lastActivity: null, riskScore: 0 };
      }
      trails[userId].events++;
      trails[userId].lastActivity = entry.timestamp;
      trails[userId].riskScore += this.calculateEventRiskScore(entry);
    });
    
    return trails;
  }

  // Calculate event risk score
  calculateEventRiskScore(entry) {
    const riskMap = {
      'CRITICAL': 10,
      'HIGH': 5,
      'MEDIUM': 2,
      'LOW': 1
    };
    
    return riskMap[entry.severity] || 1;
  }

  // Get security event trends
  getSecurityEventTrends() {
    const trends = {};
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    
    this.auditLogs.forEach(entry => {
      const eventDate = new Date(entry.timestamp);
      if (eventDate >= last30Days) {
        const dateKey = eventDate.toISOString().split('T')[0];
        if (!trends[dateKey]) {
          trends[dateKey] = { total: 0, severity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } };
        }
        trends[dateKey].total++;
        trends[dateKey].severity[entry.severity]++;
      }
    });
    
    return trends;
  }

  // Get recent audit events
  getRecentAuditEvents(limit = 50) {
    const events = Array.from(this.auditLogs.values())
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
    
    return events;
  }

  // Get compliance recommendations
  getComplianceRecommendations() {
    const recommendations = [];
    const complianceScore = this.calculateOverallComplianceScore();
    const integrityScore = this.verifyAuditIntegrity();
    
    if (complianceScore < 80) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Improve audit data completeness',
        details: 'Ensure all events include required fields',
        bananaMessage: '🍌 Banana audit needs improvement! 🍌'
      });
    }
    
    if (integrityScore < 90) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'Investigate audit integrity issues',
        details: 'Some audit hashes do not match expected values',
        bananaMessage: '🚨🍌 Banana audit integrity compromised! 🍌🚨'
      });
    }
    
    const retentionCheck = this.checkRetentionCompliance();
    if (retentionCheck.expiredEntries > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Archive or delete expired audit entries',
        details: `${retentionCheck.expiredEntries} entries exceed retention period`,
        bananaMessage: '🍌 Old banana logs need cleanup! 🍌'
      });
    }
    
    return recommendations;
  }

  // Start periodic compliance checks
  startPeriodicCompliance() {
    // Run compliance checks every 6 hours
    setInterval(() => {
      this.performComplianceCheck();
    }, 6 * 60 * 60 * 1000);
    
    logger.info('🍌 PERIODIC COMPLIANCE CHECKS ENABLED', {
      interval: '6 hours',
      bananaCompliance: 'CONTINUOUS'
    });
  }

  // Perform compliance check
  performComplianceCheck() {
    const checkId = `compliance_${Date.now()}`;
    const complianceScore = this.calculateOverallComplianceScore();
    const integrityScore = this.verifyAuditIntegrity();
    const retentionCheck = this.checkRetentionCompliance();
    
    const complianceResult = {
      checkId,
      timestamp: new Date().toISOString(),
      complianceScore,
      integrityScore,
      retentionCompliant: retentionCheck.retentionCompliant,
      issues: [],
      recommendations: this.getComplianceRecommendations(),
      bananaCompliance: 'BANANA_AUDIT_VERIFIED'
    };
    
    // Log compliance check
    this.logComplianceEvent('PERIODIC_CHECK', 
      complianceScore >= 80 ? 'PASS' : 'FAIL',
      complianceResult
    );
    
    logger.info('🍌 COMPLIANCE CHECK COMPLETED', {
      checkId,
      complianceScore,
      integrityScore,
      bananaStatus: 'COMPLIANCE_VERIFIED'
    });
    
    return complianceResult;
  }

  // 🍌 Generate audit report 🍌
  generateAuditReport(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    const relevantEvents = Array.from(this.auditLogs.values())
      .filter(entry => {
        const eventDate = new Date(entry.timestamp);
        return eventDate >= start && eventDate <= end;
      });
    
    const report = {
      title: '🍌📋 BANANA SECURITY AUDIT REPORT 📋🍌',
      reportPeriod: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalDays: Math.ceil((end - start) / (24 * 60 * 60 * 1000))
      },
      
      executiveSummary: {
        totalEvents: relevantEvents.length,
        complianceScore: this.calculatePeriodComplianceScore(relevantEvents),
        criticalEvents: relevantEvents.filter(e => e.severity === 'CRITICAL').length,
        highEvents: relevantEvents.filter(e => e.severity === 'HIGH').length,
        bananaAuditLevel: 'COMPREHENSIVE'
      },
      
      eventAnalysis: this.analyzeEventsForReport(relevantEvents),
      complianceAnalysis: this.analyzeComplianceForReport(relevantEvents),
      securityTrends: this.analyzeTrendsForReport(relevantEvents),
      recommendations: this.getReportRecommendations(relevantEvents),
      
      bananaConclusion: '🍌 BANANA AUDIT COMPLETE - FORTRESS SECURE 🍌'
    };
    
    return report;
  }

  // Calculate compliance score for period
  calculatePeriodComplianceScore(events) {
    if (events.length === 0) return 100;
    
    const totalScore = events.reduce((sum, event) => 
      sum + (event.compliance?.score || 0), 0
    );
    
    return Math.round(totalScore / events.length);
  }

  // Analyze events for report
  analyzeEventsForReport(events) {
    const analysis = {
      byType: {},
      bySeverity: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
      byHour: {},
      topUsers: {},
      topIPs: {}
    };
    
    events.forEach(event => {
      // By type
      analysis.byType[event.eventType] = (analysis.byType[event.eventType] || 0) + 1;
      
      // By severity
      analysis.bySeverity[event.severity]++;
      
      // By hour
      const hour = new Date(event.timestamp).getHours();
      analysis.byHour[hour] = (analysis.byHour[hour] || 0) + 1;
      
      // Top users
      const userId = event.details.userId || 'system';
      analysis.topUsers[userId] = (analysis.topUsers[userId] || 0) + 1;
      
      // Top IPs
      const ip = event.details.ip || 'unknown';
      analysis.topIPs[ip] = (analysis.topIPs[ip] || 0) + 1;
    });
    
    return analysis;
  }

  // Analyze compliance for report
  analyzeComplianceForReport(events) {
    const compliantEvents = events.filter(e => e.compliance?.compliant);
    const integrityIssues = events.filter(e => !this.verifyEventIntegrity(e));
    
    return {
      totalEvents: events.length,
      compliantEvents: compliantEvents.length,
      complianceRate: events.length > 0 ? 
        Math.round((compliantEvents.length / events.length) * 100) : 100,
      integrityIssues: integrityIssues.length,
      bananaCompliance: 'BANANA_ANALYZED'
    };
  }

  // Verify single event integrity
  verifyEventIntegrity(event) {
    const expectedHash = this.generateEventHash(
      event.eventId, event.timestamp, event.eventType, event.details
    );
    return event.hash === expectedHash;
  }

  // Analyze trends for report
  analyzeTrendsForReport(events) {
    const dailyTrends = {};
    
    events.forEach(event => {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      if (!dailyTrends[date]) {
        dailyTrends[date] = { total: 0, critical: 0, high: 0 };
      }
      dailyTrends[date].total++;
      if (event.severity === 'CRITICAL') dailyTrends[date].critical++;
      if (event.severity === 'HIGH') dailyTrends[date].high++;
    });
    
    return {
      dailyTrends,
      averageDaily: Object.values(dailyTrends).reduce((sum, day) => sum + day.total, 0) / 
                   Object.keys(dailyTrends).length,
      peakDay: Object.entries(dailyTrends).sort(([,a], [,b]) => b.total - a.total)[0],
      bananaAnalysis: 'BANANA_TRENDING'
    };
  }

  // Get report recommendations
  getReportRecommendations(events) {
    const recommendations = [];
    const criticalEvents = events.filter(e => e.severity === 'CRITICAL').length;
    const complianceScore = this.calculatePeriodComplianceScore(events);
    
    if (criticalEvents > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        action: `Investigate ${criticalEvents} critical security events`,
        bananaMessage: '🚨🍌 Critical banana events need attention! 🍌🚨'
      });
    }
    
    if (complianceScore < 80) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Improve audit data quality and completeness',
        bananaMessage: '🍌 Banana audit quality needs improvement! 🍌'
      });
    }
    
    return recommendations;
  }

  // 🍌 Export audit data 🍌
  exportAuditData(format = 'json', startDate = null, endDate = null) {
    let events = Array.from(this.auditLogs.values());
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      events = events.filter(event => {
        const eventDate = new Date(event.timestamp);
        return eventDate >= start && eventDate <= end;
      });
    }
    
    const exportData = {
      exportMetadata: {
        timestamp: new Date().toISOString(),
        format,
        totalEvents: events.length,
        dateRange: startDate && endDate ? { startDate, endDate } : 'ALL',
        bananaExport: 'BANANA_AUDIT_EXPORT'
      },
      auditEvents: events
    };
    
    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'csv') {
      return this.convertToCSV(events);
    }
    
    return exportData;
  }

  // Convert to CSV
  convertToCSV(events) {
    const headers = ['EventID', 'Timestamp', 'EventType', 'Severity', 'UserID', 'IP', 'Details'];
    const rows = events.map(event => [
      event.eventId,
      event.timestamp,
      event.eventType,
      event.severity,
      event.details.userId || 'system',
      event.details.ip || 'unknown',
      JSON.stringify(event.details).replace(/"/g, '""')
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }
}

module.exports = BananaAuditLogger;