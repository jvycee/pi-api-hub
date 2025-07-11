const request = require('supertest');
const app = require('../../app');
const HybridMCPServer = require('../../mcp-server/hybrid-server');
const MCPClientConfig = require('../../helpers/mcp-client-config');

/**
 * 🍌 BANANA-POWERED MCP INTEGRATION TEST SUITE 🍌
 * 
 * Tests the complete MCP integration workflow including:
 * - API endpoints for MCP management
 * - Server startup and tool execution
 * - Client configuration management
 * - End-to-end MCP workflows
 */
describe('🍌 MCP Integration Tests', () => {
  let server;
  let adminApiKey;

  beforeAll(async () => {
    // Start server
    server = app.listen(3001);
    
    // Get admin API key for testing
    const response = await request(app)
      .get('/setup/admin-key')
      .expect(200);
    
    adminApiKey = response.body.adminKey;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('🔌 MCP Monitoring Endpoints', () => {
    test('GET /monitoring/mcp/status should return MCP status', async () => {
      const response = await request(app)
        .get('/monitoring/mcp/status')
        .set('X-API-Key', adminApiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('claude_desktop');
      expect(response.body.data).toHaveProperty('cursor');
    });

    test('GET /monitoring/mcp/tools should return available tools', async () => {
      const response = await request(app)
        .get('/monitoring/mcp/tools')
        .set('X-API-Key', adminApiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('official');
      expect(response.body.data).toHaveProperty('banana');
      expect(response.body.data).toHaveProperty('routing');
    });

    test('GET /monitoring/mcp/instructions should return setup instructions', async () => {
      const response = await request(app)
        .get('/monitoring/mcp/instructions')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('claude_desktop');
      expect(response.body.data).toHaveProperty('cursor');
      expect(response.body.data).toHaveProperty('environment');
    });

    test('POST /monitoring/mcp/setup/:client should configure MCP client', async () => {
      const response = await request(app)
        .post('/monitoring/mcp/setup/claude_desktop')
        .set('X-API-Key', adminApiKey)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('MCP configuration updated');
      expect(response.body.config).toHaveProperty('mcpServers');
    });

    test('should require admin authentication for MCP endpoints', async () => {
      await request(app)
        .get('/monitoring/mcp/status')
        .expect(401);

      await request(app)
        .post('/monitoring/mcp/setup/claude_desktop')
        .expect(401);
    });
  });

  describe('🧪 MCP Test Endpoint', () => {
    test('POST /api/hubspot/mcp/test should simulate MCP tool execution', async () => {
      const testData = {
        model_id: 'llama3.2:latest',
        input: {
          name: 'John Doe',
          email: 'john.doe@example.com'
        }
      };

      const response = await request(app)
        .post('/api/hubspot/mcp/test')
        .set('X-API-Key', adminApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tool_used', 'hubspot-create-contact');
      expect(response.body.data).toHaveProperty('model_id', 'llama3.2:latest');
      expect(response.body.data).toHaveProperty('hubspot_response');
      expect(response.body.data).toHaveProperty('banana_optimization');
      expect(response.body.data).toHaveProperty('mcp_server_info');
    });

    test('should handle MCP test with different inputs', async () => {
      const testData = {
        model_id: 'claude-3-5-sonnet-20241022',
        input: {
          name: 'Jane Smith',
          email: 'jane.smith@company.com',
          company: 'Acme Corp'
        }
      };

      const response = await request(app)
        .post('/api/hubspot/mcp/test')
        .set('X-API-Key', adminApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.data.model_id).toBe('claude-3-5-sonnet-20241022');
      expect(response.body.data.hubspot_response.properties.firstname).toBe('Jane');
      expect(response.body.data.hubspot_response.properties.lastname).toBe('Smith');
    });

    test('should handle MCP test without email', async () => {
      const testData = {
        model_id: 'llama3.2:latest',
        input: {
          name: 'Bob Johnson'
        }
      };

      const response = await request(app)
        .post('/api/hubspot/mcp/test')
        .set('X-API-Key', adminApiKey)
        .send(testData)
        .expect(200);

      expect(response.body.data.hubspot_response.properties.email).toBe('bob.johnson@example.com');
    });
  });

  describe('🔧 MCP Server Integration', () => {
    let mcpServer;

    beforeEach(() => {
      // Mock environment variables for MCP server
      process.env.BANANA_API_KEY = adminApiKey;
      process.env.PRIVATE_APP_ACCESS_TOKEN = 'test-hubspot-token';
      process.env.BANANA_SERVER_PORT = '3001';
      process.env.MCP_MODE = 'hybrid';
    });

    afterEach(() => {
      if (mcpServer) {
        delete process.env.BANANA_API_KEY;
        delete process.env.PRIVATE_APP_ACCESS_TOKEN;
        delete process.env.BANANA_SERVER_PORT;
        delete process.env.MCP_MODE;
      }
    });

    test('should initialize MCP server with correct configuration', async () => {
      mcpServer = new HybridMCPServer();
      
      expect(mcpServer.mode).toBe('hybrid');
      expect(mcpServer.apiBaseUrl).toBe('http://localhost:3001');
      
      await mcpServer.initializeTools();
      
      expect(mcpServer.officialTools).toHaveLength(4);
      expect(mcpServer.bananaTools).toHaveLength(4);
    });

    test('should handle banana tool calls through API', async () => {
      mcpServer = new HybridMCPServer();
      await mcpServer.initializeTools();

      // Mock the API call that would be made by MCP server
      const mockApiCall = request(app)
        .get('/api/hubspot/contacts')
        .set('X-API-Key', adminApiKey)
        .query({ limit: 10, useCache: true });

      // This would normally be called by the MCP server
      const result = await mcpServer.handleBananaTool('banana-get-contacts-cached', {
        limit: 10,
        useCache: true
      });

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
    });

    test('should handle official tool calls through API', async () => {
      mcpServer = new HybridMCPServer();
      await mcpServer.initializeTools();

      const result = await mcpServer.handleOfficialTool('hubspot-list-objects', {
        objectType: 'contacts',
        limit: 5
      });

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
    });
  });

  describe('🎯 Client Configuration Integration', () => {
    let clientConfig;

    beforeEach(() => {
      clientConfig = new MCPClientConfig();
    });

    test('should generate and validate client configurations', async () => {
      const results = await clientConfig.generateAllConfigs();

      expect(results).toHaveProperty('claude_desktop');
      expect(results).toHaveProperty('cursor');
      
      if (results.claude_desktop.success) {
        expect(results.claude_desktop.config).toHaveProperty('mcpServers');
        expect(results.claude_desktop.config.mcpServers).toHaveProperty('hubspot-banana-hybrid');
      }
    });

    test('should handle configuration merging', async () => {
      const testConfig = {
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['mcp-server/hybrid-server.js']
          }
        }
      };

      const mergedConfig = await clientConfig.mergeConfig('claude_desktop', testConfig);
      
      expect(mergedConfig).toHaveProperty('mcpServers');
      expect(mergedConfig.mcpServers).toHaveProperty('hubspot-banana-hybrid');
    });

    test('should provide setup instructions', () => {
      const instructions = clientConfig.generateSetupInstructions();

      expect(instructions.claude_desktop.steps).toContain('Run: npm run mcp:setup-claude');
      expect(instructions.cursor.steps).toContain('Run: npm run mcp:setup-cursor');
      expect(instructions.environment.template).toContain('HUBSPOT_PRIVATE_APP_TOKEN=');
    });
  });

  describe('📊 MCP Performance Monitoring', () => {
    test('should track MCP tool usage', async () => {
      // Make several MCP test calls
      const testCalls = Array(5).fill(null).map((_, i) => 
        request(app)
          .post('/api/hubspot/mcp/test')
          .set('X-API-Key', adminApiKey)
          .send({
            model_id: 'llama3.2:latest',
            input: { name: `Test User ${i}` }
          })
      );

      await Promise.all(testCalls);

      // Check monitoring metrics
      const metricsResponse = await request(app)
        .get('/monitoring/metrics')
        .set('X-API-Key', adminApiKey)
        .expect(200);

      expect(metricsResponse.body.success).toBe(true);
      expect(metricsResponse.body.data).toHaveProperty('apis');
    });

    test('should monitor MCP server health', async () => {
      const healthResponse = await request(app)
        .get('/monitoring/mcp/status')
        .set('X-API-Key', adminApiKey)
        .expect(200);

      expect(healthResponse.body.success).toBe(true);
      expect(healthResponse.body.data).toHaveProperty('claude_desktop');
      expect(healthResponse.body.data).toHaveProperty('cursor');
    });
  });

  describe('🔄 Error Handling', () => {
    test('should handle MCP server startup errors', async () => {
      // Test with invalid configuration
      process.env.BANANA_API_KEY = 'invalid-key';
      process.env.MCP_MODE = 'hybrid';

      const mcpServer = new HybridMCPServer();
      await mcpServer.initializeTools();

      // This should handle the error gracefully
      await expect(
        mcpServer.handleBananaTool('banana-get-contacts-cached', { limit: 10 })
      ).rejects.toThrow();
    });

    test('should handle client configuration errors', async () => {
      const response = await request(app)
        .post('/monitoring/mcp/setup/invalid_client')
        .set('X-API-Key', adminApiKey)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeTruthy();
    });

    test('should handle MCP test endpoint errors', async () => {
      const response = await request(app)
        .post('/api/hubspot/mcp/test')
        .set('X-API-Key', adminApiKey)
        .send({}) // Empty payload
        .expect(200); // Should still work with defaults

      expect(response.body.success).toBe(true);
      expect(response.body.data.input_processed).toEqual({});
    });
  });

  describe('🎭 End-to-End MCP Workflows', () => {
    test('should handle complete MCP setup workflow', async () => {
      // 1. Get setup instructions
      const instructionsResponse = await request(app)
        .get('/monitoring/mcp/instructions')
        .expect(200);

      expect(instructionsResponse.body.success).toBe(true);

      // 2. Configure Claude Desktop
      const configResponse = await request(app)
        .post('/monitoring/mcp/setup/claude_desktop')
        .set('X-API-Key', adminApiKey)
        .expect(200);

      expect(configResponse.body.success).toBe(true);

      // 3. Check MCP status
      const statusResponse = await request(app)
        .get('/monitoring/mcp/status')
        .set('X-API-Key', adminApiKey)
        .expect(200);

      expect(statusResponse.body.success).toBe(true);

      // 4. Test MCP functionality
      const testResponse = await request(app)
        .post('/api/hubspot/mcp/test')
        .set('X-API-Key', adminApiKey)
        .send({
          model_id: 'llama3.2:latest',
          input: { name: 'Integration Test User' }
        })
        .expect(200);

      expect(testResponse.body.success).toBe(true);
      expect(testResponse.body.data.tool_used).toBe('hubspot-create-contact');
    });

    test('should handle MCP tool routing decisions', async () => {
      const testCases = [
        {
          input: { name: 'Simple Contact' },
          expectedRouting: 'official_mcp_tool'
        },
        {
          input: { name: 'Cached Contact', useCache: true },
          expectedRouting: 'official_mcp_tool'
        },
        {
          input: { name: 'Streaming Contact', stream: true },
          expectedRouting: 'official_mcp_tool'
        }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/hubspot/mcp/test')
          .set('X-API-Key', adminApiKey)
          .send({
            model_id: 'llama3.2:latest',
            input: testCase.input
          })
          .expect(200);

        expect(response.body.data.banana_optimization.routing_decision).toBe(testCase.expectedRouting);
      }
    });

    test('should validate MCP configuration integrity', async () => {
      // Get current tools
      const toolsResponse = await request(app)
        .get('/monitoring/mcp/tools')
        .set('X-API-Key', adminApiKey)
        .expect(200);

      const { official, banana } = toolsResponse.body.data;

      // Validate official tools
      expect(official.oauth).toContain('hubspot-get-user-details');
      expect(official.objects).toContain('hubspot-list-objects');
      expect(official.objects).toContain('hubspot-search-objects');

      // Validate banana tools
      expect(banana.contacts).toContain('get_contacts_cached');
      expect(banana.contacts).toContain('get_contacts_streaming');
      expect(banana.search).toContain('search_cached');
      expect(banana.analytics).toContain('usage_analytics');
    });
  });

  describe('🚀 Performance Tests', () => {
    test('should handle concurrent MCP requests', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array(concurrentRequests).fill(null).map((_, i) =>
        request(app)
          .post('/api/hubspot/mcp/test')
          .set('X-API-Key', adminApiKey)
          .send({
            model_id: 'llama3.2:latest',
            input: { name: `Concurrent User ${i}` }
          })
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
      });

      // Performance should be reasonable (under 10 seconds for 10 requests)
      expect(endTime - startTime).toBeLessThan(10000);
    });

    test('should measure MCP tool execution time', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .post('/api/hubspot/mcp/test')
        .set('X-API-Key', adminApiKey)
        .send({
          model_id: 'llama3.2:latest',
          input: { name: 'Performance Test User' }
        })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(response.body.data.banana_optimization.response_time_ms).toBeLessThan(1000);
      expect(responseTime).toBeLessThan(5000); // Should respond within 5 seconds
    });
  });
});