const logger = require('../shared/logger');

class JSONOptimizer {
  constructor(options = {}) {
    this.maxDepth = options.maxDepth || 10;
    this.maxStringLength = options.maxStringLength || 10000;
    this.maxArrayLength = options.maxArrayLength || 1000;
    this.maxObjectKeys = options.maxObjectKeys || 1000;
    this.preserveKeys = options.preserveKeys || ['id', 'name', 'email', 'createdAt', 'updatedAt'];
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

  // Stream-based JSON parsing for large responses
  async parseStreamedJSON(stream) {
    return new Promise((resolve, reject) => {
      let buffer = '';
      let bracketCount = 0;
      let inString = false;
      let escapeNext = false;
      const objects = [];
      let currentObject = '';
      let startIndex = 0;

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
        processBuffer();
        
        // Prevent buffer from growing too large
        if (buffer.length > 10 * 1024 * 1024) { // 10MB limit
          buffer = buffer.substring(startIndex);
          startIndex = 0;
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
        
        resolve(objects);
      });

      stream.on('error', reject);
    });
  }

  // Memory-efficient JSON stringify
  stringify(obj, options = {}) {
    const {
      maxMemory = 100 * 1024 * 1024, // 100MB
      chunkSize = 1024 * 1024 // 1MB
    } = options;

    let memoryUsed = 0;
    
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
      return JSON.stringify(optimized, replacer, 2);
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
}

module.exports = JSONOptimizer;