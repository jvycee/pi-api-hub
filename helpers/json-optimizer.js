const logger = require('../shared/logger');

class JSONOptimizer {
  constructor(options = {}) {
    this.maxDepth = options.maxDepth || 10;
    this.maxStringLength = options.maxStringLength || 10000;
    this.maxArrayLength = options.maxArrayLength || 1000;
    this.maxObjectKeys = options.maxObjectKeys || 1000;
    this.preserveKeys = options.preserveKeys || ['id', 'name', 'email', 'createdAt', 'updatedAt'];
    
    // Adaptive chunk sizing configuration - Pi 5 SSD optimized
    this.baseChunkSize = options.baseChunkSize || 2 * 1024 * 1024; // 2MB default - SSD sweet spot
    this.minChunkSize = options.minChunkSize || 128 * 1024; // 128KB min - better for SSD
    this.maxChunkSize = options.maxChunkSize || 10 * 1024 * 1024; // 10MB max - Pi 5 can handle it!
    this.memoryThresholds = {
      low: 0.5,    // 50% memory usage
      medium: 0.7, // 70% memory usage
      high: 0.85   // 85% memory usage
    };
    
    // Performance tracking
    this.performanceStats = {
      chunkSizes: [],
      memoryReadings: [],
      optimizationTimes: []
    };
  }

  // Calculate adaptive chunk size based on memory pressure
  calculateAdaptiveChunkSize() {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryPressure = usedMemory / totalMemory;
    
    // Get recent performance data
    const recentChunkSizes = this.performanceStats.chunkSizes.slice(-10);
    const recentMemoryReadings = this.performanceStats.memoryReadings.slice(-10);
    
    let adaptiveSize = this.baseChunkSize;
    
    // Adjust based on memory pressure
    if (memoryPressure > this.memoryThresholds.high) {
      // High memory pressure - reduce chunk size significantly
      adaptiveSize = this.minChunkSize;
      logger.warn('🍌 High memory pressure detected, reducing chunk size', {
        memoryPressure: `${(memoryPressure * 100).toFixed(1)}%`,
        chunkSize: `${(adaptiveSize / 1024).toFixed(0)}KB`
      });
    } else if (memoryPressure > this.memoryThresholds.medium) {
      // Medium memory pressure - moderate reduction
      adaptiveSize = this.baseChunkSize * 0.6;
    } else if (memoryPressure < this.memoryThresholds.low) {
      // Low memory pressure - can increase chunk size
      adaptiveSize = Math.min(this.maxChunkSize, this.baseChunkSize * 1.5);
    }
    
    // Consider historical performance
    if (recentChunkSizes.length > 0) {
      const avgChunkSize = recentChunkSizes.reduce((sum, size) => sum + size, 0) / recentChunkSizes.length;
      const avgMemoryUsage = recentMemoryReadings.reduce((sum, mem) => sum + mem, 0) / recentMemoryReadings.length;
      
      // If recent chunks were processed efficiently, gradually increase size
      if (avgMemoryUsage < this.memoryThresholds.medium && avgChunkSize < this.maxChunkSize) {
        adaptiveSize = Math.min(this.maxChunkSize, avgChunkSize * 1.1);
      }
      
      // If recent chunks caused memory issues, reduce size
      if (avgMemoryUsage > this.memoryThresholds.high) {
        adaptiveSize = Math.max(this.minChunkSize, avgChunkSize * 0.8);
      }
    }
    
    // Clamp to bounds
    adaptiveSize = Math.max(this.minChunkSize, Math.min(this.maxChunkSize, adaptiveSize));
    
    // Track the decision
    this.performanceStats.chunkSizes.push(adaptiveSize);
    this.performanceStats.memoryReadings.push(memoryPressure);
    
    // Keep only recent data
    if (this.performanceStats.chunkSizes.length > 100) {
      this.performanceStats.chunkSizes = this.performanceStats.chunkSizes.slice(-50);
      this.performanceStats.memoryReadings = this.performanceStats.memoryReadings.slice(-50);
    }
    
    logger.debug('🍌 Adaptive chunk size calculated', {
      memoryPressure: `${(memoryPressure * 100).toFixed(1)}%`,
      chunkSize: `${(adaptiveSize / 1024).toFixed(0)}KB`,
      trend: this.getChunkSizeTrend()
    });
    
    return Math.round(adaptiveSize);
  }
  
