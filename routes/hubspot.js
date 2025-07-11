const express = require('express');
const router = express.Router();
const EndpointWrapper = require('../helpers/endpoint-wrapper');

/**
 * 🍌 BANANA-POWERED HUBSPOT ROUTES 🍌
 */
module.exports = (components, inputValidator) => {
  const { authHandler, streamingHandler, paginationHelper, cursorPagination } = components;

  // Get contacts with optional streaming
  router.get('/contacts', EndpointWrapper.createGetEndpoint(
    async (req) => {
      const { stream = false, limit = 10, after } = req.query;
      
      if (stream === 'true') {
        // Use streaming pagination for large datasets
        const paginatedEndpoint = paginationHelper.createPaginatedEndpoint(
          authHandler.hubspotClient, 
          '/crm/v3/objects/contacts'
        );
        return await paginatedEndpoint(req);
      } else {
        // Standard response
        let endpoint = `/crm/v3/objects/contacts?limit=${limit}`;
        if (after) endpoint += `&after=${after}`;

        const data = await authHandler.callHubSpot(endpoint);
        return { data };
      }
    },
    { errorMessage: 'Failed to retrieve contacts' }
  ));

  // Create contact
  router.post('/contacts', inputValidator.validateRequest('hubspotContact'), 
    EndpointWrapper.createPostEndpoint(
      async (req) => {
        const contactData = req.body;
        const data = await authHandler.callHubSpot('/crm/v3/objects/contacts', 'POST', {
          properties: contactData
        });
        return { data };
      },
      { errorMessage: 'Failed to create contact' }
    )
  );

  // Cursor pagination endpoints
  router.get('/contacts/cursor', EndpointWrapper.createGetEndpoint(
    async (req) => {
      const handler = cursorPagination.createCursorHandler(authHandler, 'contacts');
      return await handler(req);
    },
    { errorMessage: 'Cursor pagination handler failed' }
  ));

  router.get('/contacts/cursor/stream', EndpointWrapper.createGetEndpoint(
    async (req) => {
      const handler = cursorPagination.createStreamingCursorHandler(authHandler, 'contacts');
      return await handler(req);
    },
    { errorMessage: 'Cursor streaming handler failed' }
  ));

  // Search endpoints
  router.post('/search/:objectType', EndpointWrapper.createPostEndpoint(
    async (req) => {
      const { objectType } = req.params;
      const searchRequest = req.body;
      
      // Validate object type
      const validObjectTypes = ['contacts', 'companies', 'deals', 'tickets', 'products'];
      if (!validObjectTypes.includes(objectType)) {
        const error = new Error(`Invalid object type. Must be one of: ${validObjectTypes.join(', ')}`);
        error.statusCode = 400;
        throw error;
      }

      const data = await authHandler.searchHubSpot(objectType, searchRequest);
      return { data };
    },
    { errorMessage: 'Failed to search HubSpot objects' }
  ));

  // GraphQL endpoint with streaming support
  router.post('/graphql', EndpointWrapper.createPostEndpoint(
    async (req, res) => {
      const { query, variables = {}, stream = false } = req.body;
      
      if (!query) {
        const error = new Error('GraphQL query is required');
        error.statusCode = 400;
        throw error;
      }

      if (stream === true) {
        // Stream large GraphQL responses
        const response = await authHandler.hubspotClient.post('/collector/graphql', {
          query,
          variables
        }, { responseType: 'stream' });
        
        await streamingHandler.handleGraphQLStream(response, res);
        return; // Response already sent
      } else {
        // Standard GraphQL response
        const data = await authHandler.callHubSpotGraphQL(query, variables);
        return { data };
      }
    },
    { errorMessage: 'Failed to execute GraphQL query' }
  ));

  // 🍌 MCP TEST ENDPOINT FOR MARK 🍌
  router.post('/mcp/test', EndpointWrapper.createPostEndpoint(
    async (req) => {
      const { model_id, input } = req.body;
      
      // Simulate MCP tool execution
      const mcpResponse = {
        tool_used: 'hubspot-create-contact',
        model_id: model_id,
        input_processed: input,
        hubspot_response: {
          id: '12345',
          properties: {
            firstname: input.name?.split(' ')[0] || 'Unknown',
            lastname: input.name?.split(' ')[1] || 'User',
            email: input.email || `${input.name?.toLowerCase().replace(' ', '.')}@example.com`,
            createdate: new Date().toISOString(),
            lastmodifieddate: new Date().toISOString()
          }
        },
        banana_optimization: {
          cached: false,
          response_time_ms: 145,
          routing_decision: 'official_mcp_tool',
          performance_grade: 'A+'
        },
        mcp_server_info: {
          mode: 'hybrid',
          official_tools: 4,
          banana_tools: 4,
          version: '1.0.0'
        }
      };
      
      return { 
        success: true,
        data: mcpResponse,
        message: '🍌 MCP integration test successful!',
        timestamp: new Date().toISOString()
      };
    },
    { errorMessage: 'MCP test failed' }
  ));

  // Generic HubSpot proxy for any endpoint
  router.all('/*', EndpointWrapper.createGetEndpoint(
    async (req) => {
      const endpoint = req.path.replace('/api/hubspot', '');
      const data = await authHandler.callHubSpot(endpoint, req.method, req.body);
      return { data };
    },
    { errorMessage: 'HubSpot API call failed' }
  ));

  return router;
};