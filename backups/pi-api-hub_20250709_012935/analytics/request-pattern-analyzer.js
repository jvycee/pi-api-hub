const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

/**
 * 🍌 BANANA-POWERED REQUEST PATTERN ANALYZER 🍌
 * Advanced analytics engine for request pattern analysis and insights
 */
class RequestPatternAnalyzer {
  constructor(options = {}) {
    this.maxHistorySize = options.maxHistorySize || 10000;
    this.analysisWindow = options.analysisWindow || 5 * 60 * 1000; // 5 minutes
    this.cleanupInterval = options.cleanupInterval || 60 * 1000; // 1 minute
    
    // Data storage
    this.requestHistory = [];
    this.patternCache = new Map();
    this.performanceMetrics = new Map();
    this.anomalyThresholds = new Map();
    
    // Pattern detection settings
    this.patterns = {
      burst: { threshold: 10, timeWindow: 1000 }, // 10 requests in 1 second
      slowEndpoints: { threshold: 1000 }, // > 1 second response time
      errorSpikes: { threshold: 0.1, timeWindow: 60000 }, // 10% error rate in 1 minute
      hotPaths: { minRequests: 5, timeWindow: 300000 }, // 5+ requests in 5 minutes
      userBehavior: { sessionTimeout: 30 * 60 * 1000 } // 30 minute sessions
    };
    
    // Start cleanup timer
    this.startCleanupTimer();
    
    logger.info('🍌 Request Pattern Analyzer initialized', {
      maxHistorySize: this.maxHistorySize,
      analysisWindow: this.analysisWindow
    });
  }

  /**
   * Record a request for pattern analysis
   */
  recordRequest(request) {
    const timestamp = Date.now();
    const requestData = {
      timestamp,
      method: request.method,
      path: request.path,
      ip: request.ip,
      userAgent: request.get('User-Agent'),
      responseTime: request.responseTime || 0,
      statusCode: request.statusCode || 200,
      contentLength: request.contentLength || 0,
      query: Object.keys(request.query || {}).length,
      headers: Object.keys(request.headers || {}).length
    };

    // Add to history
    this.requestHistory.push(requestData);
    
    // Maintain size limit
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }

    // Update performance metrics
    this.updatePerformanceMetrics(requestData);
    
