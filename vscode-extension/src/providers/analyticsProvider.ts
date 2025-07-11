import * as vscode from 'vscode';
import { MCPManager, MCPAnalytics } from '../mcpManager';

/**
 * 🍌 Analytics Tree Data Provider 🍌
 * 
 * Provides MCP usage analytics and performance metrics in VS Code sidebar
 */

export class AnalyticsProvider implements vscode.TreeDataProvider<AnalyticsItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AnalyticsItem | undefined | null | void> = new vscode.EventEmitter<AnalyticsItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AnalyticsItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private analytics: MCPAnalytics | null = null;
    private isLoading = false;

    constructor(private mcpManager: MCPManager) {
        this.loadAnalytics();
    }

    refresh(): void {
        this.loadAnalytics();
    }

    getTreeItem(element: AnalyticsItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AnalyticsItem): Promise<AnalyticsItem[]> {
        if (!element) {
            // Root level items
            if (!this.mcpManager.isConnected()) {
                return [
                    new AnalyticsItem(
                        'MCP Not Connected',
                        'Please check MCP connection',
                        vscode.TreeItemCollapsibleState.None,
                        'error'
                    )
                ];
            }

            if (this.isLoading) {
                return [
                    new AnalyticsItem(
                        'Loading analytics...',
                        'Fetching performance data',
                        vscode.TreeItemCollapsibleState.None,
                        'loading'
                    )
                ];
            }

            if (!this.analytics) {
                return [
                    new AnalyticsItem(
                        'No analytics data',
                        'Try refreshing or check MCP server',
                        vscode.TreeItemCollapsibleState.None,
                        'info'
                    )
                ];
            }

            return [
                new AnalyticsItem(
                    'Performance Overview',
                    'Overall system performance',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'dashboard'
                ),
                new AnalyticsItem(
                    'Tool Usage',
                    'Individual tool statistics',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'tools'
                ),
                new AnalyticsItem(
                    'Cache Performance',
                    'Caching efficiency metrics',
                    vscode.TreeItemCollapsibleState.Expanded,
                    'database'
                )
            ];
        }

        return this.getAnalyticsDetails(element);
    }

    private async loadAnalytics(): Promise<void> {
        if (!this.mcpManager.isConnected()) {
            this.analytics = null;
            this._onDidChangeTreeData.fire();
            return;
        }

        this.isLoading = true;
        this._onDidChangeTreeData.fire();

        try {
            this.analytics = await this.mcpManager.getAnalytics();
            console.log('🍌 Loaded analytics data');
        } catch (error: any) {
            console.error('🍌 Failed to load analytics:', error.message);
            this.analytics = null;
        } finally {
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
        }
    }

    private getAnalyticsDetails(element: AnalyticsItem): AnalyticsItem[] {
        if (!this.analytics) {
            return [];
        }

        switch (element.label) {
            case 'Performance Overview':
                return [
                    new AnalyticsItem(
                        'Average Response Time',
                        `${this.analytics.performance.avgResponseTime.toFixed(0)}ms`,
                        vscode.TreeItemCollapsibleState.None,
                        'clock'
                    ),
                    new AnalyticsItem(
                        'Total Requests',
                        this.formatNumber(this.analytics.performance.totalRequests),
                        vscode.TreeItemCollapsibleState.None,
                        'symbol-numeric'
                    ),
                    new AnalyticsItem(
                        'Error Rate',
                        `${(this.analytics.performance.errorRate * 100).toFixed(1)}%`,
                        vscode.TreeItemCollapsibleState.None,
                        this.analytics.performance.errorRate > 0.05 ? 'warning' : 'check'
                    ),
                    new AnalyticsItem(
                        'Success Rate',
                        `${((1 - this.analytics.performance.errorRate) * 100).toFixed(1)}%`,
                        vscode.TreeItemCollapsibleState.None,
                        'check-all'
                    )
                ];

            case 'Tool Usage':
                if (this.analytics.toolUsage.size === 0) {
                    return [
                        new AnalyticsItem(
                            'No tool usage data',
                            'No recent tool calls',
                            vscode.TreeItemCollapsibleState.None,
                            'info'
                        )
                    ];
                }

                // Sort tools by usage count
                const sortedTools = Array.from(this.analytics.toolUsage.entries())
                    .sort((a, b) => b[1].count - a[1].count)
                    .slice(0, 10); // Top 10 tools

                return sortedTools.map(([toolName, stats]) =>
                    new AnalyticsItem(
                        toolName,
                        `${stats.count} calls • ${stats.avgResponseTime.toFixed(0)}ms avg • ${(stats.successRate * 100).toFixed(1)}% success`,
                        vscode.TreeItemCollapsibleState.None,
                        this.getToolIcon(toolName)
                    )
                );

            case 'Cache Performance':
                return [
                    new AnalyticsItem(
                        'Cache Hit Rate',
                        `${(this.analytics.cache.hitRate * 100).toFixed(1)}%`,
                        vscode.TreeItemCollapsibleState.None,
                        this.analytics.cache.hitRate > 0.8 ? 'check' : this.analytics.cache.hitRate > 0.5 ? 'warning' : 'error'
                    ),
                    new AnalyticsItem(
                        'Cache Size',
                        this.formatBytes(this.analytics.cache.size),
                        vscode.TreeItemCollapsibleState.None,
                        'database'
                    ),
                    new AnalyticsItem(
                        'Cache Efficiency',
                        this.getCacheEfficiencyDescription(this.analytics.cache.hitRate),
                        vscode.TreeItemCollapsibleState.None,
                        'info'
                    )
                ];

            default:
                return [];
        }
    }

    private getToolIcon(toolName: string): string {
        if (toolName.startsWith('hubspot-')) {
            return 'organization';
        } else if (toolName.startsWith('banana-')) {
            return 'zap';
        } else {
            return 'tool';
        }
    }

    private formatNumber(num: number): string {
        if (num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        } else if (num >= 1000) {
            return `${(num / 1000).toFixed(1)}K`;
        } else {
            return num.toString();
        }
    }

    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }

    private getCacheEfficiencyDescription(hitRate: number): string {
        if (hitRate > 0.9) {
            return 'Excellent - High cache efficiency';
        } else if (hitRate > 0.8) {
            return 'Good - Cache working well';
        } else if (hitRate > 0.6) {
            return 'Fair - Some cache misses';
        } else if (hitRate > 0.3) {
            return 'Poor - Consider cache tuning';
        } else {
            return 'Very poor - Cache issues detected';
        }
    }

    public async showDetailedAnalytics(): Promise<void> {
        if (!this.analytics) {
            vscode.window.showWarningMessage('No analytics data available');
            return;
        }

        const analyticsReport = this.generateAnalyticsReport();
        
        const doc = await vscode.workspace.openTextDocument({
            content: analyticsReport,
            language: 'markdown'
        });
        
        await vscode.window.showTextDocument(doc);
    }

    private generateAnalyticsReport(): string {
        if (!this.analytics) {
            return '# No analytics data available';
        }

        const toolUsageTable = Array.from(this.analytics.toolUsage.entries())
            .sort((a, b) => b[1].count - a[1].count)
            .map(([tool, stats]) => 
                `| ${tool} | ${stats.count} | ${stats.avgResponseTime.toFixed(0)}ms | ${(stats.successRate * 100).toFixed(1)}% |`
            ).join('\n');

        return `# 🍌 HubSpot Banana MCP Analytics Report

Generated: ${new Date().toLocaleString()}

## Performance Overview

### Response Times
- **Average Response Time**: ${this.analytics.performance.avgResponseTime.toFixed(0)}ms
- **Total Requests**: ${this.formatNumber(this.analytics.performance.totalRequests)}
- **Error Rate**: ${(this.analytics.performance.errorRate * 100).toFixed(2)}%
- **Success Rate**: ${((1 - this.analytics.performance.errorRate) * 100).toFixed(2)}%

### Performance Rating
${this.getPerformanceRating()}

## Tool Usage Statistics

| Tool Name | Calls | Avg Time | Success Rate |
|-----------|-------|----------|--------------|
${toolUsageTable}

## Cache Performance

- **Hit Rate**: ${(this.analytics.cache.hitRate * 100).toFixed(1)}%
- **Cache Size**: ${this.formatBytes(this.analytics.cache.size)}
- **Efficiency**: ${this.getCacheEfficiencyDescription(this.analytics.cache.hitRate)}

### Cache Recommendations
${this.getCacheRecommendations()}

## Top Performing Tools

${this.getTopPerformingTools()}

## Performance Insights

${this.getPerformanceInsights()}

## Recommendations

${this.getRecommendations()}

---
*Report generated by HubSpot Banana MCP VS Code Extension*
`;
    }

    private getPerformanceRating(): string {
        if (!this.analytics) return 'No data';

        const avgTime = this.analytics.performance.avgResponseTime;
        const errorRate = this.analytics.performance.errorRate;
        
        if (avgTime < 200 && errorRate < 0.01) {
            return '🟢 **Excellent** - System performing optimally';
        } else if (avgTime < 500 && errorRate < 0.05) {
            return '🟡 **Good** - System performing well';
        } else if (avgTime < 1000 && errorRate < 0.1) {
            return '🟠 **Fair** - Some performance issues detected';
        } else {
            return '🔴 **Poor** - Performance optimization needed';
        }
    }

    private getCacheRecommendations(): string {
        if (!this.analytics) return 'No data';

        const hitRate = this.analytics.cache.hitRate;
        
        if (hitRate > 0.9) {
            return '✅ Cache is performing excellently. Current configuration is optimal.';
        } else if (hitRate > 0.7) {
            return '⚠️ Consider increasing cache TTL for frequently accessed data.';
        } else {
            return '❌ Cache hit rate is low. Review caching strategy and TTL settings.';
        }
    }

    private getTopPerformingTools(): string {
        if (!this.analytics) return 'No data';

        const topTools = Array.from(this.analytics.toolUsage.entries())
            .filter(([_, stats]) => stats.successRate > 0.95 && stats.avgResponseTime < 300)
            .sort((a, b) => a[1].avgResponseTime - b[1].avgResponseTime)
            .slice(0, 3);

        if (topTools.length === 0) {
            return 'No tools currently meeting optimal performance criteria.';
        }

        return topTools.map(([tool, stats], index) => 
            `${index + 1}. **${tool}** - ${stats.avgResponseTime.toFixed(0)}ms avg, ${(stats.successRate * 100).toFixed(1)}% success`
        ).join('\n');
    }

    private getPerformanceInsights(): string {
        if (!this.analytics) return 'No data';

        const insights: string[] = [];
        
        // Check for banana tool performance vs official tools
        const bananaTools = Array.from(this.analytics.toolUsage.entries())
            .filter(([tool]) => tool.startsWith('banana-'));
        const hubspotTools = Array.from(this.analytics.toolUsage.entries())
            .filter(([tool]) => tool.startsWith('hubspot-'));

        if (bananaTools.length > 0 && hubspotTools.length > 0) {
            const bananaAvg = bananaTools.reduce((sum, [_, stats]) => sum + stats.avgResponseTime, 0) / bananaTools.length;
            const hubspotAvg = hubspotTools.reduce((sum, [_, stats]) => sum + stats.avgResponseTime, 0) / hubspotTools.length;
            
            if (bananaAvg < hubspotAvg) {
                insights.push(`🍌 Banana-powered tools are ${((hubspotAvg - bananaAvg) / hubspotAvg * 100).toFixed(0)}% faster on average than official tools.`);
            }
        }

        // Check cache performance
        if (this.analytics.cache.hitRate > 0.8) {
            insights.push(`💾 High cache hit rate (${(this.analytics.cache.hitRate * 100).toFixed(1)}%) is significantly improving performance.`);
        }

        // Check error patterns
        if (this.analytics.performance.errorRate > 0.05) {
            insights.push(`⚠️ Error rate of ${(this.analytics.performance.errorRate * 100).toFixed(1)}% may indicate connectivity or configuration issues.`);
        }

        return insights.length > 0 ? insights.join('\n\n') : 'No specific performance insights at this time.';
    }

    private getRecommendations(): string {
        if (!this.analytics) return 'No data';

        const recommendations: string[] = [];
        
        // Response time recommendations
        if (this.analytics.performance.avgResponseTime > 500) {
            recommendations.push('🚀 **Optimize Response Times**: Consider enabling more banana-powered cached tools for better performance.');
        }

        // Cache recommendations
        if (this.analytics.cache.hitRate < 0.7) {
            recommendations.push('💾 **Improve Caching**: Increase cache TTL values and ensure frequently accessed data is cached.');
        }

        // Error rate recommendations
        if (this.analytics.performance.errorRate > 0.05) {
            recommendations.push('🔧 **Reduce Errors**: Review logs for common error patterns and improve error handling.');
        }

        // Tool usage recommendations
        const mostUsedTool = Array.from(this.analytics.toolUsage.entries())
            .sort((a, b) => b[1].count - a[1].count)[0];
        
        if (mostUsedTool && !mostUsedTool[0].startsWith('banana-')) {
            recommendations.push('🍌 **Consider Banana Tools**: Your most used tool could benefit from banana-powered caching optimization.');
        }

        return recommendations.length > 0 ? recommendations.join('\n\n') : '✅ System is performing well. Keep monitoring for optimal performance.';
    }
}

class AnalyticsItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly iconName: string
    ) {
        super(label, collapsibleState);

        this.tooltip = `${this.label}: ${this.description}`;
        this.description = this.description;
        this.iconPath = new vscode.ThemeIcon(iconName);

        // Add click action for detailed analytics
        if (this.label === 'Performance Overview') {
            this.command = {
                command: 'hubspot-banana-mcp.showAnalytics',
                title: 'Show Detailed Analytics'
            };
        }
    }
}