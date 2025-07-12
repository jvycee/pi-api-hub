const logger = require('../shared/logger');
const OllamaBaseService = require('../shared/ollama-base-service');

/**
 * 🐘 MARK2 SERVICE - General Purpose AI Assistant 🐘
 * 
 * Independent AI assistant service for general conversations and tasks
 * Uses Ollama backend but focused on general-purpose AI assistance
 * Not tied to Pi API Hub infrastructure - completely standalone
 */
class Mark2Service extends OllamaBaseService {
  constructor(options = {}) {
    // Mark2 has longer history and timeout for general conversations
    super({ ...options, maxHistoryLength: 30, timeout: 45000 });
    
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
    
    logger.info('🐘 Mark2 Service initialized', {
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
      const ollamaHealth = await this.checkOllamaHealth();
      this.isAvailable = ollamaHealth.healthy;
      this.lastHealthCheck = new Date();
      
      return {
        mark2Available: this.isAvailable,
        ollamaStatus: ollamaHealth,
        lastCheck: this.lastHealthCheck,
        conversationCount: this.conversationHistory.length,
        currentMode: this.currentMode,
        capabilities: this.capabilities,
        personality: this.personality
      };
      
    } catch (error) {
      this.isAvailable = false;
      const healthError = this.errorHandler.handleError(error, {
        context: 'mark2_health_check',
        mark2Service: true
      });
      
      logger.error('🐘 Mark2 health check failed', healthError);
      
      return {
        mark2Available: false,
        error: healthError.message,
        lastCheck: new Date(),
        ollamaStatus: { healthy: false }
      };
    }
  }

  /**
   * Get Mark2's current status
   */
  async getStatus() {
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
      logger.info('🐘 Mark2 mode changed', { newMode: mode });
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
      
      const systemPrompt = this.buildSystemPrompt(context);
      const conversationContext = this.buildConversationContext(message, 15);
      
      const response = await this.sendToOllama(`${systemPrompt}\n\n${conversationContext}`, {
        temperature: 0.8 // More creative than Mark
      });
      
      this.addToConversationHistory(message, response, { mode: this.currentMode });
      
      logger.info('🐘 Mark2 processed message', {
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
      
      logger.error('🐘 Mark2 message processing failed', processError);
      
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
    const modeInstructions = {
      general: "Engage in natural conversation, answer questions, and provide helpful assistance on any topic.",
      coding: "Focus on programming help, code review, debugging, and technical explanations. Provide working examples.",
      creative: "Assist with creative writing, brainstorming, ideation, and artistic projects. Be imaginative and inspiring.",
      learning: "Act as a patient teacher, breaking down complex concepts into understandable parts. Use examples.",
      research: "Help gather, analyze, and synthesize information. Provide structured, well-sourced responses."
    };

    return `You are Mark2 🐘, a versatile AI assistant designed for general-purpose conversations and assistance.

Your personality: Intelligent, helpful, and conversational. Adaptable to different types of requests.

Your capabilities:
${this.capabilities.map(c => `- ${c}`).join('\n')}

Current Mode: ${this.currentMode} - ${this.modes[this.currentMode]}
Instructions: ${modeInstructions[this.currentMode] || modeInstructions.general}

Context: ${JSON.stringify(context)}

Be helpful, engaging, and adapt your response style to the user's needs. Use the 🐘 emoji occasionally.`;
  }

  /**
   * Get error response for user (Mark2-specific)
   */
  getErrorResponse(error) {
    return this.getOllamaErrorResponse(error, '🐘');
  }

  /**
   * Get conversation statistics with mode distribution
   */
  getConversationStats() {
    const baseStats = super.getConversationStats();
    
    const modeStats = {};
    this.conversationHistory.forEach(conv => {
      modeStats[conv.mode] = (modeStats[conv.mode] || 0) + 1;
    });

    return {
      ...baseStats,
      currentMode: this.currentMode,
      modeDistribution: modeStats
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

    if (format === 'text') {
      const textExport = this.conversationHistory.map(conv => 
        `[${conv.timestamp}] [${conv.mode}]\nHuman: ${conv.message}\nMark2: ${conv.response}\n---`
      ).join('\n\n');
      
      return `Mark2 Conversation Export\nExported: ${exportData.exportedAt}\nTotal: ${exportData.totalConversations}\n\n${textExport}`;
    }
    
    const { safeStringify } = require('../shared/safe-json');
    return format === 'json' ? safeStringify(exportData) : exportData;
  }

  /**
   * Update configuration
   */
  updateConfiguration(newConfig) {
    const ollamaUpdated = this.updateOllamaConfiguration(newConfig);
    
    if (ollamaUpdated) {
      this.lastHealthCheck = null;
    }
    
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