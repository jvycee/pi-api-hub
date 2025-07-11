const WebSocket = require('ws');
const EventEmitter = require('events');
const logger = require('../shared/logger');
const config = require('../shared/config');

/**
 * 🍌 BANANA-POWERED REAL-TIME STREAMING SERVER 🍌
 * 
 * Provides real-time updates for MCP operations and HubSpot data
 * using WebSocket connections with intelligent routing and scaling
 */

class BananaStreamingServer extends EventEmitter {
    constructor(server, options = {}) {
        super();
        
        this.options = {
            port: options.port || config.streaming?.port || 3001,
            path: options.path || '/stream',
            maxConnections: options.maxConnections || 1000,
            heartbeatInterval: options.heartbeatInterval || 30000,
            compressionEnabled: options.compressionEnabled !== false,
            rateLimitPerSecond: options.rateLimitPerSecond || 100,
            ...options
        };

        this.wss = new WebSocket.Server({
            server: server,
            path: this.options.path,
            perMessageDeflate: this.options.compressionEnabled,
            maxPayload: 1024 * 1024 // 1MB max message size
        });

        this.clients = new Map();
        this.channels = new Map();
        this.metrics = {
            totalConnections: 0,
            activeConnections: 0,
            messagesPerSecond: 0,
            bytesTransferred: 0,
            errorCount: 0
        };

        this.messageQueue = new Map(); // Per-client message queues
        this.rateLimiter = new Map(); // Per-client rate limiting
        
        this.setupWebSocketServer();
        this.startHeartbeat();
        this.startMetricsCollection();
        
        logger.info('🍌 Banana Streaming Server initialized', {
            port: this.options.port,
            path: this.options.path,
            maxConnections: this.options.maxConnections
        });
    }

    setupWebSocketServer() {
        this.wss.on('connection', (ws, request) => {
            this.handleNewConnection(ws, request);
        });

        this.wss.on('error', (error) => {
            logger.error('🍌 WebSocket server error:', error);
            this.metrics.errorCount++;
        });

        // Handle server shutdown gracefully
        process.on('SIGTERM', () => this.shutdown());
        process.on('SIGINT', () => this.shutdown());
    }

    handleNewConnection(ws, request) {
        const clientId = this.generateClientId();
        const clientInfo = this.extractClientInfo(request);
        
        // Check connection limits
        if (this.clients.size >= this.options.maxConnections) {
            logger.warn('🍌 Connection limit reached, rejecting client', { clientId });
            ws.close(1013, 'Server overloaded');
            return;
        }

        // Initialize client data
        const client = {
            id: clientId,
            ws: ws,
            info: clientInfo,
            channels: new Set(),
            lastPing: Date.now(),
            isAlive: true,
            messageCount: 0,
            rateLimitTokens: this.options.rateLimitPerSecond,
            lastRateLimitReset: Date.now()
        };

        this.clients.set(clientId, client);
        this.messageQueue.set(clientId, []);
        this.metrics.totalConnections++;
        this.metrics.activeConnections++;

        logger.info('🍌 New WebSocket connection', {
            clientId,
            userAgent: clientInfo.userAgent,
            ip: clientInfo.ip,
            activeConnections: this.metrics.activeConnections
        });

        // Setup client event handlers
        this.setupClientHandlers(client);

        // Send welcome message
        this.sendToClient(clientId, {
            type: 'welcome',
            clientId: clientId,
            server: 'banana-streaming-server',
            version: '1.0.0',
            features: ['real-time-updates', 'channel-subscriptions', 'compression'],
            timestamp: Date.now()
        });

        this.emit('clientConnected', client);
    }

    setupClientHandlers(client) {
        const { ws, id: clientId } = client;

        ws.on('message', (data) => {
            this.handleClientMessage(clientId, data);
        });

        ws.on('pong', () => {
            client.lastPing = Date.now();
            client.isAlive = true;
        });

        ws.on('close', (code, reason) => {
            this.handleClientDisconnect(clientId, code, reason);
        });

        ws.on('error', (error) => {
            logger.error('🍌 Client WebSocket error', { clientId, error: error.message });
            this.handleClientDisconnect(clientId, 1011, 'Connection error');
        });
    }

