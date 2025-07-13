const cluster = require('cluster');
const logger = require('../shared/logger');

class AutoRestartManager {
  constructor(options = {}) {
    this.memoryThreshold = options.memoryThreshold || 7.5 * 1024 * 1024 * 1024; // 7.5GB - Pi 5 optimized
    this.cpuThreshold = options.cpuThreshold || 95; // 95%
    this.errorThreshold = options.errorThreshold || 50; // 50 errors per minute
    this.checkInterval = options.checkInterval || 30000; // 30 seconds
    this.gracefulShutdownTimeout = options.gracefulShutdownTimeout || 10000; // 10 seconds
    this.cooldownPeriod = options.cooldownPeriod || 60000; // 1 minute
    this.maxRestarts = options.maxRestarts || 5;
    
    this.restartCount = 0;
    this.lastRestartTime = 0;
    this.errorCount = 0;
    this.lastErrorCount = 0;
    this.consecutiveHighCpu = 0;
    this.consecutiveHighMemory = 0;
    
    this.performanceCollector = null;
    this.memoryMonitor = null;
    
    this.startMonitoring();
  }

  setMonitors(performanceCollector, memoryMonitor) {
    this.performanceCollector = performanceCollector;
    this.memoryMonitor = memoryMonitor;
  }

  startMonitoring() {
    setInterval(() => {
      this.checkSystemHealth();
    }, this.checkInterval);
    
    // Reset error count every minute
    setInterval(() => {
      this.lastErrorCount = this.errorCount;
      this.errorCount = 0;
    }, 60000);
    
    logger.info('Auto-restart monitoring started', {
      memoryThreshold: this.formatBytes(this.memoryThreshold),
      cpuThreshold: this.cpuThreshold + '%',
      errorThreshold: this.errorThreshold + '/min',
      checkInterval: this.checkInterval + 'ms'
    });
  }

  async checkSystemHealth() {
    try {
      const shouldRestart = await this.evaluateRestartConditions();
      
      if (shouldRestart.restart) {
        await this.initiateRestart(shouldRestart.reason);
      }
      
    } catch (error) {
      logger.error('Error during health check:', error);
    }
  }

  async evaluateRestartConditions() {
    const conditions = {
      restart: false,
      reason: '',
      details: {}
    };

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.rss + memoryUsage.external;
    
    if (totalMemory > this.memoryThreshold) {
      this.consecutiveHighMemory++;
      
      if (this.consecutiveHighMemory >= 3) { // 3 consecutive checks
        conditions.restart = true;
        conditions.reason = 'High memory usage';
        conditions.details.memory = {
          current: this.formatBytes(totalMemory),
          threshold: this.formatBytes(this.memoryThreshold),
          consecutiveChecks: this.consecutiveHighMemory
        };
      }
    } else {
      this.consecutiveHighMemory = 0;
    }

    // Check CPU usage (if performance collector is available)
    if (this.performanceCollector) {
      const snapshot = this.performanceCollector.getSnapshot();
      const cpuUsage = snapshot.system.cpu?.usage || 0;
      
      if (cpuUsage > this.cpuThreshold) {
        this.consecutiveHighCpu++;
        
        if (this.consecutiveHighCpu >= 5) { // 5 consecutive checks (2.5 minutes)
          conditions.restart = true;
          conditions.reason = 'High CPU usage';
          conditions.details.cpu = {
            current: cpuUsage + '%',
            threshold: this.cpuThreshold + '%',
            consecutiveChecks: this.consecutiveHighCpu
          };
        }
      } else {
        this.consecutiveHighCpu = 0;
      }
    }

    // Check error rate
    const errorsPerMinute = this.lastErrorCount;
    if (errorsPerMinute > this.errorThreshold) {
      conditions.restart = true;
      conditions.reason = 'High error rate';
      conditions.details.errors = {
        current: errorsPerMinute + '/min',
        threshold: this.errorThreshold + '/min'
      };
    }

    // Check if we're in cooldown period
    const timeSinceLastRestart = Date.now() - this.lastRestartTime;
    if (conditions.restart && timeSinceLastRestart < this.cooldownPeriod) {
      logger.warn('Restart prevented by cooldown period', {
        reason: conditions.reason,
        timeSinceLastRestart: timeSinceLastRestart + 'ms',
        cooldownPeriod: this.cooldownPeriod + 'ms'
      });
      conditions.restart = false;
    }

    // Check max restart limit
    if (conditions.restart && this.restartCount >= this.maxRestarts) {
      logger.error('Maximum restart limit reached, not restarting', {
        restartCount: this.restartCount,
        maxRestarts: this.maxRestarts,
        reason: conditions.reason
      });
      conditions.restart = false;
    }

    return conditions;
  }

