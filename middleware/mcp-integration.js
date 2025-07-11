const { spawn } = require('child_process');
const axios = require('axios');
const logger = require('../shared/logger');
const config = require('../shared/config');
const mcpConfig = require('../config/mcp-config.json');

/**
 * 🍌 BANANA-POWERED MCP INTEGRATION MIDDLEWARE 🍌
 * 
 * Hybrid middleware that intelligently routes between:
 * - Official HubSpot MCP server (20+ tools)
 * - Banana-powered optimized endpoints (caching, streaming)
 */
class MCPIntegration {
    constructor() {
        this.officialMcpProcess = null;
        this.isInitialized = false;
        this.routingRules = mcpConfig.routing.rules;
        this.metrics = {
            officialCalls: 0,
            bananaCalls: 0,
            errors: 0,
            avgResponseTime: 0
        };
    }

    /**
     * Initialize the MCP integration
     */
    async initialize() {
        if (this.isInitialized) return;

        try {
            // Start official HubSpot MCP server if enabled
            if (mcpConfig.hubspot.official.enabled) {
                await this.startOfficialMcpServer();
            }

            this.isInitialized = true;
            logger.info('🍌 MCP Integration initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize MCP integration:', error);
            throw error;
        }
    }

    /**
     * Start the official HubSpot MCP server as a child process
     */
    async startOfficialMcpServer() {
        return new Promise((resolve, reject) => {
            const serverPath = require.resolve('@hubspot/mcp-server');
            
            this.officialMcpProcess = spawn('node', [serverPath], {
                stdio: 'pipe',
                env: {
                    ...process.env,
                    PRIVATE_APP_ACCESS_TOKEN: process.env.HUBSPOT_PRIVATE_APP_TOKEN
                }
            });

            this.officialMcpProcess.on('error', (error) => {
                logger.error('Official MCP server error:', error);
                reject(error);
            });

            this.officialMcpProcess.on('close', (code) => {
                if (code !== 0) {
                    logger.error(`Official MCP server exited with code ${code}`);
                } else {
                    logger.info('Official MCP server stopped gracefully');
                }
            });

            // Give the server time to start
            setTimeout(() => {
                logger.info('🍌 Official HubSpot MCP server started');
                resolve();
            }, 2000);
        });
    }

    /**
     * Intelligent routing middleware
     */
    middleware() {
        return async (req, res, next) => {
            // Only handle MCP-related requests
            if (!req.path.startsWith('/mcp/')) {
                return next();
            }

            const startTime = Date.now();
            
            try {
                const route = this.determineRoute(req);
                const result = await this.handleRequest(req, route);
                
                // Update metrics
                this.updateMetrics(route, Date.now() - startTime);
                
                res.json(result);
            } catch (error) {
                this.metrics.errors++;
                logger.error('MCP request failed:', error);
                res.status(500).json({
                    success: false,
                    error: 'MCP request failed',
                    timestamp: new Date().toISOString()
                });
            }
        };
    }

    /**
     * Determine which route to use based on request characteristics
     */
    determineRoute(req) {
        const { method, path, query, body } = req;
        
        // Simple reads - use banana for caching
        if (method === 'GET' && this.isSimpleRead(path)) {
            return 'banana';
        }
        
        // Streaming requests - use banana
        if (query.stream === 'true' || body?.stream === true) {
            return 'banana';
        }
        
        // Batch operations - use official
        if (this.isBatchOperation(path, body)) {
            return 'official';
        }
        
        // Complex operations - use official
        if (this.isComplexOperation(path, body)) {
            return 'official';
        }
        
        // Default to banana for performance
        return 'banana';
    }

    /**
     * Handle the request based on the determined route
     */
    async handleRequest(req, route) {
        if (route === 'banana') {
            return await this.handleBananaRequest(req);
        } else {
            return await this.handleOfficialRequest(req);
        }
    }

    /**
     * Handle requests through banana-powered endpoints
     */
    async handleBananaRequest(req) {
        this.metrics.bananaCalls++;
        
        const apiPath = req.path.replace('/mcp/', '/api/');
        const baseUrl = `http://localhost:${config.server.port}`;
        
        try {
            const response = await axios({
                method: req.method,
                url: `${baseUrl}${apiPath}`,
                params: req.query,
                data: req.body,
                headers: {
                    'Authorization': req.headers.authorization,
                    'x-api-key': req.headers['x-api-key']
                }
            });
            
            return {
                success: true,
                data: response.data,
                source: 'banana',
                cached: response.headers['x-cache-status'] === 'hit'
            };
        } catch (error) {
            logger.error('Banana request failed:', error);
            throw error;
        }
    }

