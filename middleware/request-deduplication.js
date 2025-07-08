const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

class RequestDeduplicationBatcher {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.batchTimeout = options.batchTimeout || 100; // 100ms
    this.maxBatchWait = options.maxBatchWait || 1000; // 1 second max wait
    this.deduplicationTTL = options.deduplicationTTL || 5000; // 5 seconds
    this.enableBatching = options.enableBatching !== false;
    this.enableDeduplication = options.enableDeduplication !== false;
    
    // Active batches and pending requests
    this.activeBatches = new Map();
    this.pendingRequests = new Map();
    this.duplicateRequests = new Map();
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      deduplicatedRequests: 0,
      batchedRequests: 0,
      avgBatchSize: 0,
      avgBatchWaitTime: 0,
      totalBatches: 0,
      duplicatesSaved: 0,
      memoryUsage: 0
    };
    
    // Cleanup process
    this.startCleanupProcess();
    
    logger.info('🍌 Request Deduplication & Batching initialized', {
      batchSize: this.batchSize,
      batchTimeout: this.batchTimeout,
      maxBatchWait: this.maxBatchWait,
      deduplicationTTL: this.deduplicationTTL,
      enableBatching: this.enableBatching,
      enableDeduplication: this.enableDeduplication
    });
  }

  // Generate request signature for deduplication
  generateRequestSignature(req) {
    const signature = {
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      userId: req.user?.id || 'anonymous'
    };
    
    return Buffer.from(JSON.stringify(signature)).toString('base64');
  }

  // Check if request is duplicate
  isDuplicate(signature) {
    const existing = this.duplicateRequests.get(signature);
    if (!existing) return false;
    
    // Check if still within TTL
    if (Date.now() - existing.timestamp > this.deduplicationTTL) {
      this.duplicateRequests.delete(signature);
      return false;
    }
    
    return true;
  }

  // Add request to deduplication tracking
  trackRequest(signature, response) {
    this.duplicateRequests.set(signature, {
      timestamp: Date.now(),
      response: response,
      hitCount: 1
    });
  }

  // Get duplicate response
  getDuplicateResponse(signature) {
    const existing = this.duplicateRequests.get(signature);
    if (!existing) return null;
    
    // Update hit count
    existing.hitCount++;
    this.stats.duplicatesSaved++;
    
    return existing.response;
  }

  // Create batch key for similar requests
  createBatchKey(req) {
    // Group requests by endpoint and method
    return `${req.method}:${req.path.split('/').slice(0, 4).join('/')}`;
  }

  // Process single request
  async processSingleRequest(req, res, next, apiHandler) {
    const startTime = performance.now();
    
    try {
      // Handle the request
      const originalJson = res.json;
      let responseData = null;
      
      res.json = function(data) {
        responseData = data;
        return originalJson.call(this, data);
      };
      
      await apiHandler(req, res, next);
      
      // Track response time
      const responseTime = performance.now() - startTime;
      this.updateStats(responseTime, 1, false);
      
      return responseData;
    } catch (error) {
      logger.error('Single request processing failed', {
        error: error.message,
        path: req.path,
        method: req.method
      });
      throw error;
    }
  }

  // Process batch of requests
  async processBatch(batchKey, requests, apiHandler) {
    const startTime = performance.now();
    const batchSize = requests.length;
    
    logger.info('🍌 Processing batch', {
      batchKey,
      batchSize,
      requestIds: requests.map(r => r.id)
    });
    
    try {
      // Process requests in parallel with controlled concurrency
      const results = await this.processRequestsInParallel(requests, apiHandler);
      
      // Send responses to all requests in the batch
      results.forEach((result, index) => {
        const { req, res } = requests[index];
        
        if (result.error) {
          res.status(500).json({
            success: false,
            error: 'Batch processing failed',
            message: result.error.message,
            timestamp: new Date().toISOString()
          });
        } else {
          res.json(result.data);
        }
      });
      
      // Update statistics
      const processingTime = performance.now() - startTime;
      this.updateStats(processingTime, batchSize, true);
      
      logger.info('🍌 Batch processing completed', {
        batchKey,
        batchSize,
        processingTime: processingTime.toFixed(2) + 'ms',
        avgTimePerRequest: (processingTime / batchSize).toFixed(2) + 'ms'
      });
      
    } catch (error) {
      logger.error('Batch processing failed', {
        batchKey,
        batchSize,
        error: error.message
      });
      
      // Send error response to all requests
      requests.forEach(({ res }) => {
        res.status(500).json({
          success: false,
          error: 'Batch processing failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      });
    }
  }

  // Process requests in parallel with controlled concurrency
  async processRequestsInParallel(requests, apiHandler, maxConcurrency = 5) {
    const results = [];
    
    // Process in chunks to limit concurrency
    for (let i = 0; i < requests.length; i += maxConcurrency) {
      const chunk = requests.slice(i, i + maxConcurrency);
      
      const chunkPromises = chunk.map(async ({ req, res }) => {
        try {
          // Create a mock response to capture data
          const mockRes = {
            json: (data) => data,
            status: () => mockRes,
            setHeader: () => mockRes
          };
          
          // Process the request
          const data = await new Promise((resolve, reject) => {
            const originalJson = res.json;
            res.json = function(data) {
              resolve(data);
              return originalJson.call(this, data);
            };
            
            apiHandler(req, res, (err) => {
              if (err) reject(err);
            });
          });
          
          return { data, error: null };
        } catch (error) {
          return { data: null, error };
        }
      });
      
      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }
    
    return results;
  }

  // Add request to batch
  addToBatch(batchKey, req, res, apiHandler) {
    if (!this.activeBatches.has(batchKey)) {
      this.activeBatches.set(batchKey, {
        requests: [],
        startTime: Date.now(),
        timer: null
      });
    }
    
    const batch = this.activeBatches.get(batchKey);
    const requestId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    batch.requests.push({
      id: requestId,
      req,
      res,
      timestamp: Date.now()
    });
    
    // Check if batch is ready to process
    if (batch.requests.length >= this.batchSize) {
      this.executeBatch(batchKey, apiHandler);
    } else if (!batch.timer) {
      // Set timer for batch processing
      batch.timer = setTimeout(() => {
        this.executeBatch(batchKey, apiHandler);
      }, this.batchTimeout);
    }
    
    // Emergency timeout to prevent hanging requests
    setTimeout(() => {
      if (this.activeBatches.has(batchKey)) {
        this.executeBatch(batchKey, apiHandler);
      }
    }, this.maxBatchWait);
  }

  // Execute batch processing
  async executeBatch(batchKey, apiHandler) {
    const batch = this.activeBatches.get(batchKey);
    if (!batch || batch.requests.length === 0) {
      return;
    }
    
    // Clear timer
    if (batch.timer) {
      clearTimeout(batch.timer);
    }
    
    // Remove batch from active batches
    this.activeBatches.delete(batchKey);
    
    // Process the batch
    await this.processBatch(batchKey, batch.requests, apiHandler);
  }

  // Update statistics
  updateStats(responseTime, requestCount, wasBatched) {
    this.stats.totalRequests += requestCount;
    
    if (wasBatched) {
      this.stats.batchedRequests += requestCount;
      this.stats.totalBatches++;
      
      // Update average batch size
      this.stats.avgBatchSize = (
        (this.stats.avgBatchSize * (this.stats.totalBatches - 1) + requestCount) /
        this.stats.totalBatches
      );
      
      // Update average batch wait time
      this.stats.avgBatchWaitTime = (
        (this.stats.avgBatchWaitTime * (this.stats.totalBatches - 1) + responseTime) /
        this.stats.totalBatches
      );
    }
    
    // Update memory usage estimate
    this.stats.memoryUsage = (
      this.duplicateRequests.size * 1024 + // Approximate size per duplicate
      this.activeBatches.size * 512 + // Approximate size per active batch
      this.pendingRequests.size * 256 // Approximate size per pending request
    );
  }

  // Middleware for Express
  middleware(apiHandler, options = {}) {
    const batchingEnabled = options.enableBatching !== false && this.enableBatching;
    const deduplicationEnabled = options.enableDeduplication !== false && this.enableDeduplication;
    const batchableEndpoints = options.batchableEndpoints || [];
    
    return async (req, res, next) => {
      const startTime = performance.now();
      
      try {
        // Generate request signature
        const signature = this.generateRequestSignature(req);
        
        // Check for deduplication
        if (deduplicationEnabled && this.isDuplicate(signature)) {
          const duplicateResponse = this.getDuplicateResponse(signature);
          if (duplicateResponse) {
            res.setHeader('X-Deduplicated', 'true');
            res.setHeader('X-Request-Signature', signature.substring(0, 16));
            
            logger.debug('🍌 Request deduplicated', {
              signature: signature.substring(0, 16),
              path: req.path,
              method: req.method
            });
            
            return res.json(duplicateResponse);
          }
        }
        
        // Check if request should be batched
        const batchKey = this.createBatchKey(req);
        const shouldBatch = batchingEnabled && (
          batchableEndpoints.length === 0 || 
          batchableEndpoints.some(pattern => req.path.includes(pattern))
        );
        
        if (shouldBatch && req.method === 'GET') {
          // Add to batch
          res.setHeader('X-Batched', 'true');
          res.setHeader('X-Batch-Key', batchKey);
          
          this.addToBatch(batchKey, req, res, apiHandler);
        } else {
          // Process single request
          res.setHeader('X-Batched', 'false');
          
          const responseData = await this.processSingleRequest(req, res, next, apiHandler);
          
          // Track for deduplication
          if (deduplicationEnabled && responseData) {
            this.trackRequest(signature, responseData);
          }
        }
        
      } catch (error) {
        logger.error('Request processing middleware error', {
          error: error.message,
          path: req.path,
          method: req.method
        });
        
        next(error);
      }
    };
  }

  // Start cleanup process
  startCleanupProcess() {
    setInterval(() => {
      this.cleanup();
    }, this.deduplicationTTL);
    
    logger.info('🍌 Request deduplication cleanup started');
  }

  // Cleanup expired entries
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean up expired duplicate requests
    for (const [signature, entry] of this.duplicateRequests.entries()) {
      if (now - entry.timestamp > this.deduplicationTTL) {
        this.duplicateRequests.delete(signature);
        cleaned++;
      }
    }
    
    // Clean up stale active batches
    for (const [batchKey, batch] of this.activeBatches.entries()) {
      if (now - batch.startTime > this.maxBatchWait) {
        logger.warn('🍌 Cleaning up stale batch', {
          batchKey,
          age: now - batch.startTime,
          requestCount: batch.requests.length
        });
        
        // Send timeout response to all requests in the batch
        batch.requests.forEach(({ res }) => {
          res.status(408).json({
            success: false,
            error: 'Request timeout',
            message: 'Batch processing timed out',
            timestamp: new Date().toISOString()
          });
        });
        
        this.activeBatches.delete(batchKey);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('🍌 Cleanup completed', {
        duplicatesCleared: cleaned,
        activeBatches: this.activeBatches.size,
        duplicateRequests: this.duplicateRequests.size
      });
    }
  }

  // Get statistics
  getStats() {
    const totalProcessed = this.stats.totalRequests;
    const deduplicationRate = totalProcessed > 0 ? (this.stats.duplicatesSaved / totalProcessed) * 100 : 0;
    const batchingRate = totalProcessed > 0 ? (this.stats.batchedRequests / totalProcessed) * 100 : 0;
    
    return {
      ...this.stats,
      deduplicationRate: deduplicationRate.toFixed(2) + '%',
      batchingRate: batchingRate.toFixed(2) + '%',
      activeBatches: this.activeBatches.size,
      duplicateRequests: this.duplicateRequests.size,
      memoryUsageMB: (this.stats.memoryUsage / (1024 * 1024)).toFixed(2),
      avgBatchSize: this.stats.avgBatchSize.toFixed(1),
      avgBatchWaitTime: this.stats.avgBatchWaitTime.toFixed(2) + 'ms'
    };
  }

  // Force process all pending batches
  async flushBatches() {
    const batchKeys = Array.from(this.activeBatches.keys());
    
    for (const batchKey of batchKeys) {
      await this.executeBatch(batchKey, () => {});
    }
    
    logger.info('🍌 All batches flushed', {
      batchesProcessed: batchKeys.length
    });
  }

  // Clear all deduplication data
  clearDeduplication() {
    const cleared = this.duplicateRequests.size;
    this.duplicateRequests.clear();
    
    logger.info('🍌 Deduplication data cleared', {
      entriesCleared: cleared
    });
    
    return cleared;
  }

  // Get duplicate request details
  getDuplicateDetails() {
    const details = [];
    
    for (const [signature, entry] of this.duplicateRequests.entries()) {
      details.push({
        signature: signature.substring(0, 16),
        timestamp: entry.timestamp,
        hitCount: entry.hitCount,
        age: Date.now() - entry.timestamp
      });
    }
    
    return details.sort((a, b) => b.hitCount - a.hitCount);
  }

  // Get active batch details
  getActiveBatches() {
    const batches = [];
    
    for (const [batchKey, batch] of this.activeBatches.entries()) {
      batches.push({
        batchKey,
        requestCount: batch.requests.length,
        startTime: batch.startTime,
        age: Date.now() - batch.startTime,
        requests: batch.requests.map(r => ({
          id: r.id,
          path: r.req.path,
          method: r.req.method,
          timestamp: r.timestamp
        }))
      });
    }
    
    return batches.sort((a, b) => b.requestCount - a.requestCount);
  }
}

module.exports = RequestDeduplicationBatcher;