  async initiateRestart(reason) {
    this.restartCount++;
    this.lastRestartTime = Date.now();
    
    logger.warn('Initiating auto-restart', {
      reason,
      restartCount: this.restartCount,
      maxRestarts: this.maxRestarts,
      pid: process.pid
    });

    if (cluster.isWorker) {
      // Worker process - disconnect and exit gracefully
      await this.gracefulWorkerShutdown(reason);
    } else {
      // Master process - restart all workers
      await this.restartAllWorkers(reason);
    }
  }

  async gracefulWorkerShutdown(reason) {
    try {
      // Notify master process
      if (process.send) {
        process.send({
          type: 'worker-restart-request',
          reason,
          pid: process.pid,
          timestamp: Date.now()
        });
      }

      // Stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          logger.info('Server closed, exiting worker process');
        });
      }

      // Force exit after timeout
      setTimeout(() => {
        logger.warn('Graceful shutdown timeout, forcing exit');
        process.exit(1);
      }, this.gracefulShutdownTimeout);

      // Exit gracefully
      setTimeout(() => {
        process.exit(0);
      }, 1000);

    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  async restartAllWorkers(reason) {
    if (!cluster.isMaster) return;

    logger.info('Restarting all workers', { reason });

    const workers = Object.values(cluster.workers);
    
    // Restart workers one by one
    for (const worker of workers) {
      if (worker && !worker.isDead()) {
        try {
          // Send restart signal
          worker.send({
            type: 'restart-signal',
            reason,
            timestamp: Date.now()
          });

          // Give worker time to shut down gracefully
          await new Promise(resolve => {
            const timeout = setTimeout(() => {
              if (!worker.isDead()) {
                logger.warn(`Force killing worker ${worker.process.pid}`);
                worker.kill('SIGKILL');
              }
              resolve();
            }, this.gracefulShutdownTimeout);

            worker.on('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          });

          // Fork new worker
          const newWorker = cluster.fork();
          logger.info(`New worker ${newWorker.process.pid} started to replace ${worker.process.pid}`);

          // Wait for new worker to be ready
          await new Promise(resolve => {
            newWorker.on('listening', resolve);
            setTimeout(resolve, 5000); // Timeout after 5 seconds
          });

        } catch (error) {
          logger.error(`Error restarting worker ${worker.process.pid}:`, error);
        }
      }
    }

    logger.info('All workers restarted successfully');
  }

  // Track errors for restart evaluation
  trackError(error, context = {}) {
    this.errorCount++;
    
    // Log high-severity errors immediately
    if (this.isCriticalError(error)) {
      logger.error('Critical error detected', {
        error: error.message,
        context,
        errorCount: this.errorCount
      });
    }
  }

  isCriticalError(error) {
    const criticalPatterns = [
      /ECONNREFUSED/,
      /ETIMEDOUT/,
      /Memory limit exceeded/,
      /Maximum call stack size exceeded/,
      /Cannot read property.*of undefined/
    ];
    
    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  // Get restart statistics
  getStats() {
    return {
      restartCount: this.restartCount,
      lastRestartTime: this.lastRestartTime,
      maxRestarts: this.maxRestarts,
      timeSinceLastRestart: this.lastRestartTime > 0 ? Date.now() - this.lastRestartTime : null,
      currentErrorCount: this.errorCount,
      lastMinuteErrors: this.lastErrorCount,
      consecutiveHighMemory: this.consecutiveHighMemory,
      consecutiveHighCpu: this.consecutiveHighCpu,
      thresholds: {
        memory: this.formatBytes(this.memoryThreshold),
        cpu: this.cpuThreshold + '%',
        errors: this.errorThreshold + '/min'
      }
    };
  }

  // Force restart (manual trigger)
  async forceRestart(reason = 'Manual restart') {
    logger.info('Manual restart triggered', { reason });
    await this.initiateRestart(reason);
  }

  // Reset restart counter
  resetRestartCount() {
    this.restartCount = 0;
    this.lastRestartTime = 0;
    logger.info('Restart counter reset');
  }

  formatBytes(bytes) {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  }

  // Set server instance for graceful shutdown
  setServer(server) {
    this.server = server;
  }
}

module.exports = AutoRestartManager;