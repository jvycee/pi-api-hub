const EventEmitter = require('events');
const logger = require('./logger');
const { getErrorHandler } = require('./error-handler');

/**
 * 🍌 BANANA-POWERED RESOURCE MANAGER 🍌
 * 
 * Centralized resource management for connections, memory,
 * caches, and cleanup operations
 */

class ResourceManager extends EventEmitter {
    constructor() {
        super();
        this.resources = new Map();
        this.pools = new Map();
        this.caches = new Map();
        this.timers = new Map();
        this.isShuttingDown = false;
        this.shutdownTimeout = 30000; // 30 seconds
        this.errorHandler = getErrorHandler();
        
        // Resource limits
        this.limits = {
            maxConnections: 100,
            maxCacheSize: 500, // MB
            maxTimers: 1000,
            memoryThreshold: 0.9 // 90% of available memory
        };
        
        // Statistics
        this.stats = {
            connectionsCreated: 0,
            connectionsDestroyed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            memoryCleanups: 0,
            resourceLeaks: 0
        };
        
        this.setupMonitoring();
        this.setupGracefulShutdown();
    }
    
    /**
     * Register a resource for management
     */
    registerResource(id, resource, options = {}) {
        if (this.resources.has(id)) {
            logger.warn(`Resource ${id} already registered, replacing`);
            this.unregisterResource(id);
        }
        
        const resourceInfo = {
            id,
            resource,
            type: options.type || 'generic',
            createdAt: Date.now(),
            lastAccessed: Date.now(),
            accessCount: 0,
            cleanup: options.cleanup || (() => {}),
            healthCheck: options.healthCheck || (() => true),
            priority: options.priority || 1, // 1=low, 5=critical
            maxIdleTime: options.maxIdleTime || 300000, // 5 minutes
            autoCleanup: options.autoCleanup !== false
        };
        
        this.resources.set(id, resourceInfo);
        this.emit('resourceRegistered', { id, type: resourceInfo.type });
        
        logger.debug(`Resource registered: ${id} (${resourceInfo.type})`);
        return resourceInfo;
    }
    
    /**
     * Unregister and cleanup a resource
     */
    async unregisterResource(id) {
        const resourceInfo = this.resources.get(id);
        if (!resourceInfo) {
            return false;
        }
        
        try {
            await this.cleanupResource(resourceInfo);
            this.resources.delete(id);
            this.emit('resourceUnregistered', { id, type: resourceInfo.type });
            logger.debug(`Resource unregistered: ${id}`);
            return true;
        } catch (error) {
            logger.error(`Failed to unregister resource ${id}:`, error);
            return false;
        }
    }
    
    /**
     * Get a resource and update access tracking
     */
    getResource(id) {
        const resourceInfo = this.resources.get(id);
        if (!resourceInfo) {
            return null;
        }
        
        resourceInfo.lastAccessed = Date.now();
        resourceInfo.accessCount++;
        
        return resourceInfo.resource;
    }
    
    /**
     * Create and manage a connection pool
     */
    createConnectionPool(poolId, factory, options = {}) {
        if (this.pools.has(poolId)) {
            throw this.errorHandler.createError({
                type: 'configuration',
                message: `Connection pool ${poolId} already exists`,
                code: 'POOL_EXISTS'
            });
        }
        
        const pool = {
            id: poolId,
            factory,
            connections: new Set(),
            available: [],
            inUse: new Set(),
            minSize: options.minSize || 1,
            maxSize: options.maxSize || 10,
            idleTimeout: options.idleTimeout || 60000,
            acquireTimeout: options.acquireTimeout || 30000,
            validateConnection: options.validateConnection || (() => true),
            created: 0,
            destroyed: 0
        };
        
        this.pools.set(poolId, pool);
        
        // Initialize minimum connections
        this.initializePool(pool);
        
        logger.info(`Connection pool created: ${poolId}`);
        return pool;
    }
    
    /**
     * Initialize pool with minimum connections
     */
    async initializePool(pool) {
        try {
            const promises = [];
            for (let i = 0; i < pool.minSize; i++) {
                promises.push(this.createConnection(pool));
            }
            await Promise.allSettled(promises);
        } catch (error) {
            logger.error(`Failed to initialize pool ${pool.id}:`, error);
        }
    }
    
