const express = require('express');
const router = express.Router();
const logger = require('../shared/logger');

/**
 * 🍌 BANANA-POWERED API KEY MANAGEMENT ROUTES 🍌
 * 
 * Provides endpoints for:
 * - Creating new API keys
 * - Managing existing keys
 * - Viewing usage statistics
 * - Monitoring rate limits
 */

module.exports = (apiKeyAuth) => {
  
  // Get all API keys (admin only)
  router.get('/keys', (req, res) => {
    try {
      // Only admin tier can view all keys
      if (req.apiKeyData?.tier !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
          timestamp: new Date().toISOString()
        });
      }
      
      const keys = apiKeyAuth.getAllKeys();
      
      res.json({
        success: true,
        data: {
          keys: keys.map(key => ({
            key: key.key,
            name: key.name,
            tier: key.tier,
            description: key.description,
            createdAt: key.createdAt,
            lastUsed: key.lastUsed,
            isActive: key.isActive,
            requests: key.requests,
            rateLimit: key.rateLimit,
            usage: {
              totalRequests: key.usage.totalRequests || 0,
              requestsThisMinute: key.usage.requestsThisMinute || 0,
              lastRequestTime: key.usage.lastRequestTime
            }
          })),
          totalKeys: keys.length,
          activeBKeys: keys.filter(k => k.isActive).length
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Failed to get API keys', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Create new API key (admin only)
  router.post('/keys', (req, res) => {
    try {
      // Only admin tier can create keys
      if (req.apiKeyData?.tier !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required to create API keys',
          timestamp: new Date().toISOString()
        });
      }
      
      const { name, tier = 'basic', description = '' } = req.body;
      
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Name is required',
          timestamp: new Date().toISOString()
        });
      }
      
      if (!['basic', 'premium', 'admin'].includes(tier)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid tier. Must be: basic, premium, or admin',
          timestamp: new Date().toISOString()
        });
      }
      
      const newApiKey = apiKeyAuth.createAPIKey(name, tier, description);
      
      res.status(201).json({
        success: true,
        data: {
          apiKey: newApiKey,
          name,
          tier,
          description,
          rateLimit: apiKeyAuth.defaultLimits[tier],
          permissions: apiKeyAuth.permissions[tier],
          createdAt: new Date().toISOString(),
          warning: '🍌 Store this API key securely! It will not be shown again.'
        },
        timestamp: new Date().toISOString()
      });
      
      logger.info('🍌 New API key created', {
        name,
        tier,
        createdBy: req.apiKeyData?.name
      });
      
    } catch (error) {
      logger.error('Failed to create API key', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to create API key',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Get current API key info
  router.get('/me', (req, res) => {
    try {
      const usage = apiKeyAuth.keyUsage.get(req.apiKey);
      
      res.json({
        success: true,
        data: {
          name: req.apiKeyData.name,
          tier: req.apiKeyData.tier,
          description: req.apiKeyData.description,
          createdAt: req.apiKeyData.createdAt,
          lastUsed: req.apiKeyData.lastUsed,
          rateLimit: req.apiKeyData.rateLimit,
          permissions: apiKeyAuth.permissions[req.apiKeyData.tier],
          usage: {
            totalRequests: usage?.totalRequests || 0,
            requestsThisMinute: usage?.requestsThisMinute || 0,
            remainingThisMinute: Math.max(0, req.apiKeyData.rateLimit - (usage?.requestsThisMinute || 0))
          },
          status: '🍌 Banana-powered and ready!'
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Failed to get API key info', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get API key info',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Get usage statistics
  router.get('/stats', (req, res) => {
    try {
      const keys = apiKeyAuth.getAllKeys();
      
      // Calculate global stats
      const totalRequests = keys.reduce((sum, key) => sum + (key.usage.totalRequests || 0), 0);
      const activeKeys = keys.filter(key => key.isActive).length;
      const keysByTier = {
        basic: keys.filter(key => key.tier === 'basic').length,
        premium: keys.filter(key => key.tier === 'premium').length,
        admin: keys.filter(key => key.tier === 'admin').length
      };
      
      // Current minute activity
      const currentMinuteRequests = keys.reduce((sum, key) => sum + (key.usage.requestsThisMinute || 0), 0);
      
      res.json({
        success: true,
        data: {
          overview: {
            totalKeys: keys.length,
            activeKeys,
            totalRequests,
            requestsThisMinute: currentMinuteRequests,
            bananaStatus: '🍌 Maximum banana power engaged!'
          },
          keysByTier,
          recentActivity: keys
            .filter(key => key.lastUsed)
            .sort((a, b) => new Date(b.lastUsed) - new Date(a.lastUsed))
            .slice(0, 10)
            .map(key => ({
              name: key.name,
              tier: key.tier,
              lastUsed: key.lastUsed,
              totalRequests: key.usage.totalRequests || 0
            }))
        },
        timestamp: new Date().toISOString()
      });
      
    } catch (error) {
      logger.error('Failed to get API stats', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to get statistics',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  // Deactivate API key (admin only)
  router.patch('/keys/:keyPrefix/deactivate', (req, res) => {
    try {
      // Only admin tier can deactivate keys
      if (req.apiKeyData?.tier !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Admin access required',
          timestamp: new Date().toISOString()
        });
      }
      
      const { keyPrefix } = req.params;
      const keys = apiKeyAuth.getAllKeys();
      const targetKey = keys.find(key => key.key === keyPrefix + '...' || key.fullKey === keyPrefix);
      
      if (!targetKey) {
        return res.status(404).json({
          success: false,
          error: 'API key not found',
          timestamp: new Date().toISOString()
        });
      }
      
      // Deactivate the key
      const keyData = apiKeyAuth.apiKeys.get(targetKey.fullKey);
      if (keyData) {
        keyData.isActive = false;
        
        res.json({
          success: true,
          message: `API key '${keyData.name}' has been deactivated`,
          data: {
            name: keyData.name,
            tier: keyData.tier,
            deactivatedAt: new Date().toISOString()
          },
          timestamp: new Date().toISOString()
        });
        
        logger.info('🍌 API key deactivated', {
          name: keyData.name,
          deactivatedBy: req.apiKeyData?.name
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'API key not found',
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      logger.error('Failed to deactivate API key', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to deactivate API key',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  return router;
};