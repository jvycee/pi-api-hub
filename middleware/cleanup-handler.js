const logger = require('../shared/logger');

class CleanupHandler {
  constructor() {
    this.services = [];
    this.isShuttingDown = false;
    
    // Register cleanup handlers for various process signals
    this.registerSignalHandlers();
  }

  // Register a service that needs cleanup on shutdown
  registerService(service, name) {
    if (!service || typeof service.stop !== 'function') {
      logger.warn(`Service ${name} does not have a stop() method - skipping registration`);
      return;
    }

    this.services.push({ service, name });
    logger.debug(`Registered service for cleanup: ${name}`);
  }

  // Register signal handlers for graceful shutdown
  registerSignalHandlers() {
    const signals = ['SIGTERM', 'SIGINT', 'SIGUSR2'];
    
    signals.forEach(signal => {
      process.on(signal, () => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);
        this.gracefulShutdown(signal);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('unhandledRejection');
    });

    logger.info('Cleanup signal handlers registered');
  }

  // Perform graceful shutdown
  async gracefulShutdown(signal) {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Starting graceful shutdown (triggered by: ${signal})`);

    const shutdownTimeout = 15000; // 15 seconds
    const startTime = Date.now();

    try {
      // Set a timeout for the entire shutdown process
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('Shutdown timeout reached'));
        }, shutdownTimeout);
      });

      // Cleanup all registered services
      const cleanupPromise = this.cleanupServices();

      // Race between cleanup and timeout
      await Promise.race([cleanupPromise, timeoutPromise]);

      const shutdownTime = Date.now() - startTime;
      logger.info(`Graceful shutdown completed successfully in ${shutdownTime}ms`);
      
      // Give some time for final log writes
      setTimeout(() => {
        process.exit(0);
      }, 100);

    } catch (error) {
      const shutdownTime = Date.now() - startTime;
      logger.error(`Graceful shutdown failed after ${shutdownTime}ms:`, error);
      
      // Force exit if graceful shutdown fails
      setTimeout(() => {
        logger.error('Forcing process exit due to failed graceful shutdown');
        process.exit(1);
      }, 1000);
    }
  }

  // Clean up all registered services
  async cleanupServices() {
    const cleanupPromises = this.services.map(async ({ service, name }) => {
      try {
        logger.debug(`Stopping service: ${name}`);
        const startTime = Date.now();
        
        // Set a timeout for individual service cleanup
        const serviceTimeout = 5000; // 5 seconds per service
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Service ${name} cleanup timeout`));
          }, serviceTimeout);
        });

        await Promise.race([
          service.stop(),
          timeoutPromise
        ]);

        const stopTime = Date.now() - startTime;
        logger.info(`Service ${name} stopped successfully in ${stopTime}ms`);
        
      } catch (error) {
        logger.error(`Failed to stop service ${name}:`, error);
        // Continue with other services even if one fails
      }
    });

    await Promise.allSettled(cleanupPromises);
    logger.info('All services cleanup completed');
  }

  // Get cleanup statistics
  getStats() {
    return {
      registeredServices: this.services.length,
      serviceNames: this.services.map(s => s.name),
      isShuttingDown: this.isShuttingDown
    };
  }

  // Manually trigger cleanup (for testing purposes)
  async manualCleanup() {
    logger.info('Manual cleanup triggered');
    await this.cleanupServices();
  }
}

// Create singleton instance
const cleanupHandler = new CleanupHandler();

module.exports = cleanupHandler;