const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('../shared/logger');
const config = require('../shared/config');
const mcpConfig = require('../config/mcp-config.json');

/**
 * 🍌 BANANA-POWERED MCP CLIENT CONFIGURATION MANAGER 🍌
 * 
 * Manages configuration files for various MCP clients:
 * - Claude Desktop
 * - Cursor
 * - Other MCP clients
 */
class MCPClientConfig {
    constructor() {
        this.configs = mcpConfig.clients;
        this.serverPort = config.server.port;
    }

    /**
     * Generate configuration for all enabled clients
     */
    async generateAllConfigs() {
        const results = {};
        
        for (const [clientName, clientConfig] of Object.entries(this.configs)) {
            if (clientConfig.enabled) {
                try {
                    const configData = await this.generateConfig(clientName, clientConfig);
                    results[clientName] = {
                        success: true,
                        config: configData,
                        path: clientConfig.config_path
                    };
                } catch (error) {
                    results[clientName] = {
                        success: false,
                        error: error.message
                    };
                }
            }
        }
        
        return results;
    }

    /**
     * Generate configuration for a specific client
     */
    async generateConfig(clientName, clientConfig) {
        switch (clientName) {
            case 'claude_desktop':
                return this.generateClaudeDesktopConfig(clientConfig);
            case 'cursor':
                return this.generateCursorConfig(clientConfig);
            default:
                return this.generateGenericConfig(clientName, clientConfig);
        }
    }

    /**
     * Generate Claude Desktop configuration
     */
    generateClaudeDesktopConfig(clientConfig) {
        const configPath = clientConfig.config_path.replace('~', os.homedir());
        const serverPath = path.join(process.cwd(), 'mcp-server', 'hybrid-server.js');
        
        return {
            mcpServers: {
                "hubspot-banana": {
                    command: "node",
                    args: [serverPath],
                    env: {
                        ...this.resolveEnvVars(clientConfig.env_vars),
                        BANANA_SERVER_PORT: this.serverPort.toString(),
                        MCP_MODE: "hybrid"
                    }
                }
            }
        };
    }

    /**
     * Generate Cursor configuration
     */
    generateCursorConfig(clientConfig) {
        const serverPath = path.join(process.cwd(), 'mcp-server', 'hybrid-server.js');
        
        return {
            mcpServers: {
                "hubspot-banana": {
                    command: "node",
                    args: [serverPath],
                    env: {
                        ...this.resolveEnvVars(clientConfig.env_vars),
                        BANANA_SERVER_PORT: this.serverPort.toString(),
                        MCP_MODE: "hybrid"
                    }
                }
            }
        };
    }

    /**
     * Generate generic MCP client configuration
     */
    generateGenericConfig(clientName, clientConfig) {
        const serverPath = path.join(process.cwd(), 'mcp-server', 'hybrid-server.js');
        
        return {
            name: `hubspot-banana-${clientName}`,
            command: clientConfig.server_command || "node",
            args: [serverPath],
            env: {
                ...this.resolveEnvVars(clientConfig.env_vars),
                BANANA_SERVER_PORT: this.serverPort.toString(),
                MCP_MODE: "hybrid"
            }
        };
    }

    /**
     * Resolve environment variables from placeholders
     */
    resolveEnvVars(envVars) {
        const resolved = {};
        
        for (const [key, value] of Object.entries(envVars)) {
            if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
                const envKey = value.slice(2, -1);
                resolved[key] = process.env[envKey] || '';
            } else {
                resolved[key] = value;
            }
        }
        
