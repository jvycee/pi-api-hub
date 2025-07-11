const Joi = require('joi');
const axios = require('axios');
const { BananaMCPTool } = require('../mcp-tool-sdk');
const logger = require('../../shared/logger');

/**
 * 🍌 HubSpot Contact Management Tool 🍌
 * 
 * Example implementation of a banana-powered HubSpot contact tool
 * Demonstrates best practices for MCP tool development
 */

class HubSpotContactTool extends BananaMCPTool {
    constructor(config = {}) {
        super({
            name: 'hubspot-banana-contact',
            description: 'Enhanced HubSpot contact management with banana-powered optimizations',
            version: '1.0.0',
            category: 'hubspot',
            cacheEnabled: true,
            cacheTTL: 300000, // 5 minutes
            rateLimit: 50, // 50 calls per minute (HubSpot limit consideration)
            ...config
        });

        this.hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
        if (!this.hubspotToken) {
            logger.warn('🍌 HubSpot token not found - tool will work in simulation mode');
        }

        this.httpClient = axios.create({
            baseURL: 'https://api.hubapi.com',
            timeout: 15000,
            headers: {
                'Authorization': `Bearer ${this.hubspotToken}`,
                'Content-Type': 'application/json'
            }
        });
    }

    defineInputSchema() {
        return Joi.object({
            action: Joi.string().valid(
                'get', 'list', 'create', 'update', 'delete', 'search'
            ).required(),
            
            // For get/update/delete operations
            contactId: Joi.string().when('action', {
                is: Joi.string().valid('get', 'update', 'delete'),
                then: Joi.required()
            }),
            
            // For list operations
            limit: Joi.number().integer().min(1).max(100).default(20),
            offset: Joi.string(),
            
            // For create/update operations
            properties: Joi.object().when('action', {
                is: Joi.string().valid('create', 'update'),
                then: Joi.required()
            }),
            
            // For search operations
            query: Joi.string().when('action', {
                is: 'search',
                then: Joi.required()
            }),
            searchProperties: Joi.array().items(Joi.string()).default(['firstname', 'lastname', 'email']),
            
            // Common options
            requestedProperties: Joi.array().items(Joi.string()).default([
                'firstname', 'lastname', 'email', 'company', 'phone', 'createdate', 'lastmodifieddate'
            ]),
            
            // Banana-powered options
            enableCaching: Joi.boolean().default(true),
            enableOptimizations: Joi.boolean().default(true),
            returnMetadata: Joi.boolean().default(false)
        });
    }

    defineOutputSchema() {
        return Joi.object({
            success: Joi.boolean().required(),
            data: Joi.object({
                action: Joi.string().required(),
                contact: Joi.object().when('action', {
                    is: Joi.string().valid('get', 'create', 'update'),
                    then: Joi.required()
                }),
                contacts: Joi.array().when('action', {
                    is: Joi.string().valid('list', 'search'),
                    then: Joi.required()
                }),
                total: Joi.number().when('action', {
                    is: Joi.string().valid('list', 'search'),
                    then: Joi.required()
                }),
                hasMore: Joi.boolean(),
                nextOffset: Joi.string(),
                optimizations: Joi.object({
                    cacheUsed: Joi.boolean(),
                    requestsAvoided: Joi.number(),
                    dataCompressed: Joi.boolean()
                })
            }),
            error: Joi.string(),
            metadata: Joi.object().required()
        });
    }

