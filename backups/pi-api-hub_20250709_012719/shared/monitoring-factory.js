const ResponseHelper = require('./response-helper');
const logger = require('./logger');

/**
 * Factory for creating consistent monitoring endpoints
 * Eliminates 400+ lines of duplicate try-catch-response patterns
 */
class MonitoringEndpointFactory {
  /**
   * Create a GET monitoring endpoint
   * @param {Function} handler - Handler function that returns data
   * @param {Object} options - Configuration options
   */
  static createGetEndpoint(handler, options = {}) {
    return ResponseHelper.asyncHandler(async (req, res) => {
      const startTime = Date.now();
      
      try {
        const data = await Promise.resolve(handler(req, res));
        
        const metadata = {
          processingTime: `${Date.now() - startTime}ms`,
          ...options.metadata
        };
        
        return ResponseHelper.success(res, data, metadata);
      } catch (error) {
        logger.error(`Monitoring GET endpoint error: ${options.name || 'unknown'}`, {
          error: error.message,
          path: req.path,
          processingTime: `${Date.now() - startTime}ms`
        });
        
        return ResponseHelper.error(res, 
          options.errorMessage || 'Failed to retrieve monitoring data',
          500,
          { processingTime: `${Date.now() - startTime}ms` }
        );
      }
    });
  }

  /**
   * Create a POST monitoring endpoint with admin authentication
   * @param {Function} handler - Handler function that performs action
   * @param {Object} options - Configuration options
   */
  static createPostEndpoint(handler, options = {}) {
    return ResponseHelper.asyncHandler(async (req, res) => {
      const startTime = Date.now();
      
      try {
        const result = await Promise.resolve(handler(req, res));
        
        const metadata = {
          processingTime: `${Date.now() - startTime}ms`,
          action: options.action || 'completed',
          ...options.metadata
        };
        
        // Include result data if available
        if (result !== undefined) {
          return ResponseHelper.success(res, result, metadata);
        } else {
          return ResponseHelper.success(res, { 
            message: options.successMessage || 'Operation completed successfully' 
          }, metadata);
        }
      } catch (error) {
        logger.error(`Monitoring POST endpoint error: ${options.name || 'unknown'}`, {
          error: error.message,
          path: req.path,
          body: req.body,
          processingTime: `${Date.now() - startTime}ms`
        });
        
        return ResponseHelper.error(res,
          options.errorMessage || 'Failed to perform monitoring action',
          500,
          { processingTime: `${Date.now() - startTime}ms` }
        );
      }
    });
  }

  /**
   * Create a stats endpoint that aggregates multiple data sources
   * @param {Object} handlers - Object with handler functions for each stat type
   * @param {Object} options - Configuration options
   */
  static createStatsEndpoint(handlers, options = {}) {
    return ResponseHelper.asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const stats = {};
      const errors = {};
      
      // Execute all handlers in parallel with individual error handling
      const promises = Object.entries(handlers).map(async ([key, handler]) => {
        try {
          const data = await Promise.resolve(handler(req, res));
          stats[key] = data;
        } catch (error) {
          logger.warn(`Stats handler error for ${key}`, { error: error.message });
          errors[key] = error.message;
          
          // Include partial data or null for failed handlers
          stats[key] = options.includePartialData ? null : undefined;
        }
      });
      
      await Promise.all(promises);
      
      const metadata = {
        processingTime: `${Date.now() - startTime}ms`,
        statsCollected: Object.keys(stats).length,
        errors: Object.keys(errors).length > 0 ? errors : undefined,
        ...options.metadata
      };
      
      return ResponseHelper.success(res, stats, metadata);
    });
  }

  /**
   * Create a cache endpoint with automatic cache key handling
   * @param {Object} cache - Cache instance
   * @param {Object} options - Configuration options
   */
  static createCacheEndpoint(cache, options = {}) {
    const handlers = {
      // GET /cache - Get cache stats
      stats: () => cache.getStats ? cache.getStats() : cache.stats || {},
      
      // GET /cache/keys - Get cache keys
      keys: (req) => {
        const { pattern, limit } = req.query;
        const keys = cache.getKeys ? cache.getKeys(pattern) : Array.from(cache.keys());
        return {
          keys: limit ? keys.slice(0, parseInt(limit)) : keys,
          total: keys.length,
          pattern: pattern || 'all'
        };
      },
      
      // POST /cache/clear - Clear cache
      clear: () => {
        const count = cache.clear ? cache.clear() : cache.size || 0;
        return { message: 'Cache cleared successfully', entriesCleared: count };
      }
    };
    
    return {
      getStats: this.createGetEndpoint(handlers.stats, { 
        name: 'cache-stats',
        errorMessage: 'Failed to get cache statistics'
      }),
      
      getKeys: this.createGetEndpoint(handlers.keys, {
        name: 'cache-keys', 
        errorMessage: 'Failed to get cache keys'
      }),
      
      clearCache: this.createPostEndpoint(handlers.clear, {
        name: 'cache-clear',
        action: 'cache-cleared',
        successMessage: 'Cache cleared successfully',
        errorMessage: 'Failed to clear cache'
      })
    };
  }

  /**
   * Create a system info endpoint
   * @param {Object} collectors - Object with system info collectors
   * @param {Object} options - Configuration options
   */
  static createSystemInfoEndpoint(collectors, options = {}) {
    return this.createStatsEndpoint(collectors, {
      name: 'system-info',
      includePartialData: true,
      metadata: { source: 'system' },
      ...options
    });
  }

  /**
   * Create a health check endpoint with custom checks
   * @param {Array} healthChecks - Array of health check functions
   * @param {Object} options - Configuration options
   */
  static createHealthEndpoint(healthChecks = [], options = {}) {
    return ResponseHelper.asyncHandler(async (req, res) => {
      const startTime = Date.now();
      const checks = {};
      let overallHealth = 'healthy';
      
      // Run all health checks
      for (const check of healthChecks) {
        try {
          const result = await Promise.resolve(check());
          checks[check.name || 'unnamed'] = {
            status: 'healthy',
            ...result
          };
        } catch (error) {
          checks[check.name || 'unnamed'] = {
            status: 'unhealthy',
            error: error.message
          };
          overallHealth = 'degraded';
        }
      }
      
      const healthData = {
        status: overallHealth,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: Object.keys(checks).length > 0 ? checks : undefined,
        processingTime: `${Date.now() - startTime}ms`
      };
      
      const statusCode = overallHealth === 'healthy' ? 200 : 503;
      return res.status(statusCode).json(healthData);
    });
  }
}

module.exports = MonitoringEndpointFactory;