    /**
     * Handle requests through official HubSpot MCP server
     */
    async handleOfficialRequest(req) {
        this.metrics.officialCalls++;
        
        try {
            // Transform the request for official MCP format
            const mcpRequest = this.transformToMcpRequest(req);
            
            // Send to official MCP server via stdio
            const result = await this.sendToOfficialMcp(mcpRequest);
            
            return {
                success: true,
                data: result,
                source: 'official'
            };
        } catch (error) {
            logger.error('Official MCP request failed:', error);
            throw error;
        }
    }

    /**
     * Transform HTTP request to MCP format
     */
    transformToMcpRequest(req) {
        const { path, method, body, query } = req;
        
        // Map HTTP paths to MCP tool names
        const toolMapping = {
            '/mcp/hubspot/contacts': 'hubspot-list-objects',
            '/mcp/hubspot/search': 'hubspot-search-objects',
            '/mcp/hubspot/associations': 'hubspot-list-associations'
        };
        
        const toolName = toolMapping[path] || 'hubspot-list-objects';
        
        return {
            method: 'tools/call',
            params: {
                name: toolName,
                arguments: { ...query, ...body }
            }
        };
    }

    /**
     * Send request to official MCP server
     */
    async sendToOfficialMcp(mcpRequest) {
        return new Promise((resolve, reject) => {
            if (!this.officialMcpProcess) {
                reject(new Error('Official MCP server not available'));
                return;
            }

            const requestData = JSON.stringify(mcpRequest) + '\n';
            
            // Set up response handler
            const responseHandler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    this.officialMcpProcess.stdout.off('data', responseHandler);
                    resolve(response);
                } catch (error) {
                    reject(error);
                }
            };
            
            this.officialMcpProcess.stdout.on('data', responseHandler);
            this.officialMcpProcess.stdin.write(requestData);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                this.officialMcpProcess.stdout.off('data', responseHandler);
                reject(new Error('MCP request timeout'));
            }, 30000);
        });
    }

    /**
     * Check if this is a simple read operation
     */
    isSimpleRead(path) {
        const simpleReads = [
            '/mcp/hubspot/contacts',
            '/mcp/hubspot/companies',
            '/mcp/hubspot/deals'
        ];
        return simpleReads.some(pattern => path.startsWith(pattern));
    }

    /**
     * Check if this is a batch operation
     */
    isBatchOperation(path, body) {
        return path.includes('/batch/') || 
               (body && Array.isArray(body) && body.length > 10);
    }

    /**
     * Check if this is a complex operation
     */
    isComplexOperation(path, body) {
        const complexOperations = [
            '/mcp/hubspot/workflows',
            '/mcp/hubspot/associations',
            '/mcp/hubspot/properties'
        ];
        
        return complexOperations.some(pattern => path.includes(pattern)) ||
               (body && body.filterGroups && body.filterGroups.length > 2);
    }

    /**
     * Update performance metrics
     */
    updateMetrics(route, responseTime) {
        this.metrics.avgResponseTime = (this.metrics.avgResponseTime + responseTime) / 2;
        
        if (route === 'banana') {
            this.metrics.bananaCalls++;
        } else {
            this.metrics.officialCalls++;
        }
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            totalCalls: this.metrics.bananaCalls + this.metrics.officialCalls,
            bananaPercentage: Math.round((this.metrics.bananaCalls / (this.metrics.bananaCalls + this.metrics.officialCalls)) * 100),
            uptime: process.uptime()
        };
    }

    /**
     * Get available tools from both sources
     */
    getAvailableTools() {
        const bananaTools = mcpConfig.hubspot.banana.capabilities;
        const officialTools = mcpConfig.hubspot.official.capabilities;
        
        return {
            banana: bananaTools,
            official: officialTools,
            total: Object.keys(bananaTools).length + Object.keys(officialTools).length
        };
    }

    /**
     * Cleanup on shutdown
     */
    async cleanup() {
        if (this.officialMcpProcess) {
            this.officialMcpProcess.kill('SIGTERM');
            logger.info('Official MCP server stopped');
        }
        
        logger.info('🍌 MCP Integration cleaned up');
    }
}

module.exports = MCPIntegration;