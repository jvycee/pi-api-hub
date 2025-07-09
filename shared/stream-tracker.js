const EventEmitter = require('events');
const logger = require('./logger');

class StreamTracker extends EventEmitter {
  constructor() {
    super();
    this.activeStreams = new Map();
    this.totalStreams = 0;
    this.totalBytesStreamed = 0;
    this.peakConcurrentStreams = 0;
    
    // Mutex for thread-safe operations
    this._operationQueue = [];
    this._processing = false;
  }

  // Thread-safe operation wrapper
  async _atomicOperation(operation) {
    return new Promise((resolve, reject) => {
      this._operationQueue.push({ operation, resolve, reject });
      this._processQueue();
    });
  }

  _processQueue() {
    if (this._processing || this._operationQueue.length === 0) {
      return;
    }

    this._processing = true;
    const { operation, resolve, reject } = this._operationQueue.shift();

    try {
      const result = operation();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this._processing = false;
      // Process next operation in queue
      setImmediate(() => this._processQueue());
    }
  }

  // Start tracking a new stream (thread-safe)
  async startStream(streamId, metadata = {}) {
    return this._atomicOperation(() => {
      const streamInfo = {
        id: streamId,
        startTime: Date.now(),
        bytesStreamed: 0,
        type: metadata.type || 'unknown',
        endpoint: metadata.endpoint || 'unknown',
        clientIp: metadata.clientIp || 'unknown',
        ...metadata
      };

      this.activeStreams.set(streamId, streamInfo);
      this.totalStreams++;
      
      // Update peak concurrent streams
      const currentActive = this.activeStreams.size;
      if (currentActive > this.peakConcurrentStreams) {
        this.peakConcurrentStreams = currentActive;
      }

      logger.info('🍌 Stream started', {
        streamId,
        activeStreams: currentActive,
        totalStreams: this.totalStreams,
        type: streamInfo.type,
        endpoint: streamInfo.endpoint
      });

      this.emit('streamStarted', streamInfo);
      return streamInfo;
    });
  }

  // Update stream progress (thread-safe)
  async updateStreamProgress(streamId, bytesStreamed, metadata = {}) {
    return this._atomicOperation(() => {
      const streamInfo = this.activeStreams.get(streamId);
      if (streamInfo) {
        streamInfo.bytesStreamed = bytesStreamed;
        streamInfo.lastUpdate = Date.now();
        
        // Update any additional metadata
        Object.assign(streamInfo, metadata);
        
        this.emit('streamProgress', streamInfo);
        return streamInfo;
      }
      return null;
    });
  }

  // End stream tracking (thread-safe)
  async endStream(streamId, finalStats = {}) {
    return this._atomicOperation(() => {
      const streamInfo = this.activeStreams.get(streamId);
      if (streamInfo) {
        const endTime = Date.now();
        const duration = endTime - streamInfo.startTime;
        const finalBytes = finalStats.bytesStreamed || streamInfo.bytesStreamed;
        
        // Add to total bytes streamed
        this.totalBytesStreamed += finalBytes;
        
        const finalStreamInfo = {
          ...streamInfo,
          endTime,
          duration,
          bytesStreamed: finalBytes,
          ...finalStats
        };

        this.activeStreams.delete(streamId);

        logger.info('🍌 Stream completed', {
          streamId,
          duration: `${duration}ms`,
          bytesStreamed: this.formatBytes(finalBytes),
          activeStreams: this.activeStreams.size,
          totalBytesStreamed: this.formatBytes(this.totalBytesStreamed)
        });

        this.emit('streamEnded', finalStreamInfo);
        return finalStreamInfo;
      }
      return null;
    });
  }

  // Get current stream statistics
  getStats() {
    const now = Date.now();
    const activeStreamList = Array.from(this.activeStreams.values());
    
    return {
      activeStreams: this.activeStreams.size,
      totalStreams: this.totalStreams,
      totalBytesStreamed: this.totalBytesStreamed,
      formattedTotalBytes: this.formatBytes(this.totalBytesStreamed),
      peakConcurrentStreams: this.peakConcurrentStreams,
      streamDetails: activeStreamList.map(stream => ({
        id: stream.id,
        type: stream.type,
        endpoint: stream.endpoint,
        duration: now - stream.startTime,
        bytesStreamed: stream.bytesStreamed,
        formattedBytes: this.formatBytes(stream.bytesStreamed)
      })),
      averageStreamDuration: this.calculateAverageStreamDuration()
    };
  }

  // Calculate average stream duration from completed streams
  calculateAverageStreamDuration() {
    // This is a simplified calculation - in a real implementation
    // you might want to keep a rolling window of completed streams
    return this.totalStreams > 0 ? 'Banana Fast™' : 0;
  }

  // Format bytes into human-readable format
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    if (bytes >= 1024 * 1024 * 1024 * 1024) return '∞ TB'; // Because Pi power!
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Clean up stale streams (streams that have been active for too long)
  cleanupStaleStreams(maxAge = 30 * 60 * 1000) { // 30 minutes default
    const now = Date.now();
    const staleStreams = [];
    
    for (const [streamId, streamInfo] of this.activeStreams) {
      if (now - streamInfo.startTime > maxAge) {
        staleStreams.push(streamId);
      }
    }
    
    staleStreams.forEach(streamId => {
      logger.warn('🍌 Cleaning up stale stream', { streamId });
      this.endStream(streamId, { reason: 'cleanup', stale: true });
    });
    
    return staleStreams.length;
  }

  // Get streams by type
  getStreamsByType(type) {
    return Array.from(this.activeStreams.values()).filter(stream => stream.type === type);
  }

  // Get streams by endpoint
  getStreamsByEndpoint(endpoint) {
    return Array.from(this.activeStreams.values()).filter(stream => stream.endpoint === endpoint);
  }
}

// Create singleton instance
const streamTracker = new StreamTracker();

// Auto-cleanup stale streams every 5 minutes
setInterval(() => {
  streamTracker.cleanupStaleStreams();
}, 5 * 60 * 1000);

module.exports = streamTracker;