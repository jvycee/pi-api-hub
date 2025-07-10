const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

/**
 * 🍌 BANANA-POWERED QUERY OPTIMIZER 🍌
 * Database optimization system for sub-10ms query performance
 */
class QueryOptimizer {
  constructor(options = {}) {
    this.targetResponseTime = options.targetResponseTime || 10; // 10ms target
    this.maxCacheSize = options.maxCacheSize || 10000;
    this.cacheTTL = options.cacheTTL || 5 * 60 * 1000; // 5 minutes
    this.enableProfiling = options.enableProfiling !== false;
    
    // Query cache and optimization data
    this.queryCache = new Map();
    this.queryStats = new Map();
    this.indexSuggestions = new Map();
    this.slowQueryLog = [];
    this.optimizationRules = new Map();
    
    // Performance tracking
    this.totalQueries = 0;
    this.cacheHits = 0;
    this.optimizationWins = 0;
    
    this.initializeOptimizationRules();
    this.startCleanupTimer();
    
    logger.info('🍌 Query Optimizer initialized', {
      targetResponseTime: this.targetResponseTime,
      maxCacheSize: this.maxCacheSize,
      cacheTTL: this.cacheTTL
    });
  }

  /**
   * Initialize optimization rules
   */
  initializeOptimizationRules() {
    // JSON path optimization
    this.optimizationRules.set('json_path', {
      detect: (query) => query.includes('$.') || query.includes('->'),
      optimize: (query) => {
        // Suggest indexed computed columns for frequent JSON paths
        const jsonPaths = this.extractJsonPaths(query);
        return {
          optimizedQuery: query,
          suggestions: jsonPaths.map(path => `Consider adding index on JSON path: ${path}`)
        };
      }
    });

    // Array operation optimization
    this.optimizationRules.set('array_ops', {
      detect: (query) => query.includes('ARRAY_') || query.includes('JSON_ARRAY'),
      optimize: (query) => {
        return {
          optimizedQuery: query,
          suggestions: ['Consider using indexed columns instead of array operations']
        };
      }
    });

    // Wildcard optimization
    this.optimizationRules.set('wildcard', {
      detect: (query) => query.includes('LIKE %') || query.includes('ILIKE %'),
      optimize: (query) => {
        return {
          optimizedQuery: query,
          suggestions: ['Consider full-text search or prefix indexing for wildcard queries']
        };
      }
    });

    // Subquery optimization
    this.optimizationRules.set('subquery', {
      detect: (query) => query.includes('SELECT') && query.match(/\(\s*SELECT/gi),
      optimize: (query) => {
        return {
          optimizedQuery: query,
          suggestions: ['Consider using JOINs instead of subqueries for better performance']
        };
      }
    });
  }

  /**
   * Execute and optimize query
   */
  async executeQuery(queryId, queryFn, params = {}) {
    const startTime = performance.now();
    this.totalQueries++;
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(queryId, params);
      const cachedResult = this.queryCache.get(cacheKey);
      
      if (cachedResult && !this.isCacheExpired(cachedResult)) {
        this.cacheHits++;
        const endTime = performance.now();
        this.recordQueryStats(queryId, endTime - startTime, true);
        return cachedResult.data;
      }
      
      // Execute query
      const result = await queryFn(params);
      const endTime = performance.now();
      const executionTime = endTime - startTime;
      
      // Record statistics
      this.recordQueryStats(queryId, executionTime, false);
      
      // Cache result if appropriate
      if (this.shouldCacheResult(queryId, executionTime, result)) {
        this.cacheResult(cacheKey, result);
      }
      
      // Check if optimization is needed
      if (executionTime > this.targetResponseTime) {
        this.analyzeSlowQuery(queryId, executionTime, params);
      }
      
      return result;
    } catch (error) {
      const endTime = performance.now();
      this.recordQueryStats(queryId, endTime - startTime, false, error);
      throw error;
    }
  }