  // Get chunk size trend analysis
  getChunkSizeTrend() {
    const recent = this.performanceStats.chunkSizes.slice(-5);
    if (recent.length < 3) return 'stable';
    
    const trend = recent.slice(-1)[0] - recent[0];
    if (trend > recent[0] * 0.1) return 'increasing';
    if (trend < -recent[0] * 0.1) return 'decreasing';
    return 'stable';
  }

  // Optimize large JSON objects for Pi memory constraints
  optimizeObject(obj, depth = 0) {
    if (depth > this.maxDepth) {
      return { _truncated: true, _reason: 'max_depth_exceeded' };
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.optimizeString(obj);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return this.optimizeArray(obj, depth);
    }

    if (typeof obj === 'object') {
      return this.optimizeObjectProperties(obj, depth);
    }

    return obj;
  }

  // Optimize string length
  optimizeString(str) {
    if (str.length <= this.maxStringLength) {
      return str;
    }

    return {
      _truncated: true,
      _originalLength: str.length,
      _preview: str.substring(0, 100),
      _content: str.substring(0, this.maxStringLength)
    };
  }

  // Optimize arrays
  optimizeArray(arr, depth) {
    if (arr.length <= this.maxArrayLength) {
      return arr.map(item => this.optimizeObject(item, depth + 1));
    }

    logger.warn('Array truncated due to size', {
      originalLength: arr.length,
      maxLength: this.maxArrayLength
    });

    return {
      _truncated: true,
      _originalLength: arr.length,
      _items: arr.slice(0, this.maxArrayLength).map(item => this.optimizeObject(item, depth + 1)),
      _sample: arr.slice(0, 5).map(item => this.optimizeObject(item, depth + 1))
    };
  }

  // Optimize object properties
  optimizeObjectProperties(obj, depth) {
    const keys = Object.keys(obj);
    
    if (keys.length <= this.maxObjectKeys) {
      const optimized = {};
      for (const key of keys) {
        optimized[key] = this.optimizeObject(obj[key], depth + 1);
      }
      return optimized;
    }

    logger.warn('Object truncated due to key count', {
      originalKeys: keys.length,
      maxKeys: this.maxObjectKeys
    });

    // Preserve important keys first
    const preservedKeys = keys.filter(key => this.preserveKeys.includes(key));
    const otherKeys = keys.filter(key => !this.preserveKeys.includes(key));
    
    const selectedKeys = [
      ...preservedKeys,
      ...otherKeys.slice(0, this.maxObjectKeys - preservedKeys.length)
    ];

    const optimized = {
      _truncated: true,
      _originalKeys: keys.length,
      _preservedKeys: preservedKeys.length
    };

    for (const key of selectedKeys) {
      optimized[key] = this.optimizeObject(obj[key], depth + 1);
    }

    return optimized;
  }

  // Stream-based JSON parsing for large responses with adaptive chunking
  async parseStreamedJSON(stream) {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;
      const objects = [];
      let currentObject = '';
      let startIndex = 0;
      let bytesProcessed = 0;
      let chunkCount = 0;
      const startTime = Date.now();

      const processBuffer = () => {
        for (let i = startIndex; i < buffer.length; i++) {
          const char = buffer[i];

          if (escapeNext) {
            escapeNext = false;
            continue;
          }

          if (char === '\\' && inString) {
            escapeNext = true;
            continue;
          }

          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }

          if (!inString) {
            if (char === '{') {
              if (bracketCount === 0) {
                currentObject = '';
              }
              bracketCount++;
              currentObject += char;
            } else if (char === '}') {
              bracketCount--;
              currentObject += char;
              
              if (bracketCount === 0 && currentObject.trim()) {
                try {
                  const parsed = JSON.parse(currentObject);
                  const optimized = this.optimizeObject(parsed);
                  objects.push(optimized);
                  currentObject = '';
                } catch (error) {
                  logger.error('JSON parsing error:', error);
                }
              }
            } else if (bracketCount > 0) {
              currentObject += char;
            }
          } else if (bracketCount > 0) {
            currentObject += char;
          }
        }
        
        startIndex = buffer.length;
      };

