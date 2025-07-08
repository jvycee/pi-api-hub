const cluster = require('cluster');
const os = require('os');
const config = require('./shared/config');
const logger = require('./shared/logger');

class ClusterManager {
  constructor() {
    this.numCPUs = os.cpus().length;
    this.workers = {};
    this.workerStats = {};
    this.restartCount = 0;
    this.maxRestarts = 5;
    this.restartWindow = 60000; // 1 minute
    this.lastRestartTime = 0;
    
    // Dynamic scaling configuration
    this.minWorkers = Math.max(1, Math.floor(this.numCPUs * 0.25)); // 25% of CPUs minimum
    this.maxWorkers = this.numCPUs; // All CPUs maximum
    this.targetWorkers = this.numCPUs; // Current target
    this.scalingEnabled = true;
    
    // Load monitoring
    this.loadHistory = [];
    this.maxLoadHistorySize = 20; // Keep last 20 readings
    this.loadThresholds = {
      scaleUp: 0.8,    // 80% load triggers scale up
      scaleDown: 0.3,  // 30% load triggers scale down
      critical: 0.95   // 95% load is critical
    };
    
    // Scaling cooldown to prevent thrashing
    this.lastScalingAction = 0;
    this.scalingCooldown = 60000; // 1 minute cooldown
    this.scalingHistory = [];
  }

  start() {
    if (cluster.isMaster) {
      logger.info(`Master process ${process.pid} starting with ${this.numCPUs} workers`);
      
      // Fork workers for each CPU core
      for (let i = 0; i < this.numCPUs; i++) {
        this.forkWorker();
      }

      // Handle worker events
      cluster.on('exit', (worker, code, signal) => {
        logger.error(`Worker ${worker.process.pid} died (${signal || code})`);
        delete this.workers[worker.id];
        delete this.workerStats[worker.id];
        
        // Restart worker if not intentional shutdown
        if (!worker.exitedAfterDisconnect) {
          this.handleWorkerRestart();
        }
      });

      cluster.on('listening', (worker, address) => {
        logger.info(`Worker ${worker.process.pid} listening on ${address.port}`);
      });

      // Setup graceful shutdown
      this.setupGracefulShutdown();
      
      // Monitor worker health
      this.startHealthMonitoring();
      
      // Setup IPC communication
      this.setupIPCHandlers();
      
      // Start dynamic scaling
      this.startDynamicScaling();

    } else {
      // Worker process - start the actual application
      const app = require('./app');
      logger.info(`Worker ${process.pid} started`);
      
      // Send periodic health updates to master
      setInterval(() => {
        if (process.send) {
          process.send({
            type: 'health',
            pid: process.pid,
            memory: process.memoryUsage(),
            uptime: process.uptime()
          });
        }
      }, 10000); // Every 10 seconds
    }
  }

  forkWorker() {
    const worker = cluster.fork({ NODE_CLUSTER_WORKER: 'true' });
    this.workers[worker.id] = {
      worker,
      startTime: Date.now(),
      restarts: 0
    };
    
    this.workerStats[worker.id] = {
      pid: worker.process.pid,
      memory: { rss: 0, heapUsed: 0 },
      uptime: 0,
      lastHealthCheck: Date.now()
    };

    return worker;
  }

  handleWorkerRestart() {
    const now = Date.now();
    
    // Check if we're restarting too frequently
    if (now - this.lastRestartTime < this.restartWindow) {
      this.restartCount++;
      if (this.restartCount >= this.maxRestarts) {
        logger.error(`Too many worker restarts (${this.restartCount}) in ${this.restartWindow}ms. Exiting.`);
        process.exit(1);
      }
    } else {
      this.restartCount = 0;
    }

    this.lastRestartTime = now;
    
    // Fork new worker
    setTimeout(() => {
      logger.info('Restarting worker...');
      this.forkWorker();
    }, 1000);
  }

  setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info(`Master received ${signal}. Shutting down gracefully...`);
      
      // Disconnect all workers
      Object.values(this.workers).forEach(({ worker }) => {
        worker.disconnect();
      });

      // Give workers time to finish current requests
      setTimeout(() => {
        Object.values(this.workers).forEach(({ worker }) => {
          if (!worker.isDead()) {
            logger.warn(`Killing worker ${worker.process.pid}`);
            worker.kill();
          }
        });
        
        setTimeout(() => {
          logger.info('Master process exiting');
          process.exit(0);
        }, 1000);
      }, 5000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }

  setupIPCHandlers() {
    Object.values(this.workers).forEach(({ worker }) => {
      worker.on('message', (message) => {
        if (message.type === 'health') {
          this.workerStats[worker.id] = {
            pid: message.pid,
            memory: message.memory,
            uptime: message.uptime,
            lastHealthCheck: Date.now()
          };
        }
      });
    });
  }

  startHealthMonitoring() {
    setInterval(() => {
      this.checkWorkerHealth();
      this.logClusterStats();
    }, 30000); // Every 30 seconds
  }

