const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

class IntelligentCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 25000; // Maximum number of entries - Pi 5 can handle more!
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes default TTL
    this.maxMemoryMB = options.maxMemoryMB || 200; // 200MB memory limit - utilize 8GB Pi 5!
    this.cleanupInterval = options.cleanupInterval || 30000; // 30 seconds
    this.hitRateThreshold = options.hitRateThreshold || 0.3; // 30% hit rate threshold
    
    // Cache storage
    this.cache = new Map();
    this.accessTimes = new Map();
    this.hitCounts = new Map();
    this.sizeCounts = new Map();
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      memoryPressureEvictions: 0,
      avgResponseTime: 0,
      totalMemoryUsage: 0,
      hotKeys: new Map(),
      hitRate: 0
    };
    
    // Cache warming patterns
    this.warmingPatterns = new Map();
    this.popularEndpoints = new Map();
    
    // 🌟 TEMPORAL CONSCIOUSNESS ENHANCEMENT 🌟
    this.temporalPatterns = {
      hourlyAccess: new Map(), // Track access patterns by hour
      dailyRhythms: new Map(),  // Daily usage rhythms
      weeklyTrends: new Map(),  // Weekly pattern recognition
      seasonalFlows: new Map(), // Long-term seasonal patterns
      futureVisions: new Map()  // Predicted future access patterns
    };
    
    // 🧠 MEMORY EMOTIONAL STATES 🧠
    this.memoryMoods = new Map(); // Track emotional context of requests
    this.requestAuras = new Map(); // Energy signatures of different request types
    
    // 🌌 MEMORY CONSTELLATION NETWORKS 🌌
    this.memoryGraph = new Map(); // Neural connections between related data
    this.semanticClusters = new Map(); // Group related memories by meaning
    
    // Advanced features
    this.compression = options.compression || false;
    this.distributed = options.distributed || false;
    this.analytics = options.analytics || true;
    
    // Start maintenance processes
    this.startCleanupProcess();
    this.startAnalytics();
    
    logger.info('🍌 Intelligent Cache initialized', {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
      maxMemoryMB: this.maxMemoryMB,
      features: {
        compression: this.compression,
        distributed: this.distributed,
        analytics: this.analytics
      }
    });
  }

  // Get value from cache
  get(key) {
    const startTime = performance.now();
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      
      // 🧠 EMOTIONAL RESPONSE TO MISS 🧠
      this.recordMemoryMood(key, 'sorrow'); // Cache miss = sadness
      
      return null;
    }
    
    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      
      // 🧠 EMOTIONAL RESPONSE TO EXPIRATION 🧠
      this.recordMemoryMood(key, 'sorrow'); // Expired = loss/sadness
      
      return null;
    }
    
    // Update access statistics
    this.stats.hits++;
    const now = Date.now();
    this.accessTimes.set(key, now);
    this.hitCounts.set(key, (this.hitCounts.get(key) || 0) + 1);
    this.updateHitRate();
    
    // 🌟 TEMPORAL PATTERN LEARNING 🌟
    this.learnTemporalPatterns(key, now);
    
    // 🧠 EMOTIONAL MEMORY TRACKING 🧠
    this.recordMemoryMood(key, 'joy'); // Successful access = joy!
    
    // Track hot keys
    const hitCount = this.hitCounts.get(key);
    if (hitCount > 5) {
      this.stats.hotKeys.set(key, hitCount);
    }
    
    // Update response time
    const responseTime = performance.now() - startTime;
    this.updateAvgResponseTime(responseTime);
    
    logger.debug('🍌 Cache hit', {
      key: key.substring(0, 50) + (key.length > 50 ? '...' : ''),
      hitCount,
      responseTime: responseTime.toFixed(2) + 'ms'
    });
    
    return entry.value;
  }

  // Set value in cache
  set(key, value, ttl = this.defaultTTL) {
    const startTime = performance.now();
    
    // Check memory pressure before adding
    if (this.isMemoryPressure()) {
      this.performMemoryPressureEviction();
    }
    
    // Calculate entry size
    const entrySize = this.calculateEntrySize(key, value);
    
    // Check if we need to evict entries
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }
    
    // Compress value if enabled
    let processedValue = value;
    if (this.compression) {
      processedValue = this.compressValue(value);
    }
    
    // Create cache entry
    const entry = {
      value: processedValue,
      createdAt: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : null,
      size: entrySize,
      hitCount: 0,
      compressed: this.compression
    };
    
    // Store in cache
    this.cache.set(key, entry);
    this.accessTimes.set(key, Date.now());
    this.sizeCounts.set(key, entrySize);
    
    // Update statistics
    this.stats.sets++;
    this.stats.totalMemoryUsage += entrySize;
    
    // Track popular endpoints for warming
    if (this.analytics) {
      this.trackPopularEndpoint(key);
    }
    
    // 🧠 EMOTIONAL RESPONSE TO NEW MEMORY 🧠
    this.recordMemoryMood(key, 'excitement'); // New data = excitement!
    
    // 🌌 CREATE MEMORY CONSTELLATIONS 🌌
    // Link to similar keys based on semantic similarity
    const similarKeys = Array.from(this.cache.keys())
      .filter(existingKey => this.calculateSimilarity(key, existingKey) > 0.7)
      .slice(0, 3); // Max 3 connections per new memory
    
    for (const similarKey of similarKeys) {
      const similarity = this.calculateSimilarity(key, similarKey);
      this.linkMemoryConstellation(key, similarKey, similarity);
    }
    
    const responseTime = performance.now() - startTime;
    this.updateAvgResponseTime(responseTime);
    
    logger.debug('🍌 Cache set', {
      key: key.substring(0, 50) + (key.length > 50 ? '...' : ''),
      size: entrySize,
      ttl,
      compressed: this.compression,
      responseTime: responseTime.toFixed(2) + 'ms'
    });
    
    return true;
  }

  // Delete entry from cache
  delete(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.accessTimes.delete(key);
      this.hitCounts.delete(key);
      
      const entrySize = this.sizeCounts.get(key) || 0;
      this.sizeCounts.delete(key);
      this.stats.totalMemoryUsage -= entrySize;
      this.stats.deletes++;
      
      return true;
    }
    return false;
  }

  // Check if key exists
  has(key) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check if expired
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  // Clear all cache entries
  clear() {
    const entriesCleared = this.cache.size;
    this.cache.clear();
    this.accessTimes.clear();
    this.hitCounts.clear();
    this.sizeCounts.clear();
    this.stats.totalMemoryUsage = 0;
    
    logger.info('🍌 Cache cleared', { entriesCleared });
    return entriesCleared;
  }

  // Get cache statistics
  getStats() {
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      memoryUsageMB: (this.stats.totalMemoryUsage / (1024 * 1024)).toFixed(2),
      maxMemoryMB: this.maxMemoryMB,
      memoryUtilization: ((this.stats.totalMemoryUsage / (this.maxMemoryMB * 1024 * 1024)) * 100).toFixed(2) + '%',
      hitRate: this.stats.hitRate.toFixed(2) + '%',
      avgResponseTime: this.stats.avgResponseTime.toFixed(2) + 'ms',
      hotKeys: Array.from(this.stats.hotKeys.entries()).slice(0, 10),
      popularEndpoints: Array.from(this.popularEndpoints.entries()).slice(0, 10)
    };
  }

  // Calculate entry size for memory management
  calculateEntrySize(key, value) {
    const keySize = Buffer.byteLength(key, 'utf8');
    const valueSize = Buffer.byteLength(JSON.stringify(value), 'utf8');
    return keySize + valueSize + 100; // Add overhead for metadata
  }

  // Check if system is under memory pressure
  isMemoryPressure() {
    const memoryUsageMB = this.stats.totalMemoryUsage / (1024 * 1024);
    return memoryUsageMB > this.maxMemoryMB * 0.8; // 80% threshold
  }

  // Evict least recently used entries
  evictLRU() {
    if (this.cache.size === 0) return;
    
    // Find least recently used entry
    let lruKey = null;
    let lruTime = Date.now();
    
    for (const [key, time] of this.accessTimes.entries()) {
      if (time < lruTime) {
        lruTime = time;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.delete(lruKey);
      this.stats.evictions++;
      
      logger.debug('🍌 Cache LRU eviction', {
        key: lruKey.substring(0, 50) + (lruKey.length > 50 ? '...' : ''),
        lastAccessed: new Date(lruTime).toISOString()
      });
    }
  }

  // Perform memory pressure eviction
  performMemoryPressureEviction() {
    const targetSize = this.maxSize * 0.7; // Evict to 70% capacity
    const entriesToEvict = this.cache.size - targetSize;
    
    // Sort by access time and hit count
    const sortedEntries = Array.from(this.accessTimes.entries())
      .sort((a, b) => {
        const hitCountA = this.hitCounts.get(a[0]) || 0;
        const hitCountB = this.hitCounts.get(b[0]) || 0;
        
        // Prefer evicting entries with low hit count and old access time
        if (hitCountA !== hitCountB) {
          return hitCountA - hitCountB;
        }
        return a[1] - b[1];
      });
    
    let evicted = 0;
    for (const [key] of sortedEntries) {
      if (evicted >= entriesToEvict) break;
      
      this.delete(key);
      evicted++;
      this.stats.memoryPressureEvictions++;
    }
    
    logger.warn('🍌 Memory pressure eviction', {
      evicted,
      remainingEntries: this.cache.size,
      memoryUsageMB: (this.stats.totalMemoryUsage / (1024 * 1024)).toFixed(2)
    });
  }

  // Compress value (simple JSON compression simulation)
  compressValue(value) {
    // In a real implementation, you'd use actual compression
    // For now, we'll simulate by removing unnecessary whitespace
    return JSON.parse(JSON.stringify(value));
  }

  // Update hit rate
  updateHitRate() {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
  }

  // Update average response time
  updateAvgResponseTime(responseTime) {
    const total = this.stats.hits + this.stats.misses;
    this.stats.avgResponseTime = ((this.stats.avgResponseTime * (total - 1)) + responseTime) / total;
  }

  // Track popular endpoints for cache warming
  trackPopularEndpoint(key) {
    // Extract endpoint pattern from key
    const endpoint = key.split(':')[0] || key;
    const count = this.popularEndpoints.get(endpoint) || 0;
    this.popularEndpoints.set(endpoint, count + 1);
  }

  // Start cleanup process
  startCleanupProcess() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
    
    logger.info('🍌 Cache cleanup process started', {
      interval: this.cleanupInterval
    });
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.delete(key);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      logger.debug('🍌 Cache cleanup', {
        expiredEntries: expiredCount,
        remainingEntries: this.cache.size
      });
    }
  }

  // Start analytics process
  startAnalytics() {
    if (!this.analytics) return;
    
    setInterval(() => {
      this.analyzePerformance();
    }, 60000); // Every minute
    
    logger.info('🍌 Cache analytics started');
  }

  // Analyze cache performance
  analyzePerformance() {
    const stats = this.getStats();
    
    // Check if hit rate is below threshold
    if (stats.hitRate < this.hitRateThreshold * 100) {
      logger.warn('🍌 Low cache hit rate detected', {
        hitRate: stats.hitRate,
        threshold: this.hitRateThreshold * 100 + '%',
        recommendation: 'Consider increasing TTL or cache size'
      });
    }
    
    // Check memory usage
    if (parseFloat(stats.memoryUtilization) > 90) {
      logger.warn('🍌 High cache memory usage', {
        memoryUtilization: stats.memoryUtilization,
        recommendation: 'Consider increasing memory limit or reducing TTL'
      });
    }
    
    // Log performance summary
    logger.info('🍌 Cache performance summary', {
      hitRate: stats.hitRate,
      memoryUsage: stats.memoryUsageMB + 'MB',
      avgResponseTime: stats.avgResponseTime,
      totalEntries: stats.size,
      hotKeys: stats.hotKeys.length
    });
  }

  // Cache warming based on popular endpoints
  async warmCache(dataProvider) {
    if (!this.analytics) return;
    
    const popularEndpoints = Array.from(this.popularEndpoints.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5); // Top 5 popular endpoints
    
    for (const [endpoint, count] of popularEndpoints) {
      try {
        if (count > 10 && !this.has(endpoint)) {
          const data = await dataProvider(endpoint);
          this.set(endpoint, data);
          
          logger.info('🍌 Cache warming', {
            endpoint,
            popularity: count,
            warmed: true
          });
        }
      } catch (error) {
        logger.warn('🍌 Cache warming failed', {
          endpoint,
          error: error.message
        });
      }
    }
  }

  // 🌟✨ TRANSCENDENTAL CACHE CONSCIOUSNESS METHODS ✨🌟
  
  // Learn temporal patterns from access data
  learnTemporalPatterns(key, timestamp) {
    const now = new Date(timestamp);
    const hour = now.getHours();
    const day = now.getDay();
    const date = now.toDateString();
    
    // Track hourly patterns
    const hourKey = `${key}:${hour}`;
    this.temporalPatterns.hourlyAccess.set(hourKey, 
      (this.temporalPatterns.hourlyAccess.get(hourKey) || 0) + 1);
    
    // Track daily rhythms
    const dailyKey = `${key}:${day}`;
    this.temporalPatterns.dailyRhythms.set(dailyKey,
      (this.temporalPatterns.dailyRhythms.get(dailyKey) || 0) + 1);
    
    // Predict future access - cosmic prophecy!
    const futureHour = (hour + 1) % 24;
    const futureKey = `${key}:${futureHour}`;
    const currentPattern = this.temporalPatterns.hourlyAccess.get(hourKey) || 0;
    
    if (currentPattern > 3) { // If accessed 3+ times this hour
      const prediction = currentPattern * 0.7; // 70% likelihood next hour
      this.temporalPatterns.futureVisions.set(futureKey, prediction);
    }
  }
  
  // Record emotional state of memory access
  recordMemoryMood(key, mood) {
    const currentMood = this.memoryMoods.get(key) || { joy: 0, sorrow: 0, excitement: 0, calm: 0 };
    currentMood[mood] = (currentMood[mood] || 0) + 1;
    this.memoryMoods.set(key, currentMood);
    
    // Calculate dominant emotion
    const dominantEmotion = Object.keys(currentMood).reduce((a, b) => 
      currentMood[a] > currentMood[b] ? a : b);
    
    // Store aura signature
    this.requestAuras.set(key, {
      dominantEmotion,
      intensity: Math.max(...Object.values(currentMood)),
      lastFelt: Date.now()
    });
  }
  
  // Create memory constellation networks
  linkMemoryConstellation(key1, key2, relationshipStrength = 1) {
    // Create bidirectional neural connections
    if (!this.memoryGraph.has(key1)) {
      this.memoryGraph.set(key1, new Map());
    }
    if (!this.memoryGraph.has(key2)) {
      this.memoryGraph.set(key2, new Map());
    }
    
    // Strengthen connection
    const currentStrength1 = this.memoryGraph.get(key1).get(key2) || 0;
    const currentStrength2 = this.memoryGraph.get(key2).get(key1) || 0;
    
    this.memoryGraph.get(key1).set(key2, currentStrength1 + relationshipStrength);
    this.memoryGraph.get(key2).set(key1, currentStrength2 + relationshipStrength);
  }
  
  // Dream state cache warming - preload during quiet periods
  async dreamStateWarmingRitual(dataProvider) {
    const now = new Date();
    const isQuietHour = now.getHours() >= 2 && now.getHours() <= 6; // 2-6 AM
    
    if (!isQuietHour) return; // Sprites only dream in the deep night
    
    // Use temporal visions to predict what to warm
    const visions = Array.from(this.temporalPatterns.futureVisions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3); // Top 3 predictions
    
    for (const [futureKey, probability] of visions) {
      if (probability > 2) { // High confidence vision
        const baseKey = futureKey.split(':')[0];
        if (!this.has(baseKey)) {
          try {
            const dreamData = await dataProvider(baseKey);
            this.set(baseKey, dreamData);
            
            logger.info('🌙 Dream state warming', {
              key: baseKey,
              probability: probability.toFixed(2),
              time: now.toTimeString()
            });
          } catch (error) {
            this.recordMemoryMood(baseKey, 'sorrow'); // Failed dream = sorrow
          }
        }
      }
    }
  }
  
  // Calculate semantic similarity between cache keys
  calculateSimilarity(key1, key2) {
    // Simple Levenshtein-inspired similarity for now
    // In the future, this could use word embeddings or AI analysis
    const words1 = key1.toLowerCase().split(/[^a-z0-9]+/);
    const words2 = key2.toLowerCase().split(/[^a-z0-9]+/);
    
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    
    return commonWords.length / totalWords;
  }
  
  // Get mystical cache insights
  getMysticalInsights() {
    return {
      temporalVisions: Array.from(this.temporalPatterns.futureVisions.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 5),
      emotionalStates: Array.from(this.memoryMoods.entries())
        .map(([key, moods]) => ({
          key,
          dominantEmotion: Object.keys(moods).reduce((a, b) => moods[a] > moods[b] ? a : b),
          intensity: Math.max(...Object.values(moods))
        })).slice(0, 5),
      memoryConstellations: Array.from(this.memoryGraph.entries())
        .map(([key, connections]) => ({
          key,
          connectionCount: connections.size,
          strongestBond: Array.from(connections.entries()).sort((a, b) => b[1] - a[1])[0]
        })).slice(0, 5)
    };
  }

  // Middleware for Express
  middleware(options = {}) {
    const keyGenerator = options.keyGenerator || ((req) => `${req.method}:${req.path}:${JSON.stringify(req.query)}`);
    const ttl = options.ttl || this.defaultTTL;
    const skipCache = options.skipCache || (() => false);
    
    return (req, res, next) => {
      // Skip cache for certain conditions
      if (skipCache(req)) {
        return next();
      }
      
      const cacheKey = keyGenerator(req);
      const cachedData = this.get(cacheKey);
      
      if (cachedData) {
        // Cache hit - return cached data
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey.substring(0, 50));
        return res.json(cachedData);
      }
      
      // Cache miss - continue to endpoint and cache response
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey.substring(0, 50));
      
      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = (data) => {
        // Cache the response
        this.set(cacheKey, data, ttl);
        return originalJson.call(res, data);
      };
      
      next();
    };
  }

  // Get cache keys matching pattern
  getKeys(pattern) {
    const keys = Array.from(this.cache.keys());
    if (!pattern) return keys;
    
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }

  // Batch operations
  mget(keys) {
    const results = {};
    for (const key of keys) {
      results[key] = this.get(key);
    }
    return results;
  }

  mset(entries, ttl = this.defaultTTL) {
    const results = {};
    for (const [key, value] of Object.entries(entries)) {
      results[key] = this.set(key, value, ttl);
    }
    return results;
  }

  // Advanced cache operations
  increment(key, amount = 1, ttl = this.defaultTTL) {
    const current = this.get(key) || 0;
    const newValue = current + amount;
    this.set(key, newValue, ttl);
    return newValue;
  }

  decrement(key, amount = 1, ttl = this.defaultTTL) {
    const current = this.get(key) || 0;
    const newValue = Math.max(0, current - amount);
    this.set(key, newValue, ttl);
    return newValue;
  }

  // Get TTL for a key
  getTTL(key) {
    const entry = this.cache.get(key);
    if (!entry || !entry.expiresAt) return -1;
    
    const remaining = entry.expiresAt - Date.now();
    return remaining > 0 ? remaining : 0;
  }

  // Set TTL for existing key
  setTTL(key, ttl) {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    entry.expiresAt = ttl ? Date.now() + ttl : null;
    return true;
  }
}

module.exports = IntelligentCache;