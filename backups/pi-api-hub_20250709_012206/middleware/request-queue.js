const logger = require('../shared/logger');
const config = require('../shared/config');

class RequestQueue {
  constructor(options = {}) {
    this.maxConcurrent = options.maxConcurrent || config.performance.maxConcurrentRequests;
    this.maxResponseSize = options.maxResponseSize || config.performance.maxResponseSize;
    this.queue = [];
    this.activeRequests = 0;
    this.totalQueued = 0;
    this.totalProcessed = 0;
    
    // Dynamic timeout configuration
    this.baseTimeout = options.baseTimeout || 30000; // 30 seconds base
    this.maxTimeout = options.maxTimeout || 120000; // 2 minutes max
    this.minTimeout = options.minTimeout || 10000; // 10 seconds min
    
    // Performance tracking for dynamic timeout
    this.requestTimes = [];
    this.maxRequestTimeHistory = 100; // Keep last 100 request times
  }

  // Calculate dynamic timeout based on system load and performance
  calculateDynamicTimeout() {
    // Base factors for timeout calculation
    const queueLoad = this.queue.length;
    const systemLoad = this.activeRequests / this.maxConcurrent;
    
    // Average request time factor
    let avgRequestTime = this.baseTimeout;
    if (this.requestTimes.length > 0) {
      const sum = this.requestTimes.reduce((a, b) => a + b, 0);
      avgRequestTime = sum / this.requestTimes.length;
    }
    
    // Memory pressure factor (check current memory usage)
    const memoryUsage = process.memoryUsage();
    const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    // Calculate dynamic timeout with multiple factors
    let dynamicTimeout = this.baseTimeout;
    
    // Queue load factor (more queued requests = longer timeout)
    dynamicTimeout += queueLoad * 2000; // +2 seconds per queued request
    
    // System load factor (higher concurrent usage = longer timeout)
    dynamicTimeout += systemLoad * 20000; // Up to +20 seconds at full load
    
    // Average request time factor (slower requests = longer timeout)
    if (avgRequestTime > this.baseTimeout) {
      dynamicTimeout += (avgRequestTime - this.baseTimeout) * 0.5;
    }
    
    // Memory pressure factor (high memory usage = shorter timeout)
    if (memoryPressure > 0.8) {
      dynamicTimeout *= 0.7; // Reduce timeout by 30% under memory pressure
    }
    
    // Clamp to min/max bounds
    dynamicTimeout = Math.max(this.minTimeout, Math.min(this.maxTimeout, dynamicTimeout));
    
    logger.debug('Dynamic timeout calculated', {
      queueLoad,
      systemLoad: `${(systemLoad * 100).toFixed(1)}%`,
      avgRequestTime: `${avgRequestTime.toFixed(0)}ms`,
      memoryPressure: `${(memoryPressure * 100).toFixed(1)}%`,
      calculatedTimeout: `${dynamicTimeout.toFixed(0)}ms`
    });
    
    return Math.round(dynamicTimeout);
  }

  // Middleware to queue requests and limit response size
  middleware() {
    return (req, res, next) => {
      // Check if we're at capacity
      if (this.activeRequests >= this.maxConcurrent) {
        this.queue.push({ req, res, next });
        this.totalQueued++;
        
        logger.info('Request queued due to high load', {
          path: req.path,
          method: req.method,
          queueLength: this.queue.length,
          activeRequests: this.activeRequests
        });
        
        // Set a dynamic timeout for queued requests
        const dynamicTimeout = this.calculateDynamicTimeout();
        const timeout = setTimeout(() => {
          const index = this.queue.findIndex(item => item.req === req);
          if (index !== -1) {
            this.queue.splice(index, 1);
            res.status(503).json({
              success: false,
              error: 'Request timeout in queue',
              timeout: `${dynamicTimeout}ms`,
              queueStats: this.getStats()
            });
          }
        }, dynamicTimeout);
        
        // Clear timeout when request is processed
        req.on('close', () => clearTimeout(timeout));
        
        return;
      }

      // Process the request
      this.processRequest(req, res, next);
    };
  }

