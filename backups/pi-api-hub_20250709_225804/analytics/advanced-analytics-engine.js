const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

/**
 * 🍌 ADVANCED ANALYTICS ENGINE 🍌
 * Enhanced analytics with real-time pattern analysis, historical trends, and performance degradation detection
 */
class AdvancedAnalyticsEngine {
  constructor(analyticsMiddleware, aiHandler, options = {}) {
    this.analytics = analyticsMiddleware;
    this.aiHandler = aiHandler;
    
    // Configuration
    this.historicalDataRetention = options.historicalDataRetention || 24 * 60 * 60 * 1000; // 24 hours
    this.trendAnalysisWindow = options.trendAnalysisWindow || 60 * 60 * 1000; // 1 hour
    this.degradationThreshold = options.degradationThreshold || 0.25; // 25% degradation
    this.anomalyDetectionSensitivity = options.anomalyDetectionSensitivity || 0.8;
    this.realTimeUpdateInterval = options.realTimeUpdateInterval || 30000; // 30 seconds
    
    // Data storage
    this.historicalMetrics = new Map();
    this.trendData = new Map();
    this.performanceBaselines = new Map();
    this.degradationAlerts = [];
    this.anomalies = [];
    
    // Analysis state
    this.lastHistoricalAnalysis = null;
    this.lastTrendAnalysis = null;
    this.lastDegradationCheck = null;
    this.realTimeAnalysisRunning = false;
    
    // Statistics
    this.stats = {
      historicalAnalyses: 0,
      trendAnalyses: 0,
      degradationDetections: 0,
      anomaliesDetected: 0,
      lastAnalysisTime: null,
      dataPointsStored: 0
    };
    
    this.initializeEngine();
    
    logger.info('🍌 Advanced Analytics Engine initialized', {
      historicalDataRetention: this.historicalDataRetention,
      trendAnalysisWindow: this.trendAnalysisWindow,
      degradationThreshold: this.degradationThreshold,
      realTimeUpdateInterval: this.realTimeUpdateInterval
    });
  }

  /**
   * Initialize the analytics engine
   */
  initializeEngine() {
    // Start real-time analysis
    this.startRealTimeAnalysis();
    
    // Start periodic historical data collection
    this.startHistoricalDataCollection();
    
    // Start trend analysis
    this.startTrendAnalysis();
    
    // Start performance degradation monitoring
    this.startDegradationMonitoring();
    
    // Cleanup old data periodically
    this.startDataCleanup();
  }

  /**
   * Start real-time analysis updates
   */
  startRealTimeAnalysis() {
    if (this.realTimeAnalysisRunning) return;
    
    this.realTimeAnalysisRunning = true;
    
    setInterval(() => {
      try {
        this.performRealTimeAnalysis();
      } catch (error) {
        logger.error('Real-time analysis error:', error);
      }
    }, this.realTimeUpdateInterval);
    
    logger.info('🔄 Real-time analysis started');
  }

  /**
   * Perform real-time analysis
   */
  performRealTimeAnalysis() {
    const startTime = performance.now();
    
    // Get current analytics data
    const currentAnalysis = this.analytics.getAnalysis();
    const realTimeStats = this.analytics.getRealTimeStats();
    const performanceMetrics = this.analytics.getPerformanceMetrics();
    
    // Store current data point
    const timestamp = Date.now();
    const dataPoint = {
      timestamp,
      analysis: currentAnalysis,
      realTimeStats,
      performanceMetrics: performanceMetrics.slice(0, 10), // Top 10 endpoints
      metadata: {
        totalRequests: currentAnalysis.totalRequests,
        requestsPerSecond: currentAnalysis.requestsPerSecond,
        avgResponseTime: currentAnalysis.patterns?.responseTimeDistribution?.avg || 0,
        errorRate: currentAnalysis.patterns?.errorPatterns?.errorRate || 0,
        uniqueIPs: currentAnalysis.patterns?.userBehavior?.uniqueIPs || 0
      }
    };
    
    // Store in historical metrics
    if (!this.historicalMetrics.has('realtime')) {
      this.historicalMetrics.set('realtime', []);
    }
    
    const realtimeData = this.historicalMetrics.get('realtime');
    realtimeData.push(dataPoint);
    
    // Keep only recent data
    const cutoffTime = timestamp - this.historicalDataRetention;
    this.historicalMetrics.set('realtime', 
      realtimeData.filter(point => point.timestamp > cutoffTime)
    );
    
    this.stats.dataPointsStored++;
    this.stats.lastAnalysisTime = timestamp;
    
    const analysisTime = performance.now() - startTime;
    
    if (analysisTime > 100) { // Log if analysis takes longer than 100ms
      logger.warn('Real-time analysis taking longer than expected', {
        analysisTime: `${analysisTime.toFixed(2)}ms`,
        dataPoints: realtimeData.length
      });
    }
  }

