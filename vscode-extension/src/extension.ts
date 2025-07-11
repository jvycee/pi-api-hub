import * as vscode from 'vscode';
import { MCPManager } from './mcpManager';
import { StatusProvider } from './providers/statusProvider';
import { ContactsProvider } from './providers/contactsProvider';
import { AnalyticsProvider } from './providers/analyticsProvider';
import { MCPCommands } from './commands/mcpCommands';
import { MCPWebviewProvider } from './webview/mcpWebviewProvider';

/**
 * 🍌 BANANA-POWERED VS CODE MCP EXTENSION 🍌
 * 
 * Provides HubSpot MCP integration for VS Code with:
 * - Real-time MCP server status monitoring
 * - HubSpot contact management
 * - Usage analytics and performance metrics
 * - Interactive dashboard and tools
 */

let mcpManager: MCPManager;
let statusProvider: StatusProvider;
let contactsProvider: ContactsProvider;
let analyticsProvider: AnalyticsProvider;
let mcpCommands: MCPCommands;

export function activate(context: vscode.ExtensionContext) {
    console.log('🍌 Activating HubSpot Banana MCP extension...');

    // Initialize MCP Manager
    mcpManager = new MCPManager(context);
    
    // Initialize Tree Data Providers
    statusProvider = new StatusProvider(mcpManager);
    contactsProvider = new ContactsProvider(mcpManager);
    analyticsProvider = new AnalyticsProvider(mcpManager);
    
    // Initialize Commands
    mcpCommands = new MCPCommands(mcpManager, context);

    // Register Tree Views
    vscode.window.createTreeView('hubspot-mcp-status', {
        treeDataProvider: statusProvider,
        showCollapseAll: true
    });

    vscode.window.createTreeView('hubspot-contacts', {
        treeDataProvider: contactsProvider,
        showCollapseAll: true
    });

    vscode.window.createTreeView('hubspot-analytics', {
        treeDataProvider: analyticsProvider,
        showCollapseAll: true
    });

    // Register Commands
    const commands = [
        vscode.commands.registerCommand('hubspot-banana-mcp.setupMCP', () => mcpCommands.setupMCP()),
        vscode.commands.registerCommand('hubspot-banana-mcp.checkStatus', () => mcpCommands.checkStatus()),
        vscode.commands.registerCommand('hubspot-banana-mcp.testConnection', () => mcpCommands.testConnection()),
        vscode.commands.registerCommand('hubspot-banana-mcp.openDashboard', () => mcpCommands.openDashboard()),
        vscode.commands.registerCommand('hubspot-banana-mcp.refreshContacts', () => mcpCommands.refreshContacts()),
        vscode.commands.registerCommand('hubspot-banana-mcp.openContact', (contactId: string) => mcpCommands.openContact(contactId)),
        vscode.commands.registerCommand('hubspot-banana-mcp.searchContacts', () => mcpCommands.searchContacts()),
        vscode.commands.registerCommand('hubspot-banana-mcp.showAnalytics', () => mcpCommands.showAnalytics())
    ];

    context.subscriptions.push(...commands);

    // Register Webview Provider
    const webviewProvider = new MCPWebviewProvider(context.extensionUri, mcpManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider('hubspot-mcp-dashboard', webviewProvider)
    );

    // Auto-start MCP if enabled
    const config = vscode.workspace.getConfiguration('hubspot-banana-mcp');
    if (config.get('enabled') && config.get('autoStart')) {
        mcpManager.initialize().then(() => {
            vscode.window.showInformationMessage('🍌 HubSpot Banana MCP activated successfully!');
        }).catch(error => {
            vscode.window.showErrorMessage(`Failed to initialize MCP: ${error.message}`);
        });
    }

    // Setup status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(database) HubSpot MCP';
    statusBarItem.tooltip = 'HubSpot Banana MCP Status';
    statusBarItem.command = 'hubspot-banana-mcp.checkStatus';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Update status bar based on MCP status
    mcpManager.onStatusChange((status) => {
        if (status.connected) {
            statusBarItem.text = '$(database) HubSpot MCP ✅';
            statusBarItem.backgroundColor = undefined;
        } else {
            statusBarItem.text = '$(database) HubSpot MCP ❌';
            statusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.errorBackground');
        }
        
        // Refresh tree views
        statusProvider.refresh();
        contactsProvider.refresh();
        analyticsProvider.refresh();
    });

    // Setup periodic refresh
    const refreshInterval = setInterval(() => {
        if (mcpManager.isConnected()) {
            contactsProvider.refresh();
            analyticsProvider.refresh();
        }
    }, 30000); // Refresh every 30 seconds

    context.subscriptions.push({
        dispose: () => clearInterval(refreshInterval)
    });

    console.log('🍌 HubSpot Banana MCP extension activated!');
}

export function deactivate() {
    console.log('🍌 Deactivating HubSpot Banana MCP extension...');
    
    if (mcpManager) {
        mcpManager.dispose();
    }
    
    console.log('🍌 HubSpot Banana MCP extension deactivated');
}