  processRequest(req, res, next) {
    this.activeRequests++;
    const startTime = Date.now();
    
    // Add response size limiting only if not already wrapped
    if (!res._queueSizeLimited) {
      const originalSend = res.send;
      const originalJson = res.json;
      
      res.send = (body) => {
        if (res.headersSent || res.finished) {
          return;
        }
        if (this.checkResponseSize(body, req.path)) {
          return originalSend.call(res, body);
        } else {
          res.status(413);
          return originalJson.call(res, {
            success: false,
            error: 'Response too large for Pi memory constraints',
            maxSize: this.formatBytes(this.maxResponseSize)
          });
        }
      };
      
      res.json = (obj) => {
        if (res.headersSent || res.finished) {
          return;
        }
        const body = JSON.stringify(obj);
        if (this.checkResponseSize(body, req.path)) {
          return originalJson.call(res, obj);
        } else {
          res.status(413);
          return originalJson.call(res, {
            success: false,
            error: 'Response too large for Pi memory constraints',
            maxSize: this.formatBytes(this.maxResponseSize)
          });
        }
      };
      
      res._queueSizeLimited = true;
    }

    // Track request completion
    const cleanup = () => {
      this.activeRequests--;
      this.totalProcessed++;
      
      // Track request time for dynamic timeout calculation
      const requestTime = Date.now() - startTime;
      this.requestTimes.push(requestTime);
      
      // Keep only recent request times
      if (this.requestTimes.length > this.maxRequestTimeHistory) {
        this.requestTimes.shift();
      }
      
      // Log slow requests
      if (requestTime > this.baseTimeout * 0.8) {
        logger.warn('Slow request detected', {
          path: req.path,
          method: req.method,
          duration: `${requestTime}ms`,
          threshold: `${this.baseTimeout * 0.8}ms`
        });
      }
      
      // Process next request in queue
      if (this.queue.length > 0) {
        const nextRequest = this.queue.shift();
        setImmediate(() => {
          this.processRequest(nextRequest.req, nextRequest.res, nextRequest.next);
        });
      }
    };

    res.on('finish', cleanup);
    res.on('close', cleanup);
    res.on('error', cleanup);

    next();
  }

  checkResponseSize(body, path) {
    const size = Buffer.byteLength(body, 'utf8');
    
    if (size > this.maxResponseSize) {
      logger.warn('Response size limit exceeded', {
        path,
        size: this.formatBytes(size),
        limit: this.formatBytes(this.maxResponseSize)
      });
      return false;
    }
    
    if (size > this.maxResponseSize * 0.8) { // Warn at 80% of limit
      logger.warn('Large response detected', {
        path,
        size: this.formatBytes(size),
        limit: this.formatBytes(this.maxResponseSize)
      });
    }
    
    return true;
  }

  formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }

  getStats() {
    const avgRequestTime = this.requestTimes.length > 0 
      ? this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length 
      : 0;
    
    const currentTimeout = this.calculateDynamicTimeout();
    
    return {
      activeRequests: this.activeRequests,
      queueLength: this.queue.length,
      totalQueued: this.totalQueued,
      totalProcessed: this.totalProcessed,
      maxConcurrent: this.maxConcurrent,
      maxResponseSize: this.formatBytes(this.maxResponseSize),
      dynamicTimeout: {
        current: `${currentTimeout}ms`,
        base: `${this.baseTimeout}ms`,
        min: `${this.minTimeout}ms`,
        max: `${this.maxTimeout}ms`,
        avgRequestTime: `${avgRequestTime.toFixed(0)}ms`,
        requestSamples: this.requestTimes.length
      }
    };
  }

  // Health check method
  getHealth() {
    const queueUtilization = (this.activeRequests / this.maxConcurrent) * 100;
    
    let status = 'healthy';
    if (queueUtilization > 80) {
      status = 'warning';
    }
    if (queueUtilization >= 100) {
      status = 'critical';
    }
    
    return {
      status,
      queueUtilization: `${queueUtilization.toFixed(2)}%`,
      ...this.getStats()
    };
  }
}

module.exports = RequestQueue;