const zlib = require('zlib');
const logger = require('../shared/logger');

class CompressionMiddleware {
  constructor(options = {}) {
    this.compressionLevel = options.compressionLevel || 6;
    this.threshold = options.threshold || 1024; // 1KB minimum for compression
    this.supportedEncodings = ['gzip', 'deflate', 'br'];
    this.compressionStats = {
      totalRequests: 0,
      compressedRequests: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      compressionRatio: 0
    };
  }

  middleware() {
    return (req, res, next) => {
      // Skip compression for certain content types
      const skipCompression = this.shouldSkipCompression(req);
      if (skipCompression) {
        return next();
      }

      // Get client's accepted encodings
      const acceptedEncodings = this.parseAcceptEncoding(req.headers['accept-encoding']);
      
      if (acceptedEncodings.length === 0) {
        return next();
      }

      // Override res.end to compress response
      const originalEnd = res.end;
      const originalWrite = res.write;
      let chunks = [];
      let totalSize = 0;

      res.write = function(chunk, encoding) {
        if (chunk) {
          chunks.push(Buffer.from(chunk, encoding));
          totalSize += Buffer.byteLength(chunk, encoding);
        }
      };

      res.end = (chunk, encoding) => {
        if (chunk) {
          chunks.push(Buffer.from(chunk, encoding));
          totalSize += Buffer.byteLength(chunk, encoding);
        }

        // Decide whether to compress based on size
        if (totalSize < this.threshold) {
          // Restore original functions and send uncompressed
          res.write = originalWrite;
          res.end = originalEnd;
          
          chunks.forEach(chunk => originalWrite.call(res, chunk));
          return originalEnd.call(res);
        }

        // Compress the response
        const fullBuffer = Buffer.concat(chunks);
        this.compressResponse(fullBuffer, acceptedEncodings, res, originalEnd, totalSize);
      };

      next();
    };
  }

  shouldSkipCompression(req) {
    // Skip compression for:
    // - Already compressed content
    // - Streaming responses
    // - Small responses
    // - Certain endpoints
    
    const contentType = req.headers['content-type'] || '';
    const skipTypes = [
      'image/',
      'video/',
      'audio/',
      'application/zip',
      'application/gzip',
      'application/x-compressed'
    ];

    return skipTypes.some(type => contentType.includes(type)) ||
           req.path.includes('/stream') ||
           req.headers['x-no-compression'] === 'true';
  }

  parseAcceptEncoding(acceptEncoding) {
    if (!acceptEncoding) return [];

    const encodings = acceptEncoding
      .split(',')
      .map(encoding => {
        const [name, q = '1'] = encoding.trim().split(';q=');
        return {
          name: name.trim(),
          quality: parseFloat(q.replace('q=', '')) || 1
        };
      })
      .filter(encoding => this.supportedEncodings.includes(encoding.name))
      .sort((a, b) => b.quality - a.quality);

    return encodings.map(e => e.name);
  }

  compressResponse(buffer, acceptedEncodings, res, originalEnd, originalSize) {
    const bestEncoding = this.selectBestEncoding(acceptedEncodings);
    
    if (!bestEncoding) {
      // No suitable encoding, send uncompressed
      res.write = res.write;
      res.end = originalEnd;
      return originalEnd.call(res, buffer);
    }

    this.performCompression(buffer, bestEncoding, (err, compressedBuffer) => {
      if (err) {
        logger.error('Compression failed', { 
          encoding: bestEncoding, 
          error: err.message 
        });
        return originalEnd.call(res, buffer);
      }

      // Set compression headers
      res.setHeader('Content-Encoding', bestEncoding);
      res.setHeader('Content-Length', compressedBuffer.length);
      res.setHeader('Vary', 'Accept-Encoding');

      // Update statistics
      this.updateStats(originalSize, compressedBuffer.length);

      // Send compressed response
      originalEnd.call(res, compressedBuffer);

      // Log compression success
      const ratio = ((originalSize - compressedBuffer.length) / originalSize * 100).toFixed(1);
      logger.debug('Response compressed', {
        encoding: bestEncoding,
        originalSize,
        compressedSize: compressedBuffer.length,
        compressionRatio: `${ratio}%`
      });
    });
  }

