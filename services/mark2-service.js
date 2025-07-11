const axios = require('axios');
const logger = require('../shared/logger');
const { getErrorHandler } = require('../shared/error-handler');

/**
 * 🤖 MARK2 SERVICE - General Purpose AI Assistant 🤖
 * 
 * Independent AI assistant service for general conversations and tasks
 * Uses Ollama backend but focused on general-purpose AI assistance
 * Not tied to Pi API Hub infrastructure - completely standalone
 */
class Mark2Service {
  constructor(options = {}) {
    this.ollamaUrl = options.ollamaUrl || process.env.OLLAMA_URL || 'http://10.0.0.120:11434';
    this.defaultModel = options.defaultModel || 'llama3.2:latest';
    this.timeout = options.timeout || 45000;
    
    // Mark2's conversation state
    this.conversationHistory = [];
    this.maxHistoryLength = 30; // Longer history for general conversations
    this.isAvailable = false;
    this.lastHealthCheck = null;
    this.healthCheckInterval = 60000; // 1 minute
    
    // Mark2's capabilities and personality - general purpose
    this.capabilities = [
      "General conversation and discussion",
      "Code review and programming help",
      "Writing assistance and editing",
      "Research and information synthesis", 
      "Problem solving and brainstorming",
      "Learning and educational support",
      "Creative tasks and ideation",
      "Technical explanations and tutorials"
    ];
    
    this.personality = {
      name: "Mark2",
      emoji: "🐘",
      tone: "intelligent, helpful, and conversational",
      expertise: "General AI assistance across diverse topics",
      description: "A versatile AI assistant for everyday tasks, learning, and creative work"
    };
    
    // Conversation modes
    this.modes = {
      general: "General conversation and assistance",
      coding: "Programming and technical help",
      creative: "Creative writing and brainstorming", 
      learning: "Educational support and explanations",
      research: "Information gathering and analysis"
    };
    
    this.currentMode = 'general';
    this.errorHandler = getErrorHandler();
    
    logger.info('🤖 Mark2 Service initialized', {
      ollamaUrl: this.ollamaUrl,
      defaultModel: this.defaultModel,
      capabilities: this.capabilities.length
    });
  }

