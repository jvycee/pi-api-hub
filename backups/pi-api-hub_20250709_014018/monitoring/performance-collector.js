const os = require('os');
const logger = require('../shared/logger');

class PerformanceCollector {
  constructor(options = {}) {
    this.collectInterval = options.collectInterval || 30000; // 30 seconds
    this.retentionTime = options.retentionTime || 24 * 60 * 60 * 1000; // 24 hours
    this.maxDataPoints = options.maxDataPoints || 2880; // 24 hours at 30s intervals
    
    this.metrics = {
      cpu: [],
      memory: [],
      requests: [],
      responses: [],
      errors: [],
      hubspot: [],
      anthropic: [],
      system: []
    };
    
    this.counters = {
      totalRequests: 0,
      totalErrors: 0,
      hubspotCalls: 0,
      anthropicCalls: 0,
      hubspotErrors: 0,
      anthropicErrors: 0
    };
    
    this.responseTimes = [];
    this.errorRates = [];
    
    this.startCollection();
  }

  startCollection() {
    // Collect system metrics
    setInterval(() => {
      this.collectSystemMetrics();
    }, this.collectInterval);
    
    // Clean up old data
    setInterval(() => {
      this.cleanupOldData();
    }, this.collectInterval * 4); // Every 2 minutes
    
    logger.info('Performance collection started', {
      interval: this.collectInterval,
      retention: this.retentionTime,
      maxDataPoints: this.maxDataPoints
    });
  }

  collectSystemMetrics() {
    const timestamp = Date.now();
    
    try {
      // CPU metrics
      const cpus = os.cpus();
      const cpuUsage = this.calculateCPUUsage();
      
      this.addMetric('cpu', {
        timestamp,
        usage: cpuUsage,
        cores: cpus.length,
        loadAverage: os.loadavg(),
        model: cpus[0].model
      });

      // Memory metrics
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const processMemory = process.memoryUsage();
      
      this.addMetric('memory', {
        timestamp,
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercentage: (usedMem / totalMem) * 100,
        process: {
          rss: processMemory.rss,
          heapTotal: processMemory.heapTotal,
          heapUsed: processMemory.heapUsed,
          external: processMemory.external,
          heapUtilization: (processMemory.heapUsed / processMemory.heapTotal) * 100
        }
      });

      // System metrics
      this.addMetric('system', {
        timestamp,
        uptime: os.uptime(),
        processUptime: process.uptime(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        pid: process.pid
      });

    } catch (error) {
      logger.error('Error collecting system metrics:', error);
    }
  }

  calculateCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    
    return Math.round(100 - ~~(100 * idle / total));
  }

  addMetric(type, data) {
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }
    
    this.metrics[type].push(data);
    
