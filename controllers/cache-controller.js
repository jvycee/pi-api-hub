const EndpointWrapper = require('../helpers/endpoint-wrapper');

/**
 * 🍌 BANANA-POWERED CACHE CONTROLLER 🍌
 * 
 * Handles all cache management endpoints
 */
class CacheController {
  constructor(intelligentCache) {
    this.intelligentCache = intelligentCache;
  }

  getStats = EndpointWrapper.createGetEndpoint(
    () => this.intelligentCache.getStats(),
    { errorMessage: 'Failed to get cache statistics' }
  );

  clearCache = EndpointWrapper.createAdminEndpoint(
    async () => {
      this.intelligentCache.clear();
      return { message: 'Cache cleared successfully' };
    },
    { errorMessage: 'Failed to clear cache' }
  );

  getKeys = EndpointWrapper.createGetEndpoint(
    () => this.intelligentCache.getKeys(),
    { errorMessage: 'Failed to get cache keys' }
  );

  warmCache = EndpointWrapper.createGetEndpoint(
    async () => {
      // Simple data provider that simulates warming popular endpoints
      const dataProvider = async (endpoint) => {
        return {
          warmed: true,
          endpoint,
          timestamp: new Date().toISOString(),
          data: `Warmed data for ${endpoint}`
        };
      };
      
      await this.intelligentCache.warmCache(dataProvider);
      const stats = this.intelligentCache.getStats();
      
      return {
        message: 'Cache warming completed',
        data: {
          popularEndpoints: stats.popularEndpoints,
          totalEntries: stats.size,
          memoryUsage: stats.memoryUsageMB + 'MB'
        }
      };
    },
    { errorMessage: 'Failed to warm cache' }
  );
}

module.exports = CacheController;