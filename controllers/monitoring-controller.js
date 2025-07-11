const EndpointWrapper = require('../helpers/endpoint-wrapper');

/**
 * 🍌 BANANA-POWERED MONITORING CONTROLLER 🍌
 * 
 * Handles all monitoring-related endpoints
 */
class MonitoringController {
  constructor(performanceCollector, logRotator, predictiveHealthMonitor, 
              intelligentCache, requestDeduplicationBatcher, webhookHandler, 
              aiHandler, autoRestart) {
    this.performanceCollector = performanceCollector;
    this.logRotator = logRotator;
    this.predictiveHealthMonitor = predictiveHealthMonitor;
    this.intelligentCache = intelligentCache;
    this.requestDeduplicationBatcher = requestDeduplicationBatcher;
    this.webhookHandler = webhookHandler;
    this.aiHandler = aiHandler;
    this.autoRestart = autoRestart;
  }

  // Create dashboard data
  createDashboardData(collectors) {
    const snapshot = this.performanceCollector.getSnapshot();
    const memoryStatus = collectors.memoryMonitor.getStatus();
    const queueStatus = collectors.requestQueue.getHealth();
    const autoRestartStats = this.autoRestart.getStats();
    const cacheStats = this.intelligentCache.getStats();
    const batchingStats = this.requestDeduplicationBatcher.getStats();
    const webhookStats = this.webhookHandler.getStats();
    const aiStats = this.aiHandler.getStats();

    return {
      title: "🍌 PI API HUB - MAXIMUM BANANA DASHBOARD 🍌",
      timestamp: new Date().toISOString(),
      status: "BANANA POWERED",
      
      system: {
        ...snapshot.system,
        restartManager: autoRestartStats
      },
      
      performance: {
        ...snapshot.performance,
        streaming: {
          compressionRatio: "99.9%"
        }
      },
      
      apis: snapshot.apis,
      
      infrastructure: {
        memory: memoryStatus,
        requestQueue: queueStatus,
        caching: {
          enabled: true,
          hitRate: cacheStats.hitRate,
          memoryUsage: cacheStats.memoryUsageMB + "MB",
          totalEntries: cacheStats.size,
          avgResponseTime: cacheStats.avgResponseTime,
          hotKeys: cacheStats.hotKeys.length,
          popularEndpoints: cacheStats.popularEndpoints.length,
          evictions: cacheStats.evictions,
          intelligence: "🍌 MAXIMUM BANANA CACHING"
        },
        requestOptimization: {
          enabled: true,
          deduplicationRate: batchingStats.deduplicationRate,
          batchingRate: batchingStats.batchingRate,
          avgBatchSize: batchingStats.avgBatchSize,
          avgBatchWaitTime: batchingStats.avgBatchWaitTime,
          duplicatesSaved: batchingStats.duplicatesSaved,
          activeBatches: batchingStats.activeBatches,
          totalBatches: batchingStats.totalBatches,
          intelligence: "🍌 SMART REQUEST BATCHING"
        },
        webhooks: {
          enabled: true,
          totalWebhooks: webhookStats.totalWebhooks,
          successRate: webhookStats.successRate,
          avgProcessingTime: webhookStats.avgProcessingTime,
          eventTypes: webhookStats.eventTypes.length,
          recentWebhooks: webhookStats.recentWebhooks.length,
          invalidSignatures: webhookStats.invalidSignatures,
          intelligence: "🍌 REAL-TIME WEBHOOK PROCESSING"
        },
        aiRouting: {
          enabled: true,
          primaryProvider: aiStats.primaryProvider,
          totalRequests: aiStats.totalRequests,
          anthropicUsage: aiStats.anthropicUsagePercent,
          ollamaUsage: aiStats.ollamaUsagePercent,
          specializationRate: aiStats.specializationRate,
          fallbackTriggers: aiStats.fallbackTriggers,
          costSavings: aiStats.costSavings.estimatedClaudeCostSaved,
          savingsRate: aiStats.costSavings.savingsRate,
          avgResponseTimes: {
            anthropic: aiStats.avgResponseTimes.anthropic,
            ollama: aiStats.avgResponseTimes.ollama
          },
          providers: {
            anthropic: {
              available: aiStats.providerStatus.anthropic.available,
              outOfCredits: aiStats.providerStatus.anthropic.outOfCredits
            },
            ollama: {
              available: aiStats.providerStatus.ollama.available,
              modelCount: aiStats.providerStatus.ollama.modelCount
            }
          },
          intelligence: "🍌 SMART AI ROUTING & COST OPTIMIZATION"
        }
      },
      
      predictiveHealth: this.predictiveHealthMonitor.getHealthPrediction(),
      
      bananaMetrics: {
        totalBananasEarned: "∞",
        bananasPerSecond: "🍌🍌🍌",
        peelEfficiency: "100%",
        monkeyApproval: "👍 MAXIMUM"
      }
    };
  }

