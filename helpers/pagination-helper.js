const logger = require('../shared/logger');
const streamTracker = require('../shared/stream-tracker');

class PaginationHelper {
  constructor(options = {}) {
    this.defaultLimit = options.defaultLimit || 50;
    this.maxLimit = options.maxLimit || 100;
    this.defaultTimeout = options.defaultTimeout || 30000;
  }

  // Smart pagination for HubSpot APIs
  createPaginatedStream(apiClient, endpoint, options = {}) {
    const {
      limit = this.defaultLimit,
      properties = [],
      filters = [],
      sorts = [],
      associations = [],
      archived = false
    } = options;

    let after = null;
    let hasMore = true;
    let pageCount = 0;
    let totalRecords = 0;
    const startTime = Date.now();

    return {
      async *[Symbol.asyncIterator]() {
        while (hasMore) {
          try {
            const params = this.buildQueryParams({
              limit: Math.min(limit, this.maxLimit),
              after,
              properties,
              associations,
              archived
            });

            let url = `${endpoint}?${params}`;
            
            // Add search filters if provided
            let response;
            if (filters.length > 0 || sorts.length > 0) {
              const searchPayload = {
                filterGroups: filters.length > 0 ? [{ filters }] : [],
                sorts,
                properties,
                limit: Math.min(limit, this.maxLimit)
              };
              
              if (after) searchPayload.after = after;
              
              response = await apiClient.post(`${endpoint}/search`, searchPayload);
            } else {
              response = await apiClient.get(url);
            }

            const { results, paging } = response.data;
            
            // Yield each result individually for memory efficiency
            for (const result of results) {
              yield this.normalizeResult(result);
              totalRecords++;
            }

            // Update pagination state
            pageCount++;
            hasMore = paging && paging.next && paging.next.after;
            after = hasMore ? paging.next.after : null;

            // Log progress
            const elapsed = Date.now() - startTime;
            logger.info('Pagination progress', {
              endpoint,
              pageCount,
              recordsInPage: results.length,
              totalRecords,
              hasMore,
              elapsedMs: elapsed,
              avgRecordsPerSecond: (totalRecords / (elapsed / 1000)).toFixed(2)
            });

            // Memory pressure check
            if (pageCount % 10 === 0) {
              const memory = process.memoryUsage();
              if (memory.heapUsed > 1.5 * 1024 * 1024 * 1024) { // 1.5GB threshold
                logger.warn('High memory usage during pagination', {
                  heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
                  pageCount,
                  totalRecords
                });
                
                // Force garbage collection if available
                if (global.gc) {
                  global.gc();
                }
              }
            }

          } catch (error) {
            logger.error('Pagination error', {
              endpoint,
              pageCount,
              totalRecords,
              error: error.message
            });
            throw error;
          }
        }

        // Final stats
        const totalTime = Date.now() - startTime;
        logger.info('Pagination completed', {
          endpoint,
          totalPages: pageCount,
          totalRecords,
          totalTimeMs: totalTime,
          avgRecordsPerSecond: (totalRecords / (totalTime / 1000)).toFixed(2)
        });
      }
    };
  }

