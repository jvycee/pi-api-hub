const EndpointWrapper = require('../helpers/endpoint-wrapper');
const { getMarkService } = require('../services/mark-service');

/**
 * 🐐 MARK CONTROLLER - AI Assistant API Endpoints 🐐
 * 
 * Dedicated controller for Mark's AI assistant functionality
 * Provides clean separation between Mark and infrastructure monitoring
 */
class MarkController {
  constructor() {
    this.markService = getMarkService();
  }

  /**
   * Get Mark's current status and availability
   */
  getStatus = EndpointWrapper.createGetEndpoint(
    async () => {
      const status = await this.markService.getStatus();
      return {
        ...status,
        endpoint: '/api/mark/status',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to get Mark status' }
  );

  /**
   * Get detailed Mark health information
   */
  getHealth = EndpointWrapper.createGetEndpoint(
    async () => {
      const health = await this.markService.checkHealth();
      return {
        ...health,
        endpoint: '/api/mark/health',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to check Mark health' }
  );

  /**
   * Process a chat message through Mark
   */
  chat = EndpointWrapper.createPostEndpoint(
    async (req) => {
      const { message, context = {} } = req.body;
      
      if (!message || typeof message !== 'string') {
        throw new Error('Message is required and must be a string');
      }

      if (message.length > 10000) {
        throw new Error('Message too long (max 10,000 characters)');
      }

      // Add request context
      const enrichedContext = {
        ...context,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString()
      };

      const result = await this.markService.processMessage(message, enrichedContext);
      
      return {
        ...result,
        endpoint: '/api/mark/chat',
        messageLength: message.length
      };
    },
    { 
      errorMessage: 'Failed to process chat message',
      requiredFields: ['message']
    }
  );

  /**
   * Get Mark's conversation statistics
   */
  getConversationStats = EndpointWrapper.createGetEndpoint(
    () => {
      const stats = this.markService.getConversationStats();
      return {
        ...stats,
        endpoint: '/api/mark/stats',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to get conversation statistics' }
  );

  /**
   * Clear Mark's conversation history (admin only)
   */
  clearHistory = EndpointWrapper.createAdminEndpoint(
    () => {
      const result = this.markService.clearConversationHistory();
      return {
        success: true,
        message: '🐐 Mark conversation history cleared',
        ...result,
        endpoint: '/api/mark/clear-history',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to clear conversation history' }
  );

  /**
   * Update Mark's configuration (admin only)
   */
  updateConfig = EndpointWrapper.createAdminEndpoint(
    async (req) => {
      const { ollamaUrl, piApiUrl, defaultModel, timeout } = req.body;
      
      const allowedFields = { ollamaUrl, piApiUrl, defaultModel, timeout };
      const filteredConfig = Object.fromEntries(
        Object.entries(allowedFields).filter(([key, value]) => value !== undefined)
      );

      if (Object.keys(filteredConfig).length === 0) {
        throw new Error('No valid configuration fields provided');
      }

      const updatedStatus = await this.markService.updateConfiguration(filteredConfig);
      
      return {
        success: true,
        message: '🐐 Mark configuration updated',
        updatedFields: Object.keys(filteredConfig),
        newStatus: updatedStatus,
        endpoint: '/api/mark/config',
        timestamp: new Date().toISOString()
      };
    },
    { 
      errorMessage: 'Failed to update Mark configuration',
      optionalFields: ['ollamaUrl', 'piApiUrl', 'defaultModel', 'timeout']
    }
  );

  /**
   * Get Mark's capabilities and specialties
   */
  getCapabilities = EndpointWrapper.createGetEndpoint(
    () => {
      return {
        name: 'Mark',
        emoji: '🐐',
        description: 'AI-powered CLI assistant for Pi API Hub infrastructure',
        specialties: this.markService.specialties,
        features: [
          'Interactive chat conversations',
          'API testing assistance',
          'Webhook troubleshooting',
          'Security testing guidance',
          'Performance optimization advice',
          'Real-time health monitoring',
          'Conversation history management'
        ],
        supportedCommands: [
          '/test api - API testing examples',
          '/webhook hubspot - HubSpot webhook help',
          '/security scan - Security testing guidance',
          '/payload contact - Generate contact payload',
          '/status - Check Pi status',
          '/help - Show all commands',
          '/exit - End conversation'
        ],
        endpoint: '/api/mark/capabilities',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to get Mark capabilities' }
  );

  /**
   * Test Mark's AI connectivity
   */
  testAI = EndpointWrapper.createGetEndpoint(
    async () => {
      const testMessage = "Hello Mark, please respond with a brief test message.";
      const result = await this.markService.processMessage(testMessage, { 
        test: true,
        source: 'api_test'
      });

      return {
        success: result.markStatus !== 'error',
        testMessage,
        response: result.response,
        responseTime: result.timestamp,
        conversationId: result.conversationId,
        endpoint: '/api/mark/test',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to test Mark AI connectivity' }
  );
}

module.exports = MarkController;