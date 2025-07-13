const axios = require('axios');
const logger = require('../shared/logger');
const { performance } = require('perf_hooks');

class AIFallbackHandler {
  constructor(options = {}) {
    this.anthropicApiKey = options.anthropicApiKey || process.env.ANTHROPIC_API_KEY;
    this.ollamaBaseUrl = options.ollamaBaseUrl || 'http://localhost:11434';
    this.defaultModel = options.defaultModel || 'llama3.1:8b';
    this.primaryProvider = options.primaryProvider || 'ollama'; // Default to Ollama
    this.enableFallback = options.enableFallback !== false;
    this.maxRetries = options.maxRetries || 2;
    this.retryDelay = options.retryDelay || 1000;
    
    // Specialized tasks that should use Claude
    this.claudeSpecializedTasks = new Set([
      'code_review',
      'complex_analysis',
      'creative_writing',
      'detailed_explanation',
      'technical_documentation',
      'critical_thinking',
      'advanced_reasoning'
    ]);
    
    // Keywords that trigger Claude usage
    this.claudeTriggerKeywords = new Set([
      'analyze deeply',
      'complex analysis',
      'detailed review',
      'critical thinking',
      'advanced reasoning',
      'code review',
      'technical documentation',
      'creative writing',
      'explain in detail',
      'comprehensive analysis'
    ]);
    
    // Provider status tracking
    this.providerStatus = {
      anthropic: {
        available: true,
        lastFailure: null,
        failureCount: 0,
        outOfCredits: false,
        lastSuccessfulCall: Date.now()
      },
      ollama: {
        available: false,
        lastFailure: null,
        failureCount: 0,
        models: [],
        lastSuccessfulCall: null
      }
    };
    
    // Statistics
    this.stats = {
      totalRequests: 0,
      anthropicRequests: 0,
      ollamaRequests: 0,
      fallbackTriggers: 0,
      specializedTasksToAnthropic: 0,
      keywordTriggeredRequests: 0,
      errorsByProvider: new Map(),
      avgResponseTimes: {
        anthropic: 0,
        ollama: 0
      },
      creditsExhausted: false,
      lastCreditCheck: null,
      costSavings: {
        totalOllamaRequests: 0,
        estimatedClaudeCostSaved: 0
      }
    };
    
    // Initialize Ollama connection
    this.initializeOllama();
    
    logger.info('🍌 AI Fallback Handler initialized', {
      ollamaBaseUrl: this.ollamaBaseUrl,
      defaultModel: this.defaultModel,
      enableFallback: this.enableFallback,
      anthropicConfigured: !!this.anthropicApiKey
    });
  }

