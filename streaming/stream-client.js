const WebSocket = require('ws');
const EventEmitter = require('events');

/**
 * 🍌 BANANA STREAMING CLIENT 🍌
 * 
 * Client-side WebSocket interface for connecting to the Banana Streaming Server
 * Provides easy-to-use API for real-time data streaming and MCP operations
 */

class BananaStreamingClient extends EventEmitter {
    constructor(url, options = {}) {
        super();
        
        this.url = url;
        this.options = {
            reconnect: options.reconnect !== false,
            reconnectInterval: options.reconnectInterval || 5000,
            maxReconnectAttempts: options.maxReconnectAttempts || 10,
            heartbeatInterval: options.heartbeatInterval || 30000,
            timeout: options.timeout || 10000,
            ...options
        };

        this.ws = null;
        this.isConnected = false;
        this.reconnectCount = 0;
        this.subscriptions = new Set();
        this.pendingRequests = new Map();
        this.requestIdCounter = 0;
        
        // Connection state
        this.connectionState = 'disconnected'; // disconnected, connecting, connected, reconnecting
        this.lastPingTime = 0;
        this.heartbeatTimer = null;
        
        // Metrics
        this.metrics = {
            messagesReceived: 0,
            messagesSent: 0,
            bytesReceived: 0,
            bytesSent: 0,
            reconnectCount: 0,
            lastLatency: 0
        };
    }