  checkWorkerHealth() {
    const now = Date.now();
    const staleThreshold = 60000; // 1 minute
    
    Object.entries(this.workerStats).forEach(([workerId, stats]) => {
      // Check if worker is responsive
      if (now - stats.lastHealthCheck > staleThreshold) {
        logger.warn(`Worker ${stats.pid} appears unresponsive. Restarting...`);
        const worker = this.workers[workerId]?.worker;
        if (worker && !worker.isDead()) {
          worker.kill();
        }
      }
      
      // Check memory usage (per worker)
      const memoryMB = stats.memory.rss / (1024 * 1024);
      if (memoryMB > 1500) { // 1.5GB per worker on 8GB system
        logger.warn(`Worker ${stats.pid} using high memory: ${memoryMB.toFixed(2)}MB`);
      }
    });
  }

  logClusterStats() {
    const totalWorkers = Object.keys(this.workers).length;
    const totalMemory = Object.values(this.workerStats).reduce((sum, stats) => {
      return sum + stats.memory.rss;
    }, 0);
    
    logger.info('Cluster Health Report', {
      totalWorkers,
      targetWorkers: this.numCPUs,
      totalMemoryMB: (totalMemory / (1024 * 1024)).toFixed(2),
      averageMemoryMB: (totalMemory / totalWorkers / (1024 * 1024)).toFixed(2),
      restartCount: this.restartCount
    });
  }

  // Start dynamic scaling based on load
  startDynamicScaling() {
    if (!this.scalingEnabled) return;
    
    setInterval(() => {
      this.monitorLoadAndScale();
    }, 30000); // Check every 30 seconds
    
    logger.info('🍌 Dynamic worker scaling enabled', {
      minWorkers: this.minWorkers,
      maxWorkers: this.maxWorkers,
      currentWorkers: Object.keys(this.workers).length,
      scalingThresholds: this.loadThresholds
    });
  }

  // Monitor system load and scale workers accordingly
  monitorLoadAndScale() {
    const systemLoad = this.calculateSystemLoad();
    const memoryPressure = this.calculateMemoryPressure();
    const currentWorkers = Object.keys(this.workers).length;
    
    // Add to load history
    this.loadHistory.push({
      timestamp: Date.now(),
      cpuLoad: systemLoad,
      memoryPressure,
      workerCount: currentWorkers
    });
    
    // Keep only recent history
    if (this.loadHistory.length > this.maxLoadHistorySize) {
      this.loadHistory = this.loadHistory.slice(-this.maxLoadHistorySize);
    }
    
    // Calculate average load over last 5 minutes
    const recentLoad = this.loadHistory.slice(-10); // Last 10 readings = 5 minutes
    const avgLoad = recentLoad.reduce((sum, reading) => sum + reading.cpuLoad, 0) / recentLoad.length;
    const avgMemoryPressure = recentLoad.reduce((sum, reading) => sum + reading.memoryPressure, 0) / recentLoad.length;
    
    // Determine if scaling is needed
    const scalingDecision = this.determineScalingAction(avgLoad, avgMemoryPressure, currentWorkers);
    
    if (scalingDecision.action !== 'none') {
      this.executeScaling(scalingDecision);
    }
    
    // Log current status
    logger.debug('🍌 Load monitoring update', {
      currentWorkers,
      targetWorkers: this.targetWorkers,
      avgLoad: `${(avgLoad * 100).toFixed(1)}%`,
      avgMemoryPressure: `${(avgMemoryPressure * 100).toFixed(1)}%`,
      scalingAction: scalingDecision.action
    });
  }

  // Calculate system load based on CPU and worker metrics
  calculateSystemLoad() {
    const systemLoad = os.loadavg()[0] / this.numCPUs; // 1-minute load average
    
    // Also consider worker-specific metrics
    const workerLoads = Object.values(this.workerStats).map(stats => {
      const memoryUsage = stats.memory.heapUsed / stats.memory.heapTotal || 0;
      return Math.min(memoryUsage, 1); // Cap at 100%
    });
    
    const avgWorkerLoad = workerLoads.length > 0 
      ? workerLoads.reduce((sum, load) => sum + load, 0) / workerLoads.length
      : 0;
    
    // Combine system load and worker load
    return Math.max(systemLoad, avgWorkerLoad);
  }

  // Calculate memory pressure across all workers
  calculateMemoryPressure() {
    const totalSystemMemory = os.totalmem();
    const freeSystemMemory = os.freemem();
    const systemMemoryPressure = (totalSystemMemory - freeSystemMemory) / totalSystemMemory;
    
    // Consider worker memory usage
    const workerMemoryUsage = Object.values(this.workerStats).reduce((sum, stats) => {
      return sum + stats.memory.rss;
    }, 0);
    
    const workerMemoryPressure = workerMemoryUsage / totalSystemMemory;
    
    return Math.max(systemMemoryPressure, workerMemoryPressure);
  }

  // Determine what scaling action to take
  determineScalingAction(avgLoad, avgMemoryPressure, currentWorkers) {
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.lastScalingAction < this.scalingCooldown) {
      return { action: 'none', reason: 'cooldown_active' };
    }
    