    /**
     * Create a new connection for the pool
     */
    async createConnection(pool) {
        if (pool.connections.size >= pool.maxSize) {
            throw this.errorHandler.createError({
                type: 'rate_limit',
                message: `Pool ${pool.id} at maximum capacity`,
                code: 'POOL_MAX_CAPACITY'
            });
        }
        
        try {
            const connection = await pool.factory();
            const connectionWrapper = {
                id: `${pool.id}_${++pool.created}`,
                connection,
                createdAt: Date.now(),
                lastUsed: Date.now(),
                inUse: false
            };
            
            pool.connections.add(connectionWrapper);
            pool.available.push(connectionWrapper);
            
            this.stats.connectionsCreated++;
            logger.debug(`Connection created for pool ${pool.id}: ${connectionWrapper.id}`);
            
            return connectionWrapper;
        } catch (error) {
            throw this.errorHandler.wrapError(error, { poolId: pool.id });
        }
    }
    
    /**
     * Acquire a connection from the pool
     */
    async acquireConnection(poolId, timeout) {
        const pool = this.pools.get(poolId);
        if (!pool) {
            throw this.errorHandler.createError({
                type: 'not_found',
                message: `Pool ${poolId} not found`,
                code: 'POOL_NOT_FOUND'
            });
        }
        
        const acquireTimeout = timeout || pool.acquireTimeout;
        const startTime = Date.now();
        
        while (Date.now() - startTime < acquireTimeout) {
            // Try to get an available connection
            let connectionWrapper = pool.available.pop();
            
            if (connectionWrapper) {
                // Validate connection
                try {
                    const isValid = await pool.validateConnection(connectionWrapper.connection);
                    if (isValid) {
                        connectionWrapper.inUse = true;
                        connectionWrapper.lastUsed = Date.now();
                        pool.inUse.add(connectionWrapper);
                        return connectionWrapper.connection;
                    } else {
                        // Connection invalid, remove and try again
                        await this.destroyConnection(pool, connectionWrapper);
                        continue;
                    }
                } catch (error) {
                    await this.destroyConnection(pool, connectionWrapper);
                    continue;
                }
            }
            
            // No available connections, try to create one
            if (pool.connections.size < pool.maxSize) {
                try {
                    connectionWrapper = await this.createConnection(pool);
                    connectionWrapper.inUse = true;
                    pool.available.pop(); // Remove from available
                    pool.inUse.add(connectionWrapper);
                    return connectionWrapper.connection;
                } catch (error) {
                    // Creation failed, continue trying
                }
            }
            
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw this.errorHandler.createError({
            type: 'timeout',
            message: `Failed to acquire connection from pool ${poolId} within ${acquireTimeout}ms`,
            code: 'POOL_ACQUIRE_TIMEOUT'
        });
    }
    
    /**
     * Release a connection back to the pool
     */
    releaseConnection(poolId, connection) {
        const pool = this.pools.get(poolId);
        if (!pool) {
            logger.warn(`Attempted to release connection to non-existent pool: ${poolId}`);
            return;
        }
        
        // Find the connection wrapper
        const connectionWrapper = Array.from(pool.inUse).find(
            wrapper => wrapper.connection === connection
        );
        
        if (connectionWrapper) {
            connectionWrapper.inUse = false;
            connectionWrapper.lastUsed = Date.now();
            pool.inUse.delete(connectionWrapper);
            pool.available.push(connectionWrapper);
            
            logger.debug(`Connection released to pool ${poolId}: ${connectionWrapper.id}`);
        } else {
            logger.warn(`Connection not found in pool ${poolId} for release`);
        }
    }
    
    /**
     * Destroy a connection
     */
    async destroyConnection(pool, connectionWrapper) {
        try {
            // Remove from all collections
            pool.connections.delete(connectionWrapper);
            pool.inUse.delete(connectionWrapper);
            const availableIndex = pool.available.indexOf(connectionWrapper);
            if (availableIndex >= 0) {
                pool.available.splice(availableIndex, 1);
            }
            
            // Cleanup the actual connection
            if (connectionWrapper.connection && typeof connectionWrapper.connection.close === 'function') {
                await connectionWrapper.connection.close();
            }
            
            pool.destroyed++;
            this.stats.connectionsDestroyed++;
            
            logger.debug(`Connection destroyed: ${connectionWrapper.id}`);
        } catch (error) {
            logger.error(`Error destroying connection ${connectionWrapper.id}:`, error);
        }
    }
    
    /**
     * Create and manage a cache
     */
    createCache(cacheId, options = {}) {
        if (this.caches.has(cacheId)) {
            logger.warn(`Cache ${cacheId} already exists, replacing`);
            this.destroyCache(cacheId);
        }
        
        const cache = {
            id: cacheId,
            data: new Map(),
            maxSize: options.maxSize || 1000,
            ttl: options.ttl || 300000, // 5 minutes
            hits: 0,
            misses: 0,
            evictions: 0,
            lastCleanup: Date.now()
        };
        
        this.caches.set(cacheId, cache);
        
        // Schedule cleanup
        this.scheduleTimer(`cache_cleanup_${cacheId}`, () => {
            this.cleanupCache(cache);
        }, Math.min(cache.ttl, 60000)); // Cleanup every minute or TTL, whichever is smaller
        
        logger.debug(`Cache created: ${cacheId}`);
        return cache;
    }
    
    /**
     * Get value from cache
     */
    getCacheValue(cacheId, key) {
        const cache = this.caches.get(cacheId);
        if (!cache) {
            return null;
        }
        
        const entry = cache.data.get(key);
        if (!entry) {
            cache.misses++;
            this.stats.cacheMisses++;
            return null;
        }
        
        // Check TTL
        if (Date.now() - entry.timestamp > cache.ttl) {
            cache.data.delete(key);
            cache.misses++;
            this.stats.cacheMisses++;
            return null;
        }
        
        entry.lastAccessed = Date.now();
        cache.hits++;
        this.stats.cacheHits++;
        return entry.value;
    }
    
    /**
     * Set value in cache
     */
    setCacheValue(cacheId, key, value, customTTL) {
        const cache = this.caches.get(cacheId);
        if (!cache) {
            return false;
        }
        
        // Check if we need to evict
        if (cache.data.size >= cache.maxSize && !cache.data.has(key)) {
            this.evictLeastRecentlyUsed(cache);
        }
        
        const entry = {
            value,
            timestamp: Date.now(),
            lastAccessed: Date.now(),
            ttl: customTTL || cache.ttl
        };
        
        cache.data.set(key, entry);
        return true;
    }
    
    /**
     * Evict least recently used items from cache
     */
    evictLeastRecentlyUsed(cache) {
        const entries = Array.from(cache.data.entries());
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        
        // Remove oldest 10% of entries
        const toRemove = Math.ceil(entries.length * 0.1);
        for (let i = 0; i < toRemove; i++) {
            cache.data.delete(entries[i][0]);
            cache.evictions++;
        }
    }
    
    /**
     * Cleanup expired cache entries
     */
    cleanupCache(cache) {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of cache.data.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                cache.data.delete(key);
                cleaned++;
            }
        }
        
