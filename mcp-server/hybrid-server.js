const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
    CallToolRequestSchema,
    ErrorCode,
    ListResourcesRequestSchema,
    ListToolsRequestSchema,
    McpError,
    ReadResourceRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');
const axios = require('axios');
const logger = require('../shared/logger');
const config = require('../shared/config');
const mcpConfig = require('../config/mcp-config.json');

/**
 * 🍌 BANANA-POWERED HYBRID MCP SERVER 🍌
 * 
 * Combines the power of:
 * - Official HubSpot MCP server (20+ tools)
 * - Banana-powered optimizations (caching, streaming, analytics)
 */
class HybridMCPServer {
    constructor() {
        this.server = new Server(
            {
                name: 'hubspot-banana-hybrid',
                version: '1.0.0',
                description: 'Hybrid MCP server combining official HubSpot tools with banana-powered optimizations'
            },
            {
                capabilities: {
                    resources: {},
                    tools: {},
                },
            }
        );

        this.apiBaseUrl = `http://localhost:${process.env.BANANA_SERVER_PORT || config.server.port}`;
        this.mode = process.env.MCP_MODE || 'hybrid';
        this.officialTools = [];
        this.bananaTools = [];
        
        this.setupHandlers();
        this.initializeTools();
    }

    /**
     * Initialize available tools from both sources
     */
    async initializeTools() {
        // Initialize official HubSpot tools
        if (this.mode === 'hybrid' || this.mode === 'official') {
            this.officialTools = await this.loadOfficialTools();
        }

        // Initialize banana-powered tools
        if (this.mode === 'hybrid' || this.mode === 'banana') {
            this.bananaTools = await this.loadBananaTools();
        }

        logger.info(`🍌 Hybrid MCP Server initialized with ${this.officialTools.length} official tools and ${this.bananaTools.length} banana tools`);
    }

