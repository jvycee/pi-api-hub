const MemoryMonitor = require('./memory-monitor');
const RequestQueue = require('./request-queue');
const StreamingHandler = require('./streaming-handler');
const CompressionMiddleware = require('./compression');
const IntelligentCache = require('./intelligent-cache');
const RequestDeduplicationBatcher = require('./request-deduplication');
const WebhookHandler = require('./webhook-handler');
const AIFallbackHandler = require('./ai-fallback-handler');
const AnalyticsMiddleware = require('./analytics-middleware');

class CoreStack {
  constructor(config, jsonOptimizer) {
    this.memoryMonitor = new MemoryMonitor(config.performance?.memoryThresholds);
    this.requestQueue = new RequestQueue();
    this.streamingHandler = new StreamingHandler({ jsonOptimizer });
    this.compressionMiddleware = new CompressionMiddleware();
    this.intelligentCache = new IntelligentCache({
      maxSize: 25000,
      defaultTTL: 300000,
      maxMemoryMB: 200,
      compressionThreshold: 2048
    });
    this.requestDeduplicationBatcher = new RequestDeduplicationBatcher({ intelligentCache: this.intelligentCache });
    this.webhookHandler = new WebhookHandler();
    this.aiFallbackHandler = new AIFallbackHandler();
    this.analyticsMiddleware = new AnalyticsMiddleware();
  }

  getCoreMiddleware() {
    return [
      this.compressionMiddleware.middleware(),
      this.intelligentCache.middleware(),
      this.requestDeduplicationBatcher.middleware(),
      this.analyticsMiddleware.middleware()
    ];
  }

  getPerformanceMiddleware() {
    return [
      this.memoryMonitor.middleware(),
      this.requestQueue.middleware()
    ];
  }

  getAIMiddleware() {
    return this.aiFallbackHandler.middleware();
  }

  getWebhookMiddleware() {
    return this.webhookHandler.middleware();
  }

  getStreamingMiddleware() {
    return this.streamingHandler.middleware();
  }
}

module.exports = CoreStack;