        cache.lastCleanup = now;
        
        if (cleaned > 0) {
            logger.debug(`Cache ${cache.id} cleanup: removed ${cleaned} expired entries`);
        }
    }
    
    /**
     * Schedule a timer with automatic cleanup
     */
    scheduleTimer(id, callback, interval, options = {}) {
        this.clearTimer(id); // Clear existing timer
        
        const timerInfo = {
            id,
            callback,
            interval,
            recurring: options.recurring !== false,
            createdAt: Date.now(),
            lastRun: null,
            runCount: 0
        };
        
        if (timerInfo.recurring) {
            timerInfo.timer = setInterval(() => {
                try {
                    callback();
                    timerInfo.lastRun = Date.now();
                    timerInfo.runCount++;
                } catch (error) {
                    logger.error(`Timer ${id} callback error:`, error);
                }
            }, interval);
        } else {
            timerInfo.timer = setTimeout(() => {
                try {
                    callback();
                    timerInfo.lastRun = Date.now();
                    timerInfo.runCount++;
                } catch (error) {
                    logger.error(`Timer ${id} callback error:`, error);
                }
                this.timers.delete(id);
            }, interval);
        }
        
        this.timers.set(id, timerInfo);
        
        if (this.timers.size > this.limits.maxTimers) {
            logger.warn(`Timer limit exceeded: ${this.timers.size}/${this.limits.maxTimers}`);
        }
        
        return timerInfo;
    }
    
    /**
     * Clear a timer
     */
    clearTimer(id) {
        const timerInfo = this.timers.get(id);
        if (timerInfo) {
            clearTimeout(timerInfo.timer);
            clearInterval(timerInfo.timer);
            this.timers.delete(id);
        }
    }
    
    /**
     * Setup resource monitoring
     */
    setupMonitoring() {
        // Monitor memory usage
        this.scheduleTimer('memory_monitor', () => {
            this.monitorMemoryUsage();
        }, 30000); // Every 30 seconds
        
        // Cleanup idle resources
        this.scheduleTimer('resource_cleanup', () => {
            this.cleanupIdleResources();
        }, 60000); // Every minute
        
        // Pool maintenance
        this.scheduleTimer('pool_maintenance', () => {
            this.maintainPools();
        }, 120000); // Every 2 minutes
    }
    
    /**
     * Monitor memory usage and trigger cleanup if needed
     */
    monitorMemoryUsage() {
        const memoryUsage = process.memoryUsage();
        const totalMemory = require('os').totalmem();
        const memoryUtilization = memoryUsage.rss / totalMemory;
        
        if (memoryUtilization > this.limits.memoryThreshold) {
            logger.warn(`High memory usage detected: ${(memoryUtilization * 100).toFixed(2)}%`);
            this.aggressiveCleanup();
        }
        
        this.emit('memoryStatus', {
            memoryUsage,
            utilization: memoryUtilization,
            threshold: this.limits.memoryThreshold
        });
    }
    
    /**
     * Cleanup idle resources
     */
    cleanupIdleResources() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [id, resourceInfo] of this.resources.entries()) {
            if (resourceInfo.autoCleanup && 
                resourceInfo.priority < 5 && // Don't cleanup critical resources
                now - resourceInfo.lastAccessed > resourceInfo.maxIdleTime) {
                
                this.unregisterResource(id);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logger.info(`Cleaned up ${cleaned} idle resources`);
        }
    }
    
    /**
     * Maintain connection pools
     */
    maintainPools() {
        for (const pool of this.pools.values()) {
            // Remove idle connections
            const now = Date.now();
            const toDestroy = [];
            
            for (const connectionWrapper of pool.available) {
                if (now - connectionWrapper.lastUsed > pool.idleTimeout &&
                    pool.connections.size > pool.minSize) {
                    toDestroy.push(connectionWrapper);
                }
            }
            
            toDestroy.forEach(connectionWrapper => {
                this.destroyConnection(pool, connectionWrapper);
            });
            
            // Ensure minimum connections
            const needed = pool.minSize - pool.connections.size;
            if (needed > 0) {
                for (let i = 0; i < needed; i++) {
                    this.createConnection(pool).catch(error => {
                        logger.warn(`Failed to maintain minimum pool size for ${pool.id}:`, error.message);
                    });
                }
            }
        }
    }
    
    /**
     * Aggressive cleanup for memory pressure
     */
    aggressiveCleanup() {
        logger.info('Performing aggressive cleanup due to memory pressure');
        
        // Clear all caches except critical ones
        for (const cache of this.caches.values()) {
            if (cache.id !== 'critical') {
                cache.data.clear();
                cache.evictions += cache.data.size;
            }
        }
        
        // Force garbage collection if available
        if (global.gc) {
            global.gc();
        }
        
        this.stats.memoryCleanups++;
        this.emit('aggressiveCleanup');
    }
    
    /**
     * Setup graceful shutdown
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            if (this.isShuttingDown) {
                return;
            }
            
            this.isShuttingDown = true;
            logger.info(`Resource manager received ${signal}, starting graceful shutdown`);
            
            try {
                await this.shutdown();
                logger.info('Resource manager shutdown complete');
            } catch (error) {
                logger.error('Error during resource manager shutdown:', error);
            }
        };
        
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGUSR2', () => shutdown('SIGUSR2'));
    }
    
    /**
     * Graceful shutdown
     */
    async shutdown() {
        const startTime = Date.now();
        const tasks = [];
        
        // Clear all timers
        for (const id of this.timers.keys()) {
            this.clearTimer(id);
        }
        
        // Cleanup all resources
        for (const resourceInfo of this.resources.values()) {
            tasks.push(this.cleanupResource(resourceInfo));
        }
        
        // Cleanup all pools
        for (const pool of this.pools.values()) {
            tasks.push(this.destroyPool(pool));
        }
        
        // Destroy all caches
        for (const cacheId of this.caches.keys()) {
            this.destroyCache(cacheId);
        }
        
        // Wait for all cleanup tasks with timeout
        try {
            await Promise.race([
                Promise.allSettled(tasks),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Shutdown timeout')), this.shutdownTimeout)
                )
            ]);
        } catch (error) {
            logger.error('Shutdown timeout reached, forcing exit');
        }
        
        const shutdownTime = Date.now() - startTime;
        logger.info(`Resource manager shutdown completed in ${shutdownTime}ms`);
    }
    
    /**
     * Cleanup a single resource
     */
    async cleanupResource(resourceInfo) {
        try {
            if (typeof resourceInfo.cleanup === 'function') {
                await resourceInfo.cleanup(resourceInfo.resource);
            }
        } catch (error) {
            logger.error(`Error cleaning up resource ${resourceInfo.id}:`, error);
        }
    }
    
    /**
     * Destroy a connection pool
     */
    async destroyPool(pool) {
        const tasks = [];
        
        for (const connectionWrapper of pool.connections) {
            tasks.push(this.destroyConnection(pool, connectionWrapper));
        }
        
        await Promise.allSettled(tasks);
        this.pools.delete(pool.id);
        logger.info(`Pool destroyed: ${pool.id}`);
    }
    
    /**
     * Destroy a cache
     */
    destroyCache(cacheId) {
        const cache = this.caches.get(cacheId);
        if (cache) {
            cache.data.clear();
            this.caches.delete(cacheId);
            this.clearTimer(`cache_cleanup_${cacheId}`);
            logger.debug(`Cache destroyed: ${cacheId}`);
        }
    }
    
    /**
     * Get comprehensive status
     */
    getStatus() {
        const memoryUsage = process.memoryUsage();
        
        return {
            isShuttingDown: this.isShuttingDown,
            resources: {
                total: this.resources.size,
                byType: this.getResourcesByType(),
                idle: this.getIdleResourceCount()
            },
            pools: {
                total: this.pools.size,
                connections: this.getTotalConnections(),
                status: this.getPoolStatus()
            },
            caches: {
                total: this.caches.size,
                totalEntries: this.getTotalCacheEntries(),
                hitRate: this.getCacheHitRate(),
                status: this.getCacheStatus()
            },
            timers: {
                total: this.timers.size,
                active: Array.from(this.timers.values()).filter(t => t.timer).length
            },
            memory: {
                usage: memoryUsage,
                utilizationMB: Math.round(memoryUsage.rss / 1024 / 1024),
                threshold: this.limits.memoryThreshold
            },
            stats: this.stats
        };
    }
    
    getResourcesByType() {
        const byType = {};
        for (const resourceInfo of this.resources.values()) {
            byType[resourceInfo.type] = (byType[resourceInfo.type] || 0) + 1;
        }
        return byType;
    }
    
    getIdleResourceCount() {
        const now = Date.now();
        return Array.from(this.resources.values()).filter(
            r => now - r.lastAccessed > r.maxIdleTime
        ).length;
    }
    
    getTotalConnections() {
        return Array.from(this.pools.values()).reduce((sum, pool) => sum + pool.connections.size, 0);
    }
    
    getPoolStatus() {
        const status = {};
        for (const pool of this.pools.values()) {
            status[pool.id] = {
                total: pool.connections.size,
                available: pool.available.length,
                inUse: pool.inUse.size,
                minSize: pool.minSize,
                maxSize: pool.maxSize
            };
        }
        return status;
    }
    
    getTotalCacheEntries() {
        return Array.from(this.caches.values()).reduce((sum, cache) => sum + cache.data.size, 0);
    }
    
    getCacheHitRate() {
        const totalHits = this.stats.cacheHits;
        const totalRequests = totalHits + this.stats.cacheMisses;
        return totalRequests > 0 ? (totalHits / totalRequests * 100) : 0;
    }
    
    getCacheStatus() {
        const status = {};
        for (const cache of this.caches.values()) {
            const totalRequests = cache.hits + cache.misses;
            status[cache.id] = {
                entries: cache.data.size,
                maxSize: cache.maxSize,
                hits: cache.hits,
                misses: cache.misses,
                hitRate: totalRequests > 0 ? (cache.hits / totalRequests * 100) : 0,
                evictions: cache.evictions
            };
        }
        return status;
    }
}

// Singleton instance
let resourceManagerInstance = null;

function getResourceManager() {
    if (!resourceManagerInstance) {
        resourceManagerInstance = new ResourceManager();
    }
    return resourceManagerInstance;
}

module.exports = {
    ResourceManager,
    getResourceManager
};
