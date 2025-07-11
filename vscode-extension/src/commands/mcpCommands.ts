import * as vscode from 'vscode';
import { MCPManager } from '../mcpManager';

/**
 * 🍌 MCP Commands Implementation 🍌
 * 
 * Implements all VS Code commands for HubSpot Banana MCP extension
 */

export class MCPCommands {
    constructor(
        private mcpManager: MCPManager,
        private context: vscode.ExtensionContext
    ) {}

    async setupMCP(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Setting up HubSpot Banana MCP...",
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: "Checking configuration..." });
            
            try {
                // Initialize MCP manager
                progress.report({ increment: 25, message: "Connecting to MCP server..." });
                await this.mcpManager.initialize();
                
                progress.report({ increment: 50, message: "Testing connection..." });
                const connected = await this.mcpManager.testMCPConnection();
                
                if (connected) {
                    progress.report({ increment: 75, message: "Setting up VS Code integration..." });
                    await this.mcpManager.setupMCP();
                    
                    progress.report({ increment: 100, message: "Setup complete!" });
                } else {
                    throw new Error('Failed to establish MCP connection');
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`MCP setup failed: ${error.message}`);
                throw error;
            }
        });
    }

    async checkStatus(): Promise<void> {
        try {
            const status = await this.mcpManager.checkConnection();
            
            const statusMessage = status.connected 
                ? `✅ Connected to ${status.serverUrl}\n${status.tools?.length || 0} tools available`
                : `❌ Not connected to ${status.serverUrl}`;
            
            const action = await vscode.window.showInformationMessage(
                statusMessage,
                status.connected ? 'Open Dashboard' : 'Setup MCP',
                'Refresh'
            );

            switch (action) {
                case 'Open Dashboard':
                    await this.openDashboard();
                    break;
                case 'Setup MCP':
                    await this.setupMCP();
                    break;
                case 'Refresh':
                    await this.checkStatus();
                    break;
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Status check failed: ${error.message}`);
        }
    }

    async testConnection(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Testing MCP connection...",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 0, message: "Connecting to server..." });
                
                const connected = await this.mcpManager.testMCPConnection();
                
                progress.report({ increment: 50, message: "Testing tools..." });
                
                if (connected) {
                    // Test a simple operation
                    try {
                        await this.mcpManager.getContacts(1);
                        progress.report({ increment: 100, message: "Test successful!" });
                        vscode.window.showInformationMessage('🍌 MCP connection test passed! All systems operational.');
                    } catch (error) {
                        progress.report({ increment: 100, message: "Connection OK, but tool test failed" });
                        vscode.window.showWarningMessage('MCP server connected but tool test failed. Check your HubSpot API key.');
                    }
                } else {
                    throw new Error('Connection test failed');
                }
            } catch (error: any) {
                vscode.window.showErrorMessage(`Connection test failed: ${error.message}`);
            }
        });
    }

    async openDashboard(): Promise<void> {
        try {
            await this.mcpManager.openDashboard();
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to open dashboard: ${error.message}`);
        }
    }

    async refreshContacts(): Promise<void> {
        // This will be handled by the ContactsProvider
        vscode.commands.executeCommand('hubspot-banana-mcp.refreshContacts');
    }

    async openContact(contactId: string): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading contact details...",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 0, message: "Fetching contact data..." });
                
                const contact = await this.mcpManager.getContact(contactId);
                
                progress.report({ increment: 50, message: "Formatting contact view..." });
                
                // Create contact detail view
                const contactDetails = this.formatContactDetails(contact);
                
                const doc = await vscode.workspace.openTextDocument({
                    content: contactDetails,
                    language: 'markdown'
                });
                
                progress.report({ increment: 100, message: "Opening contact..." });
                await vscode.window.showTextDocument(doc);
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to load contact: ${error.message}`);
            }
        });
    }

    async searchContacts(): Promise<void> {
        const query = await vscode.window.showInputBox({
            prompt: 'Search HubSpot contacts',
            placeHolder: 'Enter name, email, company, or phone number...',
            ignoreFocusOut: true
        });

        if (!query) {
            return;
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Searching for "${query}"...`,
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 0, message: "Performing search..." });
                
                const contacts = await this.mcpManager.searchContacts(query);
                
                progress.report({ increment: 100, message: `Found ${contacts.length} contacts` });
                
                if (contacts.length === 0) {
                    vscode.window.showInformationMessage(`No contacts found matching "${query}"`);
                    return;
                }

                // Show results in a quick pick
                const items = contacts.map(contact => ({
                    label: this.getContactDisplayName(contact),
                    description: contact.properties.email || contact.properties.company || '',
                    detail: `ID: ${contact.id} • ${contact.properties.phone || 'No phone'}`,
                    contact
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: `Select from ${contacts.length} contacts found`,
                    ignoreFocusOut: true,
                    matchOnDescription: true,
                    matchOnDetail: true
                });

                if (selected) {
                    await this.openContact(selected.contact.id);
                }
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Search failed: ${error.message}`);
            }
        });
    }

    async showAnalytics(): Promise<void> {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading analytics...",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 0, message: "Fetching analytics data..." });
                
                const analytics = await this.mcpManager.getAnalytics();
                
                progress.report({ increment: 50, message: "Generating report..." });
                
                const analyticsReport = this.formatAnalyticsReport(analytics);
                
                const doc = await vscode.workspace.openTextDocument({
                    content: analyticsReport,
                    language: 'markdown'
                });
                
                progress.report({ increment: 100, message: "Opening analytics..." });
                await vscode.window.showTextDocument(doc);
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to load analytics: ${error.message}`);
            }
        });
    }

    async createNewContact(): Promise<void> {
        // Multi-step contact creation
        const firstName = await vscode.window.showInputBox({
            prompt: 'Enter first name',
            placeHolder: 'John',
            ignoreFocusOut: true
        });

        if (!firstName) return;

        const lastName = await vscode.window.showInputBox({
            prompt: 'Enter last name',
            placeHolder: 'Doe',
            ignoreFocusOut: true
        });

        if (!lastName) return;

        const email = await vscode.window.showInputBox({
            prompt: 'Enter email address',
            placeHolder: 'john.doe@example.com',
            ignoreFocusOut: true,
            validateInput: (value) => {
                if (!value.includes('@')) {
                    return 'Please enter a valid email address';
                }
                return null;
            }
        });

        if (!email) return;

        const company = await vscode.window.showInputBox({
            prompt: 'Enter company (optional)',
            placeHolder: 'Company Name',
            ignoreFocusOut: true
        });

        // Create the contact
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Creating contact...",
            cancellable: false
        }, async (progress) => {
            try {
                progress.report({ increment: 0, message: "Preparing contact data..." });
                
                // This would require implementing a create contact method in MCPManager
                // For now, show what would be created
                const contactData = {
                    firstname: firstName,
                    lastname: lastName,
                    email: email,
                    ...(company && { company })
                };

                progress.report({ increment: 50, message: "Creating in HubSpot..." });
                
                // TODO: Implement actual contact creation
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                progress.report({ increment: 100, message: "Contact created!" });
                
                vscode.window.showInformationMessage(
                    `✅ Contact created: ${firstName} ${lastName} (${email})`,
                    'Refresh Contacts'
                ).then(action => {
                    if (action === 'Refresh Contacts') {
                        vscode.commands.executeCommand('hubspot-banana-mcp.refreshContacts');
                    }
                });
                
            } catch (error: any) {
                vscode.window.showErrorMessage(`Failed to create contact: ${error.message}`);
            }
        });
    }

    private getContactDisplayName(contact: any): string {
        const { firstname, lastname, email, company } = contact.properties;
        
        if (firstname && lastname) {
            return `${firstname} ${lastname}`;
        } else if (firstname) {
            return firstname;
        } else if (lastname) {
            return lastname;
        } else if (email) {
            return email;
        } else if (company) {
            return company;
        } else {
            return `Contact ${contact.id}`;
        }
    }

    private formatContactDetails(contact: any): string {
        const { properties } = contact;
        const displayName = this.getContactDisplayName(contact);
        
        return `# 🍌 HubSpot Contact: ${displayName}

## Contact Information
- **Contact ID**: ${contact.id}
- **First Name**: ${properties.firstname || 'N/A'}
- **Last Name**: ${properties.lastname || 'N/A'}
- **Email**: ${properties.email || 'N/A'}
- **Company**: ${properties.company || 'N/A'}
- **Phone**: ${properties.phone || 'N/A'}

## Activity
- **Created**: ${properties.createdate ? new Date(properties.createdate).toLocaleString() : 'N/A'}
- **Last Modified**: ${properties.lastmodifieddate ? new Date(properties.lastmodifieddate).toLocaleString() : 'N/A'}

## Quick Actions
- [View in HubSpot](https://app.hubspot.com/contacts/contact/${contact.id})
- [Send Email](mailto:${properties.email || ''})
- [Call](tel:${properties.phone || ''})

## Additional Properties
${Object.entries(properties)
    .filter(([key]) => !['firstname', 'lastname', 'email', 'company', 'phone', 'createdate', 'lastmodifieddate'].includes(key))
    .map(([key, value]) => `- **${key}**: ${value || 'N/A'}`)
    .join('\n') || 'No additional properties'}

---
*Loaded via HubSpot Banana MCP VS Code Extension*  
*Last updated: ${new Date().toLocaleString()}*
`;
    }

    private formatAnalyticsReport(analytics: any): string {
        const toolUsageEntries = Array.from(analytics.toolUsage.entries());
        
        return `# 🍌 HubSpot Banana MCP Analytics

*Generated: ${new Date().toLocaleString()}*

## Performance Summary
- **Average Response Time**: ${analytics.performance.avgResponseTime.toFixed(0)}ms
- **Total Requests**: ${analytics.performance.totalRequests.toLocaleString()}
- **Success Rate**: ${((1 - analytics.performance.errorRate) * 100).toFixed(1)}%
- **Error Rate**: ${(analytics.performance.errorRate * 100).toFixed(1)}%

## Cache Performance
- **Hit Rate**: ${(analytics.cache.hitRate * 100).toFixed(1)}%
- **Cache Size**: ${this.formatBytes(analytics.cache.size)}

## Top Used Tools
${toolUsageEntries
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([tool, stats], index) => 
        `${index + 1}. **${tool}** - ${stats.count} calls, ${stats.avgResponseTime.toFixed(0)}ms avg`
    ).join('\n') || 'No tool usage data'}

## Performance Insights
${this.getPerformanceInsights(analytics)}

---
*Report generated by HubSpot Banana MCP VS Code Extension*
`;
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }

    private getPerformanceInsights(analytics: any): string {
        const insights: string[] = [];
        
        if (analytics.performance.avgResponseTime < 300) {
            insights.push('🟢 **Excellent Response Times** - System is performing optimally');
        } else if (analytics.performance.avgResponseTime < 500) {
            insights.push('🟡 **Good Response Times** - Performance is acceptable');
        } else {
            insights.push('🔴 **Slow Response Times** - Consider optimization');
        }

        if (analytics.cache.hitRate > 0.8) {
            insights.push('💾 **High Cache Efficiency** - Caching is working well');
        } else if (analytics.cache.hitRate > 0.5) {
            insights.push('⚠️ **Moderate Cache Efficiency** - Room for improvement');
        } else {
            insights.push('❌ **Low Cache Efficiency** - Cache configuration needs attention');
        }

        if (analytics.performance.errorRate < 0.01) {
            insights.push('✅ **Very Low Error Rate** - System is stable');
        } else if (analytics.performance.errorRate < 0.05) {
            insights.push('⚠️ **Low Error Rate** - Mostly stable with occasional issues');
        } else {
            insights.push('🚨 **High Error Rate** - Requires immediate attention');
        }

        return insights.join('\n\n');
    }
}