    handleClientMessage(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Rate limiting check
        if (!this.checkRateLimit(client)) {
            this.sendToClient(clientId, {
                type: 'error',
                error: 'Rate limit exceeded',
                timestamp: Date.now()
            });
            return;
        }

        try {
            const message = JSON.parse(data.toString());
            client.messageCount++;
            
            logger.debug('🍌 Received client message', {
                clientId,
                type: message.type,
                size: data.length
            });

            this.processClientMessage(clientId, message);
        } catch (error) {
            logger.error('🍌 Invalid message from client', {
                clientId,
                error: error.message,
                data: data.toString().substring(0, 100)
            });
            
            this.sendToClient(clientId, {
                type: 'error',
                error: 'Invalid message format',
                timestamp: Date.now()
            });
        }
    }

    processClientMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        switch (message.type) {
            case 'subscribe':
                this.subscribeToChannel(clientId, message.channel, message.filters);
                break;

            case 'unsubscribe':
                this.unsubscribeFromChannel(clientId, message.channel);
                break;

            case 'ping':
                this.sendToClient(clientId, {
                    type: 'pong',
                    timestamp: Date.now()
                });
                break;

            case 'request_data':
                this.handleDataRequest(clientId, message);
                break;

            case 'mcp_tool_call':
                this.handleMCPToolCall(clientId, message);
                break;

            default:
                logger.warn('🍌 Unknown message type from client', {
                    clientId,
                    type: message.type
                });
                
                this.sendToClient(clientId, {
                    type: 'error',
                    error: `Unknown message type: ${message.type}`,
                    timestamp: Date.now()
                });
        }
    }

    subscribeToChannel(clientId, channelName, filters = {}) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Validate channel name
        if (!this.isValidChannelName(channelName)) {
            this.sendToClient(clientId, {
                type: 'error',
                error: `Invalid channel name: ${channelName}`,
                timestamp: Date.now()
            });
            return;
        }

        // Initialize channel if it doesn't exist
        if (!this.channels.has(channelName)) {
            this.channels.set(channelName, new Set());
        }

        // Add client to channel
        client.channels.add(channelName);
        this.channels.get(channelName).add(clientId);

        logger.info('🍌 Client subscribed to channel', {
            clientId,
            channel: channelName,
            filters,
            channelSize: this.channels.get(channelName).size
        });

        this.sendToClient(clientId, {
            type: 'subscribed',
            channel: channelName,
            filters: filters,
            timestamp: Date.now()
        });

        // Send initial data if available
        this.sendInitialChannelData(clientId, channelName, filters);

        this.emit('channelSubscribed', { clientId, channelName, filters });
    }

    unsubscribeFromChannel(clientId, channelName) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.channels.delete(channelName);
        
        if (this.channels.has(channelName)) {
            this.channels.get(channelName).delete(clientId);
            
            // Clean up empty channels
            if (this.channels.get(channelName).size === 0) {
                this.channels.delete(channelName);
            }
        }

        logger.info('🍌 Client unsubscribed from channel', {
            clientId,
            channel: channelName
        });

        this.sendToClient(clientId, {
            type: 'unsubscribed',
            channel: channelName,
            timestamp: Date.now()
        });

        this.emit('channelUnsubscribed', { clientId, channelName });
    }

    handleDataRequest(clientId, message) {
        // Handle one-time data requests
        const { requestId, dataType, parameters } = message;
        
        logger.debug('🍌 Handling data request', {
            clientId,
            requestId,
            dataType
        });

        // Process data request asynchronously
        this.processDataRequest(dataType, parameters)
            .then(data => {
                this.sendToClient(clientId, {
                    type: 'data_response',
                    requestId: requestId,
                    dataType: dataType,
                    data: data,
                    timestamp: Date.now()
                });
            })
            .catch(error => {
                this.sendToClient(clientId, {
                    type: 'error',
                    requestId: requestId,
                    error: error.message,
                    timestamp: Date.now()
                });
            });
    }

    async handleMCPToolCall(clientId, message) {
        const { requestId, tool, parameters } = message;
        
        try {
            // Emit event for MCP manager to handle
            this.emit('mcpToolCall', {
                clientId,
                requestId,
                tool,
                parameters,
                callback: (result) => {
                    this.sendToClient(clientId, {
                        type: 'mcp_tool_response',
                        requestId: requestId,
                        tool: tool,
                        result: result,
                        timestamp: Date.now()
                    });
                }
            });
        } catch (error) {
            this.sendToClient(clientId, {
                type: 'error',
                requestId: requestId,
                error: error.message,
                timestamp: Date.now()
            });
        }
    }

    async processDataRequest(dataType, parameters) {
        switch (dataType) {
            case 'hubspot_contacts':
                return this.getHubSpotContacts(parameters);
            case 'mcp_status':
                return this.getMCPStatus();
            case 'analytics':
                return this.getAnalytics(parameters);
            default:
                throw new Error(`Unknown data type: ${dataType}`);
        }
    }

    sendInitialChannelData(clientId, channelName, filters) {
        // Send relevant initial data based on channel
        switch (channelName) {
            case 'mcp_status':
                this.sendMCPStatusUpdate(clientId);
                break;
            case 'hubspot_updates':
                this.sendHubSpotUpdates(clientId, filters);
                break;
            case 'performance_metrics':
                this.sendPerformanceMetrics(clientId);
                break;
        }
    }

    // Broadcasting methods
    broadcastToChannel(channelName, data) {
        if (!this.channels.has(channelName)) return;

        const clients = this.channels.get(channelName);
        const message = {
            type: 'channel_update',
            channel: channelName,
            data: data,
            timestamp: Date.now()
        };

        for (const clientId of clients) {
            this.sendToClient(clientId, message);
        }

        logger.debug('🍌 Broadcast to channel', {
            channel: channelName,
            clientCount: clients.size,
            dataSize: JSON.stringify(data).length
        });
    }

    broadcastToAll(data) {
        const message = {
            type: 'broadcast',
            data: data,
            timestamp: Date.now()
        };

        for (const [clientId] of this.clients) {
            this.sendToClient(clientId, message);
        }

        logger.debug('🍌 Broadcast to all clients', {
            clientCount: this.clients.size,
            dataSize: JSON.stringify(data).length
        });
    }

    sendToClient(clientId, data) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) {
            return false;
        }

        try {
            const message = JSON.stringify(data);
            client.ws.send(message);
            this.metrics.bytesTransferred += message.length;
            this.metrics.messagesPerSecond++;
            return true;
        } catch (error) {
            logger.error('🍌 Failed to send message to client', {
                clientId,
                error: error.message
            });
            this.handleClientDisconnect(clientId, 1011, 'Send error');
            return false;
        }
    }

    handleClientDisconnect(clientId, code, reason) {
        const client = this.clients.get(clientId);
        if (!client) return;

        // Remove from all channels
        for (const channelName of client.channels) {
            if (this.channels.has(channelName)) {
                this.channels.get(channelName).delete(clientId);
                if (this.channels.get(channelName).size === 0) {
                    this.channels.delete(channelName);
                }
            }
        }

        // Clean up client data
        this.clients.delete(clientId);
        this.messageQueue.delete(clientId);
        this.rateLimiter.delete(clientId);
        this.metrics.activeConnections--;

        logger.info('🍌 Client disconnected', {
            clientId,
            code,
            reason: reason?.toString(),
            activeConnections: this.metrics.activeConnections,
            messageCount: client.messageCount
        });

        this.emit('clientDisconnected', { clientId, code, reason });
    }

    checkRateLimit(client) {
        const now = Date.now();
        const timeSinceReset = now - client.lastRateLimitReset;

        // Reset tokens every second
        if (timeSinceReset >= 1000) {
            client.rateLimitTokens = this.options.rateLimitPerSecond;
            client.lastRateLimitReset = now;
        }

        if (client.rateLimitTokens > 0) {
            client.rateLimitTokens--;
            return true;
        }

        return false;
    }

    startHeartbeat() {
        setInterval(() => {
            this.wss.clients.forEach((ws) => {
                const client = Array.from(this.clients.values()).find(c => c.ws === ws);
                if (client) {
                    if (!client.isAlive) {
                        this.handleClientDisconnect(client.id, 1000, 'Heartbeat timeout');
                        return;
                    }
                    
                    client.isAlive = false;
                    ws.ping();
                }
            });
        }, this.options.heartbeatInterval);
    }

    startMetricsCollection() {
        setInterval(() => {
            // Reset per-second metrics
            this.metrics.messagesPerSecond = 0;
            
            // Emit metrics for monitoring
            this.emit('metrics', { ...this.metrics });
        }, 1000);
    }

    // Utility methods
    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    extractClientInfo(request) {
        const forwarded = request.headers['x-forwarded-for'];
        const ip = forwarded ? forwarded.split(',')[0] : request.connection.remoteAddress;
        
        return {
            ip: ip,
            userAgent: request.headers['user-agent'] || 'Unknown',
            origin: request.headers.origin,
            timestamp: Date.now()
        };
    }

    isValidChannelName(channelName) {
        return /^[a-zA-Z0-9_-]+$/.test(channelName) && channelName.length <= 50;
    }

    // Data provider methods (to be implemented based on your data sources)
    async getHubSpotContacts(parameters = {}) {
        // Implementation would connect to your HubSpot data source
        return { contacts: [], total: 0 };
    }

    async getMCPStatus() {
        // Implementation would check MCP server status
        return { status: 'connected', uptime: Date.now() };
    }

    async getAnalytics(parameters = {}) {
        // Implementation would fetch analytics data
        return { metrics: this.metrics };
    }

    sendMCPStatusUpdate(clientId) {
        // Send current MCP status
        this.getMCPStatus().then(status => {
            this.sendToClient(clientId, {
                type: 'channel_update',
                channel: 'mcp_status',
                data: status,
                timestamp: Date.now()
            });
        });
    }

    sendHubSpotUpdates(clientId, filters) {
        // Send HubSpot updates based on filters
        this.getHubSpotContacts(filters).then(data => {
            this.sendToClient(clientId, {
                type: 'channel_update',
                channel: 'hubspot_updates',
                data: data,
                timestamp: Date.now()
            });
        });
    }

    sendPerformanceMetrics(clientId) {
        this.sendToClient(clientId, {
            type: 'channel_update',
            channel: 'performance_metrics',
            data: this.metrics,
            timestamp: Date.now()
        });
    }

    // Public API methods
    getMetrics() {
        return {
            ...this.metrics,
            channels: Array.from(this.channels.keys()),
            channelStats: Object.fromEntries(
                Array.from(this.channels.entries()).map(([name, clients]) => [
                    name,
                    { subscriberCount: clients.size }
                ])
            )
        };
    }

    getConnectedClients() {
        return Array.from(this.clients.values()).map(client => ({
            id: client.id,
            info: client.info,
            channels: Array.from(client.channels),
            messageCount: client.messageCount,
            connectedAt: client.info.timestamp
        }));
    }

    shutdown() {
        logger.info('🍌 Shutting down Banana Streaming Server');
        
        // Close all client connections
        for (const [clientId] of this.clients) {
            this.handleClientDisconnect(clientId, 1001, 'Server shutdown');
        }

        // Close WebSocket server
        this.wss.close(() => {
            logger.info('🍌 Banana Streaming Server shut down complete');
        });

        this.emit('shutdown');
    }
}

module.exports = BananaStreamingServer;