    async execute(input, context) {
        const { action } = input;
        
        logger.debug('🍌 Executing HubSpot contact action', {
            action,
            contactId: input.contactId,
            hasToken: !!this.hubspotToken
        });

        // Route to appropriate action handler
        switch (action) {
            case 'get':
                return await this.getContact(input, context);
            case 'list':
                return await this.listContacts(input, context);
            case 'create':
                return await this.createContact(input, context);
            case 'update':
                return await this.updateContact(input, context);
            case 'delete':
                return await this.deleteContact(input, context);
            case 'search':
                return await this.searchContacts(input, context);
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    }

    async getContact(input, context) {
        const { contactId, requestedProperties, enableOptimizations } = input;
        
        if (!this.hubspotToken) {
            return this.simulateResponse('get', { contactId });
        }

        try {
            const response = await this.httpClient.get(`/crm/v3/objects/contacts/${contactId}`, {
                params: {
                    properties: requestedProperties.join(',')
                }
            });

            const contact = this.processContactData(response.data, enableOptimizations);

            return {
                success: true,
                data: {
                    action: 'get',
                    contact: contact,
                    optimizations: {
                        cacheUsed: false,
                        requestsAvoided: 0,
                        dataCompressed: enableOptimizations
                    }
                }
            };
        } catch (error) {
            throw new Error(`Failed to get contact: ${this.parseHubSpotError(error)}`);
        }
    }

    async listContacts(input, context) {
        const { limit, offset, requestedProperties, enableOptimizations } = input;
        
        if (!this.hubspotToken) {
            return this.simulateResponse('list', { limit });
        }

        try {
            const params = {
                limit: limit,
                properties: requestedProperties.join(',')
            };
            
            if (offset) {
                params.after = offset;
            }

            const response = await this.httpClient.get('/crm/v3/objects/contacts', { params });

            const contacts = response.data.results.map(contact => 
                this.processContactData(contact, enableOptimizations)
            );

            return {
                success: true,
                data: {
                    action: 'list',
                    contacts: contacts,
                    total: contacts.length,
                    hasMore: !!response.data.paging?.next,
                    nextOffset: response.data.paging?.next?.after,
                    optimizations: {
                        cacheUsed: false,
                        requestsAvoided: 0,
                        dataCompressed: enableOptimizations
                    }
                }
            };
        } catch (error) {
            throw new Error(`Failed to list contacts: ${this.parseHubSpotError(error)}`);
        }
    }

    async createContact(input, context) {
        const { properties, enableOptimizations } = input;
        
        if (!this.hubspotToken) {
            return this.simulateResponse('create', { properties });
        }

        try {
            // Validate required properties
            if (!properties.email && !properties.firstname && !properties.lastname) {
                throw new Error('At least one of email, firstname, or lastname is required');
            }

            const response = await this.httpClient.post('/crm/v3/objects/contacts', {
                properties: properties
            });

            const contact = this.processContactData(response.data, enableOptimizations);

            return {
                success: true,
                data: {
                    action: 'create',
                    contact: contact,
                    optimizations: {
                        cacheUsed: false,
                        requestsAvoided: 0,
                        dataCompressed: enableOptimizations
                    }
                }
            };
        } catch (error) {
            throw new Error(`Failed to create contact: ${this.parseHubSpotError(error)}`);
        }
    }

    async updateContact(input, context) {
        const { contactId, properties, enableOptimizations } = input;
        
        if (!this.hubspotToken) {
            return this.simulateResponse('update', { contactId, properties });
        }

        try {
            const response = await this.httpClient.patch(`/crm/v3/objects/contacts/${contactId}`, {
                properties: properties
            });

            const contact = this.processContactData(response.data, enableOptimizations);

            return {
                success: true,
                data: {
                    action: 'update',
                    contact: contact,
                    optimizations: {
                        cacheUsed: false,
                        requestsAvoided: 0,
                        dataCompressed: enableOptimizations
                    }
                }
            };
        } catch (error) {
            throw new Error(`Failed to update contact: ${this.parseHubSpotError(error)}`);
        }
    }

    async deleteContact(input, context) {
        const { contactId } = input;
        
        if (!this.hubspotToken) {
            return this.simulateResponse('delete', { contactId });
        }

        try {
            await this.httpClient.delete(`/crm/v3/objects/contacts/${contactId}`);

            return {
                success: true,
                data: {
                    action: 'delete',
                    contactId: contactId,
                    optimizations: {
                        cacheUsed: false,
                        requestsAvoided: 0,
                        dataCompressed: false
                    }
                }
            };
        } catch (error) {
            throw new Error(`Failed to delete contact: ${this.parseHubSpotError(error)}`);
        }
    }

    async searchContacts(input, context) {
        const { query, searchProperties, limit, requestedProperties, enableOptimizations } = input;
        
        if (!this.hubspotToken) {
            return this.simulateResponse('search', { query, limit });
        }

        try {
            const searchRequest = {
                filterGroups: [
                    {
                        filters: searchProperties.map(property => ({
                            propertyName: property,
                            operator: 'CONTAINS_TOKEN',
                            value: query
                        }))
                    }
                ],
                properties: requestedProperties,
                limit: limit
            };

            const response = await this.httpClient.post('/crm/v3/objects/contacts/search', searchRequest);

            const contacts = response.data.results.map(contact => 
                this.processContactData(contact, enableOptimizations)
            );

            return {
                success: true,
                data: {
                    action: 'search',
                    contacts: contacts,
                    total: response.data.total,
                    hasMore: contacts.length >= limit,
                    optimizations: {
                        cacheUsed: false,
                        requestsAvoided: 0,
                        dataCompressed: enableOptimizations
                    }
                }
            };
        } catch (error) {
            throw new Error(`Failed to search contacts: ${this.parseHubSpotError(error)}`);
        }
    }

    processContactData(contact, enableOptimizations = true) {
        if (!enableOptimizations) {
            return contact;
        }

        // Banana-powered optimizations
        const optimized = {
            id: contact.id,
            properties: {},
            createdAt: contact.createdAt,
            updatedAt: contact.updatedAt,
            archived: contact.archived
        };

        // Process and optimize properties
        for (const [key, value] of Object.entries(contact.properties || {})) {
            // Skip empty values to reduce payload
            if (value !== null && value !== undefined && value !== '') {
                optimized.properties[key] = value;
            }
        }

        // Add computed fields
        if (optimized.properties.firstname || optimized.properties.lastname) {
            optimized.properties.fullname = [
                optimized.properties.firstname,
                optimized.properties.lastname
            ].filter(Boolean).join(' ');
        }

        // Add banana metadata
        optimized._banana = {
            optimized: true,
            processedAt: Date.now(),
            version: this.getVersion()
        };

        return optimized;
    }

    parseHubSpotError(error) {
        if (error.response?.data?.message) {
            return error.response.data.message;
        }
        if (error.response?.status === 401) {
            return 'Invalid or expired HubSpot API token';
        }
        if (error.response?.status === 429) {
            return 'HubSpot API rate limit exceeded';
        }
        return error.message || 'Unknown HubSpot API error';
    }

    simulateResponse(action, params) {
        // Simulation mode for when no token is available
        const mockContact = {
            id: `mock_${Date.now()}`,
            properties: {
                firstname: 'John',
                lastname: 'Doe',
                email: 'john.doe@example.com',
                company: 'Example Corp',
                phone: '+1234567890',
                createdate: new Date().toISOString(),
                lastmodifieddate: new Date().toISOString(),
                fullname: 'John Doe'
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            archived: false,
            _banana: {
                optimized: true,
                processedAt: Date.now(),
                version: this.getVersion(),
                simulated: true
            }
        };

        switch (action) {
            case 'get':
            case 'create':
            case 'update':
                return {
                    success: true,
                    data: {
                        action: action,
                        contact: { ...mockContact, id: params.contactId || mockContact.id },
                        optimizations: {
                            cacheUsed: false,
                            requestsAvoided: 0,
                            dataCompressed: true
                        }
                    }
                };

            case 'list':
            case 'search':
                const contacts = Array(Math.min(params.limit || 5, 5)).fill(null).map((_, i) => ({
                    ...mockContact,
                    id: `mock_${Date.now()}_${i}`,
                    properties: {
                        ...mockContact.properties,
                        firstname: `Contact${i + 1}`,
                        email: `contact${i + 1}@example.com`,
                        fullname: `Contact${i + 1} Doe`
                    }
                }));

                return {
                    success: true,
                    data: {
                        action: action,
                        contacts: contacts,
                        total: contacts.length,
                        hasMore: false,
                        optimizations: {
                            cacheUsed: false,
                            requestsAvoided: 0,
                            dataCompressed: true
                        }
                    }
                };

            case 'delete':
                return {
                    success: true,
                    data: {
                        action: 'delete',
                        contactId: params.contactId,
                        optimizations: {
                            cacheUsed: false,
                            requestsAvoided: 0,
                            dataCompressed: false
                        }
                    }
                };

            default:
                throw new Error(`Simulation not supported for action: ${action}`);
        }
    }

    // Override cache key generation to include HubSpot-specific factors
    generateCacheKey(input, context) {
        const keyData = {
            tool: this.config.name,
            version: this.config.version,
            action: input.action,
            contactId: input.contactId,
            query: input.query,
            properties: input.requestedProperties,
            limit: input.limit
        };
        
        return Buffer.from(JSON.stringify(keyData)).toString('base64');
    }

    // Enhanced metrics for HubSpot operations
    getMetrics() {
        const baseMetrics = super.getMetrics();
        
        return {
            ...baseMetrics,
            hubspotSpecific: {
                tokenConfigured: !!this.hubspotToken,
                simulationMode: !this.hubspotToken,
                lastApiCall: this.metadata.lastExecuted,
                rateLimitTokens: this.rateLimitTokens
            }
        };
    }
}

module.exports = HubSpotContactTool;