const EndpointWrapper = require('../helpers/endpoint-wrapper');

/**
 * 🍌 BANANA-POWERED AI CONTROLLER 🍌
 * 
 * Handles all AI routing and management endpoints
 */
class AIController {
  constructor(aiHandler) {
    this.aiHandler = aiHandler;
  }

  getStats = EndpointWrapper.createGetEndpoint(
    () => this.aiHandler.getStats(),
    { errorMessage: 'Failed to get AI routing statistics' }
  );

  testProviders = EndpointWrapper.createAdminEndpoint(
    () => this.aiHandler.testProviders(),
    { errorMessage: 'Failed to test AI providers' }
  );

  refreshOllama = EndpointWrapper.createAdminEndpoint(
    async () => {
      const success = await this.aiHandler.refreshOllamaConnection();
      return {
        ollamaAvailable: success,
        message: success ? 'Ollama connection refreshed successfully' : 'Ollama connection failed'
      };
    },
    { errorMessage: 'Failed to refresh Ollama connection' }
  );

  resetCredits = EndpointWrapper.createAdminEndpoint(
    () => { 
      this.aiHandler.resetCreditExhaustion(); 
      return { message: 'Credit exhaustion flag reset successfully' };
    },
    { errorMessage: 'Failed to reset credit exhaustion' }
  );

  clearStats = EndpointWrapper.createAdminEndpoint(
    () => { 
      this.aiHandler.clearStats(); 
      return { message: 'AI statistics cleared successfully' };
    },
    { errorMessage: 'Failed to clear AI statistics' }
  );

  getModels = EndpointWrapper.createGetEndpoint(
    async () => {
      const models = await this.aiHandler.getOllamaModels();
      return {
        models,
        modelCount: models.length,
        defaultModel: this.aiHandler.defaultModel
      };
    },
    { errorMessage: 'Failed to get Ollama models' }
  );

  // Main AI endpoint
  processMessages = EndpointWrapper.createGetEndpoint(
    async (req) => {
      const { model = 'claude-3-haiku-20240307', max_tokens = 1000, messages, taskType, forceClaude } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        const error = new Error('Messages array is required');
        error.statusCode = 400;
        throw error;
      }

      const aiResponse = await this.aiHandler.processAIRequest(messages, {
        model,
        max_tokens,
        taskType,
        forceClaude
      });

      return {
        data: aiResponse.response,
        metadata: {
          provider: aiResponse.provider,
          routingReason: aiResponse.routingReason,
          responseTime: aiResponse.responseTime,
          fallbackUsed: aiResponse.fallbackUsed || false,
          costSavingMode: aiResponse.costSavingMode || false
        }
      };
    },
    { errorMessage: 'Failed to process AI request' }
  );
}

module.exports = AIController;