  // Batch processor for large datasets
  async processBatch(apiClient, endpoint, processor, options = {}) {
    const {
      batchSize = 100,
      concurrency = 3,
      retryAttempts = 3,
      ...paginationOptions
    } = options;

    const stream = this.createPaginatedStream(apiClient, endpoint, paginationOptions);
    let batch = [];
    let processedCount = 0;
    let currentBatch = 0;

    const processBatchData = async (batchData) => {
      let attempts = 0;
      while (attempts < retryAttempts) {
        try {
          await processor(batchData);
          return;
        } catch (error) {
          attempts++;
          logger.warn('Batch processing failed, retrying', {
            batchNumber: currentBatch,
            attempt: attempts,
            error: error.message
          });
          
          if (attempts >= retryAttempts) {
            throw error;
          }
          
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempts) * 1000));
        }
      }
    };

    try {
      for await (const record of stream) {
        batch.push(record);
        
        if (batch.length >= batchSize) {
          currentBatch++;
          await processBatchData([...batch]);
          processedCount += batch.length;
          batch = [];
          
          logger.info('Batch processed', {
            batchNumber: currentBatch,
            recordsProcessed: processedCount
          });
        }
      }

      // Process remaining records
      if (batch.length > 0) {
        currentBatch++;
        await processBatchData(batch);
        processedCount += batch.length;
      }

      return { processedCount, batches: currentBatch };

    } catch (error) {
      logger.error('Batch processing failed', {
        processedCount,
        currentBatch,
        error: error.message
      });
      throw error;
    }
  }

  // Build query parameters for HubSpot API
  buildQueryParams(options) {
    const params = new URLSearchParams();
    
    if (options.limit) params.append('limit', options.limit);
    if (options.after) params.append('after', options.after);
    if (options.archived !== undefined) params.append('archived', options.archived);
    
    if (options.properties && options.properties.length > 0) {
      options.properties.forEach(prop => params.append('properties', prop));
    }
    
    if (options.associations && options.associations.length > 0) {
      options.associations.forEach(assoc => params.append('associations', assoc));
    }
    
    return params.toString();
  }

  // Normalize HubSpot result for consistent structure
  normalizeResult(result) {
    if (!result) return null;
    
    return {
      id: result.id,
      properties: result.properties || {},
      associations: result.associations || {},
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      archived: result.archived || false,
      raw: result // Keep original for debugging
    };
  }

  // Create paginated API endpoint handler
  createPaginatedEndpoint(apiClient, endpoint) {
    return async (req, res) => {
      try {
        const {
          limit = this.defaultLimit,
          after,
          properties = [],
          associations = [],
          archived = false,
          stream = false
        } = req.query;

        const paginationOptions = {
          limit: Math.min(parseInt(limit) || this.defaultLimit, this.maxLimit),
          properties: Array.isArray(properties) ? properties : [properties].filter(Boolean),
          associations: Array.isArray(associations) ? associations : [associations].filter(Boolean),
          archived: archived === 'true'
        };

        if (stream === 'true') {
          // Stream response for large datasets with proper tracking
          const streamId = `pagination_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          
          streamTracker.startStream(streamId, {
            type: 'pagination',
            endpoint,
            clientIp: req.ip || 'unknown',
            userAgent: req.get('User-Agent') || 'unknown',
            limit: paginationOptions.limit
          });

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Transfer-Encoding': 'chunked',
            'X-Pagination-Stream': 'true',
            'X-Stream-Id': streamId
          });

          res.write('{"results": [');
          let isFirst = true;
          let totalBytes = 0;
          let recordCount = 0;

          try {
            const paginatedStream = this.createPaginatedStream(apiClient, endpoint, paginationOptions);
            
            for await (const record of paginatedStream) {
              const chunk = (isFirst ? '' : ',') + JSON.stringify(record);
              res.write(chunk);
              
              totalBytes += Buffer.byteLength(chunk);
              recordCount++;
              isFirst = false;
              
              // Update stream progress periodically
              if (recordCount % 10 === 0) {
                streamTracker.updateStreamProgress(streamId, totalBytes, {
                  recordsProcessed: recordCount
                });
              }
            }

            res.write('], "stream": true}');
            res.end();
            
            // End stream tracking
            streamTracker.endStream(streamId, {
              bytesStreamed: totalBytes,
              recordsProcessed: recordCount,
              reason: 'completed'
            });
            
          } catch (error) {
            logger.error('Pagination streaming error', { streamId, error: error.message });
            streamTracker.endStream(streamId, {
              bytesStreamed: totalBytes,
              recordsProcessed: recordCount,
              reason: 'error',
              error: error.message
            });
            throw error;
          }

        } else {
          // Standard paginated response
          const params = this.buildQueryParams({ ...paginationOptions, after });
          const response = await apiClient.get(`${endpoint}?${params}`);
          
          res.json({
            success: true,
            data: response.data,
            pagination: {
              hasMore: !!(response.data.paging && response.data.paging.next),
              nextCursor: response.data.paging?.next?.after || null,
              limit: paginationOptions.limit
            }
          });
        }

      } catch (error) {
        logger.error('Paginated endpoint error', {
          endpoint,
          error: error.message
        });
        
        res.status(500).json({
          success: false,
          error: 'Pagination failed',
          message: error.message
        });
      }
    };
  }
}

module.exports = PaginationHelper;