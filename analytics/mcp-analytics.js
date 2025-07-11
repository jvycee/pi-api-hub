const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

/**
 * 🍌 BANANA-POWERED MCP ANALYTICS SYSTEM 🍌
 * 
 * Advanced analytics for MCP tool usage, performance, and user behavior
 */
class MCPAnalytics {
  constructor() {
    this.analytics = {
      toolUsage: new Map(),
      clientBehavior: new Map(),
      performanceMetrics: new Map(),
      userPatterns: new Map(),
      sessions: new Map(),
      errors: new Map()
    };

    this.aggregatedData = {
      daily: new Map(),
      weekly: new Map(),
      monthly: new Map()
    };

    this.realTimeMetrics = {
      currentSessions: 0,
      toolCallsPerMinute: 0,
      averageResponseTime: 0,
      activeClients: new Set()
    };

    this.startTime = Date.now();
    this.intervalCollectors = [];
    
    // Start analytics collection
    this.startAnalyticsCollection();
    
    logger.info('🍌 MCP Analytics System initialized');
  }

  /**
   * Start analytics data collection
   */
  startAnalyticsCollection() {
    // Update real-time metrics every 10 seconds
    const realTimeInterval = setInterval(() => {
      this.updateRealTimeMetrics();
    }, 10000);

    // Aggregate data every minute
    const aggregationInterval = setInterval(() => {
      this.aggregateMinuteData();
    }, 60000);

    // Generate insights every 5 minutes
    const insightsInterval = setInterval(() => {
      this.generateInsights();
    }, 300000);

    // Clean up old data every hour
    const cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 3600000);

