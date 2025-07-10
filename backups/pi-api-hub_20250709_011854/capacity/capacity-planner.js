const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

/**
 * 🍌 BANANA-POWERED CAPACITY PLANNER 🍌
 * Predictive scaling and capacity planning system
 */
class CapacityPlanner {
  constructor(options = {}) {
    this.predictionWindow = options.predictionWindow || 30 * 60 * 1000; // 30 minutes
    this.historyRetention = options.historyRetention || 7 * 24 * 60 * 60 * 1000; // 7 days
    this.scalingThresholds = options.scalingThresholds || {
      cpu: { scaleUp: 70, scaleDown: 30 },
      memory: { scaleUp: 80, scaleDown: 40 },
      requests: { scaleUp: 100, scaleDown: 20 }
    };
    
    // Historical data storage
    this.metricsHistory = [];
    this.patternHistory = [];
    this.scalingEvents = [];
    
    // Prediction models
    this.patterns = {
      hourly: new Map(),
      daily: new Map(),
      weekly: new Map()
    };
    
    // Current system state
    this.currentCapacity = {
      cpuCores: 4, // Pi 5 has 4 cores
      memoryGB: 8, // Pi 5 has 8GB RAM
      maxConcurrentRequests: 25,
      currentLoad: {
        cpu: 0,
        memory: 0,
        requests: 0
      }
    };
    
    this.initializePatterns();
    this.startMetricsCollection();
    
    logger.info('🍌 Capacity Planner initialized', {
      predictionWindow: this.predictionWindow,
      historyRetention: this.historyRetention,
      scalingThresholds: this.scalingThresholds
    });
  }

  /**
   * Initialize pattern recognition
   */
  initializePatterns() {
    // Common traffic patterns
    this.patterns.hourly.set('business_hours', {
      pattern: [20, 15, 10, 5, 5, 10, 30, 60, 80, 100, 90, 85, 80, 85, 90, 95, 100, 90, 70, 50, 40, 30, 25, 20],
      confidence: 0.8,
      description: 'Standard business hours traffic'
    });
    
    this.patterns.daily.set('weekday', {
      pattern: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.0], // Mon-Sun multipliers
      confidence: 0.7,
      description: 'Weekday vs weekend traffic pattern'
    });
    
