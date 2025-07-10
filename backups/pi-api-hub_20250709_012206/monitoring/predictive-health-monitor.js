const logger = require('../shared/logger');

class PredictiveHealthMonitor {
  constructor(performanceCollector, options = {}) {
    this.performanceCollector = performanceCollector;
    this.analysisInterval = options.analysisInterval || 60000; // 1 minute
    this.predictionWindow = options.predictionWindow || 300000; // 5 minutes
    this.alertThresholds = options.alertThresholds || {
      cpu: 85,
      memory: 80,
      errorRate: 10,
      responseTime: 5000
    };
    
    // Trend analysis data
    this.trends = {
      cpu: [],
      memory: [],
      errorRate: [],
      responseTime: [],
      requests: []
    };
    
    // Prediction models (simple linear regression)
    this.models = {};
    
    // Alert states
    this.alerts = {
      active: [],
      history: []
    };
    
    this.startMonitoring();
  }

  startMonitoring() {
    // Run trend analysis every minute
    setInterval(() => {
      this.analyzeTrends();
      this.generatePredictions();
      this.checkAlerts();
    }, this.analysisInterval);
    
    logger.info('🍌 Predictive health monitoring started', {
      analysisInterval: this.analysisInterval,
      predictionWindow: this.predictionWindow
    });
  }

  analyzeTrends() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Get recent metrics
    const recentCPU = this.performanceCollector.getHistoricalData('cpu', '1h');
    const recentMemory = this.performanceCollector.getHistoricalData('memory', '1h');
    const recentRequests = this.performanceCollector.getHistoricalData('requests', '1h');
    
    // Calculate trends
    this.updateTrend('cpu', recentCPU.map(m => ({ 
      timestamp: m.timestamp, 
      value: m.usage 
    })));
    
    this.updateTrend('memory', recentMemory.map(m => ({ 
      timestamp: m.timestamp, 
      value: m.process.heapUtilization 
    })));
    
    // Calculate error rate trend
    const errorRates = this.calculateErrorRateTrend(recentRequests);
    this.updateTrend('errorRate', errorRates);
    