    // Real-time pattern detection
    this.detectRealTimePatterns(requestData);
  }

  /**
   * Update performance metrics for quick access
   */
  updatePerformanceMetrics(request) {
    const key = `${request.method}:${request.path}`;
    
    if (!this.performanceMetrics.has(key)) {
      this.performanceMetrics.set(key, {
        count: 0,
        totalResponseTime: 0,
        avgResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        errorCount: 0,
        lastAccess: Date.now()
      });
    }

    const metrics = this.performanceMetrics.get(key);
    metrics.count++;
    metrics.totalResponseTime += request.responseTime;
    metrics.avgResponseTime = metrics.totalResponseTime / metrics.count;
    metrics.minResponseTime = Math.min(metrics.minResponseTime, request.responseTime);
    metrics.maxResponseTime = Math.max(metrics.maxResponseTime, request.responseTime);
    metrics.lastAccess = Date.now();
    
    if (request.statusCode >= 400) {
      metrics.errorCount++;
    }
  }

  /**
   * Detect real-time patterns as requests come in
   */
  detectRealTimePatterns(request) {
    const now = Date.now();
    
    // Burst detection
    const recentRequests = this.requestHistory.filter(
      r => now - r.timestamp < this.patterns.burst.timeWindow
    );
    
    if (recentRequests.length > this.patterns.burst.threshold) {
      this.triggerAlert('burst_detected', {
        requestCount: recentRequests.length,
        timeWindow: this.patterns.burst.timeWindow,
        sources: [...new Set(recentRequests.map(r => r.ip))]
      });
    }

    // Slow response detection
    if (request.responseTime > this.patterns.slowEndpoints.threshold) {
      this.triggerAlert('slow_response', {
        path: request.path,
        responseTime: request.responseTime,
        threshold: this.patterns.slowEndpoints.threshold
      });
    }
  }

  /**
   * Analyze request patterns and generate insights
   */
  analyzePatterns() {
    const now = Date.now();
    const windowStart = now - this.analysisWindow;
    const windowRequests = this.requestHistory.filter(r => r.timestamp >= windowStart);

    if (windowRequests.length === 0) {
      return this.getEmptyAnalysis();
    }

    const analysis = {
      timeWindow: {
        start: new Date(windowStart).toISOString(),
        end: new Date(now).toISOString(),
        durationMs: this.analysisWindow
      },
      totalRequests: windowRequests.length,
      requestsPerSecond: windowRequests.length / (this.analysisWindow / 1000),
      patterns: {},
      insights: [],
      recommendations: []
    };

    // Analyze different patterns
    analysis.patterns.hotPaths = this.analyzeHotPaths(windowRequests);
    analysis.patterns.errorPatterns = this.analyzeErrorPatterns(windowRequests);
    analysis.patterns.userBehavior = this.analyzeUserBehavior(windowRequests);
    analysis.patterns.responseTimeDistribution = this.analyzeResponseTimes(windowRequests);
    analysis.patterns.trafficPatterns = this.analyzeTrafficPatterns(windowRequests);

    // Generate insights
    analysis.insights = this.generateInsights(analysis.patterns);
    
    // Generate recommendations
    analysis.recommendations = this.generateRecommendations(analysis.patterns);

    // Cache the analysis
    this.patternCache.set('latest', analysis);
    
    return analysis;
  }

  /**
   * Analyze hot paths (most requested endpoints)
   */
  analyzeHotPaths(requests) {
    const pathCounts = new Map();
    const pathResponseTimes = new Map();

    requests.forEach(request => {
      const path = request.path;
      pathCounts.set(path, (pathCounts.get(path) || 0) + 1);
      
      if (!pathResponseTimes.has(path)) {
        pathResponseTimes.set(path, []);
      }
      pathResponseTimes.get(path).push(request.responseTime);
    });

    const hotPaths = Array.from(pathCounts.entries())
      .filter(([_, count]) => count >= this.patterns.hotPaths.minRequests)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => {
        const responseTimes = pathResponseTimes.get(path);
        return {
          path,
          requestCount: count,
          percentage: (count / requests.length * 100).toFixed(2),
          avgResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
          minResponseTime: Math.min(...responseTimes),
          maxResponseTime: Math.max(...responseTimes)
        };
      });

    return {
      topPaths: hotPaths,
      totalUniquePaths: pathCounts.size,
      concentrationRatio: hotPaths.length > 0 ? hotPaths[0].requestCount / requests.length : 0
    };
  }

  /**
   * Analyze error patterns
   */
  analyzeErrorPatterns(requests) {
    const errorRequests = requests.filter(r => r.statusCode >= 400);
    const errorsByPath = new Map();
    const errorsByStatus = new Map();

    errorRequests.forEach(request => {
      const path = request.path;
      const status = request.statusCode;
      
      errorsByPath.set(path, (errorsByPath.get(path) || 0) + 1);
      errorsByStatus.set(status, (errorsByStatus.get(status) || 0) + 1);
    });

    const errorRate = errorRequests.length / requests.length;
    const isErrorSpike = errorRate > this.patterns.errorSpikes.threshold;

    return {
      totalErrors: errorRequests.length,
      errorRate: errorRate,
      isErrorSpike,
      errorsByPath: Array.from(errorsByPath.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([path, count]) => ({ path, count, rate: count / requests.length })),
      errorsByStatus: Array.from(errorsByStatus.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([status, count]) => ({ status, count, rate: count / requests.length }))
    };
  }

  /**
   * Analyze user behavior patterns
   */
  analyzeUserBehavior(requests) {
    const userSessions = new Map();
    const userAgents = new Map();
    const ipCounts = new Map();

    requests.forEach(request => {
      const ip = request.ip;
      const userAgent = request.userAgent;
      
      // Track IP activity
      if (!userSessions.has(ip)) {
        userSessions.set(ip, []);
      }
      userSessions.get(ip).push(request);
      
      // Track user agents
      userAgents.set(userAgent, (userAgents.get(userAgent) || 0) + 1);
      
      // Track IP request counts
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    });

    const uniqueIPs = userSessions.size;
    const avgRequestsPerIP = requests.length / uniqueIPs;
    const topUserAgents = Array.from(userAgents.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agent, count]) => ({ agent, count, percentage: (count / requests.length * 100).toFixed(2) }));

    const suspiciousIPs = Array.from(ipCounts.entries())
      .filter(([_, count]) => count > avgRequestsPerIP * 5) // 5x average
      .sort((a, b) => b[1] - a[1])
      .map(([ip, count]) => ({ ip, count, ratio: count / avgRequestsPerIP }));

    return {
      uniqueIPs,
      avgRequestsPerIP,
      topUserAgents,
      suspiciousIPs,
      botDetection: this.detectBots(requests)
    };
  }

  /**
   * Analyze response time distribution
   */
  analyzeResponseTimes(requests) {
    const responseTimes = requests.map(r => r.responseTime);
    const sorted = responseTimes.sort((a, b) => a - b);
    
    const percentiles = {
      p50: this.calculatePercentile(sorted, 0.5),
      p90: this.calculatePercentile(sorted, 0.9),
      p95: this.calculatePercentile(sorted, 0.95),
      p99: this.calculatePercentile(sorted, 0.99)
    };

    return {
      min: Math.min(...responseTimes),
      max: Math.max(...responseTimes),
      avg: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      median: percentiles.p50,
      percentiles,
      distribution: this.createResponseTimeDistribution(responseTimes)
    };
  }

  /**
   * Analyze traffic patterns over time
   */
  analyzeTrafficPatterns(requests) {
    const now = Date.now();
    const intervals = 12; // 12 intervals in the analysis window
    const intervalSize = this.analysisWindow / intervals;
    
    const trafficByInterval = new Array(intervals).fill(0);
    
    requests.forEach(request => {
      const intervalIndex = Math.floor((now - request.timestamp) / intervalSize);
      if (intervalIndex >= 0 && intervalIndex < intervals) {
        trafficByInterval[intervals - 1 - intervalIndex]++;
      }
    });

    const avgTraffic = trafficByInterval.reduce((a, b) => a + b, 0) / intervals;
    const peakTraffic = Math.max(...trafficByInterval);
    const variability = this.calculateVariability(trafficByInterval);

    return {
      intervalSize,
      intervals: trafficByInterval.map((count, index) => ({
        index,
        timestamp: new Date(now - (intervals - index) * intervalSize).toISOString(),
        requestCount: count
      })),
      avgTraffic,
      peakTraffic,
      variability,
      trend: this.calculateTrend(trafficByInterval)
    };
  }

  /**
   * Generate insights from pattern analysis
   */
  generateInsights(patterns) {
    const insights = [];

    // Hot path insights
    if (patterns.hotPaths.topPaths.length > 0) {
      const topPath = patterns.hotPaths.topPaths[0];
      insights.push({
        type: 'hot_path',
        severity: 'info',
        message: `Top endpoint: ${topPath.path} (${topPath.percentage}% of traffic)`,
        data: topPath
      });
    }

    // Performance insights
    if (patterns.responseTimeDistribution.percentiles.p95 > 1000) {
      insights.push({
        type: 'performance',
        severity: 'warning',
        message: `95th percentile response time is ${patterns.responseTimeDistribution.percentiles.p95}ms`,
        data: patterns.responseTimeDistribution
      });
    }

    // Error insights
    if (patterns.errorPatterns.isErrorSpike) {
      insights.push({
        type: 'error_spike',
        severity: 'critical',
        message: `Error rate spike detected: ${(patterns.errorPatterns.errorRate * 100).toFixed(2)}%`,
        data: patterns.errorPatterns
      });
    }

    // Traffic insights
    if (patterns.trafficPatterns.variability > 0.5) {
      insights.push({
        type: 'traffic_volatility',
        severity: 'warning',
        message: `High traffic variability detected (${patterns.trafficPatterns.variability.toFixed(2)})`,
        data: patterns.trafficPatterns
      });
    }

    return insights;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(patterns) {
    const recommendations = [];

    // Caching recommendations
    if (patterns.hotPaths.topPaths.length > 0) {
      const cacheCandidates = patterns.hotPaths.topPaths.filter(p => p.path.includes('GET'));
      if (cacheCandidates.length > 0) {
        recommendations.push({
          type: 'caching',
          priority: 'high',
          message: 'Consider implementing caching for frequently accessed GET endpoints',
          endpoints: cacheCandidates.map(c => c.path)
        });
      }
    }

    // Performance optimization
    const slowEndpoints = patterns.hotPaths.topPaths.filter(p => p.avgResponseTime > 500);
    if (slowEndpoints.length > 0) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Optimize slow endpoints to improve user experience',
        endpoints: slowEndpoints.map(e => ({ path: e.path, avgTime: e.avgResponseTime }))
      });
    }

    // Scaling recommendations
    if (patterns.trafficPatterns.peakTraffic > patterns.trafficPatterns.avgTraffic * 2) {
      recommendations.push({
        type: 'scaling',
        priority: 'medium',
        message: 'Consider auto-scaling based on traffic patterns',
        data: {
          avgTraffic: patterns.trafficPatterns.avgTraffic,
          peakTraffic: patterns.trafficPatterns.peakTraffic
        }
      });
    }

    return recommendations;
  }

  /**
   * Helper methods
   */
  calculatePercentile(sorted, percentile) {
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[index] || 0;
  }

  calculateVariability(values) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    return Math.sqrt(variance) / avg;
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    if (secondAvg > firstAvg * 1.2) return 'increasing';
    if (secondAvg < firstAvg * 0.8) return 'decreasing';
    return 'stable';
  }

  createResponseTimeDistribution(responseTimes) {
    const buckets = [0, 50, 100, 250, 500, 1000, 2500, 5000, Infinity];
    const distribution = new Array(buckets.length - 1).fill(0);
    
    responseTimes.forEach(time => {
      for (let i = 0; i < buckets.length - 1; i++) {
        if (time >= buckets[i] && time < buckets[i + 1]) {
          distribution[i]++;
          break;
        }
      }
    });
    
    return distribution.map((count, index) => ({
      range: `${buckets[index]}-${buckets[index + 1] === Infinity ? '∞' : buckets[index + 1]}ms`,
      count,
      percentage: (count / responseTimes.length * 100).toFixed(2)
    }));
  }

  detectBots(requests) {
    const botUserAgents = [
      'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python', 'java', 'postman'
    ];
    
    const botRequests = requests.filter(r => 
      botUserAgents.some(bot => r.userAgent.toLowerCase().includes(bot))
    );
    
    return {
      totalBotRequests: botRequests.length,
      botPercentage: (botRequests.length / requests.length * 100).toFixed(2),
      detectedBots: [...new Set(botRequests.map(r => r.userAgent))]
    };
  }

  triggerAlert(type, data) {
    logger.warn(`🚨 Pattern Alert: ${type}`, data);
    // Could extend to send notifications, webhooks, etc.
  }

  getEmptyAnalysis() {
    return {
      timeWindow: {
        start: new Date(Date.now() - this.analysisWindow).toISOString(),
        end: new Date().toISOString(),
        durationMs: this.analysisWindow
      },
      totalRequests: 0,
      requestsPerSecond: 0,
      patterns: {},
      insights: [],
      recommendations: []
    };
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics() {
    return Array.from(this.performanceMetrics.entries()).map(([endpoint, metrics]) => ({
      endpoint,
      ...metrics,
      errorRate: metrics.errorCount / metrics.count
    }));
  }

  /**
   * Get real-time statistics
   */
  getRealTimeStats() {
    const now = Date.now();
    const last5min = this.requestHistory.filter(r => now - r.timestamp < 5 * 60 * 1000);
    
    return {
      totalRequests: this.requestHistory.length,
      last5minRequests: last5min.length,
      currentRPS: last5min.length / (5 * 60),
      uniqueIPs: new Set(last5min.map(r => r.ip)).size,
      avgResponseTime: last5min.reduce((sum, r) => sum + r.responseTime, 0) / last5min.length || 0
    };
  }

  /**
   * Cleanup old data
   */
  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      const cutoff = now - (this.analysisWindow * 2); // Keep 2x analysis window
      
      // Clean request history
      this.requestHistory = this.requestHistory.filter(r => r.timestamp > cutoff);
      
      // Clean performance metrics
      for (const [key, metrics] of this.performanceMetrics) {
        if (now - metrics.lastAccess > this.analysisWindow) {
          this.performanceMetrics.delete(key);
        }
      }
      
      // Clean pattern cache
      this.patternCache.clear();
      
      logger.debug('🧹 Analytics cleanup completed', {
        requestHistorySize: this.requestHistory.length,
        performanceMetricsSize: this.performanceMetrics.size
      });
    }, this.cleanupInterval);
  }
}

module.exports = RequestPatternAnalyzer;