  // Initialize Ollama connection and check available models
  async initializeOllama() {
    try {
      // Check if Ollama is running
      const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`, {
        timeout: 5000
      });
      
      if (response.status === 200) {
        this.providerStatus.ollama.available = true;
        this.providerStatus.ollama.models = response.data.models || [];
        this.providerStatus.ollama.lastSuccessfulCall = Date.now();
        
        logger.info('🍌 Ollama connection successful', {
          modelsAvailable: this.providerStatus.ollama.models.length,
          models: this.providerStatus.ollama.models.map(m => m.name)
        });
        
        // Check if default model is available
        const hasDefaultModel = this.providerStatus.ollama.models.some(
          model => model.name === this.defaultModel
        );
        
        if (!hasDefaultModel && this.providerStatus.ollama.models.length > 0) {
          this.defaultModel = this.providerStatus.ollama.models[0].name;
          logger.info('🍌 Default model not found, using first available', {
            newDefaultModel: this.defaultModel
          });
        }
      }
    } catch (error) {
      this.providerStatus.ollama.available = false;
      this.providerStatus.ollama.lastFailure = Date.now();
      this.providerStatus.ollama.failureCount++;
      
      logger.warn('🍌 Ollama connection failed', {
        error: error.message,
        ollamaUrl: this.ollamaBaseUrl,
        suggestion: 'Make sure Ollama is running on your Mac Mini'
      });
    }
  }

  // Check if error indicates credit exhaustion
  isCreditExhaustedError(error) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorData = error.response?.data?.error?.message?.toLowerCase() || '';
    
    const creditKeywords = [
      'credit balance is too low',
      'insufficient credits',
      'credits exhausted',
      'billing',
      'payment required',
      'quota exceeded'
    ];
    
    return creditKeywords.some(keyword => 
      errorMessage.includes(keyword) || errorData.includes(keyword)
    );
  }

  // Make request to Anthropic
  async callAnthropic(messages, options = {}) {
    const startTime = performance.now();
    
    try {
      const requestData = {
        model: options.model || 'claude-3-haiku-20240307',
        max_tokens: options.max_tokens || 1000,
        messages: messages,
        ...options
      };
      
      const response = await axios.post('https://api.anthropic.com/v1/messages', requestData, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.anthropicApiKey,
          'anthropic-version': '2023-06-01'
        },
        timeout: 30000
      });
      
      // Update success metrics
      const responseTime = performance.now() - startTime;
      this.updateProviderStats('anthropic', true, responseTime);
      
      return {
        provider: 'anthropic',
        response: response.data,
        responseTime
      };
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      // Check if it's a credit exhaustion error
      if (this.isCreditExhaustedError(error)) {
        this.providerStatus.anthropic.outOfCredits = true;
        this.stats.creditsExhausted = true;
        this.stats.lastCreditCheck = Date.now();
        
        logger.error('🍌 Anthropic credits exhausted, enabling fallback', {
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
      
      this.updateProviderStats('anthropic', false, responseTime);
      throw error;
    }
  }

  // Make request to Ollama
  async callOllama(messages, options = {}) {
    const startTime = performance.now();
    
    try {
      // Convert messages to Ollama format
      const prompt = this.convertMessagesToPrompt(messages);
      
      const requestData = {
        model: options.model || this.defaultModel,
        prompt: prompt,
        stream: false,
        options: {
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1000,
          top_p: options.top_p || 0.9
        }
      };
      
      const response = await axios.post(`${this.ollamaBaseUrl}/api/generate`, requestData, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 60000 // Ollama can be slower
      });
      
      // Update success metrics
      const responseTime = performance.now() - startTime;
      this.updateProviderStats('ollama', true, responseTime);
      
      // Convert response to Anthropic-like format
      const convertedResponse = {
        content: [{
          type: 'text',
          text: response.data.response
        }],
        model: response.data.model,
        usage: {
          input_tokens: this.estimateTokens(prompt),
          output_tokens: this.estimateTokens(response.data.response)
        }
      };
      
      return {
        provider: 'ollama',
        response: convertedResponse,
        responseTime
      };
      
    } catch (error) {
      const responseTime = performance.now() - startTime;
      this.updateProviderStats('ollama', false, responseTime);
      throw error;
    }
  }

  // Convert Anthropic message format to simple prompt
  convertMessagesToPrompt(messages) {
    if (!Array.isArray(messages)) {
      return String(messages);
    }
    
    return messages.map(msg => {
      const role = msg.role === 'assistant' ? 'Assistant' : 'Human';
      const content = typeof msg.content === 'string' ? msg.content : 
        msg.content?.map(c => c.text || c.content || '').join(' ') || '';
      return `${role}: ${content}`;
    }).join('\n\n');
  }

  // Estimate token count (rough approximation)
  estimateTokens(text) {
    return Math.ceil((text || '').length / 4);
  }

  // Main method to handle AI requests with smart routing
  async processAIRequest(messages, options = {}) {
    this.stats.totalRequests++;
    
    const routing = this.determineProvider(messages, options);
    const preferredProvider = routing.provider;
    const routingReason = routing.reason;
    
    // Track specialized routing
    if (routingReason.includes('specialized_task') || routingReason.includes('keyword_trigger') || routingReason.includes('high_complexity')) {
      this.stats.specializedTasksToAnthropic++;
    }
    if (routingReason.includes('keyword_trigger')) {
      this.stats.keywordTriggeredRequests++;
    }
    
    logger.info('🍌 Processing AI request with smart routing', {
      provider: preferredProvider,
      reason: routingReason,
      anthropicAvailable: this.providerStatus.anthropic.available && !this.providerStatus.anthropic.outOfCredits,
      ollamaAvailable: this.providerStatus.ollama.available,
      messageCount: Array.isArray(messages) ? messages.length : 1,
      taskType: options.taskType,
      forceClaude: options.forceClaude
    });
    
    // Try primary provider first
    if (preferredProvider === 'anthropic') {
      try {
        this.stats.anthropicRequests++;
        const result = await this.callAnthropic(messages, options);
        result.routingReason = routingReason;
        return result;
      } catch (error) {
        logger.warn('🍌 Claude request failed, trying Ollama fallback', {
          error: error.message,
          routingReason,
          willFallback: this.enableFallback && this.providerStatus.ollama.available
        });
        
        // Try fallback if enabled and available
        if (this.enableFallback && this.providerStatus.ollama.available) {
          this.stats.fallbackTriggers++;
          this.stats.ollamaRequests++;
          
          try {
            const result = await this.callOllama(messages, options);
            result.fallbackUsed = true;
            result.originalProvider = 'anthropic';
            result.routingReason = routingReason;
            return result;
          } catch (fallbackError) {
            logger.error('🍌 Both providers failed', {
              claudeError: error.message,
              ollamaError: fallbackError.message,
              routingReason
            });
            throw new Error(`Both providers failed. Claude: ${error.message}, Ollama: ${fallbackError.message}`);
          }
        }
        
        throw error;
      }
    } else {
      // Use Ollama as primary
      try {
        this.stats.ollamaRequests++;
        this.stats.costSavings.totalOllamaRequests++;
        // Estimate cost saved (rough estimate: $0.003 per 1K tokens)
        const estimatedTokens = this.estimateTokens(this.extractContentFromMessages(messages));
        this.stats.costSavings.estimatedClaudeCostSaved += (estimatedTokens / 1000) * 0.003;
        
        const result = await this.callOllama(messages, options);
        result.routingReason = routingReason;
        result.costSavingMode = true;
        return result;
      } catch (error) {
        logger.warn('🍌 Ollama request failed, trying Claude fallback', {
          error: error.message,
          routingReason,
          willFallback: !this.providerStatus.anthropic.outOfCredits && this.providerStatus.anthropic.available
        });
        
        // Try Claude if available and has credits
        if (!this.providerStatus.anthropic.outOfCredits && this.providerStatus.anthropic.available) {
          this.stats.fallbackTriggers++;
          this.stats.anthropicRequests++;
          
          try {
            const result = await this.callAnthropic(messages, options);
            result.fallbackUsed = true;
            result.originalProvider = 'ollama';
            result.routingReason = routingReason;
            return result;
          } catch (fallbackError) {
            logger.error('🍌 Both providers failed', {
              ollamaError: error.message,
              claudeError: fallbackError.message,
              routingReason
            });
            throw new Error(`Both providers failed. Ollama: ${error.message}, Claude: ${fallbackError.message}`);
          }
        }
        
        throw error;
      }
    }
  }

  // Analyze if request needs specialized Claude processing
  needsClaudeSpecialization(messages, options = {}) {
    // Check for explicit task type
    if (options.taskType && this.claudeSpecializedTasks.has(options.taskType)) {
      return { needed: true, reason: `specialized_task:${options.taskType}` };
    }
    
    // Check for force Claude flag
    if (options.forceClaude === true) {
      return { needed: true, reason: 'force_claude_requested' };
    }
    
    // Analyze message content for complexity indicators
    const content = this.extractContentFromMessages(messages);
    const contentLower = content.toLowerCase();
    
    // Check for trigger keywords
    for (const keyword of this.claudeTriggerKeywords) {
      if (contentLower.includes(keyword)) {
        return { needed: true, reason: `keyword_trigger:${keyword}` };
      }
    }
    
    // Check for complexity indicators
    const complexityScore = this.calculateComplexityScore(content);
    if (complexityScore > 0.7) {
      return { needed: true, reason: `high_complexity:${complexityScore.toFixed(2)}` };
    }
    
    // Check for code-related requests
    if (this.isCodeRelated(content)) {
      return { needed: true, reason: 'code_related_request' };
    }
    
    return { needed: false, reason: 'standard_request' };
  }

  // Extract text content from messages
  extractContentFromMessages(messages) {
    if (!Array.isArray(messages)) {
      return String(messages);
    }
    
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return msg.content;
      }
      if (Array.isArray(msg.content)) {
        return msg.content.map(c => c.text || c.content || '').join(' ');
      }
      return '';
    }).join(' ');
  }

  // Calculate complexity score based on content analysis
  calculateComplexityScore(content) {
    let score = 0;
    
    // Length factor
    if (content.length > 1000) score += 0.2;
    if (content.length > 3000) score += 0.2;
    
    // Technical terms
    const technicalTerms = ['algorithm', 'architecture', 'implementation', 'optimization', 'analysis', 'framework', 'methodology'];
    const foundTerms = technicalTerms.filter(term => content.toLowerCase().includes(term));
    score += foundTerms.length * 0.1;
    
    // Question complexity
    const questionMarks = (content.match(/\?/g) || []).length;
    if (questionMarks > 3) score += 0.2;
    
    // Code patterns
    const codePatterns = ['{', '}', 'function', 'class', 'import', 'const', 'let', 'var'];
    const foundPatterns = codePatterns.filter(pattern => content.includes(pattern));
    score += foundPatterns.length * 0.05;
    
    return Math.min(score, 1.0);
  }

  // Check if request is code-related
  isCodeRelated(content) {
    const codeKeywords = [
      'function', 'class', 'import', 'export', 'const', 'let', 'var',
      'if (', 'for (', 'while (', 'switch (', 'try {', 'catch (',
      'async function', 'await ', 'promise', 'callback',
      'json', 'api', 'endpoint', 'database', 'sql',
      'react', 'node', 'javascript', 'python', 'java', 'go', 'rust'
    ];
    
    const contentLower = content.toLowerCase();
    return codeKeywords.some(keyword => contentLower.includes(keyword));
  }

  // Determine which provider to use with smart routing
  determineProvider(messages, options = {}) {
    // Check if this needs Claude specialization
    const specialization = this.needsClaudeSpecialization(messages, options);
    
    if (specialization.needed) {
      // Check if Claude is available and has credits
      if (!this.providerStatus.anthropic.outOfCredits && this.providerStatus.anthropic.available) {
        logger.info('🍌 Using Claude for specialized task', {
          reason: specialization.reason,
          hasCredits: !this.providerStatus.anthropic.outOfCredits
        });
        return { provider: 'anthropic', reason: specialization.reason };
      } else {
        logger.warn('🍌 Specialized task needs Claude but not available, using Ollama', {
          reason: specialization.reason,
          outOfCredits: this.providerStatus.anthropic.outOfCredits,
          available: this.providerStatus.anthropic.available
        });
        return { provider: 'ollama', reason: 'claude_unavailable_fallback' };
      }
    }
    
    // Default routing logic - prefer Ollama for standard tasks
    if (this.primaryProvider === 'ollama' && this.providerStatus.ollama.available) {
      return { provider: 'ollama', reason: 'primary_provider' };
    }
    
    // Fallback to available provider
    if (this.providerStatus.ollama.available) {
      return { provider: 'ollama', reason: 'ollama_available' };
    }
    
    if (this.providerStatus.anthropic.available && !this.providerStatus.anthropic.outOfCredits) {
      return { provider: 'anthropic', reason: 'anthropic_fallback' };
    }
    
    // Last resort
    return { provider: 'ollama', reason: 'last_resort' };
  }

  // Update provider statistics
  updateProviderStats(provider, success, responseTime) {
    if (success) {
      this.providerStatus[provider].lastSuccessfulCall = Date.now();
      this.providerStatus[provider].failureCount = 0;
      
      // Update average response time
      const currentAvg = this.stats.avgResponseTimes[provider];
      const requests = provider === 'anthropic' ? this.stats.anthropicRequests : this.stats.ollamaRequests;
      this.stats.avgResponseTimes[provider] = ((currentAvg * (requests - 1)) + responseTime) / requests;
      
    } else {
      this.providerStatus[provider].lastFailure = Date.now();
      this.providerStatus[provider].failureCount++;
      
      // Track errors by provider
      const errorCount = this.stats.errorsByProvider.get(provider) || 0;
      this.stats.errorsByProvider.set(provider, errorCount + 1);
    }
  }

  // Get available models from Ollama
  async getOllamaModels() {
    try {
      const response = await axios.get(`${this.ollamaBaseUrl}/api/tags`, {
        timeout: 5000
      });
      
      return response.data.models || [];
    } catch (error) {
      logger.error('Failed to get Ollama models', { error: error.message });
      return [];
    }
  }

  // Test provider connectivity
  async testProviders() {
    const results = {
      anthropic: { available: false, error: null, responseTime: 0 },
      ollama: { available: false, error: null, responseTime: 0, models: [] }
    };
    
    // Test Anthropic
    if (this.anthropicApiKey) {
      try {
        const startTime = performance.now();
        await this.callAnthropic([{
          role: 'user',
          content: 'Hello, just testing connectivity.'
        }], { max_tokens: 10 });
        
        results.anthropic.available = true;
        results.anthropic.responseTime = performance.now() - startTime;
      } catch (error) {
        results.anthropic.error = error.message;
        if (this.isCreditExhaustedError(error)) {
          results.anthropic.creditExhausted = true;
        }
      }
    }
    
    // Test Ollama
    try {
      const startTime = performance.now();
      const models = await this.getOllamaModels();
      
      if (models.length > 0) {
        // Try a simple generation
        await this.callOllama([{
          role: 'user',
          content: 'Hello'
        }], { max_tokens: 10 });
        
        results.ollama.available = true;
        results.ollama.models = models;
        results.ollama.responseTime = performance.now() - startTime;
      }
    } catch (error) {
      results.ollama.error = error.message;
    }
    
    return results;
  }

  // Get comprehensive statistics
  getStats() {
    const totalProviderRequests = this.stats.anthropicRequests + this.stats.ollamaRequests;
    const anthropicUsage = totalProviderRequests > 0 ? 
      (this.stats.anthropicRequests / totalProviderRequests * 100).toFixed(1) : '0';
    const ollamaUsage = totalProviderRequests > 0 ? 
      (this.stats.ollamaRequests / totalProviderRequests * 100).toFixed(1) : '0';
    
    const specializationRate = this.stats.totalRequests > 0 ? 
      (this.stats.specializedTasksToAnthropic / this.stats.totalRequests * 100).toFixed(1) : '0';
    
    return {
      ...this.stats,
      primaryProvider: this.primaryProvider,
      anthropicUsagePercent: anthropicUsage + '%',
      ollamaUsagePercent: ollamaUsage + '%',
      specializationRate: specializationRate + '%',
      costSavings: {
        ...this.stats.costSavings,
        estimatedClaudeCostSaved: '$' + this.stats.costSavings.estimatedClaudeCostSaved.toFixed(4),
        savingsRate: ollamaUsage + '%'
      },
      avgResponseTimes: {
        anthropic: this.stats.avgResponseTimes.anthropic.toFixed(2) + 'ms',
        ollama: this.stats.avgResponseTimes.ollama.toFixed(2) + 'ms'
      },
      providerStatus: {
        anthropic: {
          ...this.providerStatus.anthropic,
          lastSuccessfulCall: this.providerStatus.anthropic.lastSuccessfulCall ? 
            new Date(this.providerStatus.anthropic.lastSuccessfulCall).toISOString() : null,
          lastFailure: this.providerStatus.anthropic.lastFailure ? 
            new Date(this.providerStatus.anthropic.lastFailure).toISOString() : null
        },
        ollama: {
          ...this.providerStatus.ollama,
          lastSuccessfulCall: this.providerStatus.ollama.lastSuccessfulCall ? 
            new Date(this.providerStatus.ollama.lastSuccessfulCall).toISOString() : null,
          lastFailure: this.providerStatus.ollama.lastFailure ? 
            new Date(this.providerStatus.ollama.lastFailure).toISOString() : null,
          modelCount: this.providerStatus.ollama.models.length,
          availableModels: this.providerStatus.ollama.models.map(m => m.name)
        }
      },
      errorsByProvider: Array.from(this.stats.errorsByProvider.entries()).map(([provider, count]) => ({
        provider,
        errorCount: count
      })),
      specializedTasks: this.claudeSpecializedTasks,
      triggerKeywords: this.claudeTriggerKeywords
    };
  }

  // Force refresh Ollama connection
  async refreshOllamaConnection() {
    logger.info('🍌 Refreshing Ollama connection');
    await this.initializeOllama();
    return this.providerStatus.ollama.available;
  }

  // Reset credit exhaustion flag (for when credits are refilled)
  resetCreditExhaustion() {
    this.providerStatus.anthropic.outOfCredits = false;
    this.stats.creditsExhausted = false;
    this.stats.lastCreditCheck = Date.now();
    
    logger.info('🍌 Anthropic credit exhaustion flag reset');
  }

  // Clear all statistics
  clearStats() {
    this.stats = {
      totalRequests: 0,
      anthropicRequests: 0,
      ollamaRequests: 0,
      fallbackTriggers: 0,
      errorsByProvider: new Map(),
      avgResponseTimes: {
        anthropic: 0,
        ollama: 0
      },
      creditsExhausted: false,
      lastCreditCheck: null
    };
    
    logger.info('🍌 AI Fallback statistics cleared');
  }
}

module.exports = AIFallbackHandler;