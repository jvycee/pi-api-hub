const axios = require('axios');
const logger = require('../shared/logger');
const { getErrorHandler } = require('../shared/error-handler');

/**
 * 🐐 MARK SERVICE - AI-Powered CLI Assistant 🐐
 * 
 * Dedicated service for Mark's AI assistant functionality
 * Handles conversation processing, health monitoring, and AI backend integration
 */
class MarkService {
  constructor(options = {}) {
    this.ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || 'http://10.0.0.120:11434';
    this.piApiUrl = options.piApiUrl || process.env.PI_API_URL || 'http://localhost:3000';
    this.defaultModel = options.defaultModel || 'llama3.2:latest';
    this.timeout = options.timeout || 30000;
    
    // Mark's conversation state
    this.conversationHistory = [];
    this.maxHistoryLength = 20;
    this.isAvailable = false;
    this.lastHealthCheck = null;
    this.healthCheckInterval = 60000; // 1 minute
    
    // Mark's capabilities and personality
    this.specialties = [
      "API testing and payload generation",
      "Webhook troubleshooting", 
      "HubSpot API expertise",
      "MCP (Model Context Protocol) testing",
      "Security testing and vulnerability assessment",
      "Performance optimization",
      "Banana-powered infrastructure analysis 🍌"
    ];
    
    this.personality = {
      name: "Mark",
      emoji: "🐐",
      tone: "friendly and helpful",
      expertise: "Pi API Hub infrastructure and testing"
    };
    
    this.errorHandler = getErrorHandler();
    
    logger.info('🐐 Mark Service initialized', {
      ollamaUrl: this.ollamaUrl,
      piApiUrl: this.piApiUrl,
      defaultModel: this.defaultModel
    });
  }

  /**
   * Check Mark's health and availability
   */
  async checkHealth() {
    try {
      // Check Ollama availability
      const ollamaHealth = await this.checkOllamaHealth();
      
      // Check Pi API Hub connectivity
      const piApiHealth = await this.checkPiApiHealth();
      
      this.isAvailable = ollamaHealth.healthy && piApiHealth.healthy;
      this.lastHealthCheck = new Date();
      
      const healthStatus = {
        markAvailable: this.isAvailable,
        ollamaStatus: ollamaHealth,
        piApiStatus: piApiHealth,
        lastCheck: this.lastHealthCheck,
        conversationCount: this.conversationHistory.length,
        capabilities: this.specialties
      };
      
      logger.debug('🐐 Mark health check completed', healthStatus);
      return healthStatus;
      
    } catch (error) {
      this.isAvailable = false;
      const healthError = this.errorHandler.handleError(error, {
        context: 'mark_health_check',
        markService: true
      });
      
      logger.error('🐐 Mark health check failed', healthError);
      
      return {
        markAvailable: false,
        error: healthError.message,
        lastCheck: new Date(),
        ollamaStatus: { healthy: false },
        piApiStatus: { healthy: false }
      };
    }
  }

  /**
   * Check Ollama service health
   */
  async checkOllamaHealth() {
    try {
      const response = await axios.get(`${this.ollamaUrl}/api/tags`, {
        timeout: this.timeout
      });
      
      const models = response.data.models || [];
      const hasDefaultModel = models.some(model => model.name === this.defaultModel);
      
      return {
        healthy: true,
        modelCount: models.length,
        models: models.map(m => ({ name: m.name, size: m.size })),
        defaultModelAvailable: hasDefaultModel,
        activeModel: hasDefaultModel ? this.defaultModel : models[0]?.name || 'none'
      };
      
    } catch (error) {
      logger.warn('🐐 Ollama health check failed', {
        url: this.ollamaUrl,
        error: error.message
      });
      
      return {
        healthy: false,
        error: error.message,
        modelCount: 0,
        models: [],
        defaultModelAvailable: false,
        activeModel: 'unavailable'
      };
    }
  }

  /**
   * Check Pi API Hub connectivity
   */
  async checkPiApiHealth() {
    try {
      const response = await axios.get(`${this.piApiUrl}/health`, {
        timeout: 5000
      });
      
      return {
        healthy: true,
        status: response.data.status,
        responseTime: response.headers['x-response-time'] || 'unknown'
      };
      
    } catch (error) {
      logger.warn('🐐 Pi API Hub health check failed', {
        url: this.piApiUrl,
        error: error.message
      });
      
      return {
        healthy: false,
        error: error.message,
        status: 'unreachable'
      };
    }
  }

  /**
   * Get Mark's current status
   */
  async getStatus() {
    // If health check is stale, refresh it
    if (!this.lastHealthCheck || 
        Date.now() - this.lastHealthCheck.getTime() > this.healthCheckInterval) {
      await this.checkHealth();
    }
    
    return {
      name: this.personality.name,
      emoji: this.personality.emoji,
      available: this.isAvailable,
      status: this.isAvailable ? 'ready' : 'unavailable',
      lastHealthCheck: this.lastHealthCheck,
      conversationHistory: this.conversationHistory.length,
      specialties: this.specialties,
      configuration: {
        ollamaUrl: this.ollamaUrl,
        piApiUrl: this.piApiUrl,
        defaultModel: this.defaultModel
      }
    };
  }