    /**
     * Load official HubSpot MCP tools
     */
    async loadOfficialTools() {
        const officialCapabilities = mcpConfig.hubspot.official.capabilities;
        const tools = [];

        // OAuth tools
        if (officialCapabilities.oauth) {
            tools.push({
                name: 'hubspot-get-user-details',
                description: 'Get authenticated user details and hub information',
                inputSchema: {
                    type: 'object',
                    properties: {}
                },
                source: 'official'
            });
        }

        // Object tools
        if (officialCapabilities.objects) {
            tools.push(
                {
                    name: 'hubspot-list-objects',
                    description: 'List CRM objects with pagination',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            objectType: { type: 'string', enum: ['contacts', 'companies', 'deals', 'tickets', 'products'] },
                            limit: { type: 'number', default: 10, maximum: 100 },
                            after: { type: 'string' },
                            properties: { type: 'array', items: { type: 'string' } }
                        },
                        required: ['objectType']
                    },
                    source: 'official'
                },
                {
                    name: 'hubspot-search-objects',
                    description: 'Search CRM objects with advanced filters',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            objectType: { type: 'string', enum: ['contacts', 'companies', 'deals', 'tickets', 'products'] },
                            filterGroups: { type: 'array' },
                            sorts: { type: 'array' },
                            properties: { type: 'array', items: { type: 'string' } },
                            limit: { type: 'number', default: 10, maximum: 100 }
                        },
                        required: ['objectType']
                    },
                    source: 'official'
                }
            );
        }

        // Engagement tools
        if (officialCapabilities.engagements) {
            tools.push(
                {
                    name: 'hubspot-create-engagement',
                    description: 'Create notes or tasks in HubSpot',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            type: { type: 'string', enum: ['NOTE', 'TASK'] },
                            body: { type: 'string' },
                            subject: { type: 'string' },
                            associations: { type: 'array' }
                        },
                        required: ['type', 'body']
                    },
                    source: 'official'
                }
            );
        }

        return tools;
    }

    /**
     * Load banana-powered tools
     */
    async loadBananaTools() {
        const bananaCapabilities = mcpConfig.hubspot.banana.capabilities;
        const tools = [];

        // Contact tools
        if (bananaCapabilities.contacts) {
            tools.push(
                {
                    name: 'banana-get-contacts-cached',
                    description: 'Get contacts with intelligent caching (3min TTL)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: { type: 'number', default: 10, maximum: 100 },
                            after: { type: 'string' },
                            useCache: { type: 'boolean', default: true }
                        }
                    },
                    source: 'banana'
                },
                {
                    name: 'banana-get-contacts-streaming',
                    description: 'Stream contacts for large datasets',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            limit: { type: 'number', default: 100 },
                            batchSize: { type: 'number', default: 50 }
                        }
                    },
                    source: 'banana'
                }
            );
        }

        // Search tools
        if (bananaCapabilities.search) {
            tools.push(
                {
                    name: 'banana-search-cached',
                    description: 'Search with intelligent caching (2min TTL)',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            objectType: { type: 'string', enum: ['contacts', 'companies', 'deals', 'tickets'] },
                            query: { type: 'string' },
                            useCache: { type: 'boolean', default: true }
                        },
                        required: ['objectType']
                    },
                    source: 'banana'
                }
            );
        }

        // Analytics tools
        if (bananaCapabilities.analytics) {
            tools.push(
                {
                    name: 'banana-usage-analytics',
                    description: 'Get API usage analytics and performance metrics',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            timeRange: { type: 'string', enum: ['1h', '24h', '7d'], default: '24h' },
                            includeBreakdown: { type: 'boolean', default: false }
                        }
                    },
                    source: 'banana'
                }
            );
        }

        return tools;
    }

    /**
     * Setup MCP server handlers
     */
    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            const allTools = [...this.officialTools, ...this.bananaTools];
            
            return {
                tools: allTools.map(tool => ({
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema
                }))
            };
        });

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            
            try {
                // Find the tool
                const tool = [...this.officialTools, ...this.bananaTools].find(t => t.name === name);
                
                if (!tool) {
                    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }

                // Route to appropriate handler
                if (tool.source === 'official') {
                    return await this.handleOfficialTool(name, args);
                } else {
                    return await this.handleBananaTool(name, args);
                }
            } catch (error) {
                logger.error(`Error in tool ${name}:`, error);
                throw new McpError(
                    ErrorCode.InternalError,
                    `Tool execution failed: ${error.message}`
                );
            }
        });

        // List resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            return {
                resources: [
                    {
                        uri: 'banana://analytics',
                        mimeType: 'application/json',
                        name: 'Banana Analytics',
                        description: 'Real-time analytics and performance metrics'
                    },
                    {
                        uri: 'banana://health',
                        mimeType: 'application/json',
                        name: 'System Health',
                        description: 'Health status of all integrated systems'
                    },
                    {
                        uri: 'hubspot://contacts',
                        mimeType: 'application/json',
                        name: 'HubSpot Contacts',
                        description: 'All contacts from HubSpot CRM'
                    }
                ]
            };
        });

        // Handle resource reads
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const { uri } = request.params;

            switch (uri) {
                case 'banana://analytics':
                    const analytics = await this.getBananaAnalytics();
                    return {
                        contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(analytics, null, 2)
                        }]
                    };

                case 'banana://health':
                    const health = await this.getSystemHealth();
                    return {
                        contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(health, null, 2)
                        }]
                    };

                case 'hubspot://contacts':
                    const contacts = await this.handleBananaTool('banana-get-contacts-cached', { limit: 100 });
                    return {
                        contents: [{
                            uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(contacts, null, 2)
                        }]
                    };

                default:
                    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
            }
        });
    }

    /**
     * Handle official HubSpot MCP tools
     */
    async handleOfficialTool(name, args) {
        // For now, we'll proxy to the original MCP server implementation
        // In a full implementation, we'd integrate with the official @hubspot/mcp-server
        
        try {
            // Transform tool call to API call
            const apiCall = this.transformToolToApiCall(name, args);
            const response = await axios({
                method: apiCall.method,
                url: `${this.apiBaseUrl}${apiCall.path}`,
                data: apiCall.data,
                headers: {
                    'Authorization': `Bearer ${process.env.PRIVATE_APP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(response.data, null, 2)
                }]
            };
        } catch (error) {
            logger.error(`Official tool ${name} failed:`, error);
            throw error;
        }
    }

    /**
     * Handle banana-powered tools
     */
    async handleBananaTool(name, args) {
        try {
            const apiCall = this.transformBananaToolToApiCall(name, args);
            const response = await axios({
                method: apiCall.method,
                url: `${this.apiBaseUrl}${apiCall.path}`,
                params: apiCall.params,
                data: apiCall.data,
                headers: {
                    'x-api-key': process.env.BANANA_API_KEY,
                    'Content-Type': 'application/json'
                }
            });

            return {
                content: [{
                    type: 'text',
                    text: JSON.stringify(response.data, null, 2)
                }]
            };
        } catch (error) {
            logger.error(`Banana tool ${name} failed:`, error);
            throw error;
        }
    }

    /**
     * Transform official tool calls to API calls
     */
    transformToolToApiCall(name, args) {
        const toolMappings = {
            'hubspot-list-objects': {
                method: 'GET',
                path: `/api/hubspot/${args.objectType}`,
                params: { limit: args.limit, after: args.after }
            },
            'hubspot-search-objects': {
                method: 'POST',
                path: `/api/hubspot/search/${args.objectType}`,
                data: args
            },
            'hubspot-create-engagement': {
                method: 'POST',
                path: '/api/hubspot/engagements',
                data: args
            }
        };

        return toolMappings[name] || {
            method: 'GET',
            path: '/api/hubspot/contacts',
            params: args
        };
    }

    /**
     * Transform banana tool calls to API calls
     */
    transformBananaToolToApiCall(name, args) {
        const toolMappings = {
            'banana-get-contacts-cached': {
                method: 'GET',
                path: '/api/hubspot/contacts',
                params: { ...args, useCache: true }
            },
            'banana-get-contacts-streaming': {
                method: 'GET',
                path: '/api/hubspot/contacts',
                params: { ...args, stream: true }
            },
            'banana-search-cached': {
                method: 'POST',
                path: `/api/hubspot/search/${args.objectType}`,
                data: args
            },
            'banana-usage-analytics': {
                method: 'GET',
                path: '/monitoring/analytics',
                params: args
            }
        };

        return toolMappings[name] || {
            method: 'GET',
            path: '/api/hubspot/contacts',
            params: args
        };
    }

    /**
     * Get banana analytics
     */
    async getBananaAnalytics() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/monitoring/analytics`, {
                headers: { 'x-api-key': process.env.BANANA_API_KEY }
            });
            return response.data;
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Get system health
     */
    async getSystemHealth() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/health`, {
                headers: { 'x-api-key': process.env.BANANA_API_KEY }
            });
            return response.data;
        } catch (error) {
            return { error: error.message };
        }
    }

    /**
     * Start the hybrid MCP server
     */
    async start() {
        try {
            await this.initializeTools();
            
            const transport = new StdioServerTransport();
            await this.server.connect(transport);
            
            logger.info('🍌 Hybrid MCP Server started successfully');
            logger.info(`Mode: ${this.mode}`);
            logger.info(`Official tools: ${this.officialTools.length}`);
            logger.info(`Banana tools: ${this.bananaTools.length}`);
            
        } catch (error) {
            logger.error('Failed to start Hybrid MCP Server:', error);
            throw error;
        }
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const server = new HybridMCPServer();
    server.start().catch((error) => {
        logger.error('Failed to start Hybrid MCP server:', error);
        process.exit(1);
    });
}

module.exports = HybridMCPServer;