const express = require('express');
const router = express.Router();
const MonitoringController = require('../controllers/monitoring-controller');
const CacheController = require('../controllers/cache-controller');
const DeduplicationController = require('../controllers/deduplication-controller');
const WebhookController = require('../controllers/webhook-controller');
const AIController = require('../controllers/ai-controller');
const SecurityController = require('../controllers/security-controller');

/**
 * 🍌 BANANA-POWERED MONITORING ROUTES 🍌
 */
module.exports = (components, requireAdminAuth) => {
  const {
    performanceCollector,
    logRotator,
    predictiveHealthMonitor,
    intelligentCache,
    requestDeduplicationBatcher,
    webhookHandler,
    aiHandler,
    autoRestart,
    dependencyScanner,
    csrfProtection,
    sessionSecurity
  } = components;

  // Initialize controllers
  const monitoringController = new MonitoringController(
    performanceCollector, logRotator, predictiveHealthMonitor,
    intelligentCache, requestDeduplicationBatcher, webhookHandler,
    aiHandler, autoRestart
  );
  
  const cacheController = new CacheController(intelligentCache);
  const deduplicationController = new DeduplicationController(requestDeduplicationBatcher);
  const webhookController = new WebhookController(webhookHandler);
  const aiController = new AIController(aiHandler);
  const securityController = new SecurityController(dependencyScanner, csrfProtection, sessionSecurity);

  // Monitoring routes
  router.get('/dashboard', monitoringController.getDashboard);
  router.get('/metrics', monitoringController.getMetrics);
  router.get('/logs', monitoringController.getLogs);
  router.post('/logs/rotate', requireAdminAuth, monitoringController.rotateLogs);
  router.post('/restart', requireAdminAuth, monitoringController.restartSystem);
  router.get('/predictive-health', monitoringController.getPredictiveHealth);
  router.get('/cluster-scaling', monitoringController.getClusterScaling);
  router.get('/ollama-status', monitoringController.getOllamaStatus);

  // 🍌 MCP MONITORING ROUTES 🍌
  router.get('/mcp/status', requireAdminAuth, (req, res) => {
    const MCPClientConfig = require('../helpers/mcp-client-config');
    const clientConfig = new MCPClientConfig();
    
    clientConfig.getStatus().then(status => {
      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });
    }).catch(error => {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    });
  });

  router.get('/mcp/tools', requireAdminAuth, (req, res) => {
    const mcpConfig = require('../config/mcp-config.json');
    const tools = {
      official: mcpConfig.hubspot.official.capabilities,
      banana: mcpConfig.hubspot.banana.capabilities,
      routing: mcpConfig.routing
    };
    
    res.json({
      success: true,
      data: tools,
      timestamp: new Date().toISOString()
    });
  });

  router.post('/mcp/setup/:client', requireAdminAuth, async (req, res) => {
    const { client } = req.params;
    const MCPClientConfig = require('../helpers/mcp-client-config');
    const clientConfig = new MCPClientConfig();
    
    try {
      const config = await clientConfig.generateConfig(client, clientConfig.configs[client]);
      const mergedConfig = await clientConfig.mergeConfig(client, config);
      await clientConfig.writeConfig(client, mergedConfig);
      
      res.json({
        success: true,
        message: `MCP configuration updated for ${client}`,
        config: mergedConfig,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  router.get('/mcp/instructions', (req, res) => {
    const MCPClientConfig = require('../helpers/mcp-client-config');
    const clientConfig = new MCPClientConfig();
    const instructions = clientConfig.generateSetupInstructions();
    
    res.json({
      success: true,
      data: instructions,
      timestamp: new Date().toISOString()
    });
  });

  // Cache management routes
  router.get('/cache', cacheController.getStats);
  router.post('/cache/clear', requireAdminAuth, cacheController.clearCache);
  router.get('/cache/keys', cacheController.getKeys);
  router.get('/cache/warm', cacheController.warmCache);

  // Deduplication routes
  router.get('/deduplication', deduplicationController.getStats);
  router.post('/deduplication/flush', requireAdminAuth, deduplicationController.flushBatches);
  router.post('/deduplication/clear', requireAdminAuth, deduplicationController.clearDeduplication);
  router.get('/deduplication/batches', deduplicationController.getActiveBatches);
  router.get('/deduplication/duplicates', deduplicationController.getDuplicates);

  // Webhook routes
  router.get('/webhooks', webhookController.getStats);
  router.get('/webhooks/handlers', webhookController.getHandlers);
  router.post('/webhooks/clear', requireAdminAuth, webhookController.clearStats);
  router.get('/webhooks/config', webhookController.getConfig);

  // AI routing routes
  router.get('/ai', aiController.getStats);
  router.post('/ai/test', requireAdminAuth, aiController.testProviders);
  router.post('/ai/refresh-ollama', requireAdminAuth, aiController.refreshOllama);
  router.post('/ai/reset-credits', requireAdminAuth, aiController.resetCredits);
  router.post('/ai/clear', requireAdminAuth, aiController.clearStats);
  router.get('/ai/models', aiController.getModels);

  // Security monitoring routes
  router.get('/security', securityController.getSecurityOverview);
  router.get('/security/vulnerabilities', securityController.getDependencyVulnerabilities);
  router.post('/security/scan', requireAdminAuth, securityController.scanDependencies);
  router.get('/security/sessions', securityController.getSessionStats);
  router.get('/security/csrf', securityController.getCSRFStats);
  router.get('/security/events', securityController.getSecurityEvents);

  return router;
};