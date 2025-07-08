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
    const worker = cluster.fork();
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

  getClusterStats() {
    return {
      master: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage()
      },
      workers: this.workerStats,
      cluster: {
        totalWorkers: Object.keys(this.workers).length,
        targetWorkers: this.numCPUs,
        restartCount: this.restartCount,
        lastRestartTime: this.lastRestartTime
      }
    };
  }
}

// Start cluster if this file is run directly
if (require.main === module) {
  const clusterManager = new ClusterManager();
  clusterManager.start();
}

module.exports = ClusterManager;