    this.patterns.weekly.set('monthly', {
      pattern: [0.9, 0.95, 1.0, 1.05, 0.8], // Week 1-5 multipliers
      confidence: 0.6,
      description: 'Monthly traffic variation'
    });
  }

  /**
   * Record system metrics
   */
  recordMetrics(metrics) {
    const timestamp = Date.now();
    const metricsEntry = {
      timestamp,
      cpu: metrics.cpu || 0,
      memory: metrics.memory || 0,
      requests: metrics.requests || 0,
      responseTime: metrics.responseTime || 0,
      errors: metrics.errors || 0,
      throughput: metrics.throughput || 0,
      connections: metrics.connections || 0
    };
    
    this.metricsHistory.push(metricsEntry);
    this.currentCapacity.currentLoad = {
      cpu: metrics.cpu || 0,
      memory: metrics.memory || 0,
      requests: metrics.requests || 0
    };
    
    // Maintain history size
    this.cleanupOldMetrics();
    
    // Update patterns
    this.updatePatterns(metricsEntry);
    
    // Check for scaling needs
    this.evaluateScalingNeeds(metricsEntry);
  }

  /**
   * Update pattern recognition models
   */
  updatePatterns(metrics) {
    const now = new Date(metrics.timestamp);
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    const weekOfMonth = Math.ceil(now.getDate() / 7);
    
    // Update hourly patterns
    this.updateHourlyPattern(hour, metrics);
    
    // Update daily patterns
    this.updateDailyPattern(dayOfWeek, metrics);
    
    // Update weekly patterns
    this.updateWeeklyPattern(weekOfMonth, metrics);
  }

  /**
   * Update hourly traffic patterns
   */
  updateHourlyPattern(hour, metrics) {
    const patternKey = this.detectHourlyPattern(hour, metrics);
    
    if (!this.patterns.hourly.has(patternKey)) {
      this.patterns.hourly.set(patternKey, {
        pattern: new Array(24).fill(0),
        confidence: 0.1,
        description: `Learned pattern: ${patternKey}`,
        sampleCount: 0
      });
    }
    
    const pattern = this.patterns.hourly.get(patternKey);
    const weight = Math.min(pattern.sampleCount + 1, 100);
    
    // Exponential moving average
    pattern.pattern[hour] = (pattern.pattern[hour] * (weight - 1) + metrics.requests) / weight;
    pattern.sampleCount++;
    pattern.confidence = Math.min(pattern.confidence + 0.01, 1.0);
  }

  /**
   * Detect hourly pattern type
   */
  detectHourlyPattern(hour, metrics) {
    // Detect if this is business hours, late night, etc.
    if (hour >= 9 && hour <= 17) {
      return 'business_hours';
    } else if (hour >= 22 || hour <= 6) {
      return 'low_activity';
    } else {
      return 'moderate_activity';
    }
  }

  /**
   * Predict future capacity needs
   */
  predictCapacityNeeds(lookaheadMinutes = 30) {
    const now = Date.now();
    const futureTime = now + (lookaheadMinutes * 60 * 1000);
    const futureDate = new Date(futureTime);
    
    // Get base prediction from patterns
    const prediction = this.calculateBasePrediction(futureDate);
    
    // Apply trend analysis
    const trendMultiplier = this.calculateTrendMultiplier();
    
    // Apply seasonal adjustments
    const seasonalMultiplier = this.calculateSeasonalMultiplier(futureDate);
    
    // Final prediction
    const finalPrediction = {
      timestamp: futureTime,
      expectedLoad: {
        cpu: prediction.cpu * trendMultiplier * seasonalMultiplier,
        memory: prediction.memory * trendMultiplier * seasonalMultiplier,
        requests: prediction.requests * trendMultiplier * seasonalMultiplier
      },
      confidence: prediction.confidence * 0.8, // Reduce confidence for future predictions
      recommendations: []
    };
    
    // Generate scaling recommendations
    finalPrediction.recommendations = this.generateScalingRecommendations(finalPrediction.expectedLoad);
    
    return finalPrediction;
  }

  /**
   * Calculate base prediction from patterns
   */
  calculateBasePrediction(futureDate) {
    const hour = futureDate.getHours();
    const dayOfWeek = futureDate.getDay();
    
    // Get hourly pattern
    const hourlyPattern = this.getBestHourlyPattern();
    const hourlyMultiplier = hourlyPattern.pattern[hour] / 100;
    
    // Get daily pattern
    const dailyPattern = this.patterns.daily.get('weekday');
    const dailyMultiplier = dailyPattern ? dailyPattern.pattern[dayOfWeek] : 1.0;
    
    // Calculate recent average load
    const recentMetrics = this.getRecentMetrics(60 * 60 * 1000); // Last hour
    const avgLoad = this.calculateAverageLoad(recentMetrics);
    
    return {
      cpu: avgLoad.cpu * hourlyMultiplier * dailyMultiplier,
      memory: avgLoad.memory * hourlyMultiplier * dailyMultiplier,
      requests: avgLoad.requests * hourlyMultiplier * dailyMultiplier,
      confidence: (hourlyPattern.confidence + (dailyPattern?.confidence || 0.5)) / 2
    };
  }

  /**
   * Calculate trend multiplier
   */
  calculateTrendMultiplier() {
    const recentMetrics = this.getRecentMetrics(2 * 60 * 60 * 1000); // Last 2 hours
    if (recentMetrics.length < 10) return 1.0;
    
    const oldHalf = recentMetrics.slice(0, Math.floor(recentMetrics.length / 2));
    const newHalf = recentMetrics.slice(Math.floor(recentMetrics.length / 2));
    
    const oldAvg = this.calculateAverageLoad(oldHalf);
    const newAvg = this.calculateAverageLoad(newHalf);
    
    // Calculate trend (weighted average of CPU, memory, requests)
    const cpuTrend = newAvg.cpu / oldAvg.cpu;
    const memoryTrend = newAvg.memory / oldAvg.memory;
    const requestsTrend = newAvg.requests / oldAvg.requests;
    
    return (cpuTrend + memoryTrend + requestsTrend) / 3;
  }

  /**
   * Calculate seasonal multiplier
   */
  calculateSeasonalMultiplier(futureDate) {
    // Simple seasonal adjustments
    const hour = futureDate.getHours();
    const dayOfWeek = futureDate.getDay();
    
    // Weekend reduction
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return 0.7;
    }
    
    // Lunch time spike
    if (hour >= 12 && hour <= 14) {
      return 1.2;
    }
    
    // Evening reduction
    if (hour >= 18 && hour <= 22) {
      return 0.8;
    }
    
    return 1.0;
  }

  /**
   * Evaluate current scaling needs
   */
  evaluateScalingNeeds(currentMetrics) {
    const recommendations = [];
    
    // CPU scaling
    if (currentMetrics.cpu > this.scalingThresholds.cpu.scaleUp) {
      recommendations.push({
        type: 'scale_up',
        resource: 'cpu',
        current: currentMetrics.cpu,
        threshold: this.scalingThresholds.cpu.scaleUp,
        urgency: 'high',
        action: 'Increase CPU allocation or add more workers'
      });
    } else if (currentMetrics.cpu < this.scalingThresholds.cpu.scaleDown) {
      recommendations.push({
        type: 'scale_down',
        resource: 'cpu',
        current: currentMetrics.cpu,
        threshold: this.scalingThresholds.cpu.scaleDown,
        urgency: 'low',
        action: 'Consider reducing CPU allocation'
      });
    }
    
    // Memory scaling
    if (currentMetrics.memory > this.scalingThresholds.memory.scaleUp) {
      recommendations.push({
        type: 'scale_up',
        resource: 'memory',
        current: currentMetrics.memory,
        threshold: this.scalingThresholds.memory.scaleUp,
        urgency: 'high',
        action: 'Increase memory allocation or optimize memory usage'
      });
    }
    
    // Request scaling
    if (currentMetrics.requests > this.scalingThresholds.requests.scaleUp) {
      recommendations.push({
        type: 'scale_up',
        resource: 'requests',
        current: currentMetrics.requests,
        threshold: this.scalingThresholds.requests.scaleUp,
        urgency: 'medium',
        action: 'Increase maximum concurrent requests or add load balancing'
      });
    }
    
    // Log recommendations
    if (recommendations.length > 0) {
      logger.warn('🚨 Scaling recommendations generated', {
        recommendations: recommendations.map(r => ({
          type: r.type,
          resource: r.resource,
          urgency: r.urgency,
          action: r.action
        }))
      });
    }
    
    return recommendations;
  }

  /**
   * Generate scaling recommendations based on predicted load
   */
  generateScalingRecommendations(expectedLoad) {
    const recommendations = [];
    
    // Proactive scaling recommendations
    if (expectedLoad.cpu > this.scalingThresholds.cpu.scaleUp * 0.8) {
      recommendations.push({
        type: 'proactive_scale_up',
        resource: 'cpu',
        expected: expectedLoad.cpu,
        threshold: this.scalingThresholds.cpu.scaleUp,
        urgency: 'medium',
        action: 'Prepare for CPU scaling - expected high load'
      });
    }
    
    if (expectedLoad.memory > this.scalingThresholds.memory.scaleUp * 0.8) {
      recommendations.push({
        type: 'proactive_scale_up',
        resource: 'memory',
        expected: expectedLoad.memory,
        threshold: this.scalingThresholds.memory.scaleUp,
        urgency: 'medium',
        action: 'Prepare for memory scaling - expected high load'
      });
    }
    
    if (expectedLoad.requests > this.scalingThresholds.requests.scaleUp * 0.8) {
      recommendations.push({
        type: 'proactive_scale_up',
        resource: 'requests',
        expected: expectedLoad.requests,
        threshold: this.scalingThresholds.requests.scaleUp,
        urgency: 'medium',
        action: 'Prepare for request scaling - expected high traffic'
      });
    }
    
    return recommendations;
  }

  /**
   * Get capacity planning report
   */
  getCapacityReport() {
    const currentTime = Date.now();
    const prediction30min = this.predictCapacityNeeds(30);
    const prediction1hour = this.predictCapacityNeeds(60);
    const prediction2hours = this.predictCapacityNeeds(120);
    
    const recentMetrics = this.getRecentMetrics(60 * 60 * 1000); // Last hour
    const avgLoad = this.calculateAverageLoad(recentMetrics);
    
    return {
      timestamp: new Date(currentTime).toISOString(),
      currentCapacity: this.currentCapacity,
      currentLoad: avgLoad,
      utilization: {
        cpu: (avgLoad.cpu / 100 * 100).toFixed(2),
        memory: (avgLoad.memory / 100 * 100).toFixed(2),
        requests: (avgLoad.requests / this.currentCapacity.maxConcurrentRequests * 100).toFixed(2)
      },
      predictions: {
        '30min': prediction30min,
        '1hour': prediction1hour,
        '2hours': prediction2hours
      },
      recommendations: this.evaluateScalingNeeds(avgLoad),
      patterns: {
        hourly: this.getBestHourlyPattern(),
        confidence: this.calculateOverallConfidence()
      },
      history: {
        metricsCount: this.metricsHistory.length,
        scalingEvents: this.scalingEvents.length,
        oldestMetric: this.metricsHistory.length > 0 ? 
          new Date(this.metricsHistory[0].timestamp).toISOString() : null
      }
    };
  }

  /**
   * Get optimization recommendations
   */
  getOptimizationRecommendations() {
    const report = this.getCapacityReport();
    const recommendations = [];
    
    // CPU optimization
    if (report.currentLoad.cpu > 60) {
      recommendations.push({
        category: 'cpu',
        priority: 'high',
        recommendation: 'CPU usage is high - consider code optimization or horizontal scaling',
        impact: 'Improved response times and stability'
      });
    }
    
    // Memory optimization
    if (report.currentLoad.memory > 70) {
      recommendations.push({
        category: 'memory',
        priority: 'high',
        recommendation: 'Memory usage is high - check for memory leaks and optimize data structures',
        impact: 'Reduced memory pressure and better performance'
      });
    }
    
    // Request optimization
    if (report.currentLoad.requests > 80) {
      recommendations.push({
        category: 'requests',
        priority: 'medium',
        recommendation: 'High request volume - consider caching and load balancing',
        impact: 'Better request handling and reduced server load'
      });
    }
    
    // Pattern-based recommendations
    const hourlyPattern = this.getBestHourlyPattern();
    const peakHours = this.findPeakHours(hourlyPattern);
    
    if (peakHours.length > 0) {
      recommendations.push({
        category: 'scheduling',
        priority: 'medium',
        recommendation: `Peak hours detected: ${peakHours.join(', ')}:00 - consider proactive scaling`,
        impact: 'Better prepared for traffic spikes'
      });
    }
    
    return recommendations;
  }

  /**
   * Helper methods
   */
  getBestHourlyPattern() {
    let bestPattern = null;
    let bestConfidence = 0;
    
    for (const pattern of this.patterns.hourly.values()) {
      if (pattern.confidence > bestConfidence) {
        bestConfidence = pattern.confidence;
        bestPattern = pattern;
      }
    }
    
    return bestPattern || {
      pattern: new Array(24).fill(50),
      confidence: 0.1,
      description: 'Default pattern'
    };
  }

  getRecentMetrics(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.metricsHistory.filter(m => m.timestamp >= cutoff);
  }

  calculateAverageLoad(metrics) {
    if (metrics.length === 0) {
      return { cpu: 0, memory: 0, requests: 0 };
    }
    
    const totals = metrics.reduce((acc, m) => ({
      cpu: acc.cpu + m.cpu,
      memory: acc.memory + m.memory,
      requests: acc.requests + m.requests
    }), { cpu: 0, memory: 0, requests: 0 });
    
    return {
      cpu: totals.cpu / metrics.length,
      memory: totals.memory / metrics.length,
      requests: totals.requests / metrics.length
    };
  }

  calculateOverallConfidence() {
    const patterns = Array.from(this.patterns.hourly.values());
    const avgConfidence = patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
    return Math.min(avgConfidence, 1.0);
  }

  findPeakHours(pattern) {
    const avg = pattern.pattern.reduce((sum, val) => sum + val, 0) / pattern.pattern.length;
    const threshold = avg * 1.5; // 50% above average
    
    return pattern.pattern
      .map((val, hour) => ({ hour, val }))
      .filter(item => item.val > threshold)
      .map(item => item.hour);
  }

  cleanupOldMetrics() {
    const cutoff = Date.now() - this.historyRetention;
    this.metricsHistory = this.metricsHistory.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      // Collect system metrics (would integrate with actual system monitoring)
      const mockMetrics = {
        cpu: Math.random() * 100,
        memory: Math.random() * 100,
        requests: Math.floor(Math.random() * 50),
        responseTime: Math.random() * 1000,
        errors: Math.floor(Math.random() * 5),
        throughput: Math.random() * 1000,
        connections: Math.floor(Math.random() * 100)
      };
      
      this.recordMetrics(mockMetrics);
    }, 30000); // Every 30 seconds
  }
}

module.exports = CapacityPlanner;