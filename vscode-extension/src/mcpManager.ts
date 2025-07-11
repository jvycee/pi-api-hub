import * as vscode from 'vscode';
import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';

/**
 * 🍌 MCP Manager - Core MCP Integration Logic 🍌
 * 
 * Manages connection to Pi API Hub MCP server and provides
 * high-level interface for MCP operations
 */

export interface MCPStatus {
    connected: boolean;
    serverUrl: string;
    version?: string;
    tools?: string[];
    health?: {
        status: string;
        uptime: number;
        memoryUsage: number;
    };
    lastCheck: Date;
}

export interface HubSpotContact {
    id: string;
    properties: {
        firstname?: string;
        lastname?: string;
        email?: string;
        company?: string;
        phone?: string;
        createdate?: string;
        lastmodifieddate?: string;
    };
}

export interface MCPAnalytics {
    toolUsage: Map<string, {
        count: number;
        avgResponseTime: number;
        successRate: number;
    }>;
    performance: {
        avgResponseTime: number;
        totalRequests: number;
        errorRate: number;
    };
    cache: {
        hitRate: number;
        size: number;
    };
}

export class MCPManager extends EventEmitter {
    private context: vscode.ExtensionContext;
    private httpClient: AxiosInstance;
    private status: MCPStatus;
    private isInitialized = false;
    private healthCheckInterval?: NodeJS.Timeout;

    constructor(context: vscode.ExtensionContext) {
        super();
        this.context = context;
        
        const config = vscode.workspace.getConfiguration('hubspot-banana-mcp');
        const serverUrl = config.get<string>('serverUrl') || 'http://localhost:3000';
        
        this.httpClient = axios.create({
            baseURL: serverUrl,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'VS-Code-HubSpot-Banana-MCP/1.0.0'
            }
        });

        this.status = {
            connected: false,
            serverUrl,
            lastCheck: new Date()
        };

        // Setup request interceptor for API key
        this.httpClient.interceptors.request.use((config) => {
            const apiKey = this.getApiKey();
            if (apiKey) {
                config.headers['X-API-Key'] = apiKey;
            }
            return config;
        });