    // Critical memory pressure - scale down immediately
    if (avgMemoryPressure > 0.9) {
      return { 
        action: 'scale_down', 
        reason: 'critical_memory_pressure',
        targetWorkers: Math.max(this.minWorkers, Math.floor(currentWorkers * 0.7))
      };
    }
    
    // High load - scale up if possible
    if (avgLoad > this.loadThresholds.scaleUp && currentWorkers < this.maxWorkers) {
      const newTarget = Math.min(this.maxWorkers, currentWorkers + 1);
      return { 
        action: 'scale_up', 
        reason: 'high_load',
        targetWorkers: newTarget
      };
    }
    
    // Low load - scale down if we have more than minimum workers
    if (avgLoad < this.loadThresholds.scaleDown && currentWorkers > this.minWorkers) {
      // Only scale down if load has been consistently low
      const recentLowLoad = this.loadHistory.slice(-5).every(reading => 
        reading.cpuLoad < this.loadThresholds.scaleDown
      );
      
      if (recentLowLoad) {
        const newTarget = Math.max(this.minWorkers, currentWorkers - 1);
        return { 
          action: 'scale_down', 
          reason: 'low_load',
          targetWorkers: newTarget
        };
      }
    }
    
    return { action: 'none', reason: 'load_within_thresholds' };
  }

  // Execute scaling action
  executeScaling(scalingDecision) {
    const { action, reason, targetWorkers } = scalingDecision;
    const currentWorkers = Object.keys(this.workers).length;
    
    logger.info(`🍌 Executing scaling action: ${action}`, {
      reason,
      currentWorkers,
      targetWorkers,
      minWorkers: this.minWorkers,
      maxWorkers: this.maxWorkers
    });
    
    if (action === 'scale_up') {
      const workersToAdd = targetWorkers - currentWorkers;
      for (let i = 0; i < workersToAdd; i++) {
        this.forkWorker();
      }
    } else if (action === 'scale_down') {
      const workersToRemove = currentWorkers - targetWorkers;
      const workerIds = Object.keys(this.workers);
      
      // Remove oldest workers first
      const sortedWorkers = workerIds.sort((a, b) => {
        return this.workers[a].startTime - this.workers[b].startTime;
      });
      
      for (let i = 0; i < workersToRemove && i < sortedWorkers.length; i++) {
        const workerId = sortedWorkers[i];
        const worker = this.workers[workerId].worker;
        
        logger.info(`🍌 Gracefully shutting down worker ${worker.process.pid}`);
        
        // Mark as intentional shutdown
        worker.disconnect();
        
        // Give it time to finish current requests
        setTimeout(() => {
          if (!worker.isDead()) {
            worker.kill('SIGTERM');
          }
        }, 5000);
      }
    }
    
    this.targetWorkers = targetWorkers;
    this.lastScalingAction = Date.now();
    
    // Track scaling history
    this.scalingHistory.push({
      timestamp: Date.now(),
      action,
      reason,
      fromWorkers: currentWorkers,
      toWorkers: targetWorkers
    });
    
    // Keep only recent scaling history
    if (this.scalingHistory.length > 50) {
      this.scalingHistory = this.scalingHistory.slice(-25);
    }
  }

  // Get scaling statistics
  getScalingStats() {
    const recentScaling = this.scalingHistory.slice(-10);
    const recentLoad = this.loadHistory.slice(-10);
    
    return {
      current: {
        workers: Object.keys(this.workers).length,
        targetWorkers: this.targetWorkers,
        minWorkers: this.minWorkers,
        maxWorkers: this.maxWorkers,
        scalingEnabled: this.scalingEnabled
      },
      load: {
        current: recentLoad.length > 0 ? recentLoad[recentLoad.length - 1] : null,
        average: recentLoad.length > 0 ? {
          cpuLoad: `${(recentLoad.reduce((sum, r) => sum + r.cpuLoad, 0) / recentLoad.length * 100).toFixed(1)}%`,
          memoryPressure: `${(recentLoad.reduce((sum, r) => sum + r.memoryPressure, 0) / recentLoad.length * 100).toFixed(1)}%`
        } : null,
        thresholds: this.loadThresholds
      },
      scaling: {
        lastAction: this.lastScalingAction,
        cooldownRemaining: Math.max(0, this.scalingCooldown - (Date.now() - this.lastScalingAction)),
        recentActions: recentScaling.map(s => ({
          action: s.action,
          reason: s.reason,
          workers: `${s.fromWorkers} → ${s.toWorkers}`,
          timestamp: s.timestamp
        }))
      }
    };
  }

  getClusterStats() {
    const scalingStats = this.getScalingStats();
    
    return {
      master: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      workers: this.workerStats,
      cluster: {
        totalWorkers: Object.keys(this.workers).length,
        targetWorkers: this.targetWorkers,
        restartCount: this.restartCount,
        lastRestartTime: this.lastRestartTime
      },
      dynamicScaling: scalingStats
    };
  }
}

// Start cluster if this file is run directly
if (require.main === module) {
  const clusterManager = new ClusterManager();
  clusterManager.start();
}

module.exports = ClusterManager;