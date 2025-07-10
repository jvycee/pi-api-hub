const logger = require('../shared/logger');
const streamTracker = require('../shared/stream-tracker');

class CursorPagination {
  constructor(options = {}) {
    this.defaultPageSize = options.defaultPageSize || 100;
    this.maxPageSize = options.maxPageSize || 1000;
    this.cursors = new Map(); // In-memory cursor cache
    this.cursorTTL = options.cursorTTL || 3600000; // 1 hour default TTL
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes cleanup
    
    // Start cursor cleanup
    this.startCursorCleanup();
  }

  // Create a cursor-based pagination handler
  createCursorHandler(authHandler, objectType, options = {}) {
    const {
      sortField = 'createdAt',
      sortDirection = 'desc',
      idField = 'id',
      timestampField = 'createdAt',
      filters = [],
      properties = []
    } = options;

    return async (req, res) => {
      try {
        const {
          pageSize = this.defaultPageSize,
          cursor,
          direction = 'forward'
        } = req.query;

        const validatedPageSize = Math.min(
          Math.max(1, parseInt(pageSize) || this.defaultPageSize),
          this.maxPageSize
        );

        let query = this.buildSimpleCursorQuery({
          cursor,
          direction,
          sortField,
          sortDirection,
          filters,
          properties,
          pageSize: validatedPageSize
        });

        // Debug logging
        logger.info('🍌 Cursor pagination query', {
          objectType,
          query: JSON.stringify(query, null, 2),
          cursor,
          pageSize: validatedPageSize
        });

        // Execute query
        const response = await this.executeCursorQuery(authHandler.searchHubSpot.bind(authHandler), objectType, query);
        const results = response.data.results || [];

        // Generate cursors for navigation
        const cursors = this.generateSimpleCursors(response.data, results, {
          sortField,
          idField,
          timestampField
        });

        // Cache cursors for future use
        const sessionId = this.generateSessionId(req);
        this.cacheCursors(sessionId, cursors);

        // Build response
        const paginationResponse = {
          success: true,
          data: results,
          pagination: {
            pageSize: validatedPageSize,
            hasNext: cursors.next !== null,
            hasPrevious: cursors.previous !== null,
            nextCursor: cursors.next,
            previousCursor: cursors.previous,
            totalResults: results.length,
            cursors: {
              first: cursors.first,
              last: cursors.last
            }
          },
          metadata: {
            sortField,
            sortDirection,
            endpoint,
            timestamp: new Date().toISOString()
          }
        };

        // Log pagination metrics
        logger.info('🍌 Cursor pagination executed', {
          objectType,
          pageSize: validatedPageSize,
          direction,
          resultsCount: results.length,
          hasNext: cursors.next !== null,
          hasPrevious: cursors.previous !== null,
          sessionId: sessionId.substring(0, 8)
        });

        res.json(paginationResponse);

      } catch (error) {
        logger.error('Cursor pagination error', {
          objectType,
          error: error.message,
          stack: error.stack
        });

        res.status(500).json({
          success: false,
          error: 'Cursor pagination failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  // Create streaming cursor pagination
  createStreamingCursorHandler(authHandler, objectType, options = {}) {
    const {
      sortField = 'createdAt',
      sortDirection = 'desc',
      idField = 'id',
      timestampField = 'createdAt',
      filters = [],
      properties = [],
      batchSize = 100
    } = options;

    return async (req, res) => {
      const streamId = `cursor_stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let totalRecords = 0;
      let totalBytes = 0;
      let batchCount = 0;

      try {
        const {
          startCursor,
          endCursor,
          maxRecords = 10000
        } = req.query;

        // Start stream tracking
        streamTracker.startStream(streamId, {
          type: 'cursor_streaming',
          objectType,
          clientIp: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          batchSize,
          maxRecords
        });

        // Setup streaming response
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Transfer-Encoding': 'chunked',
          'X-Streaming': 'cursor-pagination',
          'X-Stream-Id': streamId
        });

        res.write('{"stream": true, "results": [');

        let currentCursor = startCursor;
        let isFirst = true;

        while (currentCursor !== endCursor && totalRecords < maxRecords) {
          // Build query for current batch
          const query = this.buildCursorQuery({
            cursor: currentCursor,
            direction: 'forward',
            sortField,
            sortDirection,
            idField,
            timestampField,
            filters,
            properties,
            pageSize: batchSize
          });

          // Execute batch query
          const response = await this.executeCursorQuery(authHandler.searchHubSpot.bind(authHandler), objectType, query);
          const results = response.data.results || [];

          if (results.length === 0) {
            break; // No more results
          }

          // Stream results
          for (const result of results) {
            const chunk = (isFirst ? '' : ',') + JSON.stringify(result);
            res.write(chunk);
            
            totalBytes += Buffer.byteLength(chunk);
            totalRecords++;
            isFirst = false;

            // Update stream progress
            if (totalRecords % 50 === 0) {
              streamTracker.updateStreamProgress(streamId, totalBytes, {
                recordsProcessed: totalRecords,
                batchesProcessed: batchCount
              });
            }
          }

          // Update cursor for next batch
          const cursors = this.generateCursors(results, {
            sortField,
            idField,
            timestampField
          });
          
          currentCursor = cursors.next;
          batchCount++;

          // Stop if no more results
          if (!currentCursor) {
            break;
          }

          // Memory pressure check
          if (batchCount % 10 === 0) {
            const memory = process.memoryUsage();
            if (memory.heapUsed > 1.5 * 1024 * 1024 * 1024) { // 1.5GB
              logger.warn('High memory usage during cursor streaming', {
                streamId,
                heapUsed: (memory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
                batchCount,
                totalRecords
              });
            }
          }
        }

        // Complete stream
        res.write(`], "metadata": {"totalRecords": ${totalRecords}, "batchesProcessed": ${batchCount}, "completed": true}}`);
        res.end();

        // End stream tracking
        streamTracker.endStream(streamId, {
          bytesStreamed: totalBytes,
          recordsProcessed: totalRecords,
          batchesProcessed: batchCount,
          reason: 'completed'
        });

        logger.info('🍌 Cursor streaming completed', {
          streamId,
          totalRecords,
          batchCount,
          totalBytes,
          duration: Date.now() - parseInt(streamId.split('_')[2])
        });

      } catch (error) {
        logger.error('Cursor streaming error', {
          streamId,
          error: error.message,
          totalRecords,
          batchCount
        });

        // End stream tracking with error
        streamTracker.endStream(streamId, {
          bytesStreamed: totalBytes,
          recordsProcessed: totalRecords,
          batchesProcessed: batchCount,
          reason: 'error',
          error: error.message
        });

        // Send error response if headers not sent
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Cursor streaming failed',
            message: error.message,
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }

  // Build simple cursor query using standard HubSpot pagination
  buildSimpleCursorQuery(params) {
    const {
      cursor,
      sortField,
      sortDirection,
      filters,
      properties,
      pageSize
    } = params;

    let query = {
      limit: pageSize,
      properties: properties,
      sorts: [{
        propertyName: sortField,
        direction: sortDirection.toUpperCase()
      }]
    };

    // Use cursor as the 'after' parameter for standard pagination
    if (cursor) {
      const cursorData = this.decodeCursor(cursor);
      if (cursorData && cursorData.after) {
        query.after = cursorData.after;
      }
    }

    // Add filters if provided
    if (filters.length > 0) {
      query.filterGroups = [{ filters }];
    }

    return query;
  }

  // Build cursor query based on parameters (complex version for advanced use)
  buildCursorQuery(params) {
    const {
      cursor,
      direction,
      sortField,
      sortDirection,
      idField,
      timestampField,
      filters,
      properties,
      pageSize
    } = params;

    let query = {
      limit: pageSize,
      properties: properties,
      sorts: [{
        propertyName: sortField,
        direction: sortDirection.toUpperCase()
      }]
    };

    // Add cursor-based filtering
    if (cursor) {
      const cursorData = this.decodeCursor(cursor);
      if (cursorData) {
        const cursorFilter = this.buildCursorFilter(
          cursorData,
          sortField,
          sortDirection,
          direction,
          idField,
          timestampField
        );
        
        if (cursorFilter) {
          query.filterGroups = [{ filters: [...filters, cursorFilter] }];
        }
      }
    } else if (filters.length > 0) {
      query.filterGroups = [{ filters }];
    }

    return query;
  }

  // Build cursor filter for pagination
  buildCursorFilter(cursorData, sortField, sortDirection, direction, idField, timestampField) {
    const { value, id, timestamp } = cursorData;
    
    // Determine comparison operator based on sort direction and pagination direction
    let operator;
    if (direction === 'forward') {
      operator = sortDirection === 'asc' ? 'GT' : 'LT';
    } else {
      operator = sortDirection === 'asc' ? 'LT' : 'GT';
    }

    // Primary filter on sort field
    let filter = {
      propertyName: sortField,
      operator: operator,
      value: value
    };

    // For timestamp-based pagination, add additional precision with ID
    if (sortField === timestampField && id) {
      // If timestamps are equal, use ID for consistent ordering
      filter = {
        operator: 'OR',
        filters: [
          {
            propertyName: sortField,
            operator: operator,
            value: value
          },
          {
            operator: 'AND',
            filters: [
              {
                propertyName: sortField,
                operator: 'EQ',
                value: value
              },
              {
                propertyName: idField,
                operator: operator,
                value: id
              }
            ]
          }
        ]
      };
    }

    return filter;
  }

  // Execute cursor query
  async executeCursorQuery(searchMethod, objectType, query) {
    // Use the searchHubSpot method from AuthHandler
    const results = await searchMethod(objectType, query);
    // AuthHandler's searchHubSpot returns the response data directly
    return { data: results };
  }

  // Generate simple cursors using HubSpot's standard pagination
  generateSimpleCursors(responseData, results, options) {
    const { sortField, idField, timestampField } = options;
    
    if (!results || results.length === 0) {
      return {
        next: null,
        previous: null,
        first: null,
        last: null
      };
    }

    const firstResult = results[0];
    const lastResult = results[results.length - 1];

    // Use HubSpot's paging.next.after for the next cursor
    const nextAfter = responseData.paging?.next?.after;
    
    return {
      next: nextAfter ? this.encodeSimpleCursor(nextAfter, lastResult, sortField, idField, timestampField) : null,
      previous: null, // Previous would require complex implementation
      first: this.encodeSimpleCursor(null, firstResult, sortField, idField, timestampField),
      last: this.encodeSimpleCursor(nextAfter, lastResult, sortField, idField, timestampField)
    };
  }

  // Generate cursors for navigation (complex version)
  generateCursors(results, options) {
    const { sortField, idField, timestampField } = options;
    
    if (!results || results.length === 0) {
      return {
        next: null,
        previous: null,
        first: null,
        last: null
      };
    }

    const firstResult = results[0];
    const lastResult = results[results.length - 1];

    return {
      next: this.encodeCursor(lastResult, sortField, idField, timestampField),
      previous: this.encodeCursor(firstResult, sortField, idField, timestampField),
      first: this.encodeCursor(firstResult, sortField, idField, timestampField),
      last: this.encodeCursor(lastResult, sortField, idField, timestampField)
    };
  }

  // Encode simple cursor data using HubSpot's after parameter
  encodeSimpleCursor(after, result, sortField, idField, timestampField) {
    if (!result) return null;

    const cursorData = {
      after: after,
      value: result.properties?.[sortField] || result[sortField],
      id: result.id || result[idField],
      timestamp: result.properties?.[timestampField] || result[timestampField]
    };

    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  // Encode cursor data (complex version)
  encodeCursor(result, sortField, idField, timestampField) {
    if (!result) return null;

    const cursorData = {
      value: result.properties?.[sortField] || result[sortField],
      id: result.id || result[idField],
      timestamp: result.properties?.[timestampField] || result[timestampField]
    };

    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  // Decode cursor data
  decodeCursor(cursor) {
    if (!cursor) return null;

    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (error) {
      logger.warn('Invalid cursor format', { cursor, error: error.message });
      return null;
    }
  }

  // Generate session ID for cursor caching
  generateSessionId(req) {
    const userAgent = req.get('User-Agent') || '';
    const ip = req.ip || '';
    const timestamp = Date.now();
    
    return Buffer.from(`${ip}_${userAgent}_${timestamp}`).toString('base64');
  }

  // Cache cursors for session
  cacheCursors(sessionId, cursors) {
    this.cursors.set(sessionId, {
      cursors,
      timestamp: Date.now()
    });
  }

  // Get cached cursors
  getCachedCursors(sessionId) {
    const cached = this.cursors.get(sessionId);
    if (!cached) return null;
    
    // Check TTL
    if (Date.now() - cached.timestamp > this.cursorTTL) {
      this.cursors.delete(sessionId);
      return null;
    }
    
    return cached.cursors;
  }

  // Start cursor cleanup process
  startCursorCleanup() {
    setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [sessionId, data] of this.cursors.entries()) {
        if (now - data.timestamp > this.cursorTTL) {
          this.cursors.delete(sessionId);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.debug('🍌 Cursor cleanup completed', {
          cleaned,
          remaining: this.cursors.size
        });
      }
    }, this.cleanupInterval);
    
    logger.info('🍌 Cursor pagination cleanup started', {
      ttl: this.cursorTTL,
      cleanupInterval: this.cleanupInterval
    });
  }

  // Get cursor statistics
  getStats() {
    return {
      activeCursors: this.cursors.size,
      defaultPageSize: this.defaultPageSize,
      maxPageSize: this.maxPageSize,
      cursorTTL: this.cursorTTL,
      memoryUsage: this.cursors.size * 1024 // Rough estimate
    };
  }

  // Test cursor pagination performance
  async testCursorPerformance(apiClient, endpoint, options = {}) {
    const {
      testPages = 10,
      pageSize = 100,
      sortField = 'createdAt'
    } = options;

    const results = {
      pages: [],
      totalTime: 0,
      totalRecords: 0,
      avgPageTime: 0,
      cursorsGenerated: 0
    };

    const startTime = Date.now();
    let currentCursor = null;

    for (let page = 0; page < testPages; page++) {
      const pageStart = Date.now();
      
      try {
        const query = this.buildCursorQuery({
          cursor: currentCursor,
          direction: 'forward',
          sortField,
          sortDirection: 'desc',
          idField: 'id',
          timestampField: 'createdAt',
          filters: [],
          properties: [],
          pageSize
        });

        const response = await this.executeCursorQuery(apiClient, endpoint, query);
        const pageResults = response.data.results || [];
        
        if (pageResults.length === 0) {
          break; // No more results
        }

        const cursors = this.generateCursors(pageResults, {
          sortField,
          idField: 'id',
          timestampField: 'createdAt'
        });

        const pageTime = Date.now() - pageStart;
        
        results.pages.push({
          page: page + 1,
          records: pageResults.length,
          timeMs: pageTime,
          cursor: currentCursor,
          nextCursor: cursors.next
        });

        results.totalRecords += pageResults.length;
        results.cursorsGenerated++;
        currentCursor = cursors.next;

      } catch (error) {
        logger.error('Cursor performance test error', {
          page: page + 1,
          error: error.message
        });
        break;
      }
    }

    results.totalTime = Date.now() - startTime;
    results.avgPageTime = results.totalTime / results.pages.length;

    logger.info('🍌 Cursor pagination performance test completed', results);
    return results;
  }
}

module.exports = CursorPagination;