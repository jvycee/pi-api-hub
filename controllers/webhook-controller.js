const EndpointWrapper = require('../helpers/endpoint-wrapper');

/**
 * 🍌 BANANA-POWERED WEBHOOK CONTROLLER 🍌
 * 
 * Handles all webhook management endpoints
 */
class WebhookController {
  constructor(webhookHandler) {
    this.webhookHandler = webhookHandler;
  }

  getStats = EndpointWrapper.createGetEndpoint(
    () => this.webhookHandler.getStats(),
    { errorMessage: 'Failed to get webhook statistics' }
  );

  getHandlers = EndpointWrapper.createGetEndpoint(
    () => this.webhookHandler.getHandlers(),
    { errorMessage: 'Failed to get webhook handlers' }
  );

  clearStats = EndpointWrapper.createAdminEndpoint(
    () => { 
      this.webhookHandler.clearStats(); 
      return { message: 'Webhook statistics cleared successfully' };
    },
    { errorMessage: 'Failed to clear webhook statistics' }
  );

  getConfig = EndpointWrapper.createGetEndpoint(
    (req) => {
      const config = this.webhookHandler.validateConfig();
      const webhookUrl = this.webhookHandler.getWebhookUrl(`${req.protocol}://${req.get('host')}`);
      
      return {
        webhookUrl,
        validation: config,
        settings: {
          validateSignature: this.webhookHandler.validateSignature,
          enableLogging: this.webhookHandler.enableLogging,
          enableAnalytics: this.webhookHandler.enableAnalytics,
          maxBodySize: this.webhookHandler.maxBodySize,
          retryAttempts: this.webhookHandler.retryAttempts
        }
      };
    },
    { errorMessage: 'Failed to get webhook configuration' }
  );
}

module.exports = WebhookController;