      stream.on('data', (chunk) => {
        buffer += chunk.toString();
        bytesProcessed += chunk.length;
        chunkCount++;
        
        processBuffer();
        
        // Use adaptive chunk sizing for buffer management
        const adaptiveChunkSize = this.calculateAdaptiveChunkSize();
        const bufferLimit = Math.max(adaptiveChunkSize * 3, 5 * 1024 * 1024); // At least 5MB
        
        // Prevent buffer from growing too large
        if (buffer.length > bufferLimit) {
          buffer = buffer.substring(startIndex);
          startIndex = 0;
          
          // Force garbage collection if available and memory pressure is high
          const memoryUsage = process.memoryUsage();
          const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
          
          if (global.gc && memoryPressure > this.memoryThresholds.medium) {
            global.gc();
            logger.debug('🍌 Forced garbage collection during JSON parsing', {
              memoryPressure: `${(memoryPressure * 100).toFixed(1)}%`,
              bufferSize: `${(buffer.length / 1024).toFixed(0)}KB`,
              chunkCount
            });
          }
        }
      });

      stream.on('end', () => {
        // Process any remaining buffer
        if (currentObject.trim()) {
          try {
            const parsed = JSON.parse(currentObject);
            const optimized = this.optimizeObject(parsed);
            objects.push(optimized);
          } catch (error) {
            logger.error('Final JSON parsing error:', error);
          }
        }
        
        // Track performance metrics
        const totalTime = Date.now() - startTime;
        this.performanceStats.optimizationTimes.push(totalTime);
        
        // Keep only recent optimization times
        if (this.performanceStats.optimizationTimes.length > 100) {
          this.performanceStats.optimizationTimes = this.performanceStats.optimizationTimes.slice(-50);
        }
        
        logger.info('🍌 JSON stream parsing completed', {
          objectsProcessed: objects.length,
          bytesProcessed: `${(bytesProcessed / 1024).toFixed(0)}KB`,
          chunksReceived: chunkCount,
          processingTime: `${totalTime}ms`,
          avgChunkSize: `${(bytesProcessed / chunkCount / 1024).toFixed(0)}KB`
        });
        
        resolve(objects);
      });