    // Keep only recent data points
    if (this.metrics[type].length > this.maxDataPoints) {
      this.metrics[type] = this.metrics[type].slice(-this.maxDataPoints);
    }
  }

  // Track request metrics
  trackRequest(req, res, responseTime) {
    const timestamp = Date.now();
    
    this.counters.totalRequests++;
    this.responseTimes.push(responseTime);
    
    // Keep only recent response times for averaging
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
    
    this.addMetric('requests', {
      timestamp,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      contentLength: res.get('Content-Length') || 0
    });
  }

  // Track API call metrics
  trackAPICall(service, endpoint, responseTime, success = true, errorType = null) {
    const timestamp = Date.now();
    
    if (service === 'hubspot') {
      this.counters.hubspotCalls++;
      if (!success) this.counters.hubspotErrors++;
    } else if (service === 'anthropic') {
      this.counters.anthropicCalls++;
      if (!success) this.counters.anthropicErrors++;
    }
    
    this.addMetric(service, {
      timestamp,
      endpoint,
      responseTime,
      success,
      errorType
    });
  }

  // Track errors
  trackError(error, context = {}) {
    const timestamp = Date.now();
    
    this.counters.totalErrors++;
    
    this.addMetric('errors', {
      timestamp,
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      context
    });
  }

  cleanupOldData() {
    const cutoffTime = Date.now() - this.retentionTime;
    
    Object.keys(this.metrics).forEach(type => {
      this.metrics[type] = this.metrics[type].filter(
        metric => metric.timestamp > cutoffTime
      );
    });
    
    // Clean response times
    this.responseTimes = this.responseTimes.slice(-1000);
  }

  // Get current performance snapshot
  getSnapshot() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Calculate averages for the last hour
    const recentRequests = this.metrics.requests.filter(r => r.timestamp > oneHourAgo);
    const recentResponseTimes = this.responseTimes.slice(-100);
    
    const avgResponseTime = recentResponseTimes.length > 0 ?
      recentResponseTimes.reduce((sum, time) => sum + time, 0) / recentResponseTimes.length : 0;
    
    const errorRate = recentRequests.length > 0 ?
      (recentRequests.filter(r => r.statusCode >= 400).length / recentRequests.length) * 100 : 0;
    
    const requestsPerMinute = recentRequests.length > 0 ?
      (recentRequests.length / 60) : 0;

    // Get latest system metrics
    const latestCPU = this.metrics.cpu[this.metrics.cpu.length - 1];
    const latestMemory = this.metrics.memory[this.metrics.memory.length - 1];
    const latestSystem = this.metrics.system[this.metrics.system.length - 1];
    
    return {
      timestamp: now,
      system: {
        cpu: latestCPU ? {
          usage: latestCPU.usage,
          cores: latestCPU.cores,
          loadAverage: latestCPU.loadAverage
        } : null,
        memory: latestMemory ? {
          totalGB: (latestMemory.total / (1024 * 1024 * 1024)).toFixed(2),
          usedGB: (latestMemory.used / (1024 * 1024 * 1024)).toFixed(2),
          freeGB: (latestMemory.free / (1024 * 1024 * 1024)).toFixed(2),
          usagePercentage: latestMemory.usagePercentage.toFixed(2),
          processHeapMB: (latestMemory.process.heapUsed / (1024 * 1024)).toFixed(2),
          heapUtilization: latestMemory.process.heapUtilization.toFixed(2)
        } : null,
        uptime: latestSystem ? {
          system: Math.round(latestSystem.uptime / 3600) + ' hours',
          process: Math.round(latestSystem.processUptime / 3600) + ' hours'
        } : null
      },
      performance: {
        requestsPerMinute: requestsPerMinute.toFixed(2),
        avgResponseTime: avgResponseTime.toFixed(2) + 'ms',
        errorRate: errorRate.toFixed(2) + '%',
        totalRequests: this.counters.totalRequests,
        totalErrors: this.counters.totalErrors
      },
      apis: {
        hubspot: {
          totalCalls: this.counters.hubspotCalls,
          errors: this.counters.hubspotErrors,
          errorRate: this.counters.hubspotCalls > 0 ?
            ((this.counters.hubspotErrors / this.counters.hubspotCalls) * 100).toFixed(2) + '%' : '0%'
        },
        anthropic: {
          totalCalls: this.counters.anthropicCalls,
          errors: this.counters.anthropicErrors,
          errorRate: this.counters.anthropicCalls > 0 ?
            ((this.counters.anthropicErrors / this.counters.anthropicCalls) * 100).toFixed(2) + '%' : '0%'
        }
      }
    };
  }

  // Get historical data for charts
  getHistoricalData(type, timeRange = '1h') {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000
    };
    
    const cutoffTime = Date.now() - (ranges[timeRange] || ranges['1h']);
    
    if (!this.metrics[type]) {
      return [];
    }
    
    return this.metrics[type].filter(metric => metric.timestamp > cutoffTime);
  }

  // Create middleware for automatic tracking
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        this.trackRequest(req, res, responseTime);
        
        if (res.statusCode >= 400) {
          this.trackError(new Error(`HTTP ${res.statusCode} - ${req.method} ${req.path}`), {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            responseTime
          });
        }
      });
      
      next();
    };
  }

  // Reset all metrics (useful for testing)
  reset() {
    Object.keys(this.metrics).forEach(key => {
      this.metrics[key] = [];
    });
    
    Object.keys(this.counters).forEach(key => {
      this.counters[key] = 0;
    });
    
    this.responseTimes = [];
    this.errorRates = [];
    
    logger.info('Performance metrics reset');
  }

  // Export metrics for external monitoring systems
  exportMetrics() {
    return {
      metrics: this.metrics,
      counters: this.counters,
      snapshot: this.getSnapshot(),
      exportTime: Date.now()
    };
  }
}

module.exports = PerformanceCollector;