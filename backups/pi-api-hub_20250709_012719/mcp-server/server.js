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
const config = require('../shared/config');
const logger = require('../shared/logger');

class HubSpotMCPServer {
    constructor() {
        this.server = new Server(
            {
                name: 'hubspot-mcp-server',
                version: '1.0.0',
            },
            {
                capabilities: {
                    resources: {},
                    tools: {},
                },
            }
        );

        // Base URL for our API middleware
        this.apiBaseUrl = `http://localhost:${config.server.port}`;

        this.setupHandlers();
    }

    setupHandlers() {
        // List available tools
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: 'get_hubspot_contacts',
                        description: 'Get contacts from HubSpot CRM',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                limit: {
                                    type: 'number',
                                    description: 'Number of contacts to retrieve (default: 10, max: 100)',
                                    default: 10
                                },
                                after: {
                                    type: 'string',
                                    description: 'Pagination cursor for getting next page of results'
                                }
                            }
                        }
                    },
                    {
                        name: 'create_hubspot_contact',
                        description: 'Create a new contact in HubSpot CRM',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                email: {
                                    type: 'string',
                                    description: 'Contact email address',
                                    format: 'email'
                                },
                                firstname: {
                                    type: 'string',
                                    description: 'Contact first name'
                                },
                                lastname: {
                                    type: 'string',
                                    description: 'Contact last name'
                                },
                                phone: {
                                    type: 'string',
                                    description: 'Contact phone number'
                                },
                                company: {
                                    type: 'string',
                                    description: 'Contact company name'
                                }
                            },
                            required: ['email']
                        }
                    },
                    {
                        name: 'search_hubspot_contacts',
                        description: 'Search contacts in HubSpot using advanced filters and criteria',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Search query string for name, email, or company'
                                },
                                filters: {
                                    type: 'array',
                                    description: 'Advanced search filters',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            propertyName: { type: 'string' },
                                            operator: {
                                                type: 'string',
                                                enum: ['EQ', 'NEQ', 'LT', 'LTE', 'GT', 'GTE', 'BETWEEN', 'IN', 'NOT_IN', 'HAS_PROPERTY', 'NOT_HAS_PROPERTY', 'CONTAINS_TOKEN', 'NOT_CONTAINS_TOKEN']
                                            },
                                            value: { type: 'string' }
                                        }
                                    }
                                },
                                sorts: {
                                    type: 'array',
                                    description: 'Sort criteria',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            propertyName: { type: 'string' },
                                            direction: { type: 'string', enum: ['ASCENDING', 'DESCENDING'] }
                                        }
                                    }
                                },
                                properties: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Contact properties to return',
                                    default: ['email', 'firstname', 'lastname', 'phone', 'company', 'createdate', 'lastmodifieddate']
                                },
                                limit: {
                                    type: 'number',
                                    description: 'Number of results to return (max 100)',
                                    default: 10,
                                    maximum: 100
                                }
                            }
                        }
                    },
                    {
                        name: 'search_hubspot_companies',
                        description: 'Search companies in HubSpot CRM',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Search query for company name or domain'
                                },
                                filters: {
                                    type: 'array',
                                    description: 'Advanced search filters for companies',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            propertyName: { type: 'string' },
                                            operator: { type: 'string' },
                                            value: { type: 'string' }
                                        }
                                    }
                                },
                                properties: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Company properties to return',
                                    default: ['name', 'domain', 'industry', 'city', 'state', 'country']
                                },
                                limit: {
                                    type: 'number',
                                    default: 10,
                                    maximum: 100
                                }
                            }
                        }
                    },
                    {
                        name: 'search_hubspot_deals',
                        description: 'Search deals in HubSpot CRM',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'Search query for deal name'
                                },
                                filters: {
                                    type: 'array',
                                    description: 'Advanced search filters for deals',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            propertyName: { type: 'string' },
                                            operator: { type: 'string' },
                                            value: { type: 'string' }
                                        }
                                    }
                                },
                                properties: {
                                    type: 'array',
                                    items: { type: 'string' },
                                    description: 'Deal properties to return',
                                    default: ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate', 'createdate']
                                },
                                limit: {
                                    type: 'number',
                                    default: 10,
                                    maximum: 100
                                }
                            }
                        }
                    },
                    {
                        name: 'hubspot_graphql_query',
                        description: 'Execute a GraphQL query against HubSpot CRM',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                query: {
                                    type: 'string',
                                    description: 'GraphQL query string'
                                },
                                variables: {
                                    type: 'object',
                                    description: 'GraphQL query variables'
                                }
                            },
                            required: ['query']
                        }
                    },
                    {
                        name: 'ask_claude',
                        description: 'Send a message to Claude (Anthropic API)',
                        inputSchema: {
                            type: 'object',
                            properties: {
                                message: {
                                    type: 'string',
                                    description: 'Message to send to Claude'
                                },
                                model: {
                                    type: 'string',
                                    description: 'Claude model to use',
                                    default: 'claude-3-haiku-20240307',
                                    enum: ['claude-3-haiku-20240307', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229']
                                },
                                max_tokens: {
                                    type: 'number',
                                    description: 'Maximum tokens in response',
                                    default: 1000
                                }
                            },
                            required: ['message']
                        }
                    }
                ]
            };
        });

        // Handle tool calls
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;

            try {
                switch (name) {
                    case 'get_hubspot_contacts':
                        return await this.getHubSpotContacts(args);

                    case 'create_hubspot_contact':
                        return await this.createHubSpotContact(args);

                    case 'search_hubspot_contacts':
                        return await this.searchHubSpotContacts(args);

                    case 'search_hubspot_companies':
                        return await this.searchHubSpotCompanies(args);

                    case 'search_hubspot_deals':
                        return await this.searchHubSpotDeals(args);

                    case 'hubspot_graphql_query':
                        return await this.executeHubSpotGraphQL(args);

                    case 'ask_claude':
                        return await this.askClaude(args);

                    default:
                        throw new McpError(
                            ErrorCode.MethodNotFound,
                            `Unknown tool: ${name}`
                        );
                }
            } catch (error) {
                logger.error(`Error in tool ${name}:`, error);
                throw new McpError(
                    ErrorCode.InternalError,
                    `Tool execution failed: ${error.message}`
                );
            }
        });

        // List available resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            return {
                resources: [
                    {
                        uri: 'hubspot://contacts',
                        mimeType: 'application/json',
                        name: 'HubSpot Contacts',
                        description: 'All contacts from HubSpot CRM'
                    },
                    {
                        uri: 'hubspot://health',
                        mimeType: 'application/json',
                        name: 'API Health Status',
                        description: 'Health status of HubSpot and Anthropic APIs'
                    }
                ]
            };
        });

        // Handle resource reads
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const { uri } = request.params;

            switch (uri) {
                case 'hubspot://contacts':
                    const contacts = await this.getHubSpotContacts({ limit: 100 });
                    return {
                        contents: [
                            {
                                uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(contacts.content[0].text, null, 2)
                            }
                        ]
                    };

                case 'hubspot://health':
                    const health = await this.getHealthStatus();
                    return {
                        contents: [
                            {
                                uri,
                                mimeType: 'application/json',
                                text: JSON.stringify(health, null, 2)
                            }
                        ]
                    };

                default:
                    throw new McpError(
                        ErrorCode.InvalidRequest,
                        `Unknown resource: ${uri}`
                    );
            }
        });
    }

    // Tool implementations
    async getHubSpotContacts(args) {
        const { limit = 10, after } = args;

        try {
            let url = `${this.apiBaseUrl}/api/hubspot/contacts?limit=${limit}`;
            if (after) url += `&after=${after}`;

            const response = await axios.get(url);

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(response.data, null, 2)
                    }
                ]
            };
        } catch (error) {
            logger.error('Error getting HubSpot contacts:', error);
            throw error;
        }
    }

    async createHubSpotContact(args) {
        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/api/hubspot/contacts`,
                args
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: `Contact created successfully: ${JSON.stringify(response.data, null, 2)}`
                    }
                ]
            };
        } catch (error) {
            logger.error('Error creating HubSpot contact:', error);
            throw error;
        }
    }

    async searchHubSpotContacts(args) {
        const {
            query,
            filters = [],
            sorts = [],
            properties = ['email', 'firstname', 'lastname', 'phone', 'company', 'createdate'],
            limit = 10
        } = args;

        try {
            const searchRequest = {
                filterGroups: [],
                sorts,
                properties,
                limit
            };

            // Add text-based search if query provided
            if (query) {
                searchRequest.filterGroups.push({
                    filters: [
                        {
                            propertyName: 'email',
                            operator: 'CONTAINS_TOKEN',
                            value: query
                        }
                    ]
                });
                searchRequest.filterGroups.push({
                    filters: [
                        {
                            propertyName: 'firstname',
                            operator: 'CONTAINS_TOKEN',
                            value: query
                        }
                    ]
                });
                searchRequest.filterGroups.push({
                    filters: [
                        {
                            propertyName: 'lastname',
                            operator: 'CONTAINS_TOKEN',
                            value: query
                        }
                    ]
                });
            }

            // Add custom filters
            if (filters.length > 0) {
                searchRequest.filterGroups.push({
                    filters: filters
                });
            }

            const response = await axios.post(
                `${this.apiBaseUrl}/api/hubspot/search/contacts`,
                searchRequest
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(response.data, null, 2)
                    }
                ]
            };
        } catch (error) {
            logger.error('Error searching HubSpot contacts:', error);

            // Fallback to simple GET if search API fails
            return await this.getHubSpotContacts({ limit });
        }
    }

    async searchHubSpotCompanies(args) {
        const {
            query,
            filters = [],
            properties = ['name', 'domain', 'industry', 'city', 'state'],
            limit = 10
        } = args;

        try {
            const searchRequest = {
                filterGroups: [],
                properties,
                limit
            };

            if (query) {
                searchRequest.filterGroups.push({
                    filters: [
                        {
                            propertyName: 'name',
                            operator: 'CONTAINS_TOKEN',
                            value: query
                        }
                    ]
                });
            }

            if (filters.length > 0) {
                searchRequest.filterGroups.push({
                    filters: filters
                });
            }

            const response = await axios.post(
                `${this.apiBaseUrl}/api/hubspot/search/companies`,
                searchRequest
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(response.data, null, 2)
                    }
                ]
            };
        } catch (error) {
            logger.error('Error searching HubSpot companies:', error);
            throw error;
        }
    }

    async searchHubSpotDeals(args) {
        const {
            query,
            filters = [],
            properties = ['dealname', 'amount', 'dealstage', 'pipeline', 'closedate'],
            limit = 10
        } = args;

        try {
            const searchRequest = {
                filterGroups: [],
                properties,
                limit
            };

            if (query) {
                searchRequest.filterGroups.push({
                    filters: [
                        {
                            propertyName: 'dealname',
                            operator: 'CONTAINS_TOKEN',
                            value: query
                        }
                    ]
                });
            }

            if (filters.length > 0) {
                searchRequest.filterGroups.push({
                    filters: filters
                });
            }

            const response = await axios.post(
                `${this.apiBaseUrl}/api/hubspot/search/deals`,
                searchRequest
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(response.data, null, 2)
                    }
                ]
            };
        } catch (error) {
            logger.error('Error searching HubSpot deals:', error);
            throw error;
        }
    }

    async executeHubSpotGraphQL(args) {
        const { query, variables = {} } = args;

        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/api/hubspot/graphql`,
                { query, variables }
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify(response.data, null, 2)
                    }
                ]
            };
        } catch (error) {
            logger.error('Error executing HubSpot GraphQL:', error);
            throw error;
        }
    }

    async askClaude(args) {
        const { message, model = 'claude-3-haiku-20240307', max_tokens = 1000 } = args;

        try {
            const response = await axios.post(
                `${this.apiBaseUrl}/api/anthropic/messages`,
                {
                    model,
                    max_tokens,
                    messages: [{ role: 'user', content: message }]
                }
            );

            return {
                content: [
                    {
                        type: 'text',
                        text: response.data.data.content[0].text
                    }
                ]
            };
        } catch (error) {
            logger.error('Error asking Claude:', error);
            throw error;
        }
    }

    async getHealthStatus() {
        try {
            const response = await axios.get(`${this.apiBaseUrl}/api/test-connections`);
            return response.data;
        } catch (error) {
            logger.error('Error getting health status:', error);
            return { error: error.message };
        }
    }

    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        logger.info('HubSpot MCP Server started and listening on stdio');
    }
}

// Start the server if this file is run directly
if (require.main === module) {
    const server = new HubSpotMCPServer();
    server.start().catch((error) => {
        logger.error('Failed to start MCP server:', error);
        process.exit(1);
    });
}

module.exports = HubSpotMCPServer;