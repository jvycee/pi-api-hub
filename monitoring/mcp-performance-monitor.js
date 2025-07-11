const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

/**
 * 🍌 BANANA-POWERED MCP PERFORMANCE MONITOR 🍌
 * 
 * Monitors MCP server performance, tool usage, and client connections
 */
class MCPPerformanceMonitor {
  constructor() {
    this.metrics = {
      toolCalls: new Map(),
      clientConnections: new Map(),
      errors: new Map(),
      performance: {
        responseTime: [],
        throughput: [],
        errorRate: []
      }
    };

    this.startTime = Date.now();
    this.intervalCollectors = [];
    
    // Start performance collection
    this.startPerformanceCollection();
    
    logger.info('🍌 MCP Performance Monitor initialized');
  }

  /**
   * Start performance data collection
   */
  startPerformanceCollection() {
    // Collect performance metrics every 30 seconds
    const performanceInterval = setInterval(() => {
      this.collectPerformanceMetrics();
    }, 30000);

    // Collect throughput metrics every minute
    const throughputInterval = setInterval(() => {
      this.collectThroughputMetrics();
    }, 60000);

    // Clean up old metrics every 5 minutes
    const cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 300000);

    this.intervalCollectors = [performanceInterval, throughputInterval, cleanupInterval];
  }

  /**
   * Track tool call execution
   */
  trackToolCall(toolName, clientId, executionTime, success = true, error = null) {
    const timestamp = Date.now();
    
    // Track tool calls
    if (!this.metrics.toolCalls.has(toolName)) {
      this.metrics.toolCalls.set(toolName, {
        count: 0,
        totalTime: 0,
        successCount: 0,
        errorCount: 0,
        avgResponseTime: 0,
        recentCalls: []
      });
    }

    const toolMetrics = this.metrics.toolCalls.get(toolName);
    toolMetrics.count++;
    toolMetrics.totalTime += executionTime;
    toolMetrics.avgResponseTime = toolMetrics.totalTime / toolMetrics.count;

    if (success) {
      toolMetrics.successCount++;
    } else {
      toolMetrics.errorCount++;
      this.trackError(toolName, error);
    }

    // Track recent calls (last 100)
    toolMetrics.recentCalls.push({
      timestamp,
      clientId,
      executionTime,
      success,
      error: error ? error.message : null
    });

    if (toolMetrics.recentCalls.length > 100) {
      toolMetrics.recentCalls.shift();
    }

    // Track client connections
    this.trackClientActivity(clientId, toolName, executionTime, success);

    // Log performance issues
    if (executionTime > 5000) {
      logger.warn(`🍌 Slow MCP tool call detected: ${toolName} took ${executionTime}ms`, {
        toolName,
        clientId,
        executionTime
      });
    }
  }

  /**
   * Track client activity
   */
  trackClientActivity(clientId, toolName, executionTime, success) {
    if (!this.metrics.clientConnections.has(clientId)) {
      this.metrics.clientConnections.set(clientId, {
        firstSeen: Date.now(),
        lastActivity: Date.now(),
        toolCalls: 0,
        totalTime: 0,
        successfulCalls: 0,
        failedCalls: 0,
        tools: new Set()
      });
    }

    const clientMetrics = this.metrics.clientConnections.get(clientId);
    clientMetrics.lastActivity = Date.now();
    clientMetrics.toolCalls++;
    clientMetrics.totalTime += executionTime;
    clientMetrics.tools.add(toolName);

    if (success) {
      clientMetrics.successfulCalls++;
    } else {
      clientMetrics.failedCalls++;
    }
  }

  /**
   * Track errors
   */
  trackError(context, error) {
    const errorKey = `${context}:${error?.name || 'Unknown'}`;
    
    if (!this.metrics.errors.has(errorKey)) {
      this.metrics.errors.set(errorKey, {
        count: 0,
        firstOccurrence: Date.now(),
        lastOccurrence: Date.now(),
        message: error?.message || 'Unknown error',
        stack: error?.stack || null
      });
    }

    const errorMetrics = this.metrics.errors.get(errorKey);
    errorMetrics.count++;
    errorMetrics.lastOccurrence = Date.now();

    logger.error(`🍌 MCP Error tracked: ${errorKey}`, {
      context,
      error: error?.message,
      count: errorMetrics.count
    });
  }

  /**
   * Collect performance metrics
   */
  collectPerformanceMetrics() {
    const now = Date.now();
    const recentCalls = this.getRecentToolCalls(60000); // Last minute
    
    if (recentCalls.length === 0) return;

    // Calculate average response time
    const avgResponseTime = recentCalls.reduce((sum, call) => sum + call.executionTime, 0) / recentCalls.length;
    
    // Calculate error rate
    const errorCount = recentCalls.filter(call => !call.success).length;
    const errorRate = (errorCount / recentCalls.length) * 100;

    // Store metrics
    this.metrics.performance.responseTime.push({
      timestamp: now,
      value: avgResponseTime
    });

    this.metrics.performance.errorRate.push({
      timestamp: now,
      value: errorRate
    });

    // Alert on high error rate
    if (errorRate > 10) {
      logger.warn(`🍌 High MCP error rate detected: ${errorRate.toFixed(1)}%`, {
        errorRate,
        recentCalls: recentCalls.length
      });
    }
  }

  /**
   * Collect throughput metrics
   */
  collectThroughputMetrics() {
    const now = Date.now();
    const recentCalls = this.getRecentToolCalls(60000); // Last minute
    
    const throughput = recentCalls.length; // Calls per minute

    this.metrics.performance.throughput.push({
      timestamp: now,
      value: throughput
    });

    logger.debug(`🍌 MCP Throughput: ${throughput} calls/minute`);
  }

  /**
   * Get recent tool calls
   */
  getRecentToolCalls(timeWindow = 60000) {
    const cutoff = Date.now() - timeWindow;
    const recentCalls = [];

    for (const [toolName, metrics] of this.metrics.toolCalls) {
      const toolRecentCalls = metrics.recentCalls.filter(call => call.timestamp > cutoff);
      recentCalls.push(...toolRecentCalls);
    }

    return recentCalls;
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const cutoff = Date.now() - 86400000; // 24 hours
    let cleaned = 0;

    // Clean up performance metrics
    ['responseTime', 'throughput', 'errorRate'].forEach(metricType => {
      const initialLength = this.metrics.performance[metricType].length;
      this.metrics.performance[metricType] = this.metrics.performance[metricType]
        .filter(metric => metric.timestamp > cutoff);
      cleaned += initialLength - this.metrics.performance[metricType].length;
    });

    // Clean up inactive clients
    for (const [clientId, metrics] of this.metrics.clientConnections) {
      if (metrics.lastActivity < cutoff) {
        this.metrics.clientConnections.delete(clientId);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`🍌 Cleaned up ${cleaned} old MCP metrics`);
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats() {
    const now = Date.now();
    const uptime = now - this.startTime;

    // Calculate tool statistics
    const toolStats = {};
    for (const [toolName, metrics] of this.metrics.toolCalls) {
      toolStats[toolName] = {
        totalCalls: metrics.count,
        successRate: metrics.count > 0 ? (metrics.successCount / metrics.count) * 100 : 0,
        avgResponseTime: metrics.avgResponseTime,
        errorCount: metrics.errorCount,
        lastUsed: metrics.recentCalls.length > 0 ? 
          Math.max(...metrics.recentCalls.map(c => c.timestamp)) : null
      };
    }

    // Calculate client statistics
    const clientStats = {};
    for (const [clientId, metrics] of this.metrics.clientConnections) {
      clientStats[clientId] = {
        firstSeen: metrics.firstSeen,
        lastActivity: metrics.lastActivity,
        totalCalls: metrics.toolCalls,
        successRate: metrics.toolCalls > 0 ? 
          (metrics.successfulCalls / metrics.toolCalls) * 100 : 0,
        avgResponseTime: metrics.toolCalls > 0 ? 
          metrics.totalTime / metrics.toolCalls : 0,
        uniqueTools: metrics.tools.size
      };
    }

    // Calculate recent performance
    const recentCalls = this.getRecentToolCalls(300000); // Last 5 minutes
    const recentPerformance = {
      callsPerMinute: recentCalls.length / 5,
      avgResponseTime: recentCalls.length > 0 ? 
        recentCalls.reduce((sum, call) => sum + call.executionTime, 0) / recentCalls.length : 0,
      errorRate: recentCalls.length > 0 ? 
        (recentCalls.filter(call => !call.success).length / recentCalls.length) * 100 : 0
    };

    return {
      uptime,
      startTime: this.startTime,
      tools: toolStats,
      clients: clientStats,
      recent: recentPerformance,
      errors: this.getErrorSummary(),
      performance: {
        responseTime: this.metrics.performance.responseTime.slice(-100), // Last 100 points
        throughput: this.metrics.performance.throughput.slice(-100),
        errorRate: this.metrics.performance.errorRate.slice(-100)
      }
    };
  }

  /**
   * Get error summary
   */
  getErrorSummary() {
    const errors = [];
    
    for (const [errorKey, metrics] of this.metrics.errors) {
      errors.push({
        key: errorKey,
        count: metrics.count,
        firstOccurrence: metrics.firstOccurrence,
        lastOccurrence: metrics.lastOccurrence,
        message: metrics.message
      });
    }

    return errors.sort((a, b) => b.count - a.count);
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const recentCalls = this.getRecentToolCalls(300000); // Last 5 minutes
    const errorRate = recentCalls.length > 0 ? 
      (recentCalls.filter(call => !call.success).length / recentCalls.length) * 100 : 0;

    const avgResponseTime = recentCalls.length > 0 ? 
      recentCalls.reduce((sum, call) => sum + call.executionTime, 0) / recentCalls.length : 0;

    let healthStatus = 'healthy';
    const issues = [];

    if (errorRate > 10) {
      healthStatus = 'degraded';
      issues.push(`High error rate: ${errorRate.toFixed(1)}%`);
    }

    if (avgResponseTime > 3000) {
      healthStatus = 'degraded';
      issues.push(`Slow response time: ${avgResponseTime.toFixed(0)}ms`);
    }

    if (errorRate > 25) {
      healthStatus = 'unhealthy';
    }

    if (avgResponseTime > 10000) {
      healthStatus = 'unhealthy';
    }

    return {
      status: healthStatus,
      issues,
      metrics: {
        errorRate,
        avgResponseTime,
        callsPerMinute: recentCalls.length / 5,
        activeClients: this.getActiveClientCount()
      }
    };
  }

  /**
   * Get active client count
   */
  getActiveClientCount() {
    const fiveMinutesAgo = Date.now() - 300000;
    let activeClients = 0;

    for (const [clientId, metrics] of this.metrics.clientConnections) {
      if (metrics.lastActivity > fiveMinutesAgo) {
        activeClients++;
      }
    }

    return activeClients;
  }

  /**
   * Get tool usage analytics
   */
  getToolUsageAnalytics() {
    const analytics = {
      totalCalls: 0,
      totalTools: this.metrics.toolCalls.size,
      toolPopularity: [],
      performanceLeaderboard: [],
      errorAnalysis: []
    };

    // Calculate tool popularity and performance
    for (const [toolName, metrics] of this.metrics.toolCalls) {
      analytics.totalCalls += metrics.count;
      
      analytics.toolPopularity.push({
        name: toolName,
        calls: metrics.count,
        percentage: 0 // Will be calculated after total
      });

      analytics.performanceLeaderboard.push({
        name: toolName,
        avgResponseTime: metrics.avgResponseTime,
        successRate: metrics.count > 0 ? (metrics.successCount / metrics.count) * 100 : 0
      });

      if (metrics.errorCount > 0) {
        analytics.errorAnalysis.push({
          name: toolName,
          errorCount: metrics.errorCount,
          errorRate: (metrics.errorCount / metrics.count) * 100
        });
      }
    }

    // Calculate percentages
    analytics.toolPopularity.forEach(tool => {
      tool.percentage = analytics.totalCalls > 0 ? 
        (tool.calls / analytics.totalCalls) * 100 : 0;
    });

    // Sort arrays
    analytics.toolPopularity.sort((a, b) => b.calls - a.calls);
    analytics.performanceLeaderboard.sort((a, b) => a.avgResponseTime - b.avgResponseTime);
    analytics.errorAnalysis.sort((a, b) => b.errorRate - a.errorRate);

    return analytics;
  }

  /**
   * Export metrics for external monitoring
   */
  exportMetrics() {
    return {
      timestamp: Date.now(),
      mcp: {
        performance: this.getPerformanceStats(),
        health: this.getHealthStatus(),
        analytics: this.getToolUsageAnalytics()
      }
    };
  }

  /**
   * Stop performance monitoring
   */
  stop() {
    this.intervalCollectors.forEach(interval => clearInterval(interval));
    this.intervalCollectors = [];
    logger.info('🍌 MCP Performance Monitor stopped');
  }
}

module.exports = MCPPerformanceMonitor;