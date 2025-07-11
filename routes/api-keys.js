const express = require('express');
const router = express.Router();
const logger = require('../shared/logger');
const EndpointWrapper = require('../helpers/endpoint-wrapper');

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
  router.get('/keys', EndpointWrapper.createAdminEndpoint(
    (req) => {
      const keys = apiKeyAuth.getAllKeys();
      
      return {
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
        activeKeys: keys.filter(k => k.isActive).length
      };
    },
    { errorMessage: 'Failed to retrieve API keys' }
  ));
  
  // Create new API key (admin only)
  router.post('/keys', EndpointWrapper.createAdminEndpoint(
    (req) => {
      const { name, tier = 'basic', description = '' } = req.body;
      
      if (!name) {
        const error = new Error('Name is required');
        error.statusCode = 400;
        throw error;
      }
      
      if (!['basic', 'premium', 'admin'].includes(tier)) {
        const error = new Error('Invalid tier. Must be: basic, premium, or admin');
        error.statusCode = 400;
        throw error;
      }
      
      const newApiKey = apiKeyAuth.createAPIKey(name, tier, description);
      
      logger.info('🍌 New API key created', {
        name,
        tier,
        createdBy: req.apiKeyData?.name
      });
      
      return {
        apiKey: newApiKey,
        name,
        tier,
        description,
        rateLimit: apiKeyAuth.defaultLimits[tier],
        permissions: apiKeyAuth.permissions[tier],
        createdAt: new Date().toISOString(),
        warning: '🍌 Store this API key securely! It will not be shown again.'
      };
    },
    { errorMessage: 'Failed to create API key' }
  ));
  
  // Get current API key info
  router.get('/me', EndpointWrapper.createGetEndpoint(
    (req) => {
      const usage = apiKeyAuth.keyUsage.get(req.apiKey);
      
      return {
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
      };
    },
    { errorMessage: 'Failed to get API key info' }
  ));
  
  // Get usage statistics
  router.get('/stats', EndpointWrapper.createGetEndpoint(
    () => {
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
      
      return {
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
      };
    },
    { errorMessage: 'Failed to get statistics' }
  ));
  
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