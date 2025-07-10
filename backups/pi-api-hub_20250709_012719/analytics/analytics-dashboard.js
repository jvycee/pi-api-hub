const ResponseHelper = require('../shared/response-helper');
const MonitoringFactory = require('../shared/monitoring-factory');
const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED ANALYTICS DASHBOARD 🍌
 * REST API endpoints for analytics and insights
 */
class AnalyticsDashboard {
  constructor(analyticsMiddleware) {
    this.analytics = analyticsMiddleware;
    
    logger.info('🍌 Analytics Dashboard initialized');
  }

  /**
   * Create analytics endpoints for Express app
   */
  createEndpoints(app, requireAdminAuth) {
    // Main analytics dashboard
    app.get('/analytics/dashboard', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.analytics.getDetailedAnalytics(),
      { name: 'analytics-dashboard', errorMessage: 'Failed to get analytics dashboard' }
    ));

    // Real-time statistics
    app.get('/analytics/realtime', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.analytics.getRealTimeStats(),
      { name: 'analytics-realtime', errorMessage: 'Failed to get real-time analytics' }
    ));

    // Pattern analysis
    app.get('/analytics/patterns', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.analytics.getAnalysis(),
      { name: 'analytics-patterns', errorMessage: 'Failed to get pattern analysis' }
    ));

    // Performance metrics
    app.get('/analytics/performance', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.analytics.getPerformanceMetrics(),
      { name: 'analytics-performance', errorMessage: 'Failed to get performance metrics' }
    ));

    // Endpoint-specific analytics
    app.get('/analytics/endpoint/:method/:path(*)', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const endpoint = `${req.params.method}:/${req.params.path}`;
        const analytics = this.analytics.getEndpointAnalytics(endpoint);
        
        if (!analytics) {
          throw new Error(`No analytics found for endpoint: ${endpoint}`);
        }
        
        return analytics;
      },
      { name: 'analytics-endpoint', errorMessage: 'Failed to get endpoint analytics' }
    ));

    // Monitoring summary (for main dashboard integration)
    app.get('/analytics/monitoring-summary', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.analytics.getMonitoringSummary(),
      { name: 'analytics-monitoring-summary', errorMessage: 'Failed to get monitoring summary' }
    ));

    // Analytics insights
    app.get('/analytics/insights', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const analysis = this.analytics.getAnalysis();
        return {
          insights: analysis.insights,
          recommendations: analysis.recommendations,
          totalInsights: analysis.insights.length,
          criticalInsights: analysis.insights.filter(i => i.severity === 'critical').length,
          warningInsights: analysis.insights.filter(i => i.severity === 'warning').length
        };
      },
      { name: 'analytics-insights', errorMessage: 'Failed to get analytics insights' }
    ));

    // Top endpoints
    app.get('/analytics/top-endpoints', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const limit = parseInt(req.query.limit) || 10;
        const analysis = this.analytics.getAnalysis();
        const topEndpoints = analysis.patterns.hotPaths?.topPaths?.slice(0, limit) || [];
        
        return {
          endpoints: topEndpoints,
          totalEndpoints: analysis.patterns.hotPaths?.totalUniquePaths || 0,
          timeWindow: analysis.timeWindow
        };
      },
      { name: 'analytics-top-endpoints', errorMessage: 'Failed to get top endpoints' }
    ));

    // Error analysis
    app.get('/analytics/errors', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const analysis = this.analytics.getAnalysis();
        const errorPatterns = analysis.patterns.errorPatterns || {};
        
        return {
          ...errorPatterns,
          isHealthy: errorPatterns.errorRate < 0.05, // 5% threshold
          recommendation: errorPatterns.errorRate > 0.1 
            ? 'High error rate detected - investigate immediately'
            : errorPatterns.errorRate > 0.05
            ? 'Error rate above normal - monitor closely'
            : 'Error rate is healthy'
        };
      },
      { name: 'analytics-errors', errorMessage: 'Failed to get error analysis' }
    ));

    // User behavior analytics
    app.get('/analytics/users', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const analysis = this.analytics.getAnalysis();
        const userBehavior = analysis.patterns.userBehavior || {};
        
        return {
          ...userBehavior,
          insights: [
            {
              type: 'user_activity',
              message: `${userBehavior.uniqueIPs || 0} unique users in analysis window`,
              data: { averageRequestsPerUser: userBehavior.avgRequestsPerIP || 0 }
            },
            {
              type: 'bot_detection',
              message: `${userBehavior.botDetection?.botPercentage || 0}% of traffic from bots`,
              data: userBehavior.botDetection || {}
            }
          ]
        };
      },
      { name: 'analytics-users', errorMessage: 'Failed to get user analytics' }
    ));

    // Response time analysis
    app.get('/analytics/response-times', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const analysis = this.analytics.getAnalysis();
        const responseTimeData = analysis.patterns.responseTimeDistribution || {};
        
        const performanceRating = this.getPerformanceRating(responseTimeData.percentiles);
        
        return {
          ...responseTimeData,
          performance: {
            rating: performanceRating,
            recommendation: this.getResponseTimeRecommendation(responseTimeData.percentiles)
          }
        };
      },
      { name: 'analytics-response-times', errorMessage: 'Failed to get response time analysis' }
    ));

    // Traffic patterns
    app.get('/analytics/traffic', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const analysis = this.analytics.getAnalysis();
        const trafficPatterns = analysis.patterns.trafficPatterns || {};
        
        return {
          ...trafficPatterns,
          insights: [
            {
              type: 'traffic_trend',
              message: `Traffic is ${trafficPatterns.trend || 'stable'}`,
              data: { 
                variability: trafficPatterns.variability,
                peakToAvgRatio: trafficPatterns.peakTraffic / trafficPatterns.avgTraffic 
              }
            }
          ]
        };
      },
      { name: 'analytics-traffic', errorMessage: 'Failed to get traffic analysis' }
    ));

    // Comprehensive report
    app.get('/analytics/report', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const analysis = this.analytics.getAnalysis();
        const realTimeStats = this.analytics.getRealTimeStats();
        const performanceMetrics = this.analytics.getPerformanceMetrics();
        
        return {
          generatedAt: new Date().toISOString(),
          executiveSummary: {
            totalRequests: analysis.totalRequests,
            requestsPerSecond: analysis.requestsPerSecond,
            avgResponseTime: analysis.patterns.responseTimeDistribution?.avg || 0,
            errorRate: analysis.patterns.errorPatterns?.errorRate || 0,
            uniqueUsers: analysis.patterns.userBehavior?.uniqueIPs || 0,
            topEndpoint: analysis.patterns.hotPaths?.topPaths?.[0]?.path || 'N/A'
          },
          keyInsights: analysis.insights.slice(0, 5),
          topRecommendations: analysis.recommendations.slice(0, 3),
          performanceHighlights: {
            fastestEndpoint: this.getFastestEndpoint(performanceMetrics),
            slowestEndpoint: this.getSlowestEndpoint(performanceMetrics),
            mostPopularEndpoint: analysis.patterns.hotPaths?.topPaths?.[0] || null
          },
          timeWindow: analysis.timeWindow
        };
      },
      { name: 'analytics-report', errorMessage: 'Failed to generate analytics report' }
    ));

    // 🤖 REQUEST TEMPLATE ENDPOINTS 🤖
    
    // Get template statistics
    app.get('/analytics/templates/stats', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.analytics.getTemplateStats(),
      { name: 'analytics-template-stats', errorMessage: 'Failed to get template statistics' }
    ));

    // Get all templates
    app.get('/analytics/templates', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.analytics.getAllTemplates(),
      { name: 'analytics-templates', errorMessage: 'Failed to get request templates' }
    ));

    // Get specific endpoint template
    app.get('/analytics/templates/:method/:path(*)', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const endpoint = `${req.params.method}:/${req.params.path}`;
        const template = this.analytics.getEndpointTemplate(endpoint);
        
        if (!template) {
          throw new Error(`No template found for endpoint: ${endpoint}`);
        }
        
        return template;
      },
      { name: 'analytics-endpoint-template', errorMessage: 'Failed to get endpoint template' }
    ));

    // Get optimization suggestions for endpoint
    app.get('/analytics/optimize/:method/:path(*)', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const endpoint = `${req.params.method}:/${req.params.path}`;
        const suggestions = this.analytics.getOptimizationSuggestions(endpoint);
        
        return {
          endpoint,
          suggestions,
          timestamp: new Date().toISOString()
        };
      },
      { name: 'analytics-optimization', errorMessage: 'Failed to get optimization suggestions' }
    ));

    // Get performance baselines
    app.get('/analytics/baselines', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.analytics.getPerformanceBaselines(),
      { name: 'analytics-baselines', errorMessage: 'Failed to get performance baselines' }
    ));

    // Get AI-powered insights
    app.get('/analytics/ai-insights', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const templates = this.analytics.getAllTemplates();
        const suggestions = [];
        
        // Collect all AI suggestions
        for (const template of templates) {
          const endpointSuggestions = this.analytics.getOptimizationSuggestions(template.endpoint);
          const aiSuggestions = endpointSuggestions.filter(s => s.source === 'ollama');
          suggestions.push(...aiSuggestions);
        }
        
        return {
          totalSuggestions: suggestions.length,
          suggestions: suggestions.slice(0, 20), // Top 20
          categories: this.categorizeAISuggestions(suggestions),
          timestamp: new Date().toISOString()
        };
      },
      { name: 'analytics-ai-insights', errorMessage: 'Failed to get AI insights' }
    ));

    logger.info('🍌 Analytics dashboard endpoints created');
  }

  /**
   * Get performance rating based on response time percentiles
   */
  getPerformanceRating(percentiles) {
    if (!percentiles) return 'unknown';
    
    const p95 = percentiles.p95;
    
    if (p95 < 100) return 'excellent';
    if (p95 < 300) return 'good';
    if (p95 < 1000) return 'fair';
    if (p95 < 3000) return 'poor';
    return 'critical';
  }

  /**
   * Get response time recommendation
   */
  getResponseTimeRecommendation(percentiles) {
    if (!percentiles) return 'Insufficient data for recommendation';
    
    const p95 = percentiles.p95;
    
    if (p95 < 100) return 'Response times are excellent - maintain current performance';
    if (p95 < 300) return 'Response times are good - consider minor optimizations';
    if (p95 < 1000) return 'Response times are fair - investigate slow endpoints';
    if (p95 < 3000) return 'Response times are poor - immediate optimization needed';
    return 'Response times are critical - urgent performance intervention required';
  }

  /**
   * Get fastest endpoint from performance metrics
   */
  getFastestEndpoint(metrics) {
    if (!metrics || metrics.length === 0) return null;
    
    return metrics.reduce((fastest, current) => 
      current.avgResponseTime < fastest.avgResponseTime ? current : fastest
    );
  }

  /**
   * Get slowest endpoint from performance metrics
   */
  getSlowestEndpoint(metrics) {
    if (!metrics || metrics.length === 0) return null;
    
    return metrics.reduce((slowest, current) => 
      current.avgResponseTime > slowest.avgResponseTime ? current : slowest
    );
  }

  /**
   * Categorize AI suggestions
   */
  categorizeAISuggestions(suggestions) {
    const categories = {
      caching: [],
      performance: [],
      query_optimization: [],
      response_optimization: [],
      request_structure: [],
      efficiency: [],
      other: []
    };
    
    suggestions.forEach(suggestion => {
      const category = suggestion.category || 'other';
      if (categories[category]) {
        categories[category].push(suggestion);
      } else {
        categories.other.push(suggestion);
      }
    });
    
    return {
      ...categories,
      summary: {
        total: suggestions.length,
        byCategory: Object.entries(categories).map(([cat, items]) => ({
          category: cat,
          count: items.length
        }))
      }
    };
  }
}

module.exports = AnalyticsDashboard;