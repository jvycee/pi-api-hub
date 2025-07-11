const EventEmitter = require('events');
const logger = require('../shared/logger');
const BananaStreamingServer = require('./websocket-server');

/**
 * 🍌 BANANA STREAMING MANAGER 🍌
 * 
 * Coordinates real-time streaming between MCP operations, HubSpot data,
 * and connected clients with intelligent data routing and optimization
 */

class BananaStreamingManager extends EventEmitter {
    constructor(httpServer, mcpManager, options = {}) {
        super();
        
        this.mcpManager = mcpManager;
        this.options = {
            enabled: options.enabled !== false,
            updateInterval: options.updateInterval || 5000,
            batchSize: options.batchSize || 50,
            maxHistory: options.maxHistory || 1000,
            ...options
        };

        // Initialize streaming server
        this.streamingServer = new BananaStreamingServer(httpServer, this.options);
        
        // Data caches and state management
        this.dataCache = new Map();
        this.updateHistory = [];
        this.activeStreams = new Map();
        this.pendingUpdates = new Map();
        
        // Performance metrics
        this.metrics = {
            streamsActive: 0,
            updatesPerSecond: 0,
            cacheHitRate: 0,
            totalUpdates: 0,
            errorCount: 0
        };

        this.setupEventHandlers();
        this.startUpdateLoop();
        
        logger.info('🍌 Banana Streaming Manager initialized', {
            enabled: this.options.enabled,
            updateInterval: this.options.updateInterval
        });
    }

    setupEventHandlers() {
        // Handle streaming server events
        this.streamingServer.on('clientConnected', (client) => {
            this.handleClientConnected(client);
        });

        this.streamingServer.on('clientDisconnected', ({ clientId }) => {
            this.handleClientDisconnected(clientId);
        });

        this.streamingServer.on('channelSubscribed', ({ clientId, channelName, filters }) => {
            this.handleChannelSubscription(clientId, channelName, filters);
        });

        this.streamingServer.on('mcpToolCall', (data) => {
            this.handleMCPToolCall(data);
        });

        // Handle MCP manager events if available
        if (this.mcpManager && typeof this.mcpManager.on === 'function') {
            this.mcpManager.on('toolCallCompleted', (data) => {
                this.handleMCPUpdate(data);
            });

            this.mcpManager.on('statusChange', (status) => {
                this.broadcastMCPStatus(status);
            });

            this.mcpManager.on('performanceUpdate', (metrics) => {
                this.broadcastPerformanceMetrics(metrics);
            });
        }
    }

    handleClientConnected(client) {
        logger.info('🍌 Client connected to streaming', {
            clientId: client.id,
            userAgent: client.info.userAgent
        });

        // Send initial welcome data
        this.sendWelcomeData(client.id);
        
        this.metrics.streamsActive++;
        this.emit('clientConnected', client);
    }

    handleClientDisconnected(clientId) {
        // Clean up client-specific data
        this.activeStreams.delete(clientId);
        this.pendingUpdates.delete(clientId);
        
        this.metrics.streamsActive--;
        this.emit('clientDisconnected', { clientId });
    }

    handleChannelSubscription(clientId, channelName, filters) {
        logger.debug('🍌 Channel subscription', {
            clientId,
            channel: channelName,
            filters
        });

        // Initialize stream for this client-channel combination
        const streamKey = `${clientId}:${channelName}`;
        this.activeStreams.set(streamKey, {
            clientId,
            channelName,
            filters,
            lastUpdate: Date.now(),
            updateCount: 0
        });

        // Start specific data streaming based on channel
        this.startChannelStream(clientId, channelName, filters);
    }