        return resolved;
    }

    /**
     * Write configuration file for a specific client
     */
    async writeConfig(clientName, configData) {
        const clientConfig = this.configs[clientName];
        if (!clientConfig) {
            throw new Error(`Unknown client: ${clientName}`);
        }
        
        const configPath = clientConfig.config_path.replace('~', os.homedir());
        const configDir = path.dirname(configPath);
        
        try {
            // Ensure directory exists
            await fs.mkdir(configDir, { recursive: true });
            
            // Write configuration
            await fs.writeFile(configPath, JSON.stringify(configData, null, 2));
            
            logger.info(`🍌 MCP configuration written for ${clientName}: ${configPath}`);
            return { success: true, path: configPath };
        } catch (error) {
            logger.error(`Failed to write ${clientName} config:`, error);
            throw error;
        }
    }

    /**
     * Read existing configuration file
     */
    async readConfig(clientName) {
        const clientConfig = this.configs[clientName];
        if (!clientConfig) {
            throw new Error(`Unknown client: ${clientName}`);
        }
        
        const configPath = clientConfig.config_path.replace('~', os.homedir());
        
        try {
            const configData = await fs.readFile(configPath, 'utf8');
            return JSON.parse(configData);
        } catch (error) {
            if (error.code === 'ENOENT') {
                return null; // File doesn't exist
            }
            throw error;
        }
    }

    /**
     * Merge with existing configuration
     */
    async mergeConfig(clientName, newConfig) {
        const existingConfig = await this.readConfig(clientName) || {};
        
        // Merge MCP servers
        if (existingConfig.mcpServers && newConfig.mcpServers) {
            existingConfig.mcpServers = {
                ...existingConfig.mcpServers,
                ...newConfig.mcpServers
            };
        } else if (newConfig.mcpServers) {
            existingConfig.mcpServers = newConfig.mcpServers;
        }
        
        return existingConfig;
    }

    /**
     * Generate setup instructions for users
     */
    generateSetupInstructions() {
        const instructions = {
            claude_desktop: {
                title: "Claude Desktop Setup",
                steps: [
                    "1. Install Claude Desktop from https://claude.ai/download",
                    "2. Set your HUBSPOT_PRIVATE_APP_TOKEN environment variable",
                    "3. Run the setup command: npm run mcp:setup-claude",
                    "4. Restart Claude Desktop",
                    "5. You should now see HubSpot tools available in Claude!"
                ],
                config_location: "~/Library/Application Support/Claude/claude_desktop_config.json"
            },
            cursor: {
                title: "Cursor Setup", 
                steps: [
                    "1. Install Cursor from https://cursor.sh/",
                    "2. Set your HUBSPOT_PRIVATE_APP_TOKEN environment variable",
                    "3. Run the setup command: npm run mcp:setup-cursor",
                    "4. Restart Cursor",
                    "5. You should now see HubSpot tools available in Cursor!"
                ],
                config_location: ".cursor/mcp.json"
            }
        };
        
        return instructions;
    }

    /**
     * Validate configuration
     */
    async validateConfig(clientName) {
        const clientConfig = this.configs[clientName];
        if (!clientConfig) {
            return { valid: false, error: `Unknown client: ${clientName}` };
        }
        
        const validation = {
            valid: true,
            errors: [],
            warnings: []
        };
        
        // Check if config file exists
        const configPath = clientConfig.config_path.replace('~', os.homedir());
        try {
            await fs.access(configPath);
        } catch (error) {
            validation.warnings.push(`Config file doesn't exist: ${configPath}`);
        }
        
        // Check environment variables
        const envVars = this.resolveEnvVars(clientConfig.env_vars);
        for (const [key, value] of Object.entries(envVars)) {
            if (!value) {
                validation.errors.push(`Missing environment variable: ${key}`);
                validation.valid = false;
            }
        }
        
        // Check if server file exists
        const serverPath = path.join(process.cwd(), 'mcp-server', 'hybrid-server.js');
        try {
            await fs.access(serverPath);
        } catch (error) {
            validation.errors.push(`Hybrid server file missing: ${serverPath}`);
            validation.valid = false;
        }
        
        return validation;
    }

    /**
     * Generate environment variable template
     */
    generateEnvTemplate() {
        return `# 🍌 BANANA-POWERED MCP ENVIRONMENT VARIABLES 🍌

# HubSpot Private App Token
# Get this from: Settings > Integrations > Private Apps in HubSpot
HUBSPOT_PRIVATE_APP_TOKEN=your_hubspot_private_app_token_here

# Banana Admin API Key (generated automatically)
BANANA_ADMIN_KEY=your_banana_admin_key_here

# Optional: Custom server port (defaults to 3000)
BANANA_SERVER_PORT=3000

# Optional: MCP mode (hybrid, official, banana)
MCP_MODE=hybrid
`;
    }

    /**
     * Get status of all client configurations
     */
    async getStatus() {
        const status = {};
        
        for (const [clientName, clientConfig] of Object.entries(this.configs)) {
            if (clientConfig.enabled) {
                const validation = await this.validateConfig(clientName);
                const config = await this.readConfig(clientName);
                
                status[clientName] = {
                    enabled: true,
                    configured: !!config,
                    valid: validation.valid,
                    errors: validation.errors,
                    warnings: validation.warnings,
                    config_path: clientConfig.config_path
                };
            } else {
                status[clientName] = {
                    enabled: false,
                    configured: false,
                    valid: false
                };
            }
        }
        
        return status;
    }
}

module.exports = MCPClientConfig;