  selectBestEncoding(acceptedEncodings) {
    // Priority order: Brotli > Gzip > Deflate
    const priorityOrder = ['br', 'gzip', 'deflate'];
    
    for (const encoding of priorityOrder) {
      if (acceptedEncodings.includes(encoding)) {
        return encoding;
      }
    }
    
    return null;
  }

  performCompression(buffer, encoding, callback) {
    const options = {
      level: this.compressionLevel,
      chunkSize: 16 * 1024, // 16KB chunks
      windowBits: encoding === 'gzip' ? 15 | 16 : 15, // Add gzip wrapper for gzip
      memLevel: 8
    };

    switch (encoding) {
      case 'br':
        zlib.brotliCompress(buffer, {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: this.compressionLevel,
            [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buffer.length
          }
        }, callback);
        break;

      case 'gzip':
        zlib.gzip(buffer, options, callback);
        break;

      case 'deflate':
        zlib.deflate(buffer, options, callback);
        break;

      default:
        callback(new Error(`Unsupported encoding: ${encoding}`));
    }
  }

  updateStats(originalSize, compressedSize) {
    this.compressionStats.totalRequests++;
    this.compressionStats.compressedRequests++;
    this.compressionStats.totalBytesIn += originalSize;
    this.compressionStats.totalBytesOut += compressedSize;
    
    // Calculate overall compression ratio
    if (this.compressionStats.totalBytesIn > 0) {
      this.compressionStats.compressionRatio = (
        (this.compressionStats.totalBytesIn - this.compressionStats.totalBytesOut) /
        this.compressionStats.totalBytesIn * 100
      ).toFixed(2);
    }
  }

  // Adaptive compression based on system load
  adaptCompressionLevel() {
    const cpuUsage = process.cpuUsage();
    const memoryUsage = process.memoryUsage();
    
    // Reduce compression level if system is under stress
    const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
    const cpuPressure = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
    
    if (memoryPressure > 0.8 || cpuPressure > 50) {
      this.compressionLevel = Math.max(1, this.compressionLevel - 1);
      logger.info('🍌 Adaptive compression: Reduced compression level', {
        level: this.compressionLevel,
        memoryPressure: `${(memoryPressure * 100).toFixed(1)}%`,
        cpuPressure: `${cpuPressure.toFixed(1)}s`
      });
    } else if (memoryPressure < 0.5 && cpuPressure < 20) {
      this.compressionLevel = Math.min(9, this.compressionLevel + 1);
      logger.info('🍌 Adaptive compression: Increased compression level', {
        level: this.compressionLevel,
        memoryPressure: `${(memoryPressure * 100).toFixed(1)}%`,
        cpuPressure: `${cpuPressure.toFixed(1)}s`
      });
    }
  }

  // Start adaptive compression monitoring
  startAdaptiveCompression() {
    setInterval(() => {
      this.adaptCompressionLevel();
    }, 60000); // Check every minute
    
    logger.info('🍌 Adaptive compression monitoring started', {
      initialLevel: this.compressionLevel,
      threshold: this.threshold
    });
  }

  getStats() {
    return {
      ...this.compressionStats,
      currentLevel: this.compressionLevel,
      threshold: this.threshold,
      supportedEncodings: this.supportedEncodings
    };
  }

  // Test different compression methods
  async testCompressionMethods(testData) {
    const results = {};
    const buffer = Buffer.from(JSON.stringify(testData));
    
    for (const encoding of this.supportedEncodings) {
      try {
        const compressed = await this.compressAsync(buffer, encoding);
        const ratio = ((buffer.length - compressed.length) / buffer.length * 100).toFixed(1);
        
        results[encoding] = {
          originalSize: buffer.length,
          compressedSize: compressed.length,
          compressionRatio: `${ratio}%`,
          spaceSaved: buffer.length - compressed.length
        };
      } catch (error) {
        results[encoding] = {
          error: error.message
        };
      }
    }
    
    return results;
  }

  compressAsync(buffer, encoding) {
    return new Promise((resolve, reject) => {
      this.performCompression(buffer, encoding, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }
}

module.exports = CompressionMiddleware;