    async connect() {
        if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                this.connectionState = 'connecting';
                this.ws = new WebSocket(this.url);
                
                this.ws.on('open', () => {
                    this.handleOpen();
                    resolve();
                });

                this.ws.on('message', (data) => {
                    this.handleMessage(data);
                });

                this.ws.on('close', (code, reason) => {
                    this.handleClose(code, reason);
                });

                this.ws.on('error', (error) => {
                    this.handleError(error);
                    if (this.connectionState === 'connecting') {
                        reject(error);
                    }
                });

                this.ws.on('pong', () => {
                    this.handlePong();
                });

                // Connection timeout
                setTimeout(() => {
                    if (this.connectionState === 'connecting') {
                        this.ws.close();
                        reject(new Error('Connection timeout'));
                    }
                }, this.options.timeout);

            } catch (error) {
                reject(error);
            }
        });
    }

    handleOpen() {
        this.isConnected = true;
        this.connectionState = 'connected';
        this.reconnectCount = 0;
        
        console.log('🍌 Connected to Banana Streaming Server');
        this.emit('connected');
        
        // Start heartbeat
        this.startHeartbeat();
        
        // Resubscribe to channels after reconnection
        this.resubscribeToChannels();
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            this.metrics.messagesReceived++;
            this.metrics.bytesReceived += data.length;
            
            this.processMessage(message);
        } catch (error) {
            console.error('🍌 Failed to parse message:', error);
            this.emit('error', new Error('Invalid message format'));
        }
    }

    processMessage(message) {
        const { type, requestId } = message;

        switch (type) {
            case 'welcome':
                this.handleWelcome(message);
                break;

            case 'welcome_data':
                this.emit('welcomeData', message);
                break;

            case 'subscribed':
                this.handleSubscribed(message);
                break;

            case 'unsubscribed':
                this.handleUnsubscribed(message);
                break;

            case 'channel_update':
                this.handleChannelUpdate(message);
                break;

            case 'stream_data':
                this.handleStreamData(message);
                break;

            case 'stream_update':
                this.handleStreamUpdate(message);
                break;

            case 'stream_error':
                this.handleStreamError(message);
                break;

            case 'data_response':
                this.handleDataResponse(message);
                break;

            case 'mcp_tool_response':
                this.handleMCPToolResponse(message);
                break;

            case 'error':
                this.handleServerError(message);
                break;

            case 'pong':
                this.handlePong();
                break;

            default:
                console.warn('🍌 Unknown message type:', type);
                this.emit('unknownMessage', message);
        }

        // Handle pending requests
        if (requestId && this.pendingRequests.has(requestId)) {
            const { resolve } = this.pendingRequests.get(requestId);
            this.pendingRequests.delete(requestId);
            resolve(message);
        }
    }

    handleWelcome(message) {
        console.log('🍌 Received welcome from server:', message.server);
        this.emit('welcome', message);
    }

    handleSubscribed(message) {
        console.log('🍌 Subscribed to channel:', message.channel);
        this.emit('subscribed', message);
    }

    handleUnsubscribed(message) {
        console.log('🍌 Unsubscribed from channel:', message.channel);
        this.subscriptions.delete(message.channel);
        this.emit('unsubscribed', message);
    }

    handleChannelUpdate(message) {
        this.emit('channelUpdate', message);
        this.emit(`update:${message.channel}`, message.data);
    }

    handleStreamData(message) {
        this.emit('streamData', message);
        this.emit(`data:${message.channel}`, message.data);
    }

    handleStreamUpdate(message) {
        this.emit('streamUpdate', message);
        this.emit(`update:${message.channel}`, message.data);
    }

    handleStreamError(message) {
        console.error('🍌 Stream error:', message.error);
        this.emit('streamError', message);
        this.emit(`error:${message.channel}`, new Error(message.error));
    }

    handleDataResponse(message) {
        this.emit('dataResponse', message);
    }

    handleMCPToolResponse(message) {
        this.emit('mcpToolResponse', message);
        this.emit(`toolResponse:${message.tool}`, message.result);
    }

    handleServerError(message) {
        console.error('🍌 Server error:', message.error);
        this.emit('serverError', new Error(message.error));
    }

    handleClose(code, reason) {
        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.stopHeartbeat();
        
        console.log(`🍌 Connection closed: ${code} - ${reason}`);
        this.emit('disconnected', { code, reason });
        
        // Attempt reconnection if enabled
        if (this.options.reconnect && this.reconnectCount < this.options.maxReconnectAttempts) {
            this.attemptReconnect();
        }
    }

    handleError(error) {
        console.error('🍌 WebSocket error:', error);
        this.emit('error', error);
    }

    handlePong() {
        if (this.lastPingTime > 0) {
            this.metrics.lastLatency = Date.now() - this.lastPingTime;
        }
    }

    async attemptReconnect() {
        this.reconnectCount++;
        this.metrics.reconnectCount++;
        this.connectionState = 'reconnecting';
        
        console.log(`🍌 Attempting reconnection ${this.reconnectCount}/${this.options.maxReconnectAttempts}`);
        this.emit('reconnecting', { attempt: this.reconnectCount });
        
        setTimeout(async () => {
            try {
                await this.connect();
                console.log('🍌 Reconnection successful');
                this.emit('reconnected');
            } catch (error) {
                console.error('🍌 Reconnection failed:', error);
                if (this.reconnectCount >= this.options.maxReconnectAttempts) {
                    console.error('🍌 Max reconnection attempts reached');
                    this.emit('reconnectionFailed');
                } else {
                    this.attemptReconnect();
                }
            }
        }, this.options.reconnectInterval);
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected) {
                this.ping();
            }
        }, this.options.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    ping() {
        if (this.isConnected && this.ws) {
            this.lastPingTime = Date.now();
            this.send({ type: 'ping' });
        }
    }

    // Public API methods
    async subscribe(channel, filters = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected to streaming server');
        }

        const message = {
            type: 'subscribe',
            channel: channel,
            filters: filters
        };

        this.send(message);
        this.subscriptions.add(channel);
        
        return new Promise((resolve) => {
            this.once('subscribed', (response) => {
                if (response.channel === channel) {
                    resolve(response);
                }
            });
        });
    }

    async unsubscribe(channel) {
        if (!this.isConnected) {
            throw new Error('Not connected to streaming server');
        }

        const message = {
            type: 'unsubscribe',
            channel: channel
        };

        this.send(message);
        
        return new Promise((resolve) => {
            this.once('unsubscribed', (response) => {
                if (response.channel === channel) {
                    resolve(response);
                }
            });
        });
    }

    async requestData(dataType, parameters = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected to streaming server');
        }

        const requestId = this.generateRequestId();
        const message = {
            type: 'request_data',
            requestId: requestId,
            dataType: dataType,
            parameters: parameters
        };

        return this.sendWithResponse(message, requestId);
    }

    async callMCPTool(tool, parameters = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected to streaming server');
        }

        const requestId = this.generateRequestId();
        const message = {
            type: 'mcp_tool_call',
            requestId: requestId,
            tool: tool,
            parameters: parameters
        };

        return this.sendWithResponse(message, requestId);
    }

    // Convenience methods for common operations
    async getHubSpotContacts(filters = {}) {
        return this.requestData('hubspot_contacts', filters);
    }

    async getMCPStatus() {
        return this.requestData('mcp_status');
    }

    async getAnalytics(parameters = {}) {
        return this.requestData('analytics', parameters);
    }

    // Subscription convenience methods
    async subscribeToContacts(filters = {}) {
        return this.subscribe('hubspot_contacts', filters);
    }

    async subscribeToMCPStatus() {
        return this.subscribe('mcp_status');
    }

    async subscribeToPerformanceMetrics() {
        return this.subscribe('performance_metrics');
    }

    async subscribeToToolCalls(filters = {}) {
        return this.subscribe('tool_calls', filters);
    }

    // Private helper methods
    send(message) {
        if (!this.isConnected || !this.ws) {
            throw new Error('Not connected');
        }

        const data = JSON.stringify(message);
        this.ws.send(data);
        this.metrics.messagesSent++;
        this.metrics.bytesSent += data.length;
    }

    async sendWithResponse(message, requestId) {
        return new Promise((resolve, reject) => {
            this.pendingRequests.set(requestId, { resolve, reject });
            
            try {
                this.send(message);
            } catch (error) {
                this.pendingRequests.delete(requestId);
                reject(error);
            }

            // Timeout for request
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    this.pendingRequests.delete(requestId);
                    reject(new Error('Request timeout'));
                }
            }, this.options.timeout);
        });
    }

    generateRequestId() {
        return `req_${++this.requestIdCounter}_${Date.now()}`;
    }

    async resubscribeToChannels() {
        for (const channel of this.subscriptions) {
            try {
                await this.subscribe(channel);
                console.log(`🍌 Resubscribed to channel: ${channel}`);
            } catch (error) {
                console.error(`🍌 Failed to resubscribe to channel ${channel}:`, error);
            }
        }
    }

    // Status and metrics
    getConnectionState() {
        return this.connectionState;
    }

    isConnectedToServer() {
        return this.isConnected;
    }

    getMetrics() {
        return {
            ...this.metrics,
            connectionState: this.connectionState,
            subscriptions: Array.from(this.subscriptions),
            pendingRequests: this.pendingRequests.size
        };
    }

    getSubscriptions() {
        return Array.from(this.subscriptions);
    }

    // Cleanup
    disconnect() {
        this.options.reconnect = false; // Disable reconnection
        this.stopHeartbeat();
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
        }
        
        this.isConnected = false;
        this.connectionState = 'disconnected';
        this.subscriptions.clear();
        this.pendingRequests.clear();
        
        console.log('🍌 Disconnected from Banana Streaming Server');
        this.emit('disconnected', { code: 1000, reason: 'Client disconnect' });
    }
}

module.exports = BananaStreamingClient;