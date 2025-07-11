/**
 * 🍌 BANANA STREAMING DASHBOARD CLIENT 🍌
 * 
 * Browser-based real-time dashboard for streaming data visualization
 * Connects to Banana Streaming Server and displays live updates
 */

class BananaStreamingDashboard {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.charts = {};
        this.subscriptions = new Set();
        
        // Dashboard state
        this.data = {
            hubspotContacts: [],
            mcpStatus: {},
            performanceMetrics: {},
            toolCalls: []
        };
        
        // UI elements
        this.elements = {};
        
        this.init();
    }

    async init() {
        console.log('🍌 Initializing Banana Streaming Dashboard');
        
        // Cache DOM elements
        this.cacheElements();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize charts
        this.initializeCharts();
        
        // Connect to streaming server
        await this.connect();
        
        console.log('🍌 Dashboard initialization complete');
    }

    cacheElements() {
        this.elements = {
            // Connection status
            connectionStatus: document.getElementById('connection-status'),
            connectionIndicator: document.getElementById('connection-indicator'),
            
            // Controls
            connectBtn: document.getElementById('connect-btn'),
            disconnectBtn: document.getElementById('disconnect-btn'),
            subscribeBtn: document.getElementById('subscribe-btn'),
            
            // Data displays
            contactsList: document.getElementById('contacts-list'),
            mcpStatusDisplay: document.getElementById('mcp-status'),
            metricsDisplay: document.getElementById('metrics-display'),
            toolCallsLog: document.getElementById('tool-calls-log'),
            
            // Charts containers
            performanceChart: document.getElementById('performance-chart'),
            connectionChart: document.getElementById('connection-chart'),
            throughputChart: document.getElementById('throughput-chart'),
            
            // Stats
            totalConnections: document.getElementById('total-connections'),
            activeStreams: document.getElementById('active-streams'),
            messagesPerSec: document.getElementById('messages-per-sec'),
            latency: document.getElementById('latency'),
            
            // Controls
            channelSelect: document.getElementById('channel-select'),
            filtersInput: document.getElementById('filters-input'),
            autoRefresh: document.getElementById('auto-refresh')
        };
    }

    setupEventListeners() {
        // Connection controls
        if (this.elements.connectBtn) {
            this.elements.connectBtn.addEventListener('click', () => this.connect());
        }
        
        if (this.elements.disconnectBtn) {
            this.elements.disconnectBtn.addEventListener('click', () => this.disconnect());
        }
        
        // Subscription controls
        if (this.elements.subscribeBtn) {
            this.elements.subscribeBtn.addEventListener('click', () => this.handleSubscribe());
        }
        
        // Auto-refresh toggle
        if (this.elements.autoRefresh) {
            this.elements.autoRefresh.addEventListener('change', (e) => {
                this.toggleAutoRefresh(e.target.checked);
            });
        }
        
        // Real-time data request buttons
        document.querySelectorAll('[data-action=\"request-data\"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dataType = e.target.dataset.dataType;
                this.requestData(dataType);
            });
        });
        
        // MCP tool call buttons
        document.querySelectorAll('[data-action=\"call-tool\"]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.target.dataset.tool;
                this.callMCPTool(tool);
            });
        });
    }

    initializeCharts() {
        try {
            // Performance metrics chart
            if (this.elements.performanceChart && typeof Chart !== 'undefined') {
                this.charts.performance = new Chart(this.elements.performanceChart, {
                    type: 'line',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Response Time (ms)',
                            data: [],
                            borderColor: '#FFD700',
                            backgroundColor: 'rgba(255, 215, 0, 0.1)',
                            tension: 0.4
                        }, {
                            label: 'Error Rate (%)',
                            data: [],
                            borderColor: '#FF6B6B',
                            backgroundColor: 'rgba(255, 107, 107, 0.1)',
                            tension: 0.4,
                            yAxisID: 'y1'
                        }]
                    },
                    options: {
                        responsive: true,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        scales: {
                            x: {
                                display: true,
                                title: {
                                    display: true,
                                    text: 'Time'
                                }
                            },
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                title: {
                                    display: true,
                                    text: 'Response Time (ms)'
                                }
                            },
                            y1: {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                title: {
                                    display: true,
                                    text: 'Error Rate (%)'
                                },
                                grid: {
                                    drawOnChartArea: false,
                                },
                            }
                        }
                    }
                });
            }
            
            // Connection metrics chart
            if (this.elements.connectionChart && typeof Chart !== 'undefined') {
                this.charts.connections = new Chart(this.elements.connectionChart, {
                    type: 'doughnut',
                    data: {
                        labels: ['Active Connections', 'Available Capacity'],
                        datasets: [{
                            data: [0, 100],
                            backgroundColor: ['#4ECDC4', '#E8E8E8'],
                            borderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                position: 'bottom'
                            }
                        }
                    }
                });
            }
            
            // Throughput chart
            if (this.elements.throughputChart && typeof Chart !== 'undefined') {
                this.charts.throughput = new Chart(this.elements.throughputChart, {
                    type: 'bar',
                    data: {
                        labels: [],
                        datasets: [{
                            label: 'Messages/sec',
                            data: [],
                            backgroundColor: '#95E1D3',
                            borderColor: '#4ECDC4',
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        scales: {
                            y: {
                                beginAtZero: true,
                                title: {
                                    display: true,
                                    text: 'Messages per Second'
                                }
                            }
                        }
                    }
                });
            }
            
        } catch (error) {
            console.warn('🍌 Charts not available:', error.message);
        }
    }

    async connect() {
        if (this.isConnected) {
            console.log('🍌 Already connected');
            return;
        }

        try {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const host = window.location.host;
            const url = `${protocol}//${host}/stream`;
            
            console.log('🍌 Connecting to:', url);
            this.updateConnectionStatus('Connecting...', 'connecting');
            
            // Import the streaming client (assuming it's available globally or via module)
            if (typeof BananaStreamingClient === 'undefined') {
                throw new Error('BananaStreamingClient not available');
            }
            
            this.client = new BananaStreamingClient(url, {
                reconnect: true,
                heartbeatInterval: 30000
            });
            
            // Setup client event handlers
            this.setupClientHandlers();
            
            // Connect
            await this.client.connect();
            
        } catch (error) {
            console.error('🍌 Connection failed:', error);
            this.updateConnectionStatus('Connection Failed', 'error');
            this.showNotification('Connection failed: ' + error.message, 'error');
        }
    }

    setupClientHandlers() {
        this.client.on('connected', () => {
            this.isConnected = true;
            this.updateConnectionStatus('Connected', 'connected');
            this.showNotification('Connected to streaming server', 'success');
            this.enableControls();
        });

        this.client.on('disconnected', ({ code, reason }) => {
            this.isConnected = false;
            this.updateConnectionStatus('Disconnected', 'disconnected');
            this.showNotification(`Disconnected: ${reason}`, 'warning');
            this.disableControls();
        });

        this.client.on('reconnecting', ({ attempt }) => {
            this.updateConnectionStatus(`Reconnecting (${attempt})...`, 'connecting');
            this.showNotification(`Reconnection attempt ${attempt}`, 'info');
        });

        this.client.on('welcomeData', (data) => {
            console.log('🍌 Welcome data received:', data);
            this.displayWelcomeData(data);
        });

        // Data handlers
        this.client.on('data:hubspot_contacts', (contacts) => {
            this.updateContactsList(contacts);
        });

        this.client.on('update:mcp_status', (status) => {
            this.updateMCPStatus(status);
        });

        this.client.on('update:performance_metrics', (metrics) => {
            this.updatePerformanceMetrics(metrics);
        });

        this.client.on('update:tool_calls', (toolCall) => {
            this.addToolCallToLog(toolCall);
        });

        this.client.on('streamError', (error) => {
            console.error('🍌 Stream error:', error);
            this.showNotification('Stream error: ' + error.error, 'error');
        });

        this.client.on('error', (error) => {
            console.error('🍌 Client error:', error);
            this.showNotification('Client error: ' + error.message, 'error');
        });
    }

    async handleSubscribe() {
        if (!this.isConnected) {
            this.showNotification('Not connected to server', 'error');
            return;
        }

        const channel = this.elements.channelSelect?.value;
        if (!channel) {
            this.showNotification('Please select a channel', 'error');
            return;
        }

        try {
            let filters = {};
            if (this.elements.filtersInput?.value) {
                filters = JSON.parse(this.elements.filtersInput.value);
            }

            await this.client.subscribe(channel, filters);
            this.subscriptions.add(channel);
            this.showNotification(`Subscribed to ${channel}`, 'success');
            this.updateSubscriptionsList();
            
        } catch (error) {
            console.error('🍌 Subscription failed:', error);
            this.showNotification('Subscription failed: ' + error.message, 'error');
        }
    }

    async requestData(dataType) {
        if (!this.isConnected) {
            this.showNotification('Not connected to server', 'error');
            return;
        }

        try {
            console.log(`🍌 Requesting ${dataType} data`);
            const response = await this.client.requestData(dataType);
            console.log(`🍌 Received ${dataType} data:`, response);
            this.showNotification(`${dataType} data updated`, 'success');
            
        } catch (error) {
            console.error(`🍌 Failed to request ${dataType}:`, error);
            this.showNotification(`Failed to get ${dataType}: ${error.message}`, 'error');
        }
    }

    async callMCPTool(tool, parameters = {}) {
        if (!this.isConnected) {
            this.showNotification('Not connected to server', 'error');
            return;
        }

        try {
            console.log(`🍌 Calling MCP tool: ${tool}`);
            const response = await this.client.callMCPTool(tool, parameters);
            console.log(`🍌 MCP tool response:`, response);
            this.showNotification(`Tool ${tool} executed successfully`, 'success');
            
        } catch (error) {
            console.error(`🍌 MCP tool call failed:`, error);
            this.showNotification(`Tool call failed: ${error.message}`, 'error');
        }
    }

    // UI Update Methods
    updateConnectionStatus(status, state) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = status;
        }
        
        if (this.elements.connectionIndicator) {
            this.elements.connectionIndicator.className = `connection-indicator ${state}`;
        }
    }

    updateContactsList(contacts) {
        if (!this.elements.contactsList) return;
        
        this.data.hubspotContacts = contacts;
        
        const html = contacts.map(contact => `
            <div class="contact-item">
                <div class="contact-name">
                    ${contact.properties.firstname || ''} ${contact.properties.lastname || ''}
                </div>
                <div class="contact-email">${contact.properties.email || ''}</div>
                <div class="contact-company">${contact.properties.company || ''}</div>
            </div>
        `).join('');
        
        this.elements.contactsList.innerHTML = html;
    }

    updateMCPStatus(status) {
        if (!this.elements.mcpStatusDisplay) return;
        
        this.data.mcpStatus = status;
        
        const html = `
            <div class=\"status-item\">
                <span class=\"label\">Status:</span>
                <span class=\"value ${status.connected ? 'connected' : 'disconnected'}\">
                    ${status.connected ? '✅ Connected' : '❌ Disconnected'}
                </span>
            </div>
            <div class=\"status-item\">
                <span class=\"label\">Tools Available:</span>
                <span class=\"value\">${status.toolsAvailable || 0}</span>
            </div>
            <div class=\"status-item\">
                <span class=\"label\">Uptime:</span>
                <span class=\"value\">${this.formatUptime(status.uptime)}</span>
            </div>
        `;
        
        this.elements.mcpStatusDisplay.innerHTML = html;
    }

    updatePerformanceMetrics(metrics) {
        if (!metrics) return;
        
        this.data.performanceMetrics = metrics;
        
        // Update stats display
        if (this.elements.totalConnections) {
            this.elements.totalConnections.textContent = metrics.streaming?.totalConnections || 0;
        }
        if (this.elements.activeStreams) {
            this.elements.activeStreams.textContent = metrics.streaming?.activeConnections || 0;
        }
        if (this.elements.messagesPerSec) {
            this.elements.messagesPerSec.textContent = metrics.streaming?.messagesPerSecond || 0;
        }
        if (this.elements.latency) {
            this.elements.latency.textContent = `${metrics.manager?.lastLatency || 0}ms`;
        }
        
        // Update charts
        this.updatePerformanceChart(metrics);
        this.updateConnectionChart(metrics);
        this.updateThroughputChart(metrics);
    }

    updatePerformanceChart(metrics) {
        if (!this.charts.performance) return;
        
        const chart = this.charts.performance;
        const now = new Date().toLocaleTimeString();
        
        // Add new data point
        chart.data.labels.push(now);
        chart.data.datasets[0].data.push(metrics.streaming?.avgResponseTime || 0);
        chart.data.datasets[1].data.push((metrics.streaming?.errorRate || 0) * 100);
        
        // Keep only last 20 data points
        if (chart.data.labels.length > 20) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
            chart.data.datasets[1].data.shift();
        }
        
        chart.update('none');
    }

    updateConnectionChart(metrics) {
        if (!this.charts.connections) return;
        
        const chart = this.charts.connections;
        const active = metrics.streaming?.activeConnections || 0;
        const total = metrics.streaming?.maxConnections || 1000;
        
        chart.data.datasets[0].data = [active, total - active];
        chart.update();
    }

    updateThroughputChart(metrics) {
        if (!this.charts.throughput) return;
        
        const chart = this.charts.throughput;
        const now = new Date().toLocaleTimeString();
        
        chart.data.labels.push(now);
        chart.data.datasets[0].data.push(metrics.streaming?.messagesPerSecond || 0);
        
        // Keep only last 15 data points
        if (chart.data.labels.length > 15) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        
        chart.update('none');
    }

    addToolCallToLog(toolCall) {
        if (!this.elements.toolCallsLog) return;
        
        const logEntry = document.createElement('div');
        logEntry.className = 'tool-call-entry';
        logEntry.innerHTML = `
            <div class=\"tool-header\">
                <span class=\"tool-name\">${toolCall.tool}</span>
                <span class=\"tool-time\">${new Date(toolCall.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class=\"tool-result ${toolCall.result?.success ? 'success' : 'error'}\">
                ${toolCall.result?.success ? '✅ Success' : '❌ Failed'}
            </div>
        `;
        
        this.elements.toolCallsLog.insertBefore(logEntry, this.elements.toolCallsLog.firstChild);
        
        // Keep only last 50 entries
        while (this.elements.toolCallsLog.children.length > 50) {
            this.elements.toolCallsLog.removeChild(this.elements.toolCallsLog.lastChild);
        }
    }

    displayWelcomeData(data) {
        console.log('🍌 System features:', data.features);
        console.log('🍌 Available channels:', data.availableChannels);
        
        // Update channel select options
        if (this.elements.channelSelect) {
            this.elements.channelSelect.innerHTML = data.availableChannels
                .map(channel => `<option value="${channel}">${channel}</option>`)
                .join('');
        }
    }

    updateSubscriptionsList() {
        const list = document.getElementById('subscriptions-list');
        if (list) {
            list.innerHTML = Array.from(this.subscriptions)
                .map(channel => `<li>${channel}</li>`)
                .join('');
        }
    }

    enableControls() {
        document.querySelectorAll('[data-requires-connection]').forEach(el => {
            el.disabled = false;
        });
    }

    disableControls() {
        document.querySelectorAll('[data-requires-connection]').forEach(el => {
            el.disabled = true;
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    formatUptime(uptime) {
        if (!uptime) return 'Unknown';
        
        const seconds = Math.floor(uptime / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    toggleAutoRefresh(enabled) {
        if (enabled) {
            this.autoRefreshInterval = setInterval(() => {
                if (this.isConnected) {
                    this.requestData('performance_metrics');
                }
            }, 5000);
        } else {
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
                this.autoRefreshInterval = null;
            }
        }
    }

    disconnect() {
        if (this.client) {
            this.client.disconnect();
        }
        this.isConnected = false;
        this.subscriptions.clear();
        this.updateConnectionStatus('Disconnected', 'disconnected');
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.streamingDashboard = new BananaStreamingDashboard();
});

// Global functions for button handlers
window.connectStreaming = () => window.streamingDashboard?.connect();
window.disconnectStreaming = () => window.streamingDashboard?.disconnect();
window.requestStreamingData = (type) => window.streamingDashboard?.requestData(type);
window.callStreamingTool = (tool) => window.streamingDashboard?.callMCPTool(tool);