  /**
   * Record query statistics
   */
  recordQueryStats(queryId, executionTime, fromCache, error = null) {
    if (!this.queryStats.has(queryId)) {
      this.queryStats.set(queryId, {
        count: 0,
        totalTime: 0,
        avgTime: 0,
        minTime: Infinity,
        maxTime: 0,
        cacheHits: 0,
        errors: 0,
        lastExecuted: Date.now()
      });
    }
    
    const stats = this.queryStats.get(queryId);
    stats.count++;
    stats.totalTime += executionTime;
    stats.avgTime = stats.totalTime / stats.count;
    stats.minTime = Math.min(stats.minTime, executionTime);
    stats.maxTime = Math.max(stats.maxTime, executionTime);
    stats.lastExecuted = Date.now();
    
    if (fromCache) {
      stats.cacheHits++;
    }
    
    if (error) {
      stats.errors++;
      logger.error(`Query error: ${queryId}`, { error: error.message, executionTime });
    }
    
    // Log slow queries
    if (executionTime > this.targetResponseTime && this.enableProfiling) {
      logger.warn(`Slow query detected: ${queryId}`, {
        executionTime: `${executionTime.toFixed(2)}ms`,
        target: `${this.targetResponseTime}ms`,
        fromCache
      });
    }
  }

  /**
   * Analyze slow query for optimization opportunities
   */
  analyzeSlowQuery(queryId, executionTime, params) {
    const slowQuery = {
      queryId,
      executionTime,
      timestamp: Date.now(),
      params,
      suggestions: []
    };
    
    // Generate optimization suggestions
    const suggestions = this.generateOptimizationSuggestions(queryId, executionTime);
    slowQuery.suggestions = suggestions;
    
    // Add to slow query log
    this.slowQueryLog.push(slowQuery);
    
    // Keep only last 100 slow queries
    if (this.slowQueryLog.length > 100) {
      this.slowQueryLog.shift();
    }
    
    logger.info(`Optimization suggestions for ${queryId}`, { suggestions });
  }

