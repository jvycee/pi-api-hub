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
        
        // Set a timeout for queued requests
        const timeout = setTimeout(() => {
          const index = this.queue.findIndex(item => item.req === req);
          if (index !== -1) {
            this.queue.splice(index, 1);
            res.status(503).json({
              success: false,
              error: 'Request timeout in queue',
              queueStats: this.getStats()
            });
          }
        }, 30000); // 30 second timeout
        
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
    return {
      activeRequests: this.activeRequests,
      queueLength: this.queue.length,
      totalQueued: this.totalQueued,
      totalProcessed: this.totalProcessed,
      maxConcurrent: this.maxConcurrent,
      maxResponseSize: this.formatBytes(this.maxResponseSize)
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