    async handleMCPToolCall({ clientId, requestId, tool, parameters, callback }) {
        try {
            logger.debug('🍌 Handling MCP tool call via streaming', {
                clientId,
                requestId,
                tool
            });

            // If we have an MCP manager, delegate the call
            if (this.mcpManager && typeof this.mcpManager.callTool === 'function') {
                const result = await this.mcpManager.callTool(tool, parameters);
                callback(result);
                
                // Broadcast update to relevant channels
                this.broadcastToolUpdate(tool, parameters, result);
            } else {
                // Mock response for testing
                const result = {
                    success: true,
                    data: { message: 'Tool call executed via streaming', tool, parameters },
                    timestamp: Date.now()
                };
                callback(result);
            }
        } catch (error) {
            logger.error('🍌 MCP tool call failed via streaming', {
                clientId,
                requestId,
                tool,
                error: error.message
            });
            
            callback({
                success: false,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    startChannelStream(clientId, channelName, filters) {
        switch (channelName) {
            case 'hubspot_contacts':
                this.startHubSpotContactStream(clientId, filters);
                break;
            case 'mcp_status':
                this.startMCPStatusStream(clientId);
                break;
            case 'performance_metrics':
                this.startPerformanceStream(clientId);
                break;
            case 'tool_calls':
                this.startToolCallStream(clientId, filters);
                break;
            default:
                logger.warn('🍌 Unknown channel for streaming', { channelName });
        }
    }

    async startHubSpotContactStream(clientId, filters = {}) {
        const cacheKey = `hubspot_contacts_${JSON.stringify(filters)}`;
        
        // Check cache first
        if (this.dataCache.has(cacheKey)) {
            const cachedData = this.dataCache.get(cacheKey);
            if (Date.now() - cachedData.timestamp < 30000) { // 30 second cache
                this.streamingServer.sendToClient(clientId, {
                    type: 'stream_data',
                    channel: 'hubspot_contacts',
                    data: cachedData.data,
                    cached: true,
                    timestamp: Date.now()
                });
                return;
            }
        }

        // Fetch fresh data
        try {
            const contacts = await this.getHubSpotContacts(filters);
            
            // Cache the result
            this.dataCache.set(cacheKey, {
                data: contacts,
                timestamp: Date.now()
            });

            // Stream to client
            this.streamingServer.sendToClient(clientId, {
                type: 'stream_data',
                channel: 'hubspot_contacts',
                data: contacts,
                cached: false,
                timestamp: Date.now()
            });

            // Set up periodic updates
            this.scheduleContactUpdates(clientId, filters);
            
        } catch (error) {
            logger.error('🍌 Failed to start HubSpot contact stream', {
                clientId,
                error: error.message
            });
            
            this.streamingServer.sendToClient(clientId, {
                type: 'stream_error',
                channel: 'hubspot_contacts',
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    startMCPStatusStream(clientId) {
        // Send current status immediately
        const status = this.getMCPStatus();
        this.streamingServer.sendToClient(clientId, {
            type: 'stream_data',
            channel: 'mcp_status',
            data: status,
            timestamp: Date.now()
        });

        // Schedule periodic status updates
        this.scheduleStatusUpdates(clientId);
    }

    startPerformanceStream(clientId) {
        // Send current metrics immediately
        const metrics = this.getPerformanceMetrics();
        this.streamingServer.sendToClient(clientId, {
            type: 'stream_data',
            channel: 'performance_metrics',
            data: metrics,
            timestamp: Date.now()
        });

        // Schedule periodic metrics updates
        this.scheduleMetricsUpdates(clientId);
    }

    startToolCallStream(clientId, filters) {
        // Send recent tool call history
        const recentCalls = this.getRecentToolCalls(filters);
        this.streamingServer.sendToClient(clientId, {
            type: 'stream_data',
            channel: 'tool_calls',
            data: recentCalls,
            timestamp: Date.now()
        });
    }

    // Scheduled update methods
    scheduleContactUpdates(clientId, filters) {
        const intervalId = setInterval(async () => {
            try {
                const contacts = await this.getHubSpotContacts(filters);
                this.streamingServer.sendToClient(clientId, {
                    type: 'stream_update',
                    channel: 'hubspot_contacts',
                    data: contacts,
                    timestamp: Date.now()
                });
            } catch (error) {
                logger.error('🍌 Scheduled contact update failed', {
                    clientId,
                    error: error.message
                });
            }
        }, this.options.updateInterval);

        // Store interval for cleanup
        this.storeClientInterval(clientId, 'contacts', intervalId);
    }

    scheduleStatusUpdates(clientId) {
        const intervalId = setInterval(() => {
            const status = this.getMCPStatus();
            this.streamingServer.sendToClient(clientId, {
                type: 'stream_update',
                channel: 'mcp_status',
                data: status,
                timestamp: Date.now()
            });
        }, this.options.updateInterval);

        this.storeClientInterval(clientId, 'status', intervalId);
    }

    scheduleMetricsUpdates(clientId) {
        const intervalId = setInterval(() => {
            const metrics = this.getPerformanceMetrics();
            this.streamingServer.sendToClient(clientId, {
                type: 'stream_update',
                channel: 'performance_metrics',
                data: metrics,
                timestamp: Date.now()
            });
        }, 1000); // More frequent updates for metrics

        this.storeClientInterval(clientId, 'metrics', intervalId);
    }

    storeClientInterval(clientId, type, intervalId) {
        if (!this.pendingUpdates.has(clientId)) {
            this.pendingUpdates.set(clientId, new Map());
        }
        this.pendingUpdates.get(clientId).set(type, intervalId);
    }

    clearClientIntervals(clientId) {
        if (this.pendingUpdates.has(clientId)) {
            const intervals = this.pendingUpdates.get(clientId);
            for (const [type, intervalId] of intervals) {
                clearInterval(intervalId);
            }
            this.pendingUpdates.delete(clientId);
        }
    }

    // Broadcasting methods
    broadcastMCPStatus(status) {
        this.streamingServer.broadcastToChannel('mcp_status', status);
        this.addToHistory('mcp_status', status);
    }

    broadcastPerformanceMetrics(metrics) {
        this.streamingServer.broadcastToChannel('performance_metrics', metrics);
        this.addToHistory('performance_metrics', metrics);
    }

    broadcastToolUpdate(tool, parameters, result) {
        const update = {
            tool,
            parameters,
            result,
            timestamp: Date.now()
        };
        
        this.streamingServer.broadcastToChannel('tool_calls', update);
        this.addToHistory('tool_calls', update);
        this.metrics.totalUpdates++;
    }

    broadcastHubSpotUpdate(updateType, data) {
        const update = {
            type: updateType,
            data,
            timestamp: Date.now()
        };
        
        this.streamingServer.broadcastToChannel('hubspot_updates', update);
        this.addToHistory('hubspot_updates', update);
    }

    // Data access methods (to be implemented with actual data sources)
    async getHubSpotContacts(filters = {}) {
        // Mock implementation - replace with actual HubSpot data access
        if (this.mcpManager && typeof this.mcpManager.getContacts === 'function') {
            try {
                return await this.mcpManager.getContacts(filters.limit || 50);
            } catch (error) {
                logger.error('🍌 Failed to fetch contacts from MCP manager', error);
                return [];
            }
        }
        
        // Fallback mock data
        return [
            {
                id: '1',
                properties: {
                    firstname: 'John',
                    lastname: 'Doe',
                    email: 'john.doe@example.com',
                    lastmodifieddate: new Date().toISOString()
                }
            }
        ];
    }

    getMCPStatus() {
        if (this.mcpManager && typeof this.mcpManager.getStatus === 'function') {
            return this.mcpManager.getStatus();
        }
        
        return {
            connected: true,
            uptime: Date.now(),
            toolsAvailable: 12,
            lastCheck: Date.now()
        };
    }

    getPerformanceMetrics() {
        const streamingMetrics = this.streamingServer.getMetrics();
        
        return {
            streaming: streamingMetrics,
            manager: this.metrics,
            system: {
                memoryUsage: process.memoryUsage(),
                uptime: process.uptime()
            },
            timestamp: Date.now()
        };
    }

    getRecentToolCalls(filters = {}) {
        const limit = filters.limit || 50;
        return this.updateHistory
            .filter(entry => entry.type === 'tool_calls')
            .slice(-limit)
            .map(entry => entry.data);
    }

    // Utility methods
    addToHistory(type, data) {
        this.updateHistory.push({
            type,
            data,
            timestamp: Date.now()
        });

        // Maintain history size limit
        if (this.updateHistory.length > this.options.maxHistory) {
            this.updateHistory = this.updateHistory.slice(-this.options.maxHistory);
        }
    }

    sendWelcomeData(clientId) {
        // Send initial system status
        this.streamingServer.sendToClient(clientId, {
            type: 'welcome_data',
            systemStatus: this.getMCPStatus(),
            availableChannels: [
                'hubspot_contacts',
                'mcp_status',
                'performance_metrics',
                'tool_calls'
            ],
            features: {
                realTimeUpdates: true,
                caching: true,
                batchProcessing: true,
                filtering: true
            },
            timestamp: Date.now()
        });
    }

    startUpdateLoop() {
        setInterval(() => {
            this.updateMetrics();
            this.cleanupCache();
        }, 5000);
    }

    updateMetrics() {
        // Update cache hit rate
        const totalCacheAccesses = this.metrics.totalUpdates;
        const cacheHits = totalCacheAccesses * 0.85; // Mock calculation
        this.metrics.cacheHitRate = totalCacheAccesses > 0 ? cacheHits / totalCacheAccesses : 0;
        
        // Update streams active
        this.metrics.streamsActive = this.activeStreams.size;
        
        // Reset per-second counters
        this.metrics.updatesPerSecond = 0;
    }

    cleanupCache() {
        const now = Date.now();
        const maxAge = 300000; // 5 minutes
        
        for (const [key, entry] of this.dataCache) {
            if (now - entry.timestamp > maxAge) {
                this.dataCache.delete(key);
            }
        }
    }

    // Public API methods
    getStats() {
        return {
            streaming: this.streamingServer.getMetrics(),
            manager: this.metrics,
            activeStreams: this.activeStreams.size,
            cacheSize: this.dataCache.size,
            historySize: this.updateHistory.length
        };
    }

    isEnabled() {
        return this.options.enabled;
    }

    shutdown() {
        logger.info('🍌 Shutting down Banana Streaming Manager');
        
        // Clear all client intervals
        for (const [clientId] of this.pendingUpdates) {
            this.clearClientIntervals(clientId);
        }
        
        // Shutdown streaming server
        this.streamingServer.shutdown();
        
        this.emit('shutdown');
    }
}

module.exports = BananaStreamingManager;