const axios = require('axios');
const logger = require('../shared/logger');
const OllamaBaseService = require('../shared/ollama-base-service');

/**
 * 🐐 MARK SERVICE - AI-Powered CLI Assistant 🐐
 * 
 * Dedicated service for Mark's AI assistant functionality
 * Handles conversation processing, health monitoring, and AI backend integration
 */
class MarkService extends OllamaBaseService {
  constructor(options = {}) {
    super(options);
    this.piApiUrl = options.piApiUrl || process.env.PI_API_URL || 'http://localhost:3000';
    
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
      const response = await this.sendToOllama(`${systemPrompt}\n\n${conversationContext}`);
      
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
   * Get error response for user (Mark-specific)
   */
  getErrorResponse(error) {
    return this.getOllamaErrorResponse(error, '🐐');
  }


  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    const ollamaUpdated = this.updateOllamaConfiguration(newConfig);
    
    if (newConfig.piApiUrl && newConfig.piApiUrl !== this.piApiUrl) {
      this.piApiUrl = newConfig.piApiUrl;
      logger.info('🐐 Mark Pi API URL updated', { piApiUrl: this.piApiUrl });
    }
    
    if (ollamaUpdated) {
      this.lastHealthCheck = null; // Force health check refresh
    }
    
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