  /**
   * Start historical data collection
   */
  startHistoricalDataCollection() {
    // Collect detailed historical snapshots every 5 minutes
    setInterval(() => {
      try {
        this.collectHistoricalSnapshot();
      } catch (error) {
        logger.error('Historical data collection error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    logger.info('📊 Historical data collection started');
  }

  /**
   * Collect detailed historical snapshot
   */
  collectHistoricalSnapshot() {
    const timestamp = Date.now();
    const snapshot = {
      timestamp,
      detailedAnalysis: this.analytics.getDetailedAnalytics(),
      templateStats: this.analytics.getTemplateStats(),
      performanceBaselines: this.analytics.getPerformanceBaselines(),
      aiInsights: this.getAIInsightsSummary()
    };
    
    if (!this.historicalMetrics.has('snapshots')) {
      this.historicalMetrics.set('snapshots', []);
    }
    
    const snapshots = this.historicalMetrics.get('snapshots');
    snapshots.push(snapshot);
    
    // Keep only recent snapshots
    const cutoffTime = timestamp - this.historicalDataRetention;
    this.historicalMetrics.set('snapshots', 
      snapshots.filter(snap => snap.timestamp > cutoffTime)
    );
    
    this.stats.historicalAnalyses++;
    
    logger.info('📸 Historical snapshot collected', {
      snapshotCount: snapshots.length,
      timestamp: new Date(timestamp).toISOString()
    });
  }

  /**
   * Start trend analysis
   */
  startTrendAnalysis() {
    // Analyze trends every 10 minutes
    setInterval(() => {
      try {
        this.analyzeTrends();
      } catch (error) {
        logger.error('Trend analysis error:', error);
      }
    }, 10 * 60 * 1000); // 10 minutes
    
    logger.info('📈 Trend analysis started');
  }

  /**
   * Analyze performance and usage trends
   */
  analyzeTrends() {
    const realtimeData = this.historicalMetrics.get('realtime') || [];
    if (realtimeData.length < 10) {
      logger.info('Insufficient data for trend analysis');
      return;
    }
    
    const now = Date.now();
    const windowStart = now - this.trendAnalysisWindow;
    const windowData = realtimeData.filter(point => point.timestamp > windowStart);
    
    if (windowData.length < 5) {
      logger.info('Insufficient data in trend analysis window');
      return;
    }
    
    // Calculate trends
    const trends = {
      timestamp: now,
      timeWindow: this.trendAnalysisWindow,
      dataPoints: windowData.length,
      
      // Request volume trend
      requestVolume: this.calculateTrend(windowData.map(d => d.metadata.totalRequests)),
      
      // Response time trend
      responseTime: this.calculateTrend(windowData.map(d => d.metadata.avgResponseTime)),
      
      // Error rate trend
      errorRate: this.calculateTrend(windowData.map(d => d.metadata.errorRate)),
      
      // RPS trend
      requestsPerSecond: this.calculateTrend(windowData.map(d => d.metadata.requestsPerSecond)),
      
      // User activity trend
      userActivity: this.calculateTrend(windowData.map(d => d.metadata.uniqueIPs)),
      
      // Endpoint performance trends
      endpointTrends: this.analyzeEndpointTrends(windowData)
    };
    
    // Store trend analysis
    if (!this.trendData.has('trends')) {
      this.trendData.set('trends', []);
    }
    
    const trendHistory = this.trendData.get('trends');
    trendHistory.push(trends);
    
    // Keep only recent trends
    const cutoffTime = now - this.historicalDataRetention;
    this.trendData.set('trends', 
      trendHistory.filter(trend => trend.timestamp > cutoffTime)
    );
    
    this.lastTrendAnalysis = trends;
    this.stats.trendAnalyses++;
    
    // Generate insights from trends
    const trendInsights = this.generateTrendInsights(trends);
    
    logger.info('📈 Trend analysis completed', {
      requestVolumeTrend: trends.requestVolume.trend,
      responseTimeTrend: trends.responseTime.trend,
      errorRateTrend: trends.errorRate.trend,
      insights: trendInsights.length
    });
  }

  /**
   * Calculate trend for a series of values
   */
  calculateTrend(values) {
    if (values.length < 2) {
      return { trend: 'stable', change: 0, confidence: 0 };
    }
    
    // Simple linear regression
    const n = values.length;
    const xSum = (n * (n + 1)) / 2; // Sum of indices 1, 2, 3, ..., n
    const ySum = values.reduce((sum, val) => sum + val, 0);
    const xySum = values.reduce((sum, val, index) => sum + val * (index + 1), 0);
    const x2Sum = (n * (n + 1) * (2 * n + 1)) / 6; // Sum of squares
    
    const slope = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
    const intercept = (ySum - slope * xSum) / n;
    
    // Calculate correlation coefficient
    const yMean = ySum / n;
    const xMean = xSum / n;
    
    let numerator = 0;
    let denomX = 0;
    let denomY = 0;
    
    for (let i = 0; i < n; i++) {
      const x = i + 1;
      const y = values[i];
      numerator += (x - xMean) * (y - yMean);
      denomX += Math.pow(x - xMean, 2);
      denomY += Math.pow(y - yMean, 2);
    }
    
    const correlation = denomX && denomY ? numerator / Math.sqrt(denomX * denomY) : 0;
    const confidence = Math.abs(correlation);
    
    // Determine trend direction
    let trend = 'stable';
    if (Math.abs(slope) > 0.1 && confidence > 0.5) {
      trend = slope > 0 ? 'increasing' : 'decreasing';
    }
    
    // Calculate percentage change
    const firstValue = values[0] || 0;
    const lastValue = values[values.length - 1] || 0;
    const change = firstValue ? ((lastValue - firstValue) / firstValue) * 100 : 0;
    
    return {
      trend,
      change: parseFloat(change.toFixed(2)),
      confidence: parseFloat(confidence.toFixed(3)),
      slope: parseFloat(slope.toFixed(6)),
      correlation: parseFloat(correlation.toFixed(3)),
      values: {
        first: firstValue,
        last: lastValue,
        min: Math.min(...values),
        max: Math.max(...values),
        avg: parseFloat((ySum / n).toFixed(2))
      }
    };
  }

  /**
   * Analyze endpoint-specific trends
   */
  analyzeEndpointTrends(windowData) {
    const endpointData = {};
    
    // Aggregate endpoint performance data
    windowData.forEach(dataPoint => {
      if (dataPoint.performanceMetrics) {
        dataPoint.performanceMetrics.forEach(metric => {
          if (!endpointData[metric.endpoint]) {
            endpointData[metric.endpoint] = {
              responseTimes: [],
              requestCounts: [],
              errorRates: []
            };
          }
          
          endpointData[metric.endpoint].responseTimes.push(metric.avgResponseTime || 0);
          endpointData[metric.endpoint].requestCounts.push(metric.requestCount || 0);
          endpointData[metric.endpoint].errorRates.push(metric.errorRate || 0);
        });
      }
    });
    
    // Calculate trends for each endpoint
    const trends = {};
    Object.entries(endpointData).forEach(([endpoint, data]) => {
      trends[endpoint] = {
        responseTime: this.calculateTrend(data.responseTimes),
        requestCount: this.calculateTrend(data.requestCounts),
        errorRate: this.calculateTrend(data.errorRates)
      };
    });
    
    return trends;
  }

  /**
   * Generate insights from trend analysis
   */
  generateTrendInsights(trends) {
    const insights = [];
    
    // Response time insights
    if (trends.responseTime.trend === 'increasing' && trends.responseTime.confidence > 0.7) {
      insights.push({
        type: 'performance_degradation',
        severity: trends.responseTime.change > 50 ? 'critical' : 'warning',
        message: `Response times increasing by ${trends.responseTime.change.toFixed(1)}%`,
        data: trends.responseTime,
        recommendation: 'Investigate performance bottlenecks and consider optimization'
      });
    }
    
    // Error rate insights
    if (trends.errorRate.trend === 'increasing' && trends.errorRate.confidence > 0.6) {
      insights.push({
        type: 'error_rate_increase',
        severity: trends.errorRate.change > 100 ? 'critical' : 'warning',
        message: `Error rate increasing by ${trends.errorRate.change.toFixed(1)}%`,
        data: trends.errorRate,
        recommendation: 'Review error logs and fix underlying issues'
      });
    }
    
    // Traffic insights
    if (trends.requestVolume.trend === 'increasing' && trends.requestVolume.confidence > 0.8) {
      insights.push({
        type: 'traffic_growth',
        severity: 'info',
        message: `Request volume growing by ${trends.requestVolume.change.toFixed(1)}%`,
        data: trends.requestVolume,
        recommendation: 'Monitor capacity and consider scaling if growth continues'
      });
    }
    
    // User activity insights
    if (trends.userActivity.trend === 'decreasing' && trends.userActivity.confidence > 0.7) {
      insights.push({
        type: 'user_activity_decline',
        severity: 'warning',
        message: `User activity declining by ${Math.abs(trends.userActivity.change).toFixed(1)}%`,
        data: trends.userActivity,
        recommendation: 'Investigate potential service issues or user experience problems'
      });
    }
    
    return insights;
  }

  /**
   * Start performance degradation monitoring
   */
  startDegradationMonitoring() {
    // Check for degradation every 5 minutes
    setInterval(() => {
      try {
        this.checkPerformanceDegradation();
      } catch (error) {
        logger.error('Performance degradation check error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    logger.info('🚨 Performance degradation monitoring started');
  }

  /**
   * Check for performance degradation
   */
  checkPerformanceDegradation() {
    const currentMetrics = this.analytics.getPerformanceMetrics();
    const realtimeData = this.historicalMetrics.get('realtime') || [];
    
    if (realtimeData.length < 20) {
      logger.info('Insufficient data for degradation detection');
      return;
    }
    
    // Get baseline from 1 hour ago
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const baselineData = realtimeData
      .filter(point => point.timestamp < oneHourAgo)
      .slice(-10); // Last 10 points before 1 hour ago
    
    if (baselineData.length < 5) {
      logger.info('Insufficient baseline data for degradation detection');
      return;
    }
    
    // Calculate baseline metrics
    const baselineResponseTime = this.calculateAverage(
      baselineData.map(d => d.metadata.avgResponseTime)
    );
    const baselineErrorRate = this.calculateAverage(
      baselineData.map(d => d.metadata.errorRate)
    );
    
    // Get current metrics
    const recentData = realtimeData.slice(-10); // Last 10 points
    const currentResponseTime = this.calculateAverage(
      recentData.map(d => d.metadata.avgResponseTime)
    );
    const currentErrorRate = this.calculateAverage(
      recentData.map(d => d.metadata.errorRate)
    );
    
    // Check for degradation
    const degradations = [];
    
    // Response time degradation
    if (baselineResponseTime > 0) {
      const responseTimeDegradation = (currentResponseTime - baselineResponseTime) / baselineResponseTime;
      if (responseTimeDegradation > this.degradationThreshold) {
        degradations.push({
          type: 'response_time',
          severity: responseTimeDegradation > 0.5 ? 'critical' : 'warning',
          degradation: responseTimeDegradation,
          baseline: baselineResponseTime,
          current: currentResponseTime,
          message: `Response time degraded by ${(responseTimeDegradation * 100).toFixed(1)}%`
        });
      }
    }
    
    // Error rate degradation
    if (baselineErrorRate >= 0) {
      const errorRateIncrease = currentErrorRate - baselineErrorRate;
      if (errorRateIncrease > 0.05) { // 5% increase
        degradations.push({
          type: 'error_rate',
          severity: errorRateIncrease > 0.1 ? 'critical' : 'warning',
          degradation: errorRateIncrease,
          baseline: baselineErrorRate,
          current: currentErrorRate,
          message: `Error rate increased by ${(errorRateIncrease * 100).toFixed(1)} percentage points`
        });
      }
    }
    
    // Store degradation alerts
    if (degradations.length > 0) {
      const alert = {
        timestamp: Date.now(),
        degradations,
        context: {
          baselineWindow: `${Math.floor(baselineData.length * this.realTimeUpdateInterval / 60000)} minutes ago`,
          currentWindow: `Last ${Math.floor(recentData.length * this.realTimeUpdateInterval / 60000)} minutes`,
          dataQuality: {
            baselinePoints: baselineData.length,
            currentPoints: recentData.length
          }
        }
      };
      
      this.degradationAlerts.push(alert);
      
      // Keep only recent alerts (last 24 hours)
      const cutoffTime = Date.now() - this.historicalDataRetention;
      this.degradationAlerts = this.degradationAlerts.filter(
        alert => alert.timestamp > cutoffTime
      );
      
      this.stats.degradationDetections++;
      this.lastDegradationCheck = alert;
      
      logger.warn('🚨 Performance degradation detected', {
        degradations: degradations.map(d => ({
          type: d.type,
          severity: d.severity,
          message: d.message
        })),
        alertCount: this.degradationAlerts.length
      });
    }
  }

  /**
   * Start data cleanup process
   */
  startDataCleanup() {
    // Cleanup old data every hour
    setInterval(() => {
      try {
        this.cleanupOldData();
      } catch (error) {
        logger.error('Data cleanup error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour
    
    logger.info('🧹 Data cleanup process started');
  }

  /**
   * Cleanup old data to prevent memory bloat
   */
  cleanupOldData() {
    const cutoffTime = Date.now() - this.historicalDataRetention;
    let cleanedItems = 0;
    
    // Cleanup historical metrics
    for (const [key, data] of this.historicalMetrics) {
      const before = data.length;
      this.historicalMetrics.set(key, data.filter(item => item.timestamp > cutoffTime));
      cleanedItems += before - this.historicalMetrics.get(key).length;
    }
    
    // Cleanup trend data
    for (const [key, data] of this.trendData) {
      const before = data.length;
      this.trendData.set(key, data.filter(item => item.timestamp > cutoffTime));
      cleanedItems += before - this.trendData.get(key).length;
    }
    
    // Cleanup degradation alerts
    const before = this.degradationAlerts.length;
    this.degradationAlerts = this.degradationAlerts.filter(
      alert => alert.timestamp > cutoffTime
    );
    cleanedItems += before - this.degradationAlerts.length;
    
    // Cleanup anomalies
    const anomaliesBefore = this.anomalies.length;
    this.anomalies = this.anomalies.filter(
      anomaly => anomaly.timestamp > cutoffTime
    );
    cleanedItems += anomaliesBefore - this.anomalies.length;
    
    if (cleanedItems > 0) {
      logger.info('🧹 Data cleanup completed', {
        itemsRemoved: cleanedItems,
        cutoffTime: new Date(cutoffTime).toISOString()
      });
    }
  }

  /**
   * Calculate average of numeric array
   */
  calculateAverage(values) {
    if (!values || values.length === 0) return 0;
    return values.reduce((sum, val) => sum + (val || 0), 0) / values.length;
  }

  /**
   * Get AI insights summary
   */
  getAIInsightsSummary() {
    try {
      const templates = this.analytics.getAllTemplates();
      const suggestions = [];
      
      for (const template of templates.slice(0, 5)) { // Top 5 templates
        const endpointSuggestions = this.analytics.getOptimizationSuggestions(template.endpoint);
        const aiSuggestions = endpointSuggestions.filter(s => s.source === 'ollama');
        suggestions.push(...aiSuggestions);
      }
      
      return {
        totalSuggestions: suggestions.length,
        categories: suggestions.reduce((acc, s) => {
          acc[s.category] = (acc[s.category] || 0) + 1;
          return acc;
        }, {}),
        priorities: suggestions.reduce((acc, s) => {
          acc[s.priority] = (acc[s.priority] || 0) + 1;
          return acc;
        }, {})
      };
    } catch (error) {
      logger.error('Error getting AI insights summary:', error);
      return { totalSuggestions: 0, categories: {}, priorities: {} };
    }
  }

  // PUBLIC API METHODS

  /**
   * Get real-time analytics dashboard data
   */
  getRealTimeDashboard() {
    const realtimeData = this.historicalMetrics.get('realtime') || [];
    const lastDataPoint = realtimeData[realtimeData.length - 1];
    
    return {
      timestamp: Date.now(),
      status: 'active',
      dataPoints: realtimeData.length,
      
      current: lastDataPoint ? {
        totalRequests: lastDataPoint.metadata.totalRequests,
        requestsPerSecond: lastDataPoint.metadata.requestsPerSecond,
        avgResponseTime: lastDataPoint.metadata.avgResponseTime,
        errorRate: lastDataPoint.metadata.errorRate,
        uniqueIPs: lastDataPoint.metadata.uniqueIPs,
        timestamp: lastDataPoint.timestamp
      } : null,
      
      trends: this.lastTrendAnalysis ? {
        requestVolume: this.lastTrendAnalysis.requestVolume,
        responseTime: this.lastTrendAnalysis.responseTime,
        errorRate: this.lastTrendAnalysis.errorRate,
        userActivity: this.lastTrendAnalysis.userActivity
      } : null,
      
      degradationAlerts: this.degradationAlerts.slice(-5), // Last 5 alerts
      
      recentData: realtimeData.slice(-20).map(point => ({ // Last 20 points
        timestamp: point.timestamp,
        totalRequests: point.metadata.totalRequests,
        avgResponseTime: point.metadata.avgResponseTime,
        errorRate: point.metadata.errorRate,
        requestsPerSecond: point.metadata.requestsPerSecond
      }))
    };
  }

  /**
   * Get historical trend analysis
   */
  getHistoricalTrends(timeRange = '1h') {
    const trends = this.trendData.get('trends') || [];
    const now = Date.now();
    
    // Parse time range
    let cutoffTime;
    switch (timeRange) {
      case '15m':
        cutoffTime = now - (15 * 60 * 1000);
        break;
      case '1h':
        cutoffTime = now - (60 * 60 * 1000);
        break;
      case '6h':
        cutoffTime = now - (6 * 60 * 60 * 1000);
        break;
      case '24h':
        cutoffTime = now - (24 * 60 * 60 * 1000);
        break;
      default:
        cutoffTime = now - (60 * 60 * 1000);
    }
    
    const filteredTrends = trends.filter(trend => trend.timestamp > cutoffTime);
    
    return {
      timeRange,
      dataPoints: filteredTrends.length,
      trends: filteredTrends,
      summary: this.lastTrendAnalysis,
      insights: this.lastTrendAnalysis ? this.generateTrendInsights(this.lastTrendAnalysis) : []
    };
  }

  /**
   * Get performance degradation report
   */
  getPerformanceDegradationReport() {
    return {
      timestamp: Date.now(),
      alertCount: this.degradationAlerts.length,
      alerts: this.degradationAlerts,
      lastCheck: this.lastDegradationCheck,
      configuration: {
        degradationThreshold: this.degradationThreshold,
        checkInterval: '5 minutes'
      },
      recommendations: this.generateDegradationRecommendations()
    };
  }

  /**
   * Generate degradation recommendations
   */
  generateDegradationRecommendations() {
    const recommendations = [];
    
    // Analyze recent degradation patterns
    const recentAlerts = this.degradationAlerts.filter(
      alert => alert.timestamp > Date.now() - (2 * 60 * 60 * 1000) // Last 2 hours
    );
    
    if (recentAlerts.length > 3) {
      recommendations.push({
        type: 'frequent_degradation',
        priority: 'high',
        message: 'Frequent performance degradation detected',
        action: 'Investigate underlying system issues and consider scaling'
      });
    }
    
    // Check for specific degradation types
    const responseTimeDegradations = recentAlerts.filter(
      alert => alert.degradations.some(d => d.type === 'response_time')
    );
    
    if (responseTimeDegradations.length > 1) {
      recommendations.push({
        type: 'response_time_pattern',
        priority: 'medium',
        message: 'Recurring response time degradation',
        action: 'Optimize slow endpoints and review database queries'
      });
    }
    
    return recommendations;
  }

  /**
   * Get engine statistics
   */
  getEngineStats() {
    return {
      ...this.stats,
      dataStorage: {
        historicalMetrics: Array.from(this.historicalMetrics.entries()).map(([key, data]) => ({
          key,
          dataPoints: data.length
        })),
        trendData: Array.from(this.trendData.entries()).map(([key, data]) => ({
          key,
          dataPoints: data.length
        })),
        degradationAlerts: this.degradationAlerts.length,
        anomalies: this.anomalies.length
      },
      configuration: {
        historicalDataRetention: this.historicalDataRetention,
        trendAnalysisWindow: this.trendAnalysisWindow,
        degradationThreshold: this.degradationThreshold,
        realTimeUpdateInterval: this.realTimeUpdateInterval
      }
    };
  }

  /**
   * Force analysis run (for testing/manual triggers)
   */
  async forceAnalysis() {
    logger.info('🔄 Forcing manual analysis run');
    
    try {
      this.performRealTimeAnalysis();
      this.collectHistoricalSnapshot();
      this.analyzeTrends();
      this.checkPerformanceDegradation();
      
      return {
        success: true,
        message: 'Manual analysis completed successfully',
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Manual analysis failed:', error);
      throw error;
    }
  }
}

module.exports = AdvancedAnalyticsEngine;