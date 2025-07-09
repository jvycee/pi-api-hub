const ResponseHelper = require('../shared/response-helper');
const MonitoringFactory = require('../shared/monitoring-factory');
const logger = require('../shared/logger');

/**
 * 🍌 ENHANCED ANALYTICS DASHBOARD 🍌
 * Advanced analytics endpoints with real-time analysis, trends, and degradation detection
 */
class EnhancedAnalyticsDashboard {
  constructor(advancedAnalyticsEngine) {
    this.engine = advancedAnalyticsEngine;
    
    logger.info('🍌 Enhanced Analytics Dashboard initialized');
  }

  /**
   * Create enhanced analytics endpoints for Express app
   */
  createEndpoints(app, requireAdminAuth) {
    // REAL-TIME ANALYTICS ENDPOINTS
    
    // Real-time dashboard - comprehensive live data
    app.get('/analytics/enhanced/realtime-dashboard', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.engine.getRealTimeDashboard(),
      { name: 'enhanced-realtime-dashboard', errorMessage: 'Failed to get real-time dashboard' }
    ));

    // Live metrics stream data
    app.get('/analytics/enhanced/live-metrics', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const limit = parseInt(req.query.limit) || 50;
        const dashboard = this.engine.getRealTimeDashboard();
        
        return {
          current: dashboard.current,
          recentData: dashboard.recentData.slice(-limit),
          trends: dashboard.trends,
          dataPoints: dashboard.dataPoints,
          updateFrequency: '30 seconds'
        };
      },
      { name: 'enhanced-live-metrics', errorMessage: 'Failed to get live metrics' }
    ));

    // Performance health check
    app.get('/analytics/enhanced/health-check', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const dashboard = this.engine.getRealTimeDashboard();
        const degradationReport = this.engine.getPerformanceDegradationReport();
        
        const isHealthy = (
          !dashboard.current || 
          (dashboard.current.avgResponseTime < 1000 && 
           dashboard.current.errorRate < 0.05 && 
           degradationReport.alertCount === 0)
        );
        
        return {
          healthy: isHealthy,
          status: isHealthy ? 'excellent' : 'degraded',
          current: dashboard.current,
          degradationAlerts: degradationReport.alertCount,
          lastUpdate: dashboard.timestamp,
          recommendations: degradationReport.recommendations
        };
      },
      { name: 'enhanced-health-check', errorMessage: 'Failed to get health check' }
    ));

    // HISTORICAL TRENDS ENDPOINTS
    
    // Historical trend analysis
    app.get('/analytics/enhanced/trends', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const timeRange = req.query.timeRange || '1h';
        return this.engine.getHistoricalTrends(timeRange);
      },
      { name: 'enhanced-trends', errorMessage: 'Failed to get historical trends' }
    ));

    // Trend comparison across time periods
    app.get('/analytics/enhanced/trend-comparison', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const period1 = req.query.period1 || '1h';
        const period2 = req.query.period2 || '6h';
        
        const trends1 = this.engine.getHistoricalTrends(period1);
        const trends2 = this.engine.getHistoricalTrends(period2);
        
        return {
          comparison: {
            period1: { timeRange: period1, ...trends1 },
            period2: { timeRange: period2, ...trends2 }
          },
          analysis: this.compareTrendPeriods(trends1, trends2)
        };
      },
      { name: 'enhanced-trend-comparison', errorMessage: 'Failed to get trend comparison' }
    ));

    // Performance evolution over time
    app.get('/analytics/enhanced/performance-evolution', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const timeRange = req.query.timeRange || '24h';
        const trends = this.engine.getHistoricalTrends(timeRange);
        
        return {
          timeRange,
          evolution: this.analyzePerformanceEvolution(trends),
          keyMetrics: this.extractKeyMetrics(trends),
          predictions: this.generatePerformancePredictions(trends)
        };
      },
      { name: 'enhanced-performance-evolution', errorMessage: 'Failed to get performance evolution' }
    ));

    // DEGRADATION DETECTION ENDPOINTS
    
    // Performance degradation report
    app.get('/analytics/enhanced/degradation-report', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.engine.getPerformanceDegradationReport(),
      { name: 'enhanced-degradation-report', errorMessage: 'Failed to get degradation report' }
    ));

    // Degradation alerts with details
    app.get('/analytics/enhanced/degradation-alerts', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const severity = req.query.severity; // 'critical', 'warning', or undefined for all
        const limit = parseInt(req.query.limit) || 20;
        
        const report = this.engine.getPerformanceDegradationReport();
        let alerts = report.alerts;
        
        if (severity) {
          alerts = alerts.filter(alert => 
            alert.degradations.some(d => d.severity === severity)
          );
        }
        
        return {
          alerts: alerts.slice(-limit),
          totalAlerts: alerts.length,
          severityFilter: severity,
          summary: this.summarizeDegradationAlerts(alerts)
        };
      },
      { name: 'enhanced-degradation-alerts', errorMessage: 'Failed to get degradation alerts' }
    ));

    // Degradation analysis with AI insights
    app.get('/analytics/enhanced/degradation-analysis', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      async () => {
        const report = this.engine.getPerformanceDegradationReport();
        const aiInsights = await this.generateAIDegradationInsights(report);
        
        return {
          degradationReport: report,
          aiInsights,
          recommendations: [
            ...report.recommendations,
            ...aiInsights.recommendations
          ],
          actionPlan: this.generateActionPlan(report, aiInsights)
        };
      },
      { name: 'enhanced-degradation-analysis', errorMessage: 'Failed to get degradation analysis' }
    ));

    // ADVANCED ANALYTICS ENDPOINTS
    
    // Predictive analytics
    app.get('/analytics/enhanced/predictions', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      (req) => {
        const horizon = req.query.horizon || '1h'; // Prediction horizon
        const trends = this.engine.getHistoricalTrends('6h'); // Use 6h data for predictions
        
        return {
          predictionHorizon: horizon,
          predictions: this.generatePredictions(trends, horizon),
          confidence: this.calculatePredictionConfidence(trends),
          recommendations: this.generatePredictiveRecommendations(trends, horizon)
        };
      },
      { name: 'enhanced-predictions', errorMessage: 'Failed to get predictions' }
    ));

    // Capacity planning insights
    app.get('/analytics/enhanced/capacity-planning', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const trends = this.engine.getHistoricalTrends('24h');
        const dashboard = this.engine.getRealTimeDashboard();
        
        return {
          currentCapacity: this.assessCurrentCapacity(dashboard),
          utilizationTrends: this.analyzeCapacityUtilization(trends),
          scalingRecommendations: this.generateScalingRecommendations(trends, dashboard),
          resourceForecasting: this.forecastResourceNeeds(trends)
        };
      },
      { name: 'enhanced-capacity-planning', errorMessage: 'Failed to get capacity planning insights' }
    ));

    // Performance optimization insights
    app.get('/analytics/enhanced/optimization-insights', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      async () => {
        const trends = this.engine.getHistoricalTrends('6h');
        const dashboard = this.engine.getRealTimeDashboard();
        const degradationReport = this.engine.getPerformanceDegradationReport();
        
        const optimizationInsights = await this.generateOptimizationInsights(
          trends, dashboard, degradationReport
        );
        
        return {
          insights: optimizationInsights,
          prioritizedActions: this.prioritizeOptimizationActions(optimizationInsights),
          impactAnalysis: this.analyzeOptimizationImpact(optimizationInsights),
          implementationPlan: this.createImplementationPlan(optimizationInsights)
        };
      },
      { name: 'enhanced-optimization-insights', errorMessage: 'Failed to get optimization insights' }
    ));

    // SYSTEM MONITORING ENDPOINTS
    
    // Engine statistics and health
    app.get('/analytics/enhanced/engine-stats', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => this.engine.getEngineStats(),
      { name: 'enhanced-engine-stats', errorMessage: 'Failed to get engine statistics' }
    ));

    // Force analysis run (manual trigger)
    app.post('/analytics/enhanced/force-analysis', requireAdminAuth, MonitoringFactory.createPostEndpoint(
      async () => {
        const result = await this.engine.forceAnalysis();
        return {
          ...result,
          engineStats: this.engine.getEngineStats()
        };
      },
      { name: 'enhanced-force-analysis', successMessage: 'Analysis triggered successfully', errorMessage: 'Failed to trigger analysis' }
    ));

    // Comprehensive analytics overview
    app.get('/analytics/enhanced/overview', requireAdminAuth, MonitoringFactory.createGetEndpoint(
      () => {
        const dashboard = this.engine.getRealTimeDashboard();
        const trends = this.engine.getHistoricalTrends('1h');
        const degradationReport = this.engine.getPerformanceDegradationReport();
        const engineStats = this.engine.getEngineStats();
        
        return {
          timestamp: Date.now(),
          status: this.calculateOverallStatus(dashboard, degradationReport),
          realTime: {
            current: dashboard.current,
            trends: dashboard.trends,
            alertCount: dashboard.degradationAlerts.length
          },
          historical: {
            dataPoints: trends.dataPoints,
            insights: trends.insights.length,
            trendSummary: trends.summary
          },
          degradation: {
            alertCount: degradationReport.alertCount,
            recommendations: degradationReport.recommendations.length,
            lastCheck: degradationReport.lastCheck
          },
          engine: {
            analysesCompleted: engineStats.historicalAnalyses + engineStats.trendAnalyses,
            dataPointsStored: engineStats.dataPointsStored,
            lastAnalysis: engineStats.lastAnalysisTime
          }
        };
      },
      { name: 'enhanced-overview', errorMessage: 'Failed to get analytics overview' }
    ));

    logger.info('🍌 Enhanced Analytics Dashboard endpoints created');
  }

  // HELPER METHODS

  /**
   * Compare trend periods
   */
  compareTrendPeriods(trends1, trends2) {
    if (!trends1.summary || !trends2.summary) {
      return { comparison: 'insufficient_data' };
    }
    
    const comparison = {};
    const metrics = ['requestVolume', 'responseTime', 'errorRate', 'userActivity'];
    
    metrics.forEach(metric => {
      if (trends1.summary[metric] && trends2.summary[metric]) {
        comparison[metric] = {
          period1: trends1.summary[metric],
          period2: trends2.summary[metric],
          difference: {
            trend: trends1.summary[metric].trend === trends2.summary[metric].trend ? 'consistent' : 'changed',
            changeDifference: Math.abs(trends1.summary[metric].change - trends2.summary[metric].change)
          }
        };
      }
    });
    
    return comparison;
  }

  /**
   * Analyze performance evolution
   */
  analyzePerformanceEvolution(trends) {
    const evolution = {
      improvement: 0,
      degradation: 0,
      stable: 0,
      phases: []
    };
    
    if (trends.trends && trends.trends.length > 0) {
      trends.trends.forEach(trend => {
        const responseTimeTrend = trend.responseTime?.trend;
        const errorRateTrend = trend.errorRate?.trend;
        
        let phase = 'stable';
        if (responseTimeTrend === 'decreasing' && errorRateTrend !== 'increasing') {
          phase = 'improvement';
          evolution.improvement++;
        } else if (responseTimeTrend === 'increasing' || errorRateTrend === 'increasing') {
          phase = 'degradation';
          evolution.degradation++;
        } else {
          evolution.stable++;
        }
        
        evolution.phases.push({
          timestamp: trend.timestamp,
          phase,
          responseTime: trend.responseTime,
          errorRate: trend.errorRate
        });
      });
    }
    
    return evolution;
  }

  /**
   * Extract key metrics from trends
   */
  extractKeyMetrics(trends) {
    if (!trends.summary) return {};
    
    return {
      responseTime: {
        trend: trends.summary.responseTime?.trend || 'unknown',
        change: trends.summary.responseTime?.change || 0,
        current: trends.summary.responseTime?.values?.last || 0
      },
      errorRate: {
        trend: trends.summary.errorRate?.trend || 'unknown',
        change: trends.summary.errorRate?.change || 0,
        current: trends.summary.errorRate?.values?.last || 0
      },
      requestVolume: {
        trend: trends.summary.requestVolume?.trend || 'unknown',
        change: trends.summary.requestVolume?.change || 0,
        current: trends.summary.requestVolume?.values?.last || 0
      }
    };
  }

  /**
   * Generate performance predictions
   */
  generatePerformancePredictions(trends) {
    const predictions = {};
    
    if (trends.summary) {
      const metrics = ['responseTime', 'errorRate', 'requestVolume'];
      
      metrics.forEach(metric => {
        const trendData = trends.summary[metric];
        if (trendData && trendData.values) {
          const prediction = this.extrapolateTrend(trendData);
          predictions[metric] = prediction;
        }
      });
    }
    
    return predictions;
  }

  /**
   * Extrapolate trend for predictions
   */
  extrapolateTrend(trendData) {
    const { trend, slope, values } = trendData;
    const current = values.last;
    
    // Simple linear extrapolation for next hour
    const prediction = current + (slope * 60); // 60 data points ahead (30-second intervals)
    
    return {
      current,
      predicted: Math.max(0, prediction), // Ensure non-negative
      confidence: trendData.confidence,
      trend,
      reasoning: this.getTrendReasoning(trend, trendData.change)
    };
  }

  /**
   * Get reasoning for trend
   */
  getTrendReasoning(trend, change) {
    switch (trend) {
      case 'increasing':
        return `Increasing trend detected with ${change.toFixed(1)}% change`;
      case 'decreasing':
        return `Decreasing trend detected with ${change.toFixed(1)}% change`;
      case 'stable':
        return 'Stable trend with minimal variation';
      default:
        return 'Insufficient data for trend analysis';
    }
  }

  /**
   * Summarize degradation alerts
   */
  summarizeDegradationAlerts(alerts) {
    const summary = {
      total: alerts.length,
      critical: 0,
      warning: 0,
      byType: {},
      recentCount: 0
    };
    
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    
    alerts.forEach(alert => {
      if (alert.timestamp > oneHourAgo) {
        summary.recentCount++;
      }
      
      alert.degradations.forEach(degradation => {
        if (degradation.severity === 'critical') {
          summary.critical++;
        } else if (degradation.severity === 'warning') {
          summary.warning++;
        }
        
        summary.byType[degradation.type] = (summary.byType[degradation.type] || 0) + 1;
      });
    });
    
    return summary;
  }

  /**
   * Generate AI degradation insights
   */
  async generateAIDegradationInsights(report) {
    // This would integrate with the AI handler for advanced analysis
    // For now, return rule-based insights
    
    const insights = {
      patterns: [],
      recommendations: [],
      rootCauseAnalysis: []
    };
    
    // Analyze degradation patterns
    if (report.alerts.length > 0) {
      const recentAlerts = report.alerts.filter(
        alert => alert.timestamp > Date.now() - (2 * 60 * 60 * 1000)
      );
      
      if (recentAlerts.length > 2) {
        insights.patterns.push({
          type: 'frequent_degradation',
          severity: 'warning',
          message: 'Multiple degradation events detected in short time period',
          data: { alertCount: recentAlerts.length, timeWindow: '2 hours' }
        });
        
        insights.recommendations.push({
          type: 'investigation',
          priority: 'high',
          action: 'Investigate underlying system issues causing repeated degradation'
        });
      }
    }
    
    return insights;
  }

  /**
   * Generate action plan
   */
  generateActionPlan(degradationReport, aiInsights) {
    const actions = [];
    
    // Immediate actions for critical degradations
    const criticalAlerts = degradationReport.alerts.filter(
      alert => alert.degradations.some(d => d.severity === 'critical')
    );
    
    if (criticalAlerts.length > 0) {
      actions.push({
        priority: 'immediate',
        action: 'Address critical performance degradations',
        steps: [
          'Review system resources (CPU, memory, disk)',
          'Check for blocking processes or queries',
          'Restart services if necessary',
          'Scale resources if capacity is exceeded'
        ]
      });
    }
    
    // Short-term actions
    if (degradationReport.alertCount > 5) {
      actions.push({
        priority: 'short_term',
        action: 'Implement performance monitoring improvements',
        steps: [
          'Tune performance thresholds',
          'Add more granular monitoring',
          'Implement automated scaling',
          'Review and optimize slow endpoints'
        ]
      });
    }
    
    return actions;
  }

  /**
   * Generate predictions for different horizons
   */
  generatePredictions(trends, horizon) {
    // Simple prediction based on trends
    const predictions = {
      horizon,
      metrics: {}
    };
    
    if (trends.summary) {
      const horizonMultiplier = this.getHorizonMultiplier(horizon);
      
      Object.entries(trends.summary).forEach(([metric, data]) => {
        if (data && data.values) {
          predictions.metrics[metric] = this.predictMetric(data, horizonMultiplier);
        }
      });
    }
    
    return predictions;
  }

  /**
   * Get horizon multiplier for predictions
   */
  getHorizonMultiplier(horizon) {
    switch (horizon) {
      case '15m': return 0.25;
      case '30m': return 0.5;
      case '1h': return 1;
      case '2h': return 2;
      case '6h': return 6;
      default: return 1;
    }
  }

  /**
   * Predict metric value
   */
  predictMetric(trendData, multiplier) {
    const { slope, values, confidence } = trendData;
    const prediction = values.last + (slope * multiplier * 10); // Approximate scaling
    
    return {
      current: values.last,
      predicted: Math.max(0, prediction),
      confidence: confidence,
      bounds: {
        lower: Math.max(0, prediction - (prediction * 0.2)),
        upper: prediction + (prediction * 0.2)
      }
    };
  }

  /**
   * Calculate prediction confidence
   */
  calculatePredictionConfidence(trends) {
    if (!trends.summary) return 0;
    
    const confidences = Object.values(trends.summary)
      .filter(data => data && data.confidence)
      .map(data => data.confidence);
    
    return confidences.length > 0 
      ? confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length
      : 0;
  }

  /**
   * Generate predictive recommendations
   */
  generatePredictiveRecommendations(trends, horizon) {
    const recommendations = [];
    
    if (trends.summary?.responseTime?.trend === 'increasing') {
      recommendations.push({
        type: 'performance_warning',
        message: `Response times predicted to increase over next ${horizon}`,
        action: 'Consider performance optimization or scaling'
      });
    }
    
    if (trends.summary?.requestVolume?.trend === 'increasing') {
      recommendations.push({
        type: 'capacity_planning',
        message: `Request volume growing, may need scaling in next ${horizon}`,
        action: 'Prepare for increased capacity requirements'
      });
    }
    
    return recommendations;
  }

  /**
   * Assess current capacity
   */
  assessCurrentCapacity(dashboard) {
    if (!dashboard.current) return { status: 'unknown' };
    
    const { avgResponseTime, errorRate, requestsPerSecond } = dashboard.current;
    
    let status = 'healthy';
    const issues = [];
    
    if (avgResponseTime > 1000) {
      status = 'stressed';
      issues.push('high_response_time');
    }
    
    if (errorRate > 0.05) {
      status = 'stressed';
      issues.push('high_error_rate');
    }
    
    if (requestsPerSecond > 50) { // Threshold for Pi system
      status = 'approaching_limit';
      issues.push('high_request_rate');
    }
    
    return {
      status,
      issues,
      metrics: { avgResponseTime, errorRate, requestsPerSecond },
      recommendation: this.getCapacityRecommendation(status, issues)
    };
  }

  /**
   * Get capacity recommendation
   */
  getCapacityRecommendation(status, issues) {
    switch (status) {
      case 'healthy':
        return 'System operating within normal parameters';
      case 'stressed':
        return `System showing stress indicators: ${issues.join(', ')}. Consider optimization.`;
      case 'approaching_limit':
        return 'System approaching capacity limits. Consider scaling or optimization.';
      default:
        return 'Unable to assess capacity';
    }
  }

  /**
   * Calculate overall status
   */
  calculateOverallStatus(dashboard, degradationReport) {
    if (!dashboard.current) return 'unknown';
    
    const hasRecentAlerts = degradationReport.alertCount > 0;
    const highResponseTime = dashboard.current.avgResponseTime > 1000;
    const highErrorRate = dashboard.current.errorRate > 0.05;
    
    if (hasRecentAlerts || highResponseTime || highErrorRate) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  // Additional helper methods for optimization insights...
  async generateOptimizationInsights(trends, dashboard, degradationReport) {
    // This would be implemented with more sophisticated analysis
    return {
      performanceInsights: [],
      resourceInsights: [],
      usageInsights: []
    };
  }

  prioritizeOptimizationActions(insights) {
    return [];
  }

  analyzeOptimizationImpact(insights) {
    return {};
  }

  createImplementationPlan(insights) {
    return {};
  }

  analyzeCapacityUtilization(trends) {
    return {};
  }

  generateScalingRecommendations(trends, dashboard) {
    return [];
  }

  forecastResourceNeeds(trends) {
    return {};
  }
}

module.exports = EnhancedAnalyticsDashboard;