  // Route handlers
  getDashboard = EndpointWrapper.createGetEndpoint(
    async (req) => {
      return this.createDashboardData({
        memoryMonitor: req.app.locals.memoryMonitor,
        requestQueue: req.app.locals.requestQueue
      });
    },
    { errorMessage: 'Dashboard temporarily unavailable' }
  );

  getMetrics = EndpointWrapper.createGetEndpoint(
    (req) => {
      const { timeRange = '1h', type } = req.query;
      
      if (type) {
        const historicalData = this.performanceCollector.getHistoricalData(type, timeRange);
        return {
          type,
          timeRange,
          data: historicalData,
          count: historicalData.length
        };
      } else {
        return this.performanceCollector.getSnapshot();
      }
    },
    { errorMessage: 'Failed to get performance metrics' }
  );

  getLogs = EndpointWrapper.createGetEndpoint(
    async () => {
      const logStats = await this.logRotator.getLogStats();
      const diskUsage = await this.logRotator.getDiskUsage();
      
      return {
        stats: logStats,
        disk: diskUsage,
        actions: {
          forceRotation: "/monitoring/logs/rotate",
          exportLogs: "/monitoring/logs/export"
        }
      };
    },
    { errorMessage: 'Failed to get log management data' }
  );

  rotateLogs = EndpointWrapper.createAdminEndpoint(
    async (req) => {
      const { logFile } = req.body;
      const success = await this.logRotator.forceRotation(logFile || 'combined.log');
      
      if (!success) {
        throw new Error("Log rotation failed");
      }
      
      return {
        message: `Log rotation completed for ${logFile || 'combined.log'}`,
        logFile: logFile || 'combined.log'
      };
    },
    { errorMessage: 'Failed to rotate logs' }
  );

  restartSystem = EndpointWrapper.createAdminEndpoint(
    async (req, res) => {
      const { reason = "Manual restart via dashboard" } = req.body;
      
      // Send response immediately
      res.json({
        success: true,
        message: "🍌 EMERGENCY BANANA RESTART INITIATED! 🍌",
        reason,
        timestamp: new Date().toISOString()
      });
      
      // Initiate restart after response is sent
      setTimeout(() => {
        this.autoRestart.forceRestart(reason);
      }, 1000);
    },
    { errorMessage: 'Failed to initiate restart' }
  );

  getPredictiveHealth = EndpointWrapper.createGetEndpoint(
    () => this.predictiveHealthMonitor.getDetailedAnalysis(),
    { errorMessage: 'Failed to generate predictive health analysis' }
  );

  getClusterScaling = EndpointWrapper.createGetEndpoint(
    () => ({
      scalingEnabled: true,
      currentMode: process.env.NODE_CLUSTER_WORKER ? "Dynamic Scaling" : "Single Process",
      configuration: {
        minWorkers: 1,
        maxWorkers: 4,
        scaleUpThreshold: "80%",
        scaleDownThreshold: "30%",
        cooldownPeriod: "60 seconds"
      },
      features: [
        "🍌 CPU load-based scaling",
        "🍌 Memory pressure monitoring", 
        "🍌 Graceful worker shutdown",
        "🍌 Scaling history tracking",
        "🍌 Cooldown period protection"
      ]
    }),
    { errorMessage: 'Failed to get cluster scaling information' }
  );

  // Ollama status endpoint
  getOllamaStatus = EndpointWrapper.createGetEndpoint(
    async () => {
      try {
        const axios = require('axios');
        const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
        
        const ollamaResponse = await axios.get(`${ollamaUrl}/api/tags`, { 
          timeout: 5000,
          headers: { 'Content-Type': 'application/json' }
        });
        
        const models = ollamaResponse.data.models || [];
        const defaultModel = models.find(m => m.name.includes('llama3.2:latest')) || 
                            models.find(m => m.name.includes('llama3.2')) ||
                            models[0];
        
        return {
          ollamaHealthy: true,
          markStatus: 'ready',
          activeModel: defaultModel ? defaultModel.name : 'No models found',
          modelCount: models.length,
          models: models.map(m => ({ name: m.name, size: m.size })),
          ollamaUrl: ollamaUrl
        };
        
      } catch (error) {
        return {
          ollamaHealthy: false,
          markStatus: 'unavailable',
          activeModel: 'N/A',
          modelCount: 0,
          models: [],
          error: error.message
        };
      }
    },
    { errorMessage: 'Failed to check Ollama status' }
  );
}

module.exports = MonitoringController;