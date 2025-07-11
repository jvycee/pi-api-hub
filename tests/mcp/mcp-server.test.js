const HybridMCPServer = require('../../mcp-server/hybrid-server');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const axios = require('axios');
const logger = require('../../shared/logger');

// Mock dependencies
jest.mock('axios');
jest.mock('../../shared/logger');
jest.mock('@modelcontextprotocol/sdk/server/index.js');
jest.mock('@modelcontextprotocol/sdk/server/stdio.js');

/**
 * 🍌 BANANA-POWERED MCP SERVER TEST SUITE 🍌
 */
describe('🍌 Hybrid MCP Server Tests', () => {
  let mcpServer;
  let mockServer;
  let mockAxios;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock server instance
    mockServer = {
      setRequestHandler: jest.fn(),
      connect: jest.fn().mockResolvedValue(undefined)
    };
    
    Server.mockImplementation(() => mockServer);
    mockAxios = axios;
    
    // Set environment variables for testing
    process.env.BANANA_API_KEY = 'test-banana-key';
    process.env.PRIVATE_APP_ACCESS_TOKEN = 'test-hubspot-token';
    process.env.BANANA_SERVER_PORT = '3000';
    process.env.MCP_MODE = 'hybrid';
    
    mcpServer = new HybridMCPServer();
  });

  afterEach(() => {
    // Clean up environment variables
    delete process.env.BANANA_API_KEY;
    delete process.env.PRIVATE_APP_ACCESS_TOKEN;
    delete process.env.BANANA_SERVER_PORT;
    delete process.env.MCP_MODE;
  });

  describe('🚀 Server Initialization', () => {
    test('should initialize with correct configuration', () => {
      expect(Server).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'hubspot-banana-hybrid',
          version: '1.0.0',
          description: 'Hybrid MCP server combining official HubSpot tools with banana-powered optimizations'
        }),
        expect.objectContaining({
          capabilities: {
            resources: {},
            tools: {}
          }
        })
      );
    });

    test('should set correct API base URL', () => {
      expect(mcpServer.apiBaseUrl).toBe('http://localhost:3000');
    });

    test('should set correct mode', () => {
      expect(mcpServer.mode).toBe('hybrid');
    });

    test('should setup request handlers', () => {
      expect(mockServer.setRequestHandler).toHaveBeenCalledTimes(4);
    });
  });

  describe('🔧 Tool Loading', () => {
    test('should load official tools correctly', async () => {
      const tools = await mcpServer.loadOfficialTools();
      
      expect(tools).toHaveLength(4);
      expect(tools[0]).toMatchObject({
        name: 'hubspot-get-user-details',
        description: 'Get authenticated user details and hub information',
        source: 'official'
      });
    });

    test('should load banana tools correctly', async () => {
      const tools = await mcpServer.loadBananaTools();
      
      expect(tools).toHaveLength(4);
      expect(tools[0]).toMatchObject({
        name: 'banana-get-contacts-cached',
        description: 'Get contacts with intelligent caching (3min TTL)',
        source: 'banana'
      });
    });

    test('should initialize tools based on mode', async () => {
      await mcpServer.initializeTools();
      
      expect(mcpServer.officialTools).toHaveLength(4);
      expect(mcpServer.bananaTools).toHaveLength(4);
      expect(logger.info).toHaveBeenCalledWith(
        '🍌 Hybrid MCP Server initialized with 4 official tools and 4 banana tools'
      );
    });
  });

  describe('🛠️ Tool Execution', () => {
    beforeEach(async () => {
      await mcpServer.initializeTools();
    });

    test('should handle official tool calls', async () => {
      const mockResponse = {
        data: { contacts: [{ id: '1', name: 'Test Contact' }] }
      };
      mockAxios.mockResolvedValue(mockResponse);

      const result = await mcpServer.handleOfficialTool('hubspot-list-objects', {
        objectType: 'contacts',
        limit: 10
      });

      expect(mockAxios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://localhost:3000/api/hubspot/contacts',
        data: undefined,
        headers: {
          'Authorization': 'Bearer test-hubspot-token',
          'Content-Type': 'application/json'
        }
      });

      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(mockResponse.data);
    });

    test('should handle banana tool calls', async () => {
      const mockResponse = {
        data: { contacts: [{ id: '1', name: 'Cached Contact' }] }
      };
      mockAxios.mockResolvedValue(mockResponse);

      const result = await mcpServer.handleBananaTool('banana-get-contacts-cached', {
        limit: 10,
        useCache: true
      });

      expect(mockAxios).toHaveBeenCalledWith({
        method: 'GET',
        url: 'http://localhost:3000/api/hubspot/contacts',
        params: { limit: 10, useCache: true },
        data: undefined,
        headers: {
          'x-api-key': 'test-banana-key',
          'Content-Type': 'application/json'
        }
      });

      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toEqual(mockResponse.data);
    });

    test('should handle tool errors gracefully', async () => {
      const mockError = new Error('API call failed');
      mockAxios.mockRejectedValue(mockError);

      await expect(
        mcpServer.handleOfficialTool('hubspot-list-objects', { objectType: 'contacts' })
      ).rejects.toThrow('API call failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Official tool hubspot-list-objects failed:',
        mockError
      );
    });
  });

  describe('🔄 Tool Transformation', () => {
    test('should transform official tool calls to API calls', () => {
      const apiCall = mcpServer.transformToolToApiCall('hubspot-list-objects', {
        objectType: 'contacts',
        limit: 10,
        after: 'cursor123'
      });

      expect(apiCall).toEqual({
        method: 'GET',
        path: '/api/hubspot/contacts',
        params: { limit: 10, after: 'cursor123' }
      });
    });

    test('should transform banana tool calls to API calls', () => {
      const apiCall = mcpServer.transformBananaToolToApiCall('banana-get-contacts-cached', {
        limit: 50,
        useCache: true
      });

      expect(apiCall).toEqual({
        method: 'GET',
        path: '/api/hubspot/contacts',
        params: { limit: 50, useCache: true }
      });
    });

    test('should handle unknown tool transformations', () => {
      const apiCall = mcpServer.transformToolToApiCall('unknown-tool', { test: 'data' });

      expect(apiCall).toEqual({
        method: 'GET',
        path: '/api/hubspot/contacts',
        params: { test: 'data' }
      });
    });
  });

  describe('📊 Analytics and Health', () => {
    test('should get banana analytics', async () => {
      const mockAnalytics = {
        requests: 100,
        cacheHitRate: 0.85,
        averageResponseTime: 145
      };
      mockAxios.mockResolvedValue({ data: mockAnalytics });

      const result = await mcpServer.getBananaAnalytics();

      expect(mockAxios).toHaveBeenCalledWith(
        'http://localhost:3000/monitoring/analytics',
        { headers: { 'x-api-key': 'test-banana-key' } }
      );
      expect(result).toEqual(mockAnalytics);
    });

    test('should get system health', async () => {
      const mockHealth = {
        status: 'healthy',
        uptime: 3600,
        memoryUsage: '45%'
      };
      mockAxios.mockResolvedValue({ data: mockHealth });

      const result = await mcpServer.getSystemHealth();

      expect(mockAxios).toHaveBeenCalledWith(
        'http://localhost:3000/health',
        { headers: { 'x-api-key': 'test-banana-key' } }
      );
      expect(result).toEqual(mockHealth);
    });

    test('should handle analytics errors gracefully', async () => {
      const mockError = new Error('Analytics service unavailable');
      mockAxios.mockRejectedValue(mockError);

      const result = await mcpServer.getBananaAnalytics();

      expect(result).toEqual({ error: 'Analytics service unavailable' });
    });
  });

  describe('🚀 Server Startup', () => {
    test('should start successfully', async () => {
      const mockTransport = { connect: jest.fn() };
      
      await mcpServer.start();

      expect(mockServer.connect).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('🍌 Hybrid MCP Server started successfully');
      expect(logger.info).toHaveBeenCalledWith('Mode: hybrid');
      expect(logger.info).toHaveBeenCalledWith('Official tools: 4');
      expect(logger.info).toHaveBeenCalledWith('Banana tools: 4');
    });

    test('should handle startup errors', async () => {
      const mockError = new Error('Failed to connect transport');
      mockServer.connect.mockRejectedValue(mockError);

      await expect(mcpServer.start()).rejects.toThrow('Failed to connect transport');
      expect(logger.error).toHaveBeenCalledWith('Failed to start Hybrid MCP Server:', mockError);
    });
  });

  describe('🎯 Integration Tests', () => {
    test('should handle complete tool execution workflow', async () => {
      const mockResponse = {
        data: {
          results: [
            { id: '1', properties: { firstname: 'John', lastname: 'Doe' } },
            { id: '2', properties: { firstname: 'Jane', lastname: 'Smith' } }
          ]
        }
      };
      mockAxios.mockResolvedValue(mockResponse);

      await mcpServer.initializeTools();
      
      // Test official tool
      const officialResult = await mcpServer.handleOfficialTool('hubspot-list-objects', {
        objectType: 'contacts',
        limit: 2
      });

      expect(officialResult.content[0].type).toBe('text');
      const officialData = JSON.parse(officialResult.content[0].text);
      expect(officialData.results).toHaveLength(2);

      // Test banana tool
      const bananaResult = await mcpServer.handleBananaTool('banana-get-contacts-cached', {
        limit: 2,
        useCache: true
      });

      expect(bananaResult.content[0].type).toBe('text');
      const bananaData = JSON.parse(bananaResult.content[0].text);
      expect(bananaData.results).toHaveLength(2);
    });

    test('should handle different modes correctly', async () => {
      // Test official-only mode
      process.env.MCP_MODE = 'official';
      const officialServer = new HybridMCPServer();
      await officialServer.initializeTools();
      
      expect(officialServer.officialTools).toHaveLength(4);
      expect(officialServer.bananaTools).toHaveLength(0);

      // Test banana-only mode
      process.env.MCP_MODE = 'banana';
      const bananaServer = new HybridMCPServer();
      await bananaServer.initializeTools();
      
      expect(bananaServer.officialTools).toHaveLength(0);
      expect(bananaServer.bananaTools).toHaveLength(4);
    });
  });

  describe('🔍 Error Handling', () => {
    test('should handle network errors', async () => {
      const networkError = new Error('Network timeout');
      networkError.code = 'ECONNABORTED';
      mockAxios.mockRejectedValue(networkError);

      await expect(
        mcpServer.handleBananaTool('banana-get-contacts-cached', { limit: 10 })
      ).rejects.toThrow('Network timeout');
    });

    test('should handle API errors', async () => {
      const apiError = new Error('Request failed with status code 429');
      apiError.response = {
        status: 429,
        data: { error: 'Rate limit exceeded' }
      };
      mockAxios.mockRejectedValue(apiError);

      await expect(
        mcpServer.handleOfficialTool('hubspot-list-objects', { objectType: 'contacts' })
      ).rejects.toThrow('Request failed with status code 429');
    });

    test('should handle malformed responses', async () => {
      mockAxios.mockResolvedValue({ data: null });

      const result = await mcpServer.handleBananaTool('banana-get-contacts-cached', { limit: 10 });
      
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('null');
    });
  });
});