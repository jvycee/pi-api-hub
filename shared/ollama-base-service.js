const axios = require('axios');
const logger = require('./logger');
const { getErrorHandler } = require('./error-handler');

/**
 * 🦙 OLLAMA BASE SERVICE 🦙
 * 
 * Shared base class for services that interact with Ollama
 * Eliminates code duplication between Mark and Mark2 services
 */
class OllamaBaseService {
  constructor(options = {}) {
    this.ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || 'http://10.0.0.120:11434';
    this.defaultModel = options.defaultModel || 'llama3.2:latest';
    this.timeout = options.timeout || 30000;
    this.conversationHistory = [];
    this.maxHistoryLength = options.maxHistoryLength || 20;
    this.isAvailable = false;
    this.lastHealthCheck = null;
    this.healthCheckInterval = 60000;
    this.errorHandler = getErrorHandler();
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
        activeModel: hasDefaultModel ? this.defaultModel : models[0]?.name || 'none',
        url: this.ollamaUrl
      };
      
    } catch (error) {
      logger.warn(`🦙 Ollama health check failed for ${this.constructor.name}`, {
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
   * Send message to Ollama with standardized options
   */
  async sendToOllama(prompt, options = {}) {
    const defaultOptions = {
      temperature: 0.7,
      top_p: 0.9,
      top_k: 40,
      repeat_penalty: 1.1
    };

    const response = await axios.post(`${this.ollamaUrl}/api/generate`, {
      model: this.defaultModel,
      prompt: prompt,
      stream: false,
      options: { ...defaultOptions, ...options }
    }, {
      timeout: this.timeout
    });
    
    return response.data.response;
  }

  /**
   * Add to conversation history with size management
   */
  addToConversationHistory(message, response, metadata = {}) {
    this.conversationHistory.push({
      message,
      response,
      timestamp: new Date(),
      ...metadata
    });
    
    // Keep history within limits
    if (this.conversationHistory.length > this.maxHistoryLength) {
      this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength);
    }
  }

  /**
   * Get standardized error response
   */
  getOllamaErrorResponse(error, emoji = '🦙') {
    if (error.message.includes('ECONNREFUSED')) {
      return `${emoji} I'm having trouble connecting to my AI backend (Ollama). Please check if Ollama is running at ${this.ollamaUrl}`;
    }
    
    if (error.message.includes('timeout')) {
      return `${emoji} I'm taking longer than usual to respond. The AI service might be busy. Please try again in a moment.`;
    }
    
    return `${emoji} I encountered an error: ${error.message}. Please try again or check the logs.`;
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory() {
    const historyCount = this.conversationHistory.length;
    this.conversationHistory = [];
    
    logger.info(`🦙 ${this.constructor.name} conversation history cleared`, { previousCount: historyCount });
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
   * Update Ollama configuration
   */
  updateOllamaConfiguration(newConfig) {
    let updated = false;
    
    if (newConfig.ollamaUrl && newConfig.ollamaUrl !== this.ollamaUrl) {
      this.ollamaUrl = newConfig.ollamaUrl;
      updated = true;
    }
    
    if (newConfig.defaultModel && newConfig.defaultModel !== this.defaultModel) {
      this.defaultModel = newConfig.defaultModel;
      updated = true;
    }
    
    if (newConfig.timeout && newConfig.timeout !== this.timeout) {
      this.timeout = newConfig.timeout;
      updated = true;
    }
    
    if (newConfig.maxHistoryLength && newConfig.maxHistoryLength !== this.maxHistoryLength) {
      this.maxHistoryLength = newConfig.maxHistoryLength;
      updated = true;
    }
    
    if (updated) {
      logger.info(`🦙 ${this.constructor.name} Ollama configuration updated`, newConfig);
      this.lastHealthCheck = null; // Force health check refresh
    }
    
    return updated;
  }

  /**
   * Build conversation context from history
   */
  buildConversationContext(newMessage, contextLength = 10) {
    const recentHistory = this.conversationHistory.slice(-contextLength);
    const context = recentHistory.map(entry => 
      `Human: ${entry.message}\nAssistant: ${entry.response}`
    ).join('\n\n');
    
    return context + `\n\nHuman: ${newMessage}\nAssistant:`;
  }
}

module.exports = OllamaBaseService;