    this.intervalCollectors = [realTimeInterval, aggregationInterval, insightsInterval, cleanupInterval];
  }

  /**
   * Record tool usage event
   */
  recordToolUsage(toolName, clientId, userId, executionTime, success, metadata = {}) {
    const timestamp = Date.now();
    const sessionId = this.getOrCreateSession(clientId, userId);

    // Record tool usage
    if (!this.analytics.toolUsage.has(toolName)) {
      this.analytics.toolUsage.set(toolName, {
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        clients: new Set(),
        users: new Set(),
        hourlyUsage: new Map(),
        parameters: new Map(),
        recentCalls: []
      });
    }

    const toolStats = this.analytics.toolUsage.get(toolName);
    toolStats.totalCalls++;
    toolStats.totalTime += executionTime;
    toolStats.averageTime = toolStats.totalTime / toolStats.totalCalls;
    toolStats.minTime = Math.min(toolStats.minTime, executionTime);
    toolStats.maxTime = Math.max(toolStats.maxTime, executionTime);
    toolStats.clients.add(clientId);
    toolStats.users.add(userId);

    if (success) {
      toolStats.successfulCalls++;
    } else {
      toolStats.failedCalls++;
    }

    // Record hourly usage
    const hour = new Date(timestamp).getHours();
    toolStats.hourlyUsage.set(hour, (toolStats.hourlyUsage.get(hour) || 0) + 1);

    // Record parameters
    if (metadata.parameters) {
      for (const [param, value] of Object.entries(metadata.parameters)) {
        if (!toolStats.parameters.has(param)) {
          toolStats.parameters.set(param, new Map());
        }
        const paramStats = toolStats.parameters.get(param);
        paramStats.set(value, (paramStats.get(value) || 0) + 1);
      }
    }

    // Record recent calls (last 100)
    toolStats.recentCalls.push({
      timestamp,
      clientId,
      userId,
      executionTime,
      success,
      metadata
    });

    if (toolStats.recentCalls.length > 100) {
      toolStats.recentCalls.shift();
    }

    // Update session
    this.updateSession(sessionId, toolName, executionTime, success, metadata);

    // Update client behavior
    this.recordClientBehavior(clientId, toolName, executionTime, success);
  }

  /**
   * Get or create user session
   */
  getOrCreateSession(clientId, userId) {
    const sessionKey = `${clientId}:${userId}`;
    const now = Date.now();
    
    // Check for existing active session (within 30 minutes)
    for (const [sessionId, session] of this.analytics.sessions) {
      if (session.clientId === clientId && session.userId === userId && 
          (now - session.lastActivity) < 1800000) {
        return sessionId;
      }
    }

    // Create new session
    const sessionId = `session_${now}_${Math.random().toString(36).substr(2, 9)}`;
    this.analytics.sessions.set(sessionId, {
      sessionId,
      clientId,
      userId,
      startTime: now,
      lastActivity: now,
      toolCalls: 0,
      uniqueTools: new Set(),
      totalTime: 0,
      averageTime: 0,
      errors: 0,
      patterns: []
    });

    this.realTimeMetrics.currentSessions++;
    this.realTimeMetrics.activeClients.add(clientId);

    return sessionId;
  }

  /**
   * Update session data
   */
  updateSession(sessionId, toolName, executionTime, success, metadata) {
    const session = this.analytics.sessions.get(sessionId);
    if (!session) return;

    session.lastActivity = Date.now();
    session.toolCalls++;
    session.uniqueTools.add(toolName);
    session.totalTime += executionTime;
    session.averageTime = session.totalTime / session.toolCalls;

    if (!success) {
      session.errors++;
    }

    // Record interaction patterns
    session.patterns.push({
      timestamp: Date.now(),
      tool: toolName,
      duration: executionTime,
      success
    });

    // Keep only last 50 patterns
    if (session.patterns.length > 50) {
      session.patterns.shift();
    }
  }

  /**
   * Record client behavior
   */
  recordClientBehavior(clientId, toolName, executionTime, success) {
    if (!this.analytics.clientBehavior.has(clientId)) {
      this.analytics.clientBehavior.set(clientId, {
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        totalCalls: 0,
        successfulCalls: 0,
        failedCalls: 0,
        totalTime: 0,
        averageTime: 0,
        favoriteTools: new Map(),
        usagePatterns: {
          hourly: new Map(),
          daily: new Map(),
          weekly: new Map()
        },
        sessions: 0,
        avgSessionDuration: 0
      });
    }

    const clientStats = this.analytics.clientBehavior.get(clientId);
    clientStats.lastSeen = Date.now();
    clientStats.totalCalls++;
    clientStats.totalTime += executionTime;
    clientStats.averageTime = clientStats.totalTime / clientStats.totalCalls;

    if (success) {
      clientStats.successfulCalls++;
    } else {
      clientStats.failedCalls++;
    }

    // Track favorite tools
    clientStats.favoriteTools.set(toolName, (clientStats.favoriteTools.get(toolName) || 0) + 1);

    // Track usage patterns
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();
    const week = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000));

    clientStats.usagePatterns.hourly.set(hour, (clientStats.usagePatterns.hourly.get(hour) || 0) + 1);
    clientStats.usagePatterns.daily.set(day, (clientStats.usagePatterns.daily.get(day) || 0) + 1);
    clientStats.usagePatterns.weekly.set(week, (clientStats.usagePatterns.weekly.get(week) || 0) + 1);
  }

  /**
   * Record performance metrics
   */
  recordPerformanceMetrics(clientId, toolName, metrics) {
    const timestamp = Date.now();
    const key = `${clientId}:${toolName}`;

    if (!this.analytics.performanceMetrics.has(key)) {
      this.analytics.performanceMetrics.set(key, {
        samples: [],
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        throughput: 0,
        errorRate: 0
      });
    }

    const perfMetrics = this.analytics.performanceMetrics.get(key);
    perfMetrics.samples.push({
      timestamp,
      responseTime: metrics.responseTime,
      success: metrics.success,
      throughput: metrics.throughput || 0
    });

    // Keep only last 1000 samples
    if (perfMetrics.samples.length > 1000) {
      perfMetrics.samples.shift();
    }

    // Calculate percentiles
    const responseTimes = perfMetrics.samples.map(s => s.responseTime).sort((a, b) => a - b);
    const totalSamples = responseTimes.length;
    
    perfMetrics.averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / totalSamples;
    perfMetrics.p95ResponseTime = responseTimes[Math.floor(totalSamples * 0.95)];
    perfMetrics.p99ResponseTime = responseTimes[Math.floor(totalSamples * 0.99)];
    
    const successfulSamples = perfMetrics.samples.filter(s => s.success).length;
    perfMetrics.errorRate = ((totalSamples - successfulSamples) / totalSamples) * 100;
  }

  /**
   * Update real-time metrics
   */
  updateRealTimeMetrics() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Count tool calls in the last minute
    let toolCallsLastMinute = 0;
    let totalResponseTime = 0;
    let responseTimeCount = 0;

    for (const [toolName, stats] of this.analytics.toolUsage) {
      const recentCalls = stats.recentCalls.filter(call => call.timestamp > oneMinuteAgo);
      toolCallsLastMinute += recentCalls.length;
      
      for (const call of recentCalls) {
        totalResponseTime += call.executionTime;
        responseTimeCount++;
      }
    }

    this.realTimeMetrics.toolCallsPerMinute = toolCallsLastMinute;
    this.realTimeMetrics.averageResponseTime = responseTimeCount > 0 ? 
      totalResponseTime / responseTimeCount : 0;

    // Update current sessions (clean up old ones)
    let activeSessions = 0;
    const thirtyMinutesAgo = now - 1800000;

    for (const [sessionId, session] of this.analytics.sessions) {
      if (session.lastActivity > thirtyMinutesAgo) {
        activeSessions++;
      } else {
        this.analytics.sessions.delete(sessionId);
      }
    }

    this.realTimeMetrics.currentSessions = activeSessions;
  }

  /**
   * Aggregate minute data
   */
  aggregateMinuteData() {
    const now = Date.now();
    const minuteKey = Math.floor(now / 60000);

    // Aggregate tool usage
    const toolUsageThisMinute = new Map();
    for (const [toolName, stats] of this.analytics.toolUsage) {
      const recentCalls = stats.recentCalls.filter(call => 
        call.timestamp > now - 60000
      );
      
      if (recentCalls.length > 0) {
        toolUsageThisMinute.set(toolName, {
          calls: recentCalls.length,
          averageTime: recentCalls.reduce((sum, call) => sum + call.executionTime, 0) / recentCalls.length,
          successRate: (recentCalls.filter(call => call.success).length / recentCalls.length) * 100
        });
      }
    }

    // Store aggregated data
    this.aggregatedData.daily.set(minuteKey, {
      timestamp: now,
      toolUsage: toolUsageThisMinute,
      activeSessions: this.realTimeMetrics.currentSessions,
      activeClients: this.realTimeMetrics.activeClients.size
    });

    // Clean up old daily data (keep 24 hours)
    const oneDayAgo = minuteKey - 1440; // 1440 minutes = 24 hours
    for (const [key] of this.aggregatedData.daily) {
      if (key < oneDayAgo) {
        this.aggregatedData.daily.delete(key);
      }
    }
  }

  /**
   * Generate insights
   */
  generateInsights() {
    const insights = {
      timestamp: Date.now(),
      toolPopularity: this.analyzeToolPopularity(),
      performanceInsights: this.analyzePerformance(),
      userBehaviorInsights: this.analyzeUserBehavior(),
      clientInsights: this.analyzeClientBehavior(),
      recommendations: this.generateRecommendations()
    };

    logger.info('🍌 MCP Analytics Insights Generated', {
      topTools: insights.toolPopularity.slice(0, 3),
      avgResponseTime: insights.performanceInsights.averageResponseTime,
      activeClients: insights.clientInsights.activeClients
    });

    return insights;
  }

  /**
   * Analyze tool popularity
   */
  analyzeToolPopularity() {
    const toolPopularity = [];
    
    for (const [toolName, stats] of this.analytics.toolUsage) {
      toolPopularity.push({
        name: toolName,
        calls: stats.totalCalls,
        successRate: stats.totalCalls > 0 ? (stats.successfulCalls / stats.totalCalls) * 100 : 0,
        averageTime: stats.averageTime,
        uniqueUsers: stats.users.size,
        uniqueClients: stats.clients.size,
        trend: this.calculateTrend(toolName)
      });
    }

    return toolPopularity.sort((a, b) => b.calls - a.calls);
  }

  /**
   * Analyze performance
   */
  analyzePerformance() {
    let totalCalls = 0;
    let totalTime = 0;
    let totalErrors = 0;
    const responseTimes = [];

    for (const [toolName, stats] of this.analytics.toolUsage) {
      totalCalls += stats.totalCalls;
      totalTime += stats.totalTime;
      totalErrors += stats.failedCalls;
      
      stats.recentCalls.forEach(call => {
        responseTimes.push(call.executionTime);
      });
    }

    responseTimes.sort((a, b) => a - b);

    return {
      totalCalls,
      averageResponseTime: totalCalls > 0 ? totalTime / totalCalls : 0,
      errorRate: totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0,
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)] || 0,
      p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)] || 0,
      throughput: this.realTimeMetrics.toolCallsPerMinute
    };
  }

  /**
   * Analyze user behavior
   */
  analyzeUserBehavior() {
    const userMetrics = {
      totalUsers: new Set(),
      activeUsers: new Set(),
      averageSessionDuration: 0,
      averageToolsPerSession: 0,
      mostActiveHours: new Map(),
      sessionPatterns: []
    };

    const now = Date.now();
    const oneHourAgo = now - 3600000;
    let totalSessionDuration = 0;
    let totalToolsUsed = 0;
    let sessionCount = 0;

    for (const [sessionId, session] of this.analytics.sessions) {
      userMetrics.totalUsers.add(session.userId);
      
      if (session.lastActivity > oneHourAgo) {
        userMetrics.activeUsers.add(session.userId);
      }

      const sessionDuration = session.lastActivity - session.startTime;
      totalSessionDuration += sessionDuration;
      totalToolsUsed += session.uniqueTools.size;
      sessionCount++;

      // Track hourly usage
      const hour = new Date(session.startTime).getHours();
      userMetrics.mostActiveHours.set(hour, (userMetrics.mostActiveHours.get(hour) || 0) + 1);
    }

    userMetrics.averageSessionDuration = sessionCount > 0 ? totalSessionDuration / sessionCount : 0;
    userMetrics.averageToolsPerSession = sessionCount > 0 ? totalToolsUsed / sessionCount : 0;

    return userMetrics;
  }

  /**
   * Analyze client behavior
   */
  analyzeClientBehavior() {
    const clientMetrics = {
      totalClients: this.analytics.clientBehavior.size,
      activeClients: this.realTimeMetrics.activeClients.size,
      clientDistribution: new Map(),
      averageCallsPerClient: 0,
      clientRetention: 0
    };

    let totalCalls = 0;
    const now = Date.now();
    const oneWeekAgo = now - 604800000; // 7 days
    let retainedClients = 0;

    for (const [clientId, stats] of this.analytics.clientBehavior) {
      totalCalls += stats.totalCalls;
      
      // Client type distribution
      const clientType = clientId.split(':')[0] || 'unknown';
      clientMetrics.clientDistribution.set(clientType, 
        (clientMetrics.clientDistribution.get(clientType) || 0) + 1);

      // Retention: clients active in the last week
      if (stats.lastSeen > oneWeekAgo) {
        retainedClients++;
      }
    }

    clientMetrics.averageCallsPerClient = clientMetrics.totalClients > 0 ? 
      totalCalls / clientMetrics.totalClients : 0;
    clientMetrics.clientRetention = clientMetrics.totalClients > 0 ? 
      (retainedClients / clientMetrics.totalClients) * 100 : 0;

    return clientMetrics;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations() {
    const recommendations = [];
    const performanceInsights = this.analyzePerformance();
    const toolPopularity = this.analyzeToolPopularity();

    // Performance recommendations
    if (performanceInsights.averageResponseTime > 3000) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        title: 'High Response Time Detected',
        description: `Average response time is ${performanceInsights.averageResponseTime.toFixed(0)}ms`,
        suggestion: 'Consider optimizing slow tools or adding caching'
      });
    }

    if (performanceInsights.errorRate > 5) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        title: 'High Error Rate',
        description: `Error rate is ${performanceInsights.errorRate.toFixed(1)}%`,
        suggestion: 'Investigate and fix failing tools'
      });
    }

    // Tool usage recommendations
    const mostPopularTool = toolPopularity[0];
    if (mostPopularTool && mostPopularTool.averageTime > 5000) {
      recommendations.push({
        type: 'optimization',
        priority: 'medium',
        title: 'Popular Tool Performance',
        description: `${mostPopularTool.name} is popular but slow (${mostPopularTool.averageTime.toFixed(0)}ms)`,
        suggestion: 'Optimize this tool for better user experience'
      });
    }

    // Usage pattern recommendations
    if (this.realTimeMetrics.toolCallsPerMinute > 100) {
      recommendations.push({
        type: 'scaling',
        priority: 'medium',
        title: 'High Traffic Volume',
        description: `${this.realTimeMetrics.toolCallsPerMinute} calls per minute`,
        suggestion: 'Consider scaling MCP server infrastructure'
      });
    }

    return recommendations;
  }

  /**
   * Calculate trend for a tool
   */
  calculateTrend(toolName) {
    const stats = this.analytics.toolUsage.get(toolName);
    if (!stats || stats.recentCalls.length < 10) {
      return 'stable';
    }

    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const twoHoursAgo = now - 7200000;

    const recentCalls = stats.recentCalls.filter(call => call.timestamp > oneHourAgo).length;
    const previousCalls = stats.recentCalls.filter(call => 
      call.timestamp > twoHoursAgo && call.timestamp <= oneHourAgo
    ).length;

    if (recentCalls > previousCalls * 1.2) {
      return 'increasing';
    } else if (recentCalls < previousCalls * 0.8) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * Clean up old data
   */
  cleanupOldData() {
    const now = Date.now();
    const oneWeekAgo = now - 604800000; // 7 days
    let cleaned = 0;

    // Clean up old sessions
    for (const [sessionId, session] of this.analytics.sessions) {
      if (session.lastActivity < oneWeekAgo) {
        this.analytics.sessions.delete(sessionId);
        cleaned++;
      }
    }

    // Clean up old tool usage data
    for (const [toolName, stats] of this.analytics.toolUsage) {
      const initialLength = stats.recentCalls.length;
      stats.recentCalls = stats.recentCalls.filter(call => call.timestamp > oneWeekAgo);
      cleaned += initialLength - stats.recentCalls.length;
    }

    if (cleaned > 0) {
      logger.debug(`🍌 Cleaned up ${cleaned} old MCP analytics records`);
    }
  }

  /**
   * Export analytics data
   */
  exportAnalytics() {
    return {
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      realTimeMetrics: this.realTimeMetrics,
      toolUsage: this.analyzeToolPopularity(),
      performance: this.analyzePerformance(),
      userBehavior: this.analyzeUserBehavior(),
      clientBehavior: this.analyzeClientBehavior(),
      insights: this.generateInsights(),
      aggregatedData: {
        daily: Array.from(this.aggregatedData.daily.entries()).slice(-1440), // Last 24 hours
        weekly: Array.from(this.aggregatedData.weekly.entries()).slice(-168), // Last week
        monthly: Array.from(this.aggregatedData.monthly.entries()).slice(-720) // Last month
      }
    };
  }

  /**
   * Get dashboard data
   */
  getDashboardData() {
    const insights = this.generateInsights();
    
    return {
      overview: {
        totalToolCalls: insights.performanceInsights.totalCalls,
        averageResponseTime: insights.performanceInsights.averageResponseTime,
        errorRate: insights.performanceInsights.errorRate,
        activeClients: insights.clientInsights.activeClients,
        currentSessions: this.realTimeMetrics.currentSessions
      },
      topTools: insights.toolPopularity.slice(0, 10),
      performance: {
        throughput: this.realTimeMetrics.toolCallsPerMinute,
        responseTime: insights.performanceInsights.averageResponseTime,
        errorRate: insights.performanceInsights.errorRate
      },
      recommendations: insights.recommendations,
      realTime: this.realTimeMetrics
    };
  }

  /**
   * Stop analytics collection
   */
  stop() {
    this.intervalCollectors.forEach(interval => clearInterval(interval));
    this.intervalCollectors = [];
    logger.info('🍌 MCP Analytics System stopped');
  }
}

module.exports = MCPAnalytics;