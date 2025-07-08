const stream = require('stream');
const { pipeline } = require('stream/promises');
const logger = require('../shared/logger');

class StreamingHandler {
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 1024 * 1024; // 1MB chunks
    this.maxStreamSize = options.maxStreamSize || 100 * 1024 * 1024; // 100MB max
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
  createChunkedResponseHandler(res, contentType = 'application/json') {
    let totalSize = 0;
    
    res.writeHead(200, {
      'Content-Type': contentType,
      'Transfer-Encoding': 'chunked',
      'X-Streaming': 'true',
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
          
          // Check if we're exceeding max stream size
          if (totalSize > this.maxStreamSize) {
            logger.warn('Stream size limit exceeded', {
              totalSize,
              maxSize: this.maxStreamSize
            });
            res.write('{"error": "Stream size limit exceeded"}\n');
            res.end();
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
        logger.info('Stream completed', { totalSize });
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
    
    const readable = new stream.Readable({
      objectMode: true,
      async read() {
        if (!hasMore) {
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

          logger.info('Streamed HubSpot page', {
            endpoint,
            recordsInPage: results.length,
            totalRecords,
            hasMore
          });

        } catch (error) {
          logger.error('Error streaming HubSpot data:', error);
          this.emit('error', error);
        }
      }
    });

    return readable;
  }

  // Memory-efficient GraphQL response handler
  async handleGraphQLStream(response, res) {
    try {
      const jsonTransform = this.createJSONStreamTransform();
      const chunkedHandler = this.createChunkedResponseHandler(res);

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

      logger.info('GraphQL stream completed successfully');

    } catch (error) {
      logger.error('GraphQL streaming error:', error);
      
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