    // Calculate response time trend
    const responseTimes = this.calculateResponseTimeTrend(recentRequests);
    this.updateTrend('responseTime', responseTimes);
  }

  updateTrend(metric, dataPoints) {
    if (dataPoints.length < 2) return;
    
    // Calculate trend (simple linear regression)
    const n = dataPoints.length;
    const sumX = dataPoints.reduce((sum, point, index) => sum + index, 0);
    const sumY = dataPoints.reduce((sum, point) => sum + point.value, 0);
    const sumXY = dataPoints.reduce((sum, point, index) => sum + index * point.value, 0);
    const sumXX = dataPoints.reduce((sum, point, index) => sum + index * index, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared for trend strength
    const meanY = sumY / n;
    const ssTotal = dataPoints.reduce((sum, point) => sum + Math.pow(point.value - meanY, 2), 0);
    const ssResidual = dataPoints.reduce((sum, point, index) => {
      const predicted = slope * index + intercept;
      return sum + Math.pow(point.value - predicted, 2);
    }, 0);
    
    const rSquared = 1 - (ssResidual / ssTotal);
    
    const trendData = {
      timestamp: Date.now(),
      slope,
      intercept,
      rSquared,
      direction: slope > 0 ? 'increasing' : slope < 0 ? 'decreasing' : 'stable',
      strength: this.getTrendStrength(rSquared),
      currentValue: dataPoints[dataPoints.length - 1].value,
      dataPoints: dataPoints.length
    };
    
    // Store trend
    this.trends[metric].push(trendData);
    
    // Keep only recent trends
    if (this.trends[metric].length > 100) {
      this.trends[metric] = this.trends[metric].slice(-100);
    }
  }

  getTrendStrength(rSquared) {
    if (rSquared > 0.8) return 'strong';
    if (rSquared > 0.5) return 'moderate';
    if (rSquared > 0.2) return 'weak';
    return 'negligible';
  }

  calculateErrorRateTrend(requests) {
    if (requests.length === 0) return [];
    
    // Group by 5-minute intervals
    const intervals = {};
    requests.forEach(req => {
      const interval = Math.floor(req.timestamp / (5 * 60 * 1000)) * (5 * 60 * 1000);
      if (!intervals[interval]) {
        intervals[interval] = { total: 0, errors: 0 };
      }
      intervals[interval].total++;
      if (req.statusCode >= 400) {
        intervals[interval].errors++;
      }
    });
    
    return Object.entries(intervals).map(([timestamp, data]) => ({
      timestamp: parseInt(timestamp),
      value: data.total > 0 ? (data.errors / data.total) * 100 : 0
    })).sort((a, b) => a.timestamp - b.timestamp);
  }

  calculateResponseTimeTrend(requests) {
    if (requests.length === 0) return [];
    
    // Group by 5-minute intervals and calculate average response time
    const intervals = {};
    requests.forEach(req => {
      const interval = Math.floor(req.timestamp / (5 * 60 * 1000)) * (5 * 60 * 1000);
      if (!intervals[interval]) {
        intervals[interval] = { total: 0, sum: 0 };
      }
      intervals[interval].total++;
      intervals[interval].sum += req.responseTime;
    });
    
    return Object.entries(intervals).map(([timestamp, data]) => ({
      timestamp: parseInt(timestamp),
      value: data.total > 0 ? data.sum / data.total : 0
    })).sort((a, b) => a.timestamp - b.timestamp);
  }

  generatePredictions() {
    const predictions = {};
    
    Object.keys(this.trends).forEach(metric => {
      const trend = this.trends[metric];
      if (trend.length === 0) return;
      
      const latest = trend[trend.length - 1];
      if (latest.strength === 'negligible') return;
      
      // Predict value in 5 minutes (300 seconds)
      const predictionSteps = this.predictionWindow / this.analysisInterval;
      const predictedValue = latest.slope * predictionSteps + latest.currentValue;
      
      predictions[metric] = {
        current: latest.currentValue,
        predicted: predictedValue,
        trend: latest.direction,
        strength: latest.strength,
        timeWindow: `${this.predictionWindow / 60000} minutes`,
        confidence: latest.rSquared
      };
    });
    
    this.models = predictions;
    return predictions;
  }

  checkAlerts() {
    const predictions = this.models;
    const newAlerts = [];
    
    Object.keys(predictions).forEach(metric => {
      const prediction = predictions[metric];
      const threshold = this.alertThresholds[metric];
      
      if (!threshold) return;
      
      // Check if predicted value exceeds threshold
      if (prediction.predicted > threshold && prediction.strength !== 'weak') {
        const severity = this.calculateSeverity(prediction, threshold);
        
        newAlerts.push({
          id: `${metric}_${Date.now()}`,
          metric,
          type: 'predictive',
          severity,
          message: `${metric} predicted to reach ${prediction.predicted.toFixed(2)} (threshold: ${threshold}) in ${prediction.timeWindow}`,
          currentValue: prediction.current,
          predictedValue: prediction.predicted,
          threshold,
          trend: prediction.trend,
          confidence: prediction.confidence,
          timestamp: Date.now()
        });
      }
    });
    
    // Add new alerts
    newAlerts.forEach(alert => {
      // Check if similar alert already exists
      const existingAlert = this.alerts.active.find(a => 
        a.metric === alert.metric && a.type === alert.type
      );
      
      if (!existingAlert) {
        this.alerts.active.push(alert);
        this.alerts.history.push({...alert, status: 'triggered'});
        
        logger.warn('🍌 Predictive alert triggered', {
          metric: alert.metric,
          severity: alert.severity,
          message: alert.message,
          confidence: `${(alert.confidence * 100).toFixed(1)}%`
        });
      }
    });
    
    // Clean up resolved alerts
    this.alerts.active = this.alerts.active.filter(alert => {
      const prediction = predictions[alert.metric];
      if (!prediction || prediction.predicted <= alert.threshold) {
        this.alerts.history.push({...alert, status: 'resolved', resolvedAt: Date.now()});
        logger.info('🍌 Predictive alert resolved', {
          metric: alert.metric,
          message: alert.message
        });
        return false;
      }
      return true;
    });
    
    // Keep alert history manageable
    if (this.alerts.history.length > 1000) {
      this.alerts.history = this.alerts.history.slice(-1000);
    }
  }

  calculateSeverity(prediction, threshold) {
    const exceedance = (prediction.predicted - threshold) / threshold;
    const confidence = prediction.confidence;
    
    if (exceedance > 0.5 && confidence > 0.7) return 'critical';
    if (exceedance > 0.2 && confidence > 0.5) return 'high';
    if (exceedance > 0.1 && confidence > 0.3) return 'medium';
    return 'low';
  }

  getHealthPrediction() {
    const predictions = this.models;
    const activeAlerts = this.alerts.active;
    
    // Calculate overall health score
    let healthScore = 100;
    
    // Deduct points for active alerts
    activeAlerts.forEach(alert => {
      switch (alert.severity) {
        case 'critical': healthScore -= 25; break;
        case 'high': healthScore -= 15; break;
        case 'medium': healthScore -= 10; break;
        case 'low': healthScore -= 5; break;
      }
    });
    
    // Deduct points for negative trends
    Object.values(predictions).forEach(prediction => {
      if (prediction.trend === 'increasing' && prediction.strength === 'strong') {
        healthScore -= 5;
      }
    });
    
    healthScore = Math.max(0, Math.min(100, healthScore));
    
    let healthStatus = 'excellent';
    if (healthScore < 90) healthStatus = 'good';
    if (healthScore < 70) healthStatus = 'warning';
    if (healthScore < 50) healthStatus = 'critical';
    
    return {
      score: healthScore,
      status: healthStatus,
      predictions,
      activeAlerts: activeAlerts.length,
      trends: Object.keys(predictions).map(metric => ({
        metric,
        direction: predictions[metric].trend,
        strength: predictions[metric].strength
      }))
    };
  }

  getDetailedAnalysis() {
    return {
      predictions: this.models,
      trends: this.trends,
      alerts: this.alerts,
      health: this.getHealthPrediction(),
      analysis: {
        timestamp: Date.now(),
        predictionWindow: this.predictionWindow,
        analysisInterval: this.analysisInterval,
        thresholds: this.alertThresholds
      }
    };
  }
}

module.exports = PredictiveHealthMonitor;