  /**
   * Process a message through Mark's AI
   */
  async processMessage(message, context = {}) {
    try {
      if (!this.isAvailable) {
        await this.checkHealth();
        if (!this.isAvailable) {
          throw new Error('Mark is currently unavailable. Please check Ollama service.');
        }
      }
      
      // Build conversation context
      const systemPrompt = this.buildSystemPrompt(context);
      const conversationContext = this.buildConversationContext(message);
      
      // Send to Ollama
      const response = await this.sendToOllama(systemPrompt, conversationContext);
      
      // Store conversation
      this.addToConversationHistory(message, response);
      
      logger.info('🐐 Mark processed message', {
        messageLength: message.length,
        responseLength: response.length,
        conversationCount: this.conversationHistory.length
      });
      
      return {
        response,
        conversationId: this.conversationHistory.length,
        timestamp: new Date(),
        markStatus: 'active'
      };
      
    } catch (error) {
      const processError = this.errorHandler.handleError(error, {
        context: 'mark_message_processing',
        message: message.substring(0, 100) + '...',
        markService: true
      });
      
      logger.error('🐐 Mark message processing failed', processError);
      
      return {
        response: this.getErrorResponse(error),
        error: processError.message,
        timestamp: new Date(),
        markStatus: 'error'
      };
    }
  }

  /**
   * Build system prompt for Mark
   */
  buildSystemPrompt(context = {}) {
    return `You are Mark 🐐, an AI assistant specializing in the Pi API Hub infrastructure.

Your expertise includes:
${this.specialties.map(s => `- ${s}`).join('\n')}

Current context:
- Pi API Hub URL: ${this.piApiUrl}
- Your availability: ${this.isAvailable ? 'online' : 'limited'}
- User context: ${JSON.stringify(context)}

Be helpful, concise, and include practical examples. Use the 🐐 emoji occasionally to show your personality.
Focus on actionable advice for API testing, debugging, and optimization.`;
  }

  /**
   * Build conversation context
   */
  buildConversationContext(newMessage) {
    const recentHistory = this.conversationHistory.slice(-10); // Last 10 exchanges
    const context = recentHistory.map(entry => 
      `Human: ${entry.message}\nMark: ${entry.response}`
    ).join('\n\n');
    
    return context + `\n\nHuman: ${newMessage}\nMark:`;
  }

  /**
   * Send message to Ollama
   */
  async sendToOllama(systemPrompt, conversationContext) {
    const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
      model: this.defaultModel,
      prompt: `${systemPrompt}\n\n${conversationContext}`,
      stream: false,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40
      }
    }, {
      timeout: this.timeout
    });
    
    return response.data.response;
  }

  /**
   * Add to conversation history
   */
  addToConversationHistory(message, response) {
    this.conversationHistory.push({
      message,
      response,
      timestamp: new Date()
    });
    
    // Keep history within limits
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Get error response for user
   */
  getErrorResponse(error) {
    if (error.message.includes('ECONNREFUSED')) {
      return `🐐 Sorry, I'm having trouble connecting to my AI backend (Ollama). Please check if Ollama is running at ${this.ollamaUrl}`;
    }
    
    if (error.message.includes('timeout')) {
      return `🐐 I'm taking too long to respond. The AI service might be overloaded. Please try again in a moment.`;
    }
    
    return `🐐 I encountered an error: ${error.message}. Please check the logs or try again.`;
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory() {
    const historyCount = this.conversationHistory.length;
    this.conversationHistory = [];
    
    logger.info('🐐 Mark conversation history cleared', { previousCount: historyCount });
    return { cleared: historyCount };
  }

  /**
   * Get conversation statistics
   */
  getConversationStats() {
    return {
      totalConversations: this.conversationHistory.length,
      oldestConversation: this.conversationHistory[0]?.timestamp || null,
      newestConversation: this.conversationHistory[this.conversationHistory.length - 1]?.timestamp || null,
      averageMessageLength: this.conversationHistory.length > 0 
        ? Math.round(this.conversationHistory.reduce((sum, conv) => sum + conv.message.length, 0) / this.conversationHistory.length)
        : 0
    };
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    if (newConfig.ollamaUrl) this.ollamaUrl = newConfig.ollamaUrl;
    if (newConfig.piApiUrl) this.piApiUrl = newConfig.piApiUrl;
    if (newConfig.defaultModel) this.defaultModel = newConfig.defaultModel;
    if (newConfig.timeout) this.timeout = newConfig.timeout;
    
    logger.info('🐐 Mark configuration updated', newConfig);
    
    // Invalidate health check to force refresh
    this.lastHealthCheck = null;
    
    return this.getStatus();
  }
}

// Singleton instance
let markServiceInstance = null;

function getMarkService(options = {}) {
  if (!markServiceInstance) {
    markServiceInstance = new MarkService(options);
  }
  return markServiceInstance;
}

module.exports = {
  MarkService,
  getMarkService
};