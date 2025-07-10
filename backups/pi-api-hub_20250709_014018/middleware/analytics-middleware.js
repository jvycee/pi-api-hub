const RequestPatternAnalyzer = require('../analytics/request-pattern-analyzer');
const RequestTemplateManager = require('../analytics/request-template-manager');
const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED ANALYTICS MIDDLEWARE 🍌
 * Integrates request pattern analysis into the Express pipeline
 */
class AnalyticsMiddleware {
  constructor(aiHandler, options = {}) {
    this.analyzer = new RequestPatternAnalyzer(options);
    this.templateManager = new RequestTemplateManager(aiHandler, options);
    this.enableRealTimeAnalysis = options.enableRealTimeAnalysis !== false;
    this.analysisInterval = options.analysisInterval || 60000; // 1 minute
    this.lastAnalysis = null;
    
    // Start periodic analysis
    if (this.enableRealTimeAnalysis) {
      this.startPeriodicAnalysis();
    }
    
    logger.info('🍌 Analytics Middleware initialized', {
      enableRealTimeAnalysis: this.enableRealTimeAnalysis,
      analysisInterval: this.analysisInterval
    });
  }

  /**
   * Express middleware function
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Capture original end method
      const originalEnd = res.end;
      
      // Override end method to capture response data
      res.end = function(chunk, encoding) {
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Add response metadata to request
        req.responseTime = responseTime;
        req.statusCode = res.statusCode;
        req.contentLength = res.get('Content-Length') || 0;
        
        // Record request for analysis
        this.analyzer.recordRequest(req);
        
        // Record request for template learning
        this.templateManager.recordRequest(req, res, responseTime);
        
        // Call original end method
        originalEnd.call(res, chunk, encoding);
      }.bind(this);
      
      next();
    };
  }

  /**
   * Start periodic pattern analysis
   */
  startPeriodicAnalysis() {
    setInterval(() => {
      try {
        const analysis = this.analyzer.analyzePatterns();
        this.lastAnalysis = analysis;
        
        // Log insights
        if (analysis.insights.length > 0) {
          logger.info('🔍 Pattern Analysis Insights', {
            totalInsights: analysis.insights.length,
            insights: analysis.insights.map(i => ({
              type: i.type,
              severity: i.severity,
              message: i.message
            }))
          });
        }
        
        // Log recommendations
        if (analysis.recommendations.length > 0) {
          logger.info('💡 Performance Recommendations', {
            totalRecommendations: analysis.recommendations.length,
            recommendations: analysis.recommendations.map(r => ({
              type: r.type,
              priority: r.priority,
              message: r.message
            }))
          });
        }
      } catch (error) {
        logger.error('Analytics analysis error:', error);
      }
    }, this.analysisInterval);
  }

  /**
   * Get current analysis results
   */
  getAnalysis() {
    return this.lastAnalysis || this.analyzer.analyzePatterns();
  }

  /**
   * Get real-time statistics
   */
  getRealTimeStats() {
    return this.analyzer.getRealTimeStats();
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics() {
    return this.analyzer.getPerformanceMetrics();
  }

  /**
   * Get detailed analytics for dashboard
   */
  getDetailedAnalytics() {
    const analysis = this.getAnalysis();
    const realTimeStats = this.getRealTimeStats();
    const performanceMetrics = this.getPerformanceMetrics();
    
    return {
      timestamp: new Date().toISOString(),
      realTime: realTimeStats,
      analysis,
      performanceMetrics: performanceMetrics.slice(0, 20), // Top 20 endpoints
      summary: {
        totalRequests: analysis.totalRequests,
        requestsPerSecond: analysis.requestsPerSecond,
        avgResponseTime: analysis.patterns.responseTimeDistribution?.avg || 0,
        errorRate: analysis.patterns.errorPatterns?.errorRate || 0,
        uniqueIPs: analysis.patterns.userBehavior?.uniqueIPs || 0,
        topEndpoint: analysis.patterns.hotPaths?.topPaths?.[0]?.path || 'N/A'
      }
    };
  }

  /**
   * Get analytics for specific endpoint
   */
  getEndpointAnalytics(endpoint) {
    const performanceMetrics = this.getPerformanceMetrics();
    const endpointMetrics = performanceMetrics.find(m => m.endpoint === endpoint);
    
    if (!endpointMetrics) {
      return null;
    }
    
    const analysis = this.getAnalysis();
    const hotPath = analysis.patterns.hotPaths?.topPaths?.find(p => p.path === endpoint.split(':')[1]);
    
    return {
      endpoint,
      metrics: endpointMetrics,
      ranking: hotPath ? {
        rank: analysis.patterns.hotPaths.topPaths.indexOf(hotPath) + 1,
        percentage: hotPath.percentage
      } : null,
      recommendations: analysis.recommendations.filter(r => 
        r.endpoints && r.endpoints.includes(endpoint.split(':')[1])
      )
    };
  }

  /**
   * Get analytics summary for monitoring dashboard
   */
  getMonitoringSummary() {
    const realTimeStats = this.getRealTimeStats();
    const analysis = this.getAnalysis();
    
    return {
      timestamp: new Date().toISOString(),
      health: {
        requestsPerSecond: realTimeStats.currentRPS,
        avgResponseTime: realTimeStats.avgResponseTime,
        errorRate: analysis.patterns.errorPatterns?.errorRate || 0,
        uniqueUsers: realTimeStats.uniqueIPs
      },
      alerts: analysis.insights.filter(i => i.severity === 'warning' || i.severity === 'critical'),
      topEndpoints: analysis.patterns.hotPaths?.topPaths?.slice(0, 5) || [],
      performance: {
        p95ResponseTime: analysis.patterns.responseTimeDistribution?.percentiles?.p95 || 0,
        p99ResponseTime: analysis.patterns.responseTimeDistribution?.percentiles?.p99 || 0,
        slowEndpoints: analysis.patterns.hotPaths?.topPaths?.filter(p => p.avgResponseTime > 1000) || []
      }
    };
  }

  /**
   * Get template statistics
   */
  getTemplateStats() {
    return this.templateManager.getTemplateStats();
  }

  /**
   * Get optimization suggestions for endpoint
   */
  getOptimizationSuggestions(endpoint) {
    return this.templateManager.getOptimizationSuggestions(endpoint);
  }

  /**
   * Get endpoint template
   */
  getEndpointTemplate(endpoint) {
    return this.templateManager.getEndpointTemplate(endpoint);
  }

  /**
   * Get all templates
   */
  getAllTemplates() {
    return this.templateManager.getAllTemplates();
  }

  /**
   * Get performance baselines
   */
  getPerformanceBaselines() {
    return this.templateManager.getPerformanceBaselines();
  }
}

module.exports = AnalyticsMiddleware;