        // Setup response interceptor for error handling
        this.httpClient.interceptors.response.use(
            (response) => response,
            (error) => {
                console.error('🍌 MCP API Error:', error.message);
                if (error.response?.status === 401) {
                    vscode.window.showErrorMessage('Invalid API key. Please check your HubSpot Banana MCP configuration.');
                }
                return Promise.reject(error);
            }
        );
    }

    async initialize(): Promise<void> {
        if (this.isInitialized) {
            return;
        }

        console.log('🍌 Initializing MCP Manager...');

        try {
            // Check if API key is configured
            const apiKey = this.getApiKey();
            if (!apiKey) {
                await this.promptForApiKey();
            }

            // Test connection
            await this.checkConnection();
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            this.isInitialized = true;
            console.log('🍌 MCP Manager initialized successfully');
        } catch (error: any) {
            console.error('🍌 Failed to initialize MCP Manager:', error.message);
            throw error;
        }
    }

    async checkConnection(): Promise<MCPStatus> {
        try {
            const response = await this.httpClient.get('/monitoring/mcp/status');
            
            this.status = {
                connected: true,
                serverUrl: this.status.serverUrl,
                version: response.data.version,
                tools: response.data.tools,
                health: response.data.health,
                lastCheck: new Date()
            };

            this.emit('statusChange', this.status);
            return this.status;
        } catch (error: any) {
            this.status = {
                connected: false,
                serverUrl: this.status.serverUrl,
                lastCheck: new Date()
            };

            this.emit('statusChange', this.status);
            throw new Error(`Failed to connect to MCP server: ${error.message}`);
        }
    }

    async getContacts(limit = 50): Promise<HubSpotContact[]> {
        try {
            const response = await this.httpClient.post('/api/hubspot/mcp/test', {
                model_id: 'vscode-extension',
                input: {
                    action: 'list_contacts',
                    limit
                }
            });

            if (response.data.success) {
                return response.data.data.contacts || [];
            } else {
                throw new Error(response.data.error || 'Failed to fetch contacts');
            }
        } catch (error: any) {
            console.error('🍌 Failed to fetch contacts:', error.message);
            throw error;
        }
    }

    async searchContacts(query: string): Promise<HubSpotContact[]> {
        try {
            const response = await this.httpClient.post('/api/hubspot/mcp/test', {
                model_id: 'vscode-extension',
                input: {
                    action: 'search_contacts',
                    query
                }
            });

            if (response.data.success) {
                return response.data.data.contacts || [];
            } else {
                throw new Error(response.data.error || 'Failed to search contacts');
            }
        } catch (error: any) {
            console.error('🍌 Failed to search contacts:', error.message);
            throw error;
        }
    }

    async getContact(contactId: string): Promise<HubSpotContact> {
        try {
            const response = await this.httpClient.post('/api/hubspot/mcp/test', {
                model_id: 'vscode-extension',
                input: {
                    action: 'get_contact',
                    contactId
                }
            });

            if (response.data.success) {
                return response.data.data.contact;
            } else {
                throw new Error(response.data.error || 'Failed to fetch contact');
            }
        } catch (error: any) {
            console.error('🍌 Failed to fetch contact:', error.message);
            throw error;
        }
    }

    async getAnalytics(): Promise<MCPAnalytics> {
        try {
            const response = await this.httpClient.get('/monitoring/analytics');
            
            return {
                toolUsage: new Map(Object.entries(response.data.toolUsage || {})),
                performance: response.data.performance || {
                    avgResponseTime: 0,
                    totalRequests: 0,
                    errorRate: 0
                },
                cache: response.data.cache || {
                    hitRate: 0,
                    size: 0
                }
            };
        } catch (error: any) {
            console.error('🍌 Failed to fetch analytics:', error.message);
            throw error;
        }
    }

    async testMCPConnection(): Promise<boolean> {
        try {
            const response = await this.httpClient.post('/api/hubspot/mcp/test', {
                model_id: 'vscode-extension-test',
                input: {
                    action: 'ping'
                }
            });

            return response.data.success === true;
        } catch (error) {
            return false;
        }
    }

    getStatus(): MCPStatus {
        return { ...this.status };
    }

    isConnected(): boolean {
        return this.status.connected;
    }

    private getApiKey(): string | undefined {
        // First check environment variable
        const envApiKey = process.env.BANANA_ADMIN_KEY;
        if (envApiKey) {
            return envApiKey;
        }

        // Then check VS Code configuration
        const config = vscode.workspace.getConfiguration('hubspot-banana-mcp');
        return this.context.globalState.get('apiKey') || config.get('apiKey');
    }

    private async promptForApiKey(): Promise<void> {
        const apiKey = await vscode.window.showInputBox({
            prompt: 'Enter your Banana Admin API Key',
            placeHolder: 'Get this from http://localhost:3000/setup/admin-key',
            ignoreFocusOut: true,
            password: true
        });

        if (apiKey) {
            await this.context.globalState.update('apiKey', apiKey);
        } else {
            throw new Error('API key is required for MCP connection');
        }
    }

    private startHealthMonitoring(): void {
        // Check health every 30 seconds
        this.healthCheckInterval = setInterval(async () => {
            try {
                await this.checkConnection();
            } catch (error) {
                // Connection check failed - status already updated in checkConnection
            }
        }, 30000);
    }

    public async openDashboard(): Promise<void> {
        const serverUrl = this.status.serverUrl;
        const dashboardUrl = `${serverUrl}/dashboard.html`;
        
        try {
            await vscode.env.openExternal(vscode.Uri.parse(dashboardUrl));
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to open dashboard: ${error.message}`);
        }
    }

    public async setupMCP(): Promise<void> {
        try {
            // Check if we have the required configuration
            const apiKey = this.getApiKey();
            
            if (!apiKey) {
                await this.promptForApiKey();
            }

            // Test connection
            const connected = await this.testMCPConnection();
            
            if (connected) {
                vscode.window.showInformationMessage('🍌 MCP setup completed successfully!');
                
                // Show setup instructions
                const setupDoc = await vscode.workspace.openTextDocument({
                    content: this.generateSetupInstructions(),
                    language: 'markdown'
                });
                vscode.window.showTextDocument(setupDoc);
            } else {
                vscode.window.showErrorMessage('Failed to connect to MCP server. Please check your configuration.');
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`MCP setup failed: ${error.message}`);
        }
    }

    private generateSetupInstructions(): string {
        return `# 🍌 HubSpot Banana MCP Setup Complete!

## VS Code Integration Status
✅ Extension installed and activated
✅ MCP server connection established
✅ API key configured

## Available Features

### 1. Contact Management
- View recent HubSpot contacts in the sidebar
- Search contacts using the command palette
- Quick contact details and actions

### 2. Real-time Monitoring
- MCP server status in the sidebar
- Usage analytics and performance metrics
- Health monitoring and alerts

### 3. Dashboard Access
- Open the web dashboard from VS Code
- Real-time performance monitoring
- Security and analytics overview

## Quick Start Commands

### Command Palette Commands
- \`HubSpot MCP: Check Status\` - Check MCP server status
- \`HubSpot MCP: Test Connection\` - Test MCP connectivity
- \`HubSpot MCP: Refresh Contacts\` - Refresh contact list
- \`HubSpot MCP: Search Contacts\` - Search HubSpot contacts
- \`HubSpot MCP: Open Dashboard\` - Open monitoring dashboard

### Sidebar Views
- **MCP Status** - Real-time server status and health
- **Recent Contacts** - Quick access to HubSpot contacts
- **Usage Analytics** - Performance metrics and insights

## Configuration

Access settings via: \`File > Preferences > Settings > HubSpot Banana MCP\`

- **Server URL**: ${this.status.serverUrl}
- **Auto Start**: Automatically connect on VS Code startup
- **Debug Mode**: Enable detailed logging
- **Cache TTL**: Configure caching behavior

## Next Steps

1. 🔍 **Explore Contacts**: Use the sidebar to browse your HubSpot contacts
2. 📊 **Monitor Performance**: Check the analytics view for usage insights
3. 🌐 **Open Dashboard**: Access the full web dashboard for detailed monitoring
4. ⚙️ **Customize Settings**: Adjust configuration to your preferences

## Getting Help

- View logs in the VS Code Output panel (HubSpot MCP channel)
- Check the MCP server status in the sidebar
- Visit the monitoring dashboard for detailed diagnostics

**🍌 Happy coding with banana-powered productivity! 🍌**
`;
    }

    dispose(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        this.removeAllListeners();
    }
}