  /**
   * Generate optimization suggestions
   */
  generateOptimizationSuggestions(queryId, executionTime) {
    const suggestions = [];
    
    // Basic performance suggestions
    if (executionTime > 100) {
      suggestions.push({
        type: 'caching',
        message: 'Consider caching this query result',
        impact: 'high'
      });
    }
    
    if (executionTime > 50) {
      suggestions.push({
        type: 'indexing',
        message: 'Consider adding database indexes for this query',
        impact: 'medium'
      });
    }
    
    if (executionTime > 200) {
      suggestions.push({
        type: 'pagination',
        message: 'Consider implementing pagination to reduce data transfer',
        impact: 'high'
      });
    }
    
    // Query-specific suggestions
    const queryStats = this.queryStats.get(queryId);
    if (queryStats && queryStats.count > 10) {
      const cacheHitRate = queryStats.cacheHits / queryStats.count;
      if (cacheHitRate < 0.3) {
        suggestions.push({
          type: 'cache_strategy',
          message: 'Low cache hit rate - consider longer TTL or different caching strategy',
          impact: 'medium'
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Cache management
   */
  generateCacheKey(queryId, params) {
    const paramsString = JSON.stringify(params, Object.keys(params).sort());
    return `${queryId}:${Buffer.from(paramsString).toString('base64')}`;
  }

  cacheResult(cacheKey, data) {
    // Implement LRU eviction if cache is full
    if (this.queryCache.size >= this.maxCacheSize) {
      const oldestKey = this.queryCache.keys().next().value;
      this.queryCache.delete(oldestKey);
    }
    
    this.queryCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl: this.cacheTTL
    });
  }

  isCacheExpired(cacheEntry) {
    return Date.now() - cacheEntry.timestamp > cacheEntry.ttl;
  }

  shouldCacheResult(queryId, executionTime, result) {
    // Cache if query is slow or result is small
    const resultSize = JSON.stringify(result).length;
    return executionTime > 5 || resultSize < 100000; // 100KB limit
  }

  /**
   * Connection pool optimization
   */
  createOptimizedPool(dbConfig) {
    const poolConfig = {
      ...dbConfig,
      // Pi 5 optimized settings
      min: 2,
      max: 8, // Pi 5 can handle more connections
      acquireTimeoutMillis: 30000,
      createTimeoutMillis: 3000,
      destroyTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      
      // Performance optimizations
      propagateCreateError: false,
      
      // Lifecycle hooks
      afterCreate: (conn, done) => {
        // Optimize connection settings
        conn.query('SET synchronous_commit = OFF', (err) => {
          done(err, conn);
        });
      }
    };
    
    logger.info('🍌 Optimized database pool created', {
      min: poolConfig.min,
      max: poolConfig.max,
      acquireTimeout: poolConfig.acquireTimeoutMillis
    });
    
    return poolConfig;
  }

  /**
   * In-memory query optimization
   */
  optimizeInMemoryQuery(data, query) {
    const startTime = performance.now();
    
    try {
      // For JSON data operations
      if (query.type === 'filter') {
        const result = this.optimizedFilter(data, query.conditions);
        const endTime = performance.now();
        
        logger.debug('In-memory filter optimized', {
          executionTime: `${(endTime - startTime).toFixed(2)}ms`,
          recordsProcessed: Array.isArray(data) ? data.length : 1,
          recordsReturned: Array.isArray(result) ? result.length : 1
        });
        
        return result;
      }
      
      if (query.type === 'sort') {
        const result = this.optimizedSort(data, query.sortBy, query.order);
        const endTime = performance.now();
        
        logger.debug('In-memory sort optimized', {
          executionTime: `${(endTime - startTime).toFixed(2)}ms`,
          recordsProcessed: Array.isArray(data) ? data.length : 1
        });
        
        return result;
      }
      
      if (query.type === 'aggregate') {
        const result = this.optimizedAggregate(data, query.aggregations);
        const endTime = performance.now();
        
        logger.debug('In-memory aggregation optimized', {
          executionTime: `${(endTime - startTime).toFixed(2)}ms`,
          recordsProcessed: Array.isArray(data) ? data.length : 1
        });
        
        return result;
      }
      
      return data;
    } catch (error) {
      logger.error('In-memory query optimization failed', { error: error.message });
      return data;
    }
  }

  /**
   * Optimized filter implementation
   */
  optimizedFilter(data, conditions) {
    if (!Array.isArray(data)) return data;
    
    // Pre-compile conditions for better performance
    const compiledConditions = conditions.map(condition => {
      if (condition.operator === 'equals') {
        return (item) => item[condition.field] === condition.value;
      }
      if (condition.operator === 'contains') {
        return (item) => String(item[condition.field]).includes(condition.value);
      }
      if (condition.operator === 'gt') {
        return (item) => item[condition.field] > condition.value;
      }
      if (condition.operator === 'lt') {
        return (item) => item[condition.field] < condition.value;
      }
      return () => true;
    });
    
    return data.filter(item => 
      compiledConditions.every(condition => condition(item))
    );
  }

  /**
   * Optimized sort implementation
   */
  optimizedSort(data, sortBy, order = 'asc') {
    if (!Array.isArray(data)) return data;
    
    const multiplier = order === 'desc' ? -1 : 1;
    
    return data.sort((a, b) => {
      const valueA = a[sortBy];
      const valueB = b[sortBy];
      
      if (valueA < valueB) return -1 * multiplier;
      if (valueA > valueB) return 1 * multiplier;
      return 0;
    });
  }

  /**
   * Optimized aggregation implementation
   */
  optimizedAggregate(data, aggregations) {
    if (!Array.isArray(data)) return {};
    
    const result = {};
    
    aggregations.forEach(agg => {
      if (agg.type === 'count') {
        result[agg.name] = data.length;
      } else if (agg.type === 'sum') {
        result[agg.name] = data.reduce((sum, item) => sum + (item[agg.field] || 0), 0);
      } else if (agg.type === 'avg') {
        const sum = data.reduce((sum, item) => sum + (item[agg.field] || 0), 0);
        result[agg.name] = sum / data.length;
      } else if (agg.type === 'min') {
        result[agg.name] = Math.min(...data.map(item => item[agg.field] || 0));
      } else if (agg.type === 'max') {
        result[agg.name] = Math.max(...data.map(item => item[agg.field] || 0));
      }
    });
    
    return result;
  }

  /**
   * Get optimization statistics
   */
  getOptimizationStats() {
    const cacheHitRate = this.totalQueries > 0 ? (this.cacheHits / this.totalQueries) * 100 : 0;
    const avgQueryTime = this.calculateAverageQueryTime();
    
    return {
      totalQueries: this.totalQueries,
      cacheHits: this.cacheHits,
      cacheHitRate: cacheHitRate.toFixed(2),
      cacheMissRate: (100 - cacheHitRate).toFixed(2),
      optimizationWins: this.optimizationWins,
      avgQueryTime: avgQueryTime.toFixed(2),
      targetResponseTime: this.targetResponseTime,
      performanceRating: this.getPerformanceRating(avgQueryTime),
      queryStatsCount: this.queryStats.size,
      slowQueryCount: this.slowQueryLog.length,
      cacheSize: this.queryCache.size,
      maxCacheSize: this.maxCacheSize
    };
  }

  /**
   * Calculate average query time across all queries
   */
  calculateAverageQueryTime() {
    if (this.queryStats.size === 0) return 0;
    
    let totalTime = 0;
    let totalCount = 0;
    
    for (const stats of this.queryStats.values()) {
      totalTime += stats.totalTime;
      totalCount += stats.count;
    }
    
    return totalCount > 0 ? totalTime / totalCount : 0;
  }

  /**
   * Get performance rating
   */
  getPerformanceRating(avgTime) {
    if (avgTime < 5) return 'excellent';
    if (avgTime < 10) return 'good';
    if (avgTime < 25) return 'fair';
    if (avgTime < 50) return 'poor';
    return 'critical';
  }

  /**
   * Get detailed query statistics
   */
  getQueryStats() {
    return Array.from(this.queryStats.entries()).map(([queryId, stats]) => ({
      queryId,
      ...stats,
      cacheHitRate: stats.count > 0 ? (stats.cacheHits / stats.count * 100).toFixed(2) : 0,
      performance: this.getPerformanceRating(stats.avgTime),
      lastExecutedAgo: Date.now() - stats.lastExecuted
    }));
  }

  /**
   * Get slow query log
   */
  getSlowQueryLog() {
    return this.slowQueryLog.map(query => ({
      ...query,
      executionTime: `${query.executionTime.toFixed(2)}ms`,
      timestamp: new Date(query.timestamp).toISOString(),
      age: Date.now() - query.timestamp
    }));
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    let totalSize = 0;
    let expiredEntries = 0;
    const now = Date.now();
    
    for (const entry of this.queryCache.values()) {
      totalSize += JSON.stringify(entry.data).length;
      if (this.isCacheExpired(entry)) {
        expiredEntries++;
      }
    }
    
    return {
      size: this.queryCache.size,
      maxSize: this.maxCacheSize,
      utilization: (this.queryCache.size / this.maxCacheSize * 100).toFixed(2),
      totalSizeBytes: totalSize,
      totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
      expiredEntries,
      ttl: this.cacheTTL,
      hitRate: this.totalQueries > 0 ? (this.cacheHits / this.totalQueries * 100).toFixed(2) : 0
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    const clearedEntries = this.queryCache.size;
    this.queryCache.clear();
    logger.info('🧹 Query cache cleared', { clearedEntries });
    return clearedEntries;
  }

  /**
   * Helper methods
   */
  extractJsonPaths(query) {
    const jsonPathRegex = /\$\.[a-zA-Z0-9_.[\]]+/g;
    return query.match(jsonPathRegex) || [];
  }

  /**
   * Cleanup timer
   */
  startCleanupTimer() {
    setInterval(() => {
      const now = Date.now();
      let expiredCount = 0;
      
      // Remove expired cache entries
      for (const [key, entry] of this.queryCache.entries()) {
        if (this.isCacheExpired(entry)) {
          this.queryCache.delete(key);
          expiredCount++;
        }
      }
      
      // Clean old query stats
      for (const [queryId, stats] of this.queryStats.entries()) {
        if (now - stats.lastExecuted > 24 * 60 * 60 * 1000) { // 24 hours
          this.queryStats.delete(queryId);
        }
      }
      
      if (expiredCount > 0) {
        logger.debug('🧹 Query optimizer cleanup completed', {
          expiredCacheEntries: expiredCount,
          currentCacheSize: this.queryCache.size,
          queryStatsCount: this.queryStats.size
        });
      }
    }, 60000); // Run every minute
  }
}

module.exports = QueryOptimizer;