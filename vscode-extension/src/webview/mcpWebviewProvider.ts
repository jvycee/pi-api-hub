import * as vscode from 'vscode';
import { MCPManager } from '../mcpManager';

/**
 * 🍌 MCP Webview Provider 🍌
 * 
 * Provides interactive dashboard within VS Code
 */

export class MCPWebviewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'hubspot-mcp-dashboard';

    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
        private mcpManager: MCPManager
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            allowScripts: true,
            localResourceRoots: [
                this._extensionUri
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'refresh':
                        this.refresh();
                        break;
                    case 'openDashboard':
                        this.mcpManager.openDashboard();
                        break;
                    case 'testConnection':
                        vscode.commands.executeCommand('hubspot-banana-mcp.testConnection');
                        break;
                    case 'searchContacts':
                        vscode.commands.executeCommand('hubspot-banana-mcp.searchContacts');
                        break;
                }
            },
            undefined,
            []
        );

        // Initial data load
        this.updateWebview();

        // Listen for status changes
        this.mcpManager.on('statusChange', () => {
            this.updateWebview();
        });
    }

    private async updateWebview() {
        if (!this._view) {
            return;
        }

        try {
            const status = this.mcpManager.getStatus();
            const analytics = this.mcpManager.isConnected() ? 
                await this.mcpManager.getAnalytics() : null;

            this._view.webview.postMessage({
                command: 'updateData',
                status: status,
                analytics: analytics ? {
                    performance: analytics.performance,
                    cache: analytics.cache,
                    toolUsage: Object.fromEntries(analytics.toolUsage.entries())
                } : null
            });
        } catch (error) {
            console.error('Failed to update webview data:', error);
        }
    }

    public refresh() {
        this.updateWebview();
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const styleVscode = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${styleVscode}" rel="stylesheet">
    <title>HubSpot MCP Dashboard</title>
    <style>
        body {
            padding: 10px;
            font-size: 12px;
            line-height: 1.4;
        }
        .header {
            text-align: center;
            margin-bottom: 15px;
            padding: 10px;
            background: var(--vscode-badge-background);
            border-radius: 4px;
        }
        .status-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-bottom: 15px;
        }
        .status-card {
            padding: 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 4px;
            text-align: center;
        }
        .status-connected {
            border-color: var(--vscode-testing-iconPassed);
            background: var(--vscode-testing-iconPassed)20;
        }
        .status-disconnected {
            border-color: var(--vscode-testing-iconFailed);
            background: var(--vscode-testing-iconFailed)20;
        }
        .metric {
            display: flex;
            justify-content: space-between;
            padding: 4px 0;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
        .metric:last-child {
            border-bottom: none;
        }
        .metric-label {
            font-weight: bold;
        }
        .metric-value {
            color: var(--vscode-descriptionForeground);
        }
        .actions {
            margin-top: 15px;
        }
        .action-button {
            display: block;
            width: 100%;
            padding: 8px;
            margin-bottom: 5px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-align: center;
        }
        .action-button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .action-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
        .tools-list {
            max-height: 150px;
            overflow-y: auto;
            margin-top: 10px;
        }
        .tool-item {
            padding: 4px 8px;
            margin: 2px 0;
            background: var(--vscode-list-hoverBackground);
            border-radius: 3px;
            font-size: 11px;
        }
        .banana-tool {
            border-left: 3px solid #FFD700;
        }
        .hubspot-tool {
            border-left: 3px solid #FF7A59;
        }
        .loading {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
        }
        .error {
            color: var(--vscode-errorForeground);
            background: var(--vscode-inputValidation-errorBackground);
            padding: 8px;
            border-radius: 4px;
            margin: 8px 0;
        }
        .section-title {
            font-weight: bold;
            margin: 15px 0 8px 0;
            padding-bottom: 4px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }
    </style>
</head>
<body>
    <div class="header">
        <h3>🍌 HubSpot MCP</h3>
        <p>Banana-Powered Integration</p>
    </div>

    <div id="content">
        <div class="loading">Loading dashboard...</div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentData = null;

        // Handle messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateData':
                    currentData = message;
                    updateDashboard(message.status, message.analytics);
                    break;
            }
        });

        function updateDashboard(status, analytics) {
            const content = document.getElementById('content');
            
            const html = \`
                <div class="status-grid">
                    <div class="status-card \${status.connected ? 'status-connected' : 'status-disconnected'}">
                        <div style="font-weight: bold;">\${status.connected ? '✅ Connected' : '❌ Disconnected'}</div>
                        <div style="font-size: 10px; margin-top: 4px;">
                            \${status.connected ? 'Server Online' : 'Check Connection'}
                        </div>
                    </div>
                    <div class="status-card">
                        <div style="font-weight: bold;">Tools</div>
                        <div style="font-size: 10px; margin-top: 4px;">
                            \${status.tools ? status.tools.length : 0} Available
                        </div>
                    </div>
                </div>

                \${status.connected && analytics ? \`
                    <div class="section-title">Performance</div>
                    <div class="metric">
                        <span class="metric-label">Response Time</span>
                        <span class="metric-value">\${analytics.performance.avgResponseTime.toFixed(0)}ms</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Success Rate</span>
                        <span class="metric-value">\${((1 - analytics.performance.errorRate) * 100).toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Cache Hit Rate</span>
                        <span class="metric-value">\${(analytics.cache.hitRate * 100).toFixed(1)}%</span>
                    </div>
                    <div class="metric">
                        <span class="metric-label">Total Requests</span>
                        <span class="metric-value">\${analytics.performance.totalRequests.toLocaleString()}</span>
                    </div>
                \` : ''}

                \${status.tools && status.tools.length > 0 ? \`
                    <div class="section-title">Available Tools</div>
                    <div class="tools-list">
                        \${status.tools.map(tool => \`
                            <div class="tool-item \${tool.startsWith('banana-') ? 'banana-tool' : 'hubspot-tool'}">
                                \${tool}
                            </div>
                        \`).join('')}
                    </div>
                \` : ''}

                <div class="actions">
                    <button class="action-button" onclick="sendCommand('refresh')">
                        🔄 Refresh
                    </button>
                    <button class="action-button" onclick="sendCommand('testConnection')" \${!status.connected ? '' : ''}>
                        🔧 Test Connection
                    </button>
                    <button class="action-button" onclick="sendCommand('searchContacts')" \${!status.connected ? 'disabled' : ''}>
                        🔍 Search Contacts
                    </button>
                    <button class="action-button" onclick="sendCommand('openDashboard')" \${!status.connected ? 'disabled' : ''}>
                        🌐 Open Web Dashboard
                    </button>
                </div>
            \`;
            
            content.innerHTML = html;
        }

        function sendCommand(command) {
            vscode.postMessage({ command: command });
        }

        // Initial refresh request
        sendCommand('refresh');
    </script>
</body>
</html>`;
    }
}