  /**
   * Check Mark2's health and availability
   */
  async checkHealth() {
    try {
      // Check Ollama availability
      const ollamaHealth = await this.checkOllamaHealth();
      
      this.isAvailable = ollamaHealth.healthy;
      this.lastHealthCheck = new Date();
      
      const healthStatus = {
        mark2Available: this.isAvailable,
        ollamaStatus: ollamaHealth,
        lastCheck: this.lastHealthCheck,
        conversationCount: this.conversationHistory.length,
        currentMode: this.currentMode,
        capabilities: this.capabilities,
        personality: this.personality
      };
      
      logger.debug('🤖 Mark2 health check completed', healthStatus);
      return healthStatus;
      
    } catch (error) {
      this.isAvailable = false;
      const healthError = this.errorHandler.handleError(error, {
        context: 'mark2_health_check',
        mark2Service: true
      });
      
      logger.error('🤖 Mark2 health check failed', healthError);
      
      return {
        mark2Available: false,
        error: healthError.message,
        lastCheck: new Date(),
        ollamaStatus: { healthy: false }
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
        activeModel: hasDefaultModel ? this.defaultModel : models[0]?.name || 'none',
        url: this.ollamaUrl
      };
      
    } catch (error) {
      logger.warn('🤖 Mark2 Ollama health check failed', {
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
   * Get Mark2's current status
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
      description: this.personality.description,
      lastHealthCheck: this.lastHealthCheck,
      conversationHistory: this.conversationHistory.length,
      currentMode: this.currentMode,
      availableModes: this.modes,
      capabilities: this.capabilities,
      configuration: {
        ollamaUrl: this.ollamaUrl,
        defaultModel: this.defaultModel,
        maxHistory: this.maxHistoryLength
      }
    };
  }

  /**
   * Set conversation mode
   */
  setMode(mode) {
    if (this.modes[mode]) {
      this.currentMode = mode;
      logger.info('🤖 Mark2 mode changed', { newMode: mode });
      return true;
    }
    return false;
  }

  /**
   * Process a message through Mark2's AI
   */
  async processMessage(message, context = {}) {
    try {
      if (!this.isAvailable) {
        await this.checkHealth();
        if (!this.isAvailable) {
          throw new Error('Mark2 is currently unavailable. Please check Ollama service.');
        }
      }
      
      // Build conversation context based on mode
      const systemPrompt = this.buildSystemPrompt(context);
      const conversationContext = this.buildConversationContext(message);
      
      // Send to Ollama
      const response = await this.sendToOllama(systemPrompt, conversationContext);
      
      // Store conversation
      this.addToConversationHistory(message, response);
      
      logger.info('🤖 Mark2 processed message', {
        messageLength: message.length,
        responseLength: response.length,
        conversationCount: this.conversationHistory.length,
        mode: this.currentMode
      });
      
      return {
        response,
        conversationId: this.conversationHistory.length,
        timestamp: new Date(),
        mode: this.currentMode,
        mark2Status: 'active'
      };
      
    } catch (error) {
      const processError = this.errorHandler.handleError(error, {
        context: 'mark2_message_processing',
        message: message.substring(0, 100) + '...',
        mark2Service: true
      });
      
      logger.error('🤖 Mark2 message processing failed', processError);
      
      return {
        response: this.getErrorResponse(error),
        error: processError.message,
        timestamp: new Date(),
        mode: this.currentMode,
        mark2Status: 'error'
      };
    }
  }

  /**
   * Build system prompt for Mark2 based on current mode
   */
  buildSystemPrompt(context = {}) {
    const basePrompt = `You are Mark2 🐘, a versatile AI assistant designed for general-purpose conversations and assistance.

Your personality:
- Intelligent, helpful, and conversational
- Adaptable to different types of requests and conversations
- Clear and concise in explanations
- Encouraging and supportive in interactions
- Curious and engaged with learning

Your capabilities include:
${this.capabilities.map(c => `- ${c}`).join('\n')}`;

    const modeInstructions = {
      general: "Engage in natural conversation, answer questions, and provide helpful assistance on any topic.",
      coding: "Focus on programming help, code review, debugging, and technical explanations. Provide working examples and best practices.",
      creative: "Assist with creative writing, brainstorming, ideation, and artistic projects. Be imaginative and inspiring.",
      learning: "Act as a patient teacher, breaking down complex concepts into understandable parts. Use examples and analogies.",
      research: "Help gather, analyze, and synthesize information. Provide structured, well-sourced responses."
    };

    const currentModeInstruction = modeInstructions[this.currentMode] || modeInstructions.general;

    return `${basePrompt}

Current Mode: ${this.currentMode} - ${this.modes[this.currentMode]}
Instructions for this mode: ${currentModeInstruction}

Context: ${JSON.stringify(context)}

Be helpful, engaging, and adapt your response style to the user's needs. Use the 🐘 emoji occasionally to show your personality.`;
  }

  /**
   * Build conversation context
   */
  buildConversationContext(newMessage) {
    const recentHistory = this.conversationHistory.slice(-15); // Last 15 exchanges for context
    const context = recentHistory.map(entry => 
      `Human: ${entry.message}\nMark2: ${entry.response}`
    ).join('\n\n');
    
    return context + `\n\nHuman: ${newMessage}\nMark2:`;
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
        temperature: 0.8, // Slightly more creative than Mark
        top_p: 0.9,
        top_k: 40,
        repeat_penalty: 1.1
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
      timestamp: new Date(),
      mode: this.currentMode
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
      return `🐘 I'm having trouble connecting to my AI backend (Ollama). Please check if Ollama is running at ${this.ollamaUrl}`;
    }
    
    if (error.message.includes('timeout')) {
      return `🐘 I'm taking longer than usual to respond. The AI service might be busy. Please try again in a moment.`;
    }
    
    return `🐘 I encountered an error: ${error.message}. Please try again or check the logs.`;
  }

  /**
   * Clear conversation history
   */
  clearConversationHistory() {
    const historyCount = this.conversationHistory.length;
    this.conversationHistory = [];
    
    logger.info('🤖 Mark2 conversation history cleared', { previousCount: historyCount });
    return { cleared: historyCount };
  }

  /**
   * Get conversation statistics
   */
  getConversationStats() {
    const modeStats = {};
    this.conversationHistory.forEach(conv => {
      modeStats[conv.mode] = (modeStats[conv.mode] || 0) + 1;
    });

    return {
      totalConversations: this.conversationHistory.length,
      currentMode: this.currentMode,
      modeDistribution: modeStats,
      oldestConversation: this.conversationHistory[0]?.timestamp || null,
      newestConversation: this.conversationHistory[this.conversationHistory.length - 1]?.timestamp || null,
      averageMessageLength: this.conversationHistory.length > 0 
        ? Math.round(this.conversationHistory.reduce((sum, conv) => sum + conv.message.length, 0) / this.conversationHistory.length)
        : 0
    };
  }

  /**
   * Export conversation history
   */
  exportConversationHistory(format = 'json') {
    const exportData = {
      exportedAt: new Date(),
      totalConversations: this.conversationHistory.length,
      mark2Version: this.personality.name,
      conversations: this.conversationHistory
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else if (format === 'text') {
      const textExport = this.conversationHistory.map(conv => 
        `[${conv.timestamp}] [${conv.mode}]\nHuman: ${conv.message}\nMark2: ${conv.response}\n---`
      ).join('\n\n');
      
      return `Mark2 Conversation Export\nExported: ${exportData.exportedAt}\nTotal Conversations: ${exportData.totalConversations}\n\n${textExport}`;
    }
    
    return exportData;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    if (newConfig.ollamaUrl) this.ollamaUrl = newConfig.ollamaUrl;
    if (newConfig.defaultModel) this.defaultModel = newConfig.defaultModel;
    if (newConfig.timeout) this.timeout = newConfig.timeout;
    if (newConfig.maxHistoryLength) this.maxHistoryLength = newConfig.maxHistoryLength;
    
    logger.info('🤖 Mark2 configuration updated', newConfig);
    
    // Invalidate health check to force refresh
    this.lastHealthCheck = null;
    
    return this.getStatus();
  }
}

// Singleton instance
let mark2ServiceInstance = null;

function getMark2Service(options = {}) {
  if (!mark2ServiceInstance) {
    mark2ServiceInstance = new Mark2Service(options);
  }
  return mark2ServiceInstance;
}

module.exports = {
  Mark2Service,
  getMark2Service
};