      stream.on('error', reject);
    });
  }

  // Memory-efficient JSON stringify with adaptive chunking
  stringify(obj, options = {}) {
    const adaptiveChunkSize = this.calculateAdaptiveChunkSize();
    const {
      maxMemory = 100 * 1024 * 1024, // 100MB
      chunkSize = adaptiveChunkSize
    } = options;

    let memoryUsed = 0;
    const startTime = Date.now();
    
    const replacer = (key, value) => {
      if (value && typeof value === 'object') {
        const size = JSON.stringify(value).length * 2; // Rough estimate
        memoryUsed += size;
        
        if (memoryUsed > maxMemory) {
          return { _truncated: true, _reason: 'memory_limit_exceeded' };
        }
      }
      
      return value;
    };

    try {
      const optimized = this.optimizeObject(obj);
      const result = JSON.stringify(optimized, replacer, 2);
      
      // Track performance
      const processingTime = Date.now() - startTime;
      this.performanceStats.optimizationTimes.push(processingTime);
      
      logger.debug('🍌 JSON stringify completed', {
        chunkSize: `${(chunkSize / 1024).toFixed(0)}KB`,
        memoryUsed: `${(memoryUsed / 1024).toFixed(0)}KB`,
        processingTime: `${processingTime}ms`,
        resultSize: `${(result.length / 1024).toFixed(0)}KB`
      });
      
      return result;
    } catch (error) {
      logger.error('JSON stringify error:', error);
      return JSON.stringify({
        error: 'Serialization failed',
        message: error.message,
        truncated: true
      });
    }
  }

  // Create middleware for JSON optimization
  middleware() {
    return (req, res, next) => {
      const originalJson = res.json;
      
      res.json = (obj) => {
        try {
          const optimized = this.optimizeObject(obj);
          return originalJson.call(res, optimized);
        } catch (error) {
          logger.error('JSON optimization middleware error:', error);
          return originalJson.call(res, {
            error: 'Response optimization failed',
            message: error.message,
            original: obj
          });
        }
      };
      
      next();
    };
  }

  // Get optimization statistics
  getStats(obj) {
    const stats = {
      originalSize: 0,
      optimizedSize: 0,
      truncations: 0,
      depth: 0
    };

    const traverse = (current, depth = 0) => {
      stats.depth = Math.max(stats.depth, depth);
      
      if (current && typeof current === 'object') {
        if (current._truncated) {
          stats.truncations++;
        }
        
        for (const key in current) {
          if (current.hasOwnProperty(key)) {
            traverse(current[key], depth + 1);
          }
        }
      }
    };

    try {
      stats.originalSize = JSON.stringify(obj).length;
      const optimized = this.optimizeObject(obj);
      stats.optimizedSize = JSON.stringify(optimized).length;
      traverse(optimized);
      
      stats.compressionRatio = (stats.optimizedSize / stats.originalSize * 100).toFixed(2);
      
    } catch (error) {
      logger.error('Stats calculation error:', error);
    }

    return stats;
  }
  
  // Get adaptive chunk sizing statistics
  getAdaptiveStats() {
    const recentChunks = this.performanceStats.chunkSizes.slice(-20);
    const recentMemory = this.performanceStats.memoryReadings.slice(-20);
    const recentTimes = this.performanceStats.optimizationTimes.slice(-20);
    
    const avgChunkSize = recentChunks.length > 0 
      ? recentChunks.reduce((sum, size) => sum + size, 0) / recentChunks.length 
      : this.baseChunkSize;
    
    const avgMemoryPressure = recentMemory.length > 0
      ? recentMemory.reduce((sum, mem) => sum + mem, 0) / recentMemory.length
      : 0;
    
    const avgOptimizationTime = recentTimes.length > 0
      ? recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length
      : 0;
    
    return {
      adaptive: {
        currentChunkSize: `${(this.calculateAdaptiveChunkSize() / 1024).toFixed(0)}KB`,
        avgChunkSize: `${(avgChunkSize / 1024).toFixed(0)}KB`,
        baseChunkSize: `${(this.baseChunkSize / 1024).toFixed(0)}KB`,
        minChunkSize: `${(this.minChunkSize / 1024).toFixed(0)}KB`,
        maxChunkSize: `${(this.maxChunkSize / 1024).toFixed(0)}KB`,
        trend: this.getChunkSizeTrend()
      },
      performance: {
        avgMemoryPressure: `${(avgMemoryPressure * 100).toFixed(1)}%`,
        avgOptimizationTime: `${avgOptimizationTime.toFixed(0)}ms`,
        samplesCollected: recentChunks.length,
        totalOptimizations: this.performanceStats.optimizationTimes.length
      },
      memoryThresholds: {
        low: `${(this.memoryThresholds.low * 100).toFixed(0)}%`,
        medium: `${(this.memoryThresholds.medium * 100).toFixed(0)}%`,
        high: `${(this.memoryThresholds.high * 100).toFixed(0)}%`
      }
    };
  }
}

module.exports = JSONOptimizer;