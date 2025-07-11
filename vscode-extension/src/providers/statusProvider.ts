import * as vscode from 'vscode';
import { MCPManager, MCPStatus } from '../mcpManager';

/**
 * 🍌 Status Tree Data Provider 🍌
 * 
 * Provides real-time MCP server status information in VS Code sidebar
 */

export class StatusProvider implements vscode.TreeDataProvider<StatusItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<StatusItem | undefined | null | void> = new vscode.EventEmitter<StatusItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<StatusItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private mcpManager: MCPManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: StatusItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: StatusItem): Promise<StatusItem[]> {
        if (!element) {
            // Root level items
            const status = this.mcpManager.getStatus();
            
            return [
                new StatusItem(
                    'Connection Status',
                    status.connected ? 'Connected ✅' : 'Disconnected ❌',
                    vscode.TreeItemCollapsibleState.Expanded,
                    status.connected ? 'check' : 'error'
                ),
                new StatusItem(
                    'Server Info',
                    'Server Information',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'server'
                ),
                new StatusItem(
                    'Health Metrics',
                    'Health & Performance',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'pulse'
                ),
                new StatusItem(
                    'Tools Available',
                    'Available MCP Tools',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'tools'
                )
            ];
        }

        return this.getStatusDetails(element);
    }

    private async getStatusDetails(element: StatusItem): Promise<StatusItem[]> {
        const status = this.mcpManager.getStatus();

        switch (element.label) {
            case 'Connection Status':
                return [
                    new StatusItem(
                        'Server URL',
                        status.serverUrl,
                        vscode.TreeItemCollapsibleState.None,
                        'link'
                    ),
                    new StatusItem(
                        'Last Check',
                        status.lastCheck.toLocaleTimeString(),
                        vscode.TreeItemCollapsibleState.None,
                        'clock'
                    ),
                    new StatusItem(
                        'Version',
                        status.version || 'Unknown',
                        vscode.TreeItemCollapsibleState.None,
                        'tag'
                    )
                ];

            case 'Server Info':
                if (!status.connected) {
                    return [
                        new StatusItem(
                            'Status',
                            'Server not connected',
                            vscode.TreeItemCollapsibleState.None,
                            'error'
                        )
                    ];
                }

                return [
                    new StatusItem(
                        'Mode',
                        'Hybrid (Official + Banana)',
                        vscode.TreeItemCollapsibleState.None,
                        'settings'
                    ),
                    new StatusItem(
                        'API Version',
                        'v1.0.0',
                        vscode.TreeItemCollapsibleState.None,
                        'tag'
                    ),
                    new StatusItem(
                        'Protocol',
                        'Model Context Protocol',
                        vscode.TreeItemCollapsibleState.None,
                        'link'
                    )
                ];

            case 'Health Metrics':
                if (!status.connected || !status.health) {
                    return [
                        new StatusItem(
                            'Status',
                            'Health data unavailable',
                            vscode.TreeItemCollapsibleState.None,
                            'warning'
                        )
                    ];
                }

                const uptime = this.formatUptime(status.health.uptime);
                const memory = this.formatMemory(status.health.memoryUsage);

                return [
                    new StatusItem(
                        'Health Status',
                        status.health.status,
                        vscode.TreeItemCollapsibleState.None,
                        status.health.status === 'healthy' ? 'check' : 'warning'
                    ),
                    new StatusItem(
                        'Uptime',
                        uptime,
                        vscode.TreeItemCollapsibleState.None,
                        'clock'
                    ),
                    new StatusItem(
                        'Memory Usage',
                        memory,
                        vscode.TreeItemCollapsibleState.None,
                        'dashboard'
                    )
                ];

            case 'Tools Available':
                if (!status.connected || !status.tools) {
                    return [
                        new StatusItem(
                            'Status',
                            'Tools list unavailable',
                            vscode.TreeItemCollapsibleState.None,
                            'warning'
                        )
                    ];
                }

                return status.tools.map(tool => 
                    new StatusItem(
                        tool,
                        this.getToolDescription(tool),
                        vscode.TreeItemCollapsibleState.None,
                        this.getToolIcon(tool)
                    )
                );

            default:
                return [];
        }
    }

    private formatUptime(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (days > 0) {
            return `${days}d ${hours}h ${minutes}m`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else {
            return `${minutes}m`;
        }
    }

    private formatMemory(bytes: number): string {
        const mb = bytes / 1024 / 1024;
        return `${mb.toFixed(1)} MB`;
    }

    private getToolDescription(tool: string): string {
        const descriptions: Record<string, string> = {
            'hubspot-list-objects': 'List HubSpot objects',
            'hubspot-search-objects': 'Search HubSpot objects',
            'hubspot-get-user-details': 'Get user information',
            'hubspot-create-engagement': 'Create engagements',
            'banana-get-contacts-cached': 'Cached contact retrieval',
            'banana-get-contacts-streaming': 'Streaming contact data',
            'banana-search-cached': 'Cached search results',
            'banana-usage-analytics': 'Usage analytics'
        };

        return descriptions[tool] || 'MCP Tool';
    }

    private getToolIcon(tool: string): string {
        if (tool.startsWith('hubspot-')) {
            return 'organization';
        } else if (tool.startsWith('banana-')) {
            return 'zap';
        } else {
            return 'tool';
        }
    }
}

class StatusItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName?: string
    ) {
        super(label, collapsibleState);

        this.tooltip = `${this.label}: ${this.description}`;
        this.description = this.description;

        if (iconName) {
            this.iconPath = new vscode.ThemeIcon(iconName);
        }

        // Add context value for specific actions
        if (this.label === 'Server URL') {
            this.contextValue = 'serverUrl';
            this.command = {
                command: 'hubspot-banana-mcp.openDashboard',
                title: 'Open Dashboard'
            };
        }
    }
}