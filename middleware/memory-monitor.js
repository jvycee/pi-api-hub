const logger = require('../shared/logger');

class MemoryMonitor {
  constructor(options = {}) {
    this.warningThreshold = options.warningThreshold || 6 * 1024 * 1024 * 1024; // 6GB
    this.criticalThreshold = options.criticalThreshold || 7 * 1024 * 1024 * 1024; // 7GB
    this.logInterval = options.logInterval || 60000; // 1 minute
    this.gcThreshold = options.gcThreshold || 0.8; // 80% memory usage
    
    // Store interval ID for cleanup
    this.monitoringInterval = null;
    
    this.startMonitoring();
  }

  getMemoryUsage() {
    const usage = process.memoryUsage();
    const system = {
      rss: usage.rss, // Resident Set Size
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers
    };
    
    return {
      ...system,
      heapUtilization: (usage.heapUsed / usage.heapTotal) * 100,
      totalMemory: usage.rss + usage.external
    };
  }

  formatBytes(bytes) {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  }

  checkMemoryHealth() {
    const memory = this.getMemoryUsage();
    
    if (memory.totalMemory > this.criticalThreshold) {
      logger.error('CRITICAL: Memory usage exceeds safe threshold', {
        totalMemory: this.formatBytes(memory.totalMemory),
        threshold: this.formatBytes(this.criticalThreshold),
        heapUtilization: `${memory.heapUtilization.toFixed(2)}%`
      });
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        logger.info('Forced garbage collection due to high memory usage');
      }
      
      return 'critical';
    }
    
    if (memory.totalMemory > this.warningThreshold) {
      logger.warn('WARNING: Memory usage approaching threshold', {
        totalMemory: this.formatBytes(memory.totalMemory),
        threshold: this.formatBytes(this.warningThreshold),
        heapUtilization: `${memory.heapUtilization.toFixed(2)}%`
      });
      
      return 'warning';
    }
    
    return 'healthy';
  }

  startMonitoring() {
    this.monitoringInterval = setInterval(() => {
      const memory = this.getMemoryUsage();
      const status = this.checkMemoryHealth();
      
      if (status === 'healthy') {
        logger.info('Memory Status: Healthy', {
          totalMemory: this.formatBytes(memory.totalMemory),
          heapUtilization: `${memory.heapUtilization.toFixed(2)}%`,
          rss: this.formatBytes(memory.rss),
          heapUsed: this.formatBytes(memory.heapUsed)
        });
      }
      
      // Suggest GC if heap utilization is high
      if (memory.heapUtilization > this.gcThreshold * 100 && global.gc) {
        global.gc();
        logger.info('Performed garbage collection', {
          heapUtilization: `${memory.heapUtilization.toFixed(2)}%`
        });
      }
      
    }, this.logInterval);
  }

  // Middleware function
  middleware() {
    return (req, res, next) => {
      const startMemory = this.getMemoryUsage();
      
      // Add memory info to response headers in development
      if (process.env.NODE_ENV !== 'production') {
        res.setHeader('X-Memory-Usage', this.formatBytes(startMemory.totalMemory));
        res.setHeader('X-Heap-Utilization', `${startMemory.heapUtilization.toFixed(2)}%`);
      }
      
      // Track memory usage for this request
      res.on('finish', () => {
        const endMemory = this.getMemoryUsage();
        const memoryDelta = endMemory.totalMemory - startMemory.totalMemory;
        
        if (memoryDelta > 100 * 1024 * 1024) { // Log if request used > 100MB
          logger.warn('High memory usage request', {
            method: req.method,
            path: req.path,
            memoryDelta: this.formatBytes(memoryDelta),
            finalMemory: this.formatBytes(endMemory.totalMemory)
          });
        }
      });
      
      next();
    };
  }

  // Get current memory status for health endpoint
  getStatus() {
    const memory = this.getMemoryUsage();
    const status = this.checkMemoryHealth();
    
    return {
      status,
      totalMemory: this.formatBytes(memory.totalMemory),
      heapUtilization: `${memory.heapUtilization.toFixed(2)}%`,
      rss: this.formatBytes(memory.rss),
      heapUsed: this.formatBytes(memory.heapUsed),
      heapTotal: this.formatBytes(memory.heapTotal),
      external: this.formatBytes(memory.external),
      thresholds: {
        warning: this.formatBytes(this.warningThreshold),
        critical: this.formatBytes(this.criticalThreshold)
      }
    };
  }

  // Clean up monitoring interval
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Memory monitoring stopped and interval cleaned up');
    }
  }
}

module.exports = MemoryMonitor;