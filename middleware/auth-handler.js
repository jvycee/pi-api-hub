const axios = require('axios');
const config = require('../shared/config');
const logger = require('../shared/logger');

class AuthHandler {
  constructor() {
    this.hubspotClient = this.createHubSpotClient();
    this.anthropicClient = this.createAnthropicClient();
  }

  createHubSpotClient() {
    return axios.create({
      baseURL: config.apis.hubspot.baseUrl,
      timeout: config.apis.hubspot.timeout,
      headers: {
        'Authorization': `Bearer ${config.apis.hubspot.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  createAnthropicClient() {
    return axios.create({
      baseURL: config.apis.anthropic.baseUrl,
      timeout: config.apis.anthropic.timeout,
      headers: {
        'x-api-key': config.apis.anthropic.apiKey,
        'content-type': 'application/json',
        'anthropic-version': config.apis.anthropic.version
      }
    });
  }

  // HubSpot API calls
  async callHubSpot(endpoint, method = 'GET', data = null) {
    try {
      logger.info(`Making HubSpot ${method} request to ${endpoint}`);
      
      const response = await this.hubspotClient({
        method,
        url: endpoint,
        data
      });

      logger.info(`HubSpot request successful: ${response.status}`);
      return response.data;
    } catch (error) {
      logger.error('HubSpot API Error:', {
        endpoint,
        method,
        status: error.response?.status,
        message: error.response?.data?.message || error.message
      });
      throw error;
    }
  }

  // Anthropic API calls
  async callAnthropic(data) {
    try {
      logger.info('Making Anthropic API request');
      
      const response = await this.anthropicClient.post('/v1/messages', data);

      logger.info(`Anthropic request successful: ${response.status}`);
      return response.data;
    } catch (error) {
      logger.error('Anthropic API Error:', {
        status: error.response?.status,
        message: error.response?.data?.error?.message || error.message
      });
      throw error;
    }
  }

  // HubSpot GraphQL calls
  async callHubSpotGraphQL(query, variables = {}) {
    try {
      logger.info('Making HubSpot GraphQL request');
      
      const response = await this.hubspotClient.post('/collector/graphql', {
        query,
        variables
      });

      logger.info(`HubSpot GraphQL request successful: ${response.status}`);
      return response.data;
    } catch (error) {
      logger.error('HubSpot GraphQL API Error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        errors: error.response?.data?.errors
      });
      throw error;
    }
  }

  // Test API connections
  async testConnections() {
    const results = {};

    // Test HubSpot
    try {
      await this.callHubSpot('/crm/v3/objects/contacts?limit=1');
      results.hubspot = { status: 'connected', error: null };
      logger.info('HubSpot connection test: SUCCESS');
    } catch (error) {
      results.hubspot = { 
        status: 'error', 
        error: error.response?.data?.message || error.message 
      };
      logger.error('HubSpot connection test: FAILED');
    }

    // Test HubSpot GraphQL
    try {
      const testQuery = `
        query {
          CRM {
            contact_collection(limit: 1) {
              items {
                id
                properties {
                  email
                  firstname
                  lastname
                }
              }
            }
          }
        }
      `;
      await this.callHubSpotGraphQL(testQuery);
      results.hubspotGraphQL = { status: 'connected', error: null };
      logger.info('HubSpot GraphQL connection test: SUCCESS');
    } catch (error) {
      results.hubspotGraphQL = { 
        status: 'error', 
        error: error.response?.data?.errors?.[0]?.message || error.message 
      };
      logger.error('HubSpot GraphQL connection test: FAILED');
    }
    try {
      await this.callAnthropic({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hello' }]
      });
      results.anthropic = { status: 'connected', error: null };
      logger.info('Anthropic connection test: SUCCESS');
    } catch (error) {
      results.anthropic = { 
        status: 'error', 
        error: error.response?.data?.error?.message || error.message 
      };
      logger.error('Anthropic connection test: FAILED');
    }

    return results;
  }
}

module.exports = AuthHandler;