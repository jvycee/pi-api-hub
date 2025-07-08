const stream = require('stream');
const { pipeline } = require('stream/promises');
const logger = require('../shared/logger');
const streamTracker = require('../shared/stream-tracker');

class StreamingHandler {
  constructor(options = {}) {
    this.baseChunkSize = options.baseChunkSize || 1024 * 1024; // 1MB base chunks
    this.maxStreamSize = options.maxStreamSize || 100 * 1024 * 1024; // 100MB max
    this.jsonOptimizer = options.jsonOptimizer || null; // Will be injected
  }
  
  // Calculate adaptive chunk size based on memory pressure
  getAdaptiveChunkSize() {
    if (this.jsonOptimizer) {
      return this.jsonOptimizer.calculateAdaptiveChunkSize();
    }
    
    // Fallback calculation if no optimizer available
    const memoryUsage = process.memoryUsage();
    const memoryPressure = memoryUsage.heapUsed / memoryUsage.heapTotal;
    
    if (memoryPressure > 0.85) return 64 * 1024; // 64KB
    if (memoryPressure > 0.7) return 512 * 1024; // 512KB
    if (memoryPressure < 0.5) return 2 * 1024 * 1024; // 2MB
    return this.baseChunkSize;
  }

  // Transform stream to handle large JSON responses
  createJSONStreamTransform() {
    let buffer = '';
    let objectDepth = 0;
    let inString = false;
    let escapeNext = false;
    let currentObject = '';
    let objectCount = 0;

    return new stream.Transform({
      objectMode: true,
      transform: function(chunk, encoding, callback) {
        buffer += chunk.toString();
        
        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          
          if (escapeNext) {
            escapeNext = false;
            currentObject += char;
            continue;
          }
          
          if (char === '\\' && inString) {
            escapeNext = true;
            currentObject += char;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            currentObject += char;
            continue;
          }
          
          if (!inString) {
            if (char === '{') {
              objectDepth++;
              currentObject += char;
            } else if (char === '}') {
              objectDepth--;
              currentObject += char;
              
              // Complete object found
              if (objectDepth === 0 && currentObject.trim()) {
                try {
                  const parsedObject = JSON.parse(currentObject);
                  this.push(parsedObject);
                  objectCount++;
                  currentObject = '';
                } catch (error) {
                  logger.error('JSON parsing error in stream:', error);
                }
              }
            } else {
              currentObject += char;
            }
          } else {
            currentObject += char;
          }
        }
        
        buffer = '';
        callback();
      },
      
      flush: function(callback) {
        if (currentObject.trim()) {
          try {
            const parsedObject = JSON.parse(currentObject);
            this.push(parsedObject);
          } catch (error) {
            logger.error('JSON parsing error in stream flush:', error);
          }
        }
        callback();
      }
    });
  }

  // Create a chunked response handler
  createChunkedResponseHandler(res, contentType = 'application/json', metadata = {}) {
    let totalSize = 0;
    const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Start tracking this stream
    streamTracker.startStream(streamId, {
      type: 'chunked',
      contentType,
      clientIp: res.req?.ip || 'unknown',
      userAgent: res.req?.get('User-Agent') || 'unknown',
      ...metadata
    });
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Transfer-Encoding': 'chunked',
      'X-Streaming': 'true',
      'X-Stream-Id': streamId,
      'Cache-Control': 'no-cache'
    });

    return new stream.Writable({
      objectMode: true,
      write: function(chunk, encoding, callback) {
        try {
          let data;
          
          if (typeof chunk === 'object') {
            data = JSON.stringify(chunk) + '\n';
          } else {
            data = chunk.toString() + '\n';
          }
          
          totalSize += Buffer.byteLength(data);
          
          // Update stream progress
          streamTracker.updateStreamProgress(streamId, totalSize);
          
          // Check if we're exceeding max stream size
          if (totalSize > this.maxStreamSize) {
            logger.warn('Stream size limit exceeded', {
              streamId,
              totalSize,
              maxSize: this.maxStreamSize
            });
            res.write('{"error": "Stream size limit exceeded"}\n');
            res.end();
            streamTracker.endStream(streamId, { 
              bytesStreamed: totalSize, 
              reason: 'size_limit_exceeded' 
            });
            return callback();
          }
          
          res.write(data);
          callback();
        } catch (error) {
          logger.error('Error writing to stream:', error);
          callback(error);
        }
      }.bind(this),
      
      final: function(callback) {
        res.end();
        streamTracker.endStream(streamId, { 
          bytesStreamed: totalSize, 
          reason: 'completed' 
        });
        logger.info('Stream completed', { streamId, totalSize });
        callback();
      }
    });
  }

  // Paginated HubSpot data streamer
  async streamHubSpotData(hubspotClient, endpoint, options = {}) {
    const {
      limit = 100,
      properties = [],
      transform = null
    } = options;

    let after = null;
    let hasMore = true;
    let totalRecords = 0;
    
    const streamId = `hubspot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    streamTracker.startStream(streamId, {
      type: 'hubspot',
      endpoint,
      limit,
      properties: properties.length
    });
    
    const readable = new stream.Readable({
      objectMode: true,
      async read() {
        if (!hasMore) {
          streamTracker.endStream(streamId, { 
            bytesStreamed: totalRecords * 1024, // Approximate bytes
            recordsProcessed: totalRecords,
            reason: 'completed'
          });
          this.push(null);
          return;
        }

        try {
          let url = `${endpoint}?limit=${limit}`;
          if (properties.length > 0) {
            url += `&properties=${properties.join(',')}`;
          }
          if (after) {
            url += `&after=${after}`;
          }

          const response = await hubspotClient.get(url);
          const { results, paging } = response.data;

          // Transform and push each result
          for (const result of results) {
            const transformedResult = transform ? transform(result) : result;
            this.push(transformedResult);
            totalRecords++;
          }

          // Check for more pages
          if (paging && paging.next && paging.next.after) {
            after = paging.next.after;
            hasMore = true;
          } else {
            hasMore = false;
          }

          // Update stream progress
          streamTracker.updateStreamProgress(streamId, totalRecords * 1024, {
            recordsProcessed: totalRecords,
            pagesProcessed: after ? 'multiple' : 'first'
          });

          logger.info('Streamed HubSpot page', {
            streamId,
            endpoint,
            recordsInPage: results.length,
            totalRecords,
            hasMore
          });

        } catch (error) {
          logger.error('Error streaming HubSpot data:', error);
          streamTracker.endStream(streamId, { 
            bytesStreamed: totalRecords * 1024,
            recordsProcessed: totalRecords,
            reason: 'error',
            error: error.message
          });
          this.emit('error', error);
        }
      }
    });

    return readable;
  }

  // Memory-efficient GraphQL response handler
  async handleGraphQLStream(response, res) {
    const streamId = `graphql_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      streamTracker.startStream(streamId, {
        type: 'graphql',
        endpoint: '/api/hubspot/graphql',
        clientIp: res.req?.ip || 'unknown'
      });
      
      const jsonTransform = this.createJSONStreamTransform();
      const chunkedHandler = this.createChunkedResponseHandler(res, 'application/json', {
        endpoint: '/api/hubspot/graphql'
      });

      // Start streaming response
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Transfer-Encoding': 'chunked',
        'X-GraphQL-Stream': 'true'
      });

      let isFirstChunk = true;
      res.write('{"data": [');

      const writeTransform = new stream.Transform({
        objectMode: true,
        transform: function(chunk, encoding, callback) {
          if (!isFirstChunk) {
            this.push(',');
          }
          this.push(JSON.stringify(chunk));
          isFirstChunk = false;
          callback();
        },
        flush: function(callback) {
          this.push(']}');
          callback();
        }
      });

      await pipeline(
        response.data,
        jsonTransform,
        writeTransform,
        chunkedHandler
      );

      logger.info('GraphQL stream completed successfully', { streamId });

    } catch (error) {
      logger.error('GraphQL streaming error:', error);
      
      streamTracker.endStream(streamId, { 
        reason: 'error',
        error: error.message
      });
      
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'GraphQL streaming failed',
          message: error.message
        });
      }
    }
  }

  // Memory usage monitor for streams
  monitorStreamMemory(streamName) {
    const startMemory = process.memoryUsage();
    
    return {
      check: () => {
        const currentMemory = process.memoryUsage();
        const memoryDelta = currentMemory.heapUsed - startMemory.heapUsed;
        
        if (memoryDelta > 200 * 1024 * 1024) { // 200MB threshold
          logger.warn('High memory usage in stream', {
            streamName,
            memoryDelta: (memoryDelta / 1024 / 1024).toFixed(2) + ' MB',
            currentHeap: (currentMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB'
          });
        }
        
        return memoryDelta;
      },
      
      end: () => {
        const endMemory = process.memoryUsage();
        const totalDelta = endMemory.heapUsed - startMemory.heapUsed;
        
        logger.info('Stream memory usage', {
          streamName,
          memoryUsed: (totalDelta / 1024 / 1024).toFixed(2) + ' MB',
          finalHeap: (endMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB'
        });
      }
    };
  }
}

module.exports = StreamingHandler;