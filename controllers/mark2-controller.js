const EndpointWrapper = require('../helpers/endpoint-wrapper');
const { getMark2Service } = require('../services/mark2-service');

/**
 * 🤖 MARK2 CONTROLLER - General Purpose AI Assistant API 🤖
 * 
 * Dedicated controller for Mark2's general-purpose AI functionality
 * Independent of Pi API Hub infrastructure - focused on general AI assistance
 */
class Mark2Controller {
  constructor() {
    this.mark2Service = getMark2Service();
  }

  /**
   * Get Mark2's current status and availability
   */
  getStatus = EndpointWrapper.createGetEndpoint(
    async () => {
      const status = await this.mark2Service.getStatus();
      return {
        ...status,
        endpoint: '/api/mark2/status',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to get Mark2 status' }
  );

  /**
   * Get detailed Mark2 health information
   */
  getHealth = EndpointWrapper.createGetEndpoint(
    async () => {
      const health = await this.mark2Service.checkHealth();
      return {
        ...health,
        endpoint: '/api/mark2/health',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to check Mark2 health' }
  );

  /**
   * Process a chat message through Mark2
   */
  chat = EndpointWrapper.createPostEndpoint(
    async (req) => {
      const { message, context = {} } = req.body;
      
      if (!message || typeof message !== 'string') {
        throw new Error('Message is required and must be a string');
      }

      if (message.length > 50000) {
        throw new Error('Message too long (max 50,000 characters)');
      }

      // Add request context
      const enrichedContext = {
        ...context,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        timestamp: new Date().toISOString(),
        source: 'api'
      };

      const result = await this.mark2Service.processMessage(message, enrichedContext);
      
      return {
        ...result,
        endpoint: '/api/mark2/chat',
        messageLength: message.length
      };
    },
    { 
      errorMessage: 'Failed to process chat message',
      requiredFields: ['message']
    }
  );

  /**
   * Set Mark2's conversation mode
   */
  setMode = EndpointWrapper.createPostEndpoint(
    async (req) => {
      const { mode } = req.body;
      
      if (!mode || typeof mode !== 'string') {
        throw new Error('Mode is required and must be a string');
      }

      const modeSet = this.mark2Service.setMode(mode);
      
      if (!modeSet) {
        const availableModes = Object.keys(this.mark2Service.modes);
        throw new Error(`Invalid mode '${mode}'. Available modes: ${availableModes.join(', ')}`);
      }

      const status = await this.mark2Service.getStatus();
      
      return {
        success: true,
        message: `🐘 Mark2 mode changed to: ${mode}`,
        currentMode: status.currentMode,
        modeDescription: this.mark2Service.modes[mode],
        endpoint: '/api/mark2/mode',
        timestamp: new Date().toISOString()
      };
    },
    { 
      errorMessage: 'Failed to set conversation mode',
      requiredFields: ['mode']
    }
  );

  /**
   * Get available conversation modes
   */
  getModes = EndpointWrapper.createGetEndpoint(
    () => {
      return {
        currentMode: this.mark2Service.currentMode,
        availableModes: this.mark2Service.modes,
        modeDescriptions: Object.entries(this.mark2Service.modes).map(([key, desc]) => ({
          mode: key,
          description: desc,
          active: key === this.mark2Service.currentMode
        })),
        endpoint: '/api/mark2/modes',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to get conversation modes' }
  );

  /**
   * Get Mark2's conversation statistics
   */
  getConversationStats = EndpointWrapper.createGetEndpoint(
    () => {
      const stats = this.mark2Service.getConversationStats();
      return {
        ...stats,
        endpoint: '/api/mark2/stats',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to get conversation statistics' }
  );

  /**
   * Clear Mark2's conversation history (admin only)
   */
  clearHistory = EndpointWrapper.createAdminEndpoint(
    () => {
      const result = this.mark2Service.clearConversationHistory();
      return {
        success: true,
        message: '🐘 Mark2 conversation history cleared',
        ...result,
        endpoint: '/api/mark2/clear-history',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to clear conversation history' }
  );

  /**
   * Export Mark2's conversation history (admin only)
   */
  exportHistory = EndpointWrapper.createAdminEndpoint(
    (req) => {
      const { format = 'json' } = req.query;
      
      if (!['json', 'text'].includes(format)) {
        throw new Error('Invalid format. Use "json" or "text"');
      }

      const exportData = this.mark2Service.exportConversationHistory(format);
      
      return {
        success: true,
        format,
        data: exportData,
        endpoint: '/api/mark2/export-history',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to export conversation history' }
  );

  /**
   * Update Mark2's configuration (admin only)
   */
  updateConfig = EndpointWrapper.createAdminEndpoint(
    async (req) => {
      const { ollamaUrl, defaultModel, timeout, maxHistoryLength } = req.body;
      
      const allowedFields = { ollamaUrl, defaultModel, timeout, maxHistoryLength };
      const filteredConfig = Object.fromEntries(
        Object.entries(allowedFields).filter(([key, value]) => value !== undefined)
      );

      if (Object.keys(filteredConfig).length === 0) {
        throw new Error('No valid configuration fields provided');
      }

      const updatedStatus = await this.mark2Service.updateConfiguration(filteredConfig);
      
      return {
        success: true,
        message: '🐘 Mark2 configuration updated',
        updatedFields: Object.keys(filteredConfig),
        newStatus: updatedStatus,
        endpoint: '/api/mark2/config',
        timestamp: new Date().toISOString()
      };
    },
    { 
      errorMessage: 'Failed to update Mark2 configuration',
      optionalFields: ['ollamaUrl', 'defaultModel', 'timeout', 'maxHistoryLength']
    }
  );

  /**
   * Get Mark2's capabilities and features
   */
  getCapabilities = EndpointWrapper.createGetEndpoint(
    () => {
      return {
        name: 'Mark2',
        emoji: '🐘',
        description: 'General-purpose AI assistant for everyday tasks, learning, and creative work',
        capabilities: this.mark2Service.capabilities,
        personality: this.mark2Service.personality,
        features: [
          'Multi-mode conversations (general, coding, creative, learning, research)',
          'Extended conversation history (30 exchanges)',
          'Conversation export functionality',
          'Adaptive response styles based on context',
          'Independent of specific infrastructure',
          'General-purpose problem solving',
          'Creative and educational assistance'
        ],
        availableModes: this.mark2Service.modes,
        currentMode: this.mark2Service.currentMode,
        apiEndpoints: [
          'GET /api/mark2/status - Get Mark2 status',
          'GET /api/mark2/health - Detailed health information',
          'POST /api/mark2/chat - Send message to Mark2',
          'POST /api/mark2/mode - Set conversation mode',
          'GET /api/mark2/modes - Get available modes',
          'GET /api/mark2/stats - Conversation statistics',
          'GET /api/mark2/capabilities - This endpoint'
        ],
        endpoint: '/api/mark2/capabilities',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to get Mark2 capabilities' }
  );

  /**
   * Test Mark2's AI connectivity
   */
  testAI = EndpointWrapper.createGetEndpoint(
    async () => {
      const testMessage = "Hello! Please respond with a brief test message confirming you're working.";
      const result = await this.mark2Service.processMessage(testMessage, { 
        test: true,
        source: 'api_test'
      });

      return {
        success: result.mark2Status !== 'error',
        testMessage,
        response: result.response,
        responseTime: result.timestamp,
        conversationId: result.conversationId,
        mode: result.mode,
        endpoint: '/api/mark2/test',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to test Mark2 AI connectivity' }
  );

  /**
   * Quick conversation starters
   */
  getConversationStarters = EndpointWrapper.createGetEndpoint(
    () => {
      const starters = {
        general: [
          "Tell me something interesting about today's date",
          "What's a good way to start learning something new?",
          "Help me brainstorm ideas for a weekend project"
        ],
        coding: [
          "Explain the difference between async and sync programming",
          "Review this code snippet for improvements",
          "What are the latest trends in web development?"
        ],
        creative: [
          "Help me write a short story beginning",
          "Generate ideas for a creative writing prompt",
          "What's an interesting plot twist for a mystery story?"
        ],
        learning: [
          "Explain quantum computing in simple terms",
          "What's the best way to learn a new language?",
          "Break down how machine learning works"
        ],
        research: [
          "Summarize the latest developments in renewable energy",
          "Compare different approaches to remote work productivity",
          "Analyze the pros and cons of electric vehicles"
        ]
      };

      return {
        conversationStarters: starters,
        currentMode: this.mark2Service.currentMode,
        suggestedStarters: starters[this.mark2Service.currentMode] || starters.general,
        endpoint: '/api/mark2/conversation-starters',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'Failed to get conversation starters' }
  );
}

module.exports = Mark2Controller;