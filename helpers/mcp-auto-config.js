const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execSync } = require('child_process');
const logger = require('../shared/logger');
const MCPClientConfig = require('./mcp-client-config');

/**
 * 🍌 BANANA-POWERED MCP AUTO-CONFIGURATION SYSTEM 🍌
 * 
 * Automatically detects, configures, and manages MCP clients
 */
class MCPAutoConfig {
  constructor() {
    this.clientConfig = new MCPClientConfig();
    this.detectedClients = new Map();
    this.configWatchers = new Map();
    this.validationResults = new Map();
    this.autoHealingEnabled = true;
    this.configHashes = new Map();
    
    logger.info('🍌 MCP Auto-Configuration System initialized');
  }

  /**
   * Auto-detect all available MCP clients
   */
  async detectClients() {
    const detectionResults = new Map();
    
    // Detect Claude Desktop
    const claudeDesktopDetection = await this.detectClaudeDesktop();
    if (claudeDesktopDetection.detected) {
      detectionResults.set('claude_desktop', claudeDesktopDetection);
    }

    // Detect Cursor
    const cursorDetection = await this.detectCursor();
    if (cursorDetection.detected) {
      detectionResults.set('cursor', cursorDetection);
    }

    // Detect VS Code (potential MCP support)
    const vscodeDetection = await this.detectVSCode();
    if (vscodeDetection.detected) {
      detectionResults.set('vscode', vscodeDetection);
    }

    // Detect Continue.dev
    const continueDetection = await this.detectContinue();
    if (continueDetection.detected) {
      detectionResults.set('continue', continueDetection);
    }

    this.detectedClients = detectionResults;
    
    logger.info(`🍌 MCP Client Detection Complete: ${detectionResults.size} clients detected`, {
      clients: Array.from(detectionResults.keys())
    });

    return detectionResults;
  }

  /**
   * Detect Claude Desktop installation
   */
  async detectClaudeDesktop() {
    const result = {
      detected: false,
      name: 'Claude Desktop',
      version: null,
      configPath: null,
      executable: null,
      status: 'not_found'
    };

    try {
      // Check macOS installation
      if (process.platform === 'darwin') {
        const macPaths = [
          '/Applications/Claude.app',
          path.join(os.homedir(), 'Applications/Claude.app')
        ];

        for (const appPath of macPaths) {
          try {
            await fs.access(appPath);
            result.detected = true;
            result.executable = appPath;
            result.configPath = path.join(os.homedir(), 'Library/Application Support/Claude/claude_desktop_config.json');
            result.status = 'found';
            break;
          } catch (error) {
            // Continue checking other paths
          }
        }
      }

      // Check Windows installation
      if (process.platform === 'win32') {
        const winPaths = [
          path.join(os.homedir(), 'AppData/Local/Claude/Claude.exe'),
          path.join(os.homedir(), 'AppData/Roaming/Claude/Claude.exe')
        ];

        for (const exePath of winPaths) {
          try {
            await fs.access(exePath);
            result.detected = true;
            result.executable = exePath;
            result.configPath = path.join(os.homedir(), 'AppData/Roaming/Claude/claude_desktop_config.json');
            result.status = 'found';
            break;
          } catch (error) {
            // Continue checking other paths
          }
        }
      }

      // Check Linux installation
      if (process.platform === 'linux') {
        const linuxPaths = [
          '/usr/local/bin/claude',
          '/usr/bin/claude',
          path.join(os.homedir(), '.local/bin/claude')
        ];

        for (const exePath of linuxPaths) {
          try {
            await fs.access(exePath);
            result.detected = true;
            result.executable = exePath;
            result.configPath = path.join(os.homedir(), '.config/claude/claude_desktop_config.json');
            result.status = 'found';
            break;
          } catch (error) {
            // Continue checking other paths
          }
        }
      }

      // Try to get version if detected
      if (result.detected && result.executable) {
        result.version = await this.getClaudeDesktopVersion(result.executable);
      }

      // Check if already configured
      if (result.detected && result.configPath) {
        const configStatus = await this.checkExistingConfig(result.configPath);
        result.configured = configStatus.configured;
        result.hasHubspotBanana = configStatus.hasHubspotBanana;
        result.configValid = configStatus.valid;
      }

    } catch (error) {
      logger.error('Error detecting Claude Desktop:', error);
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  /**
   * Detect Cursor installation
   */
  async detectCursor() {
    const result = {
      detected: false,
      name: 'Cursor',
      version: null,
      configPath: null,
      executable: null,
      status: 'not_found'
    };

    try {
      // Check macOS installation
      if (process.platform === 'darwin') {
        const macPaths = [
          '/Applications/Cursor.app',
          path.join(os.homedir(), 'Applications/Cursor.app')
        ];

        for (const appPath of macPaths) {
          try {
            await fs.access(appPath);
            result.detected = true;
            result.executable = appPath;
            result.configPath = path.join(os.homedir(), '.cursor/mcp.json');
            result.status = 'found';
            break;
          } catch (error) {
            // Continue checking other paths
          }
        }
      }

      // Check Windows installation
      if (process.platform === 'win32') {
        const winPaths = [
          path.join(os.homedir(), 'AppData/Local/Programs/cursor/Cursor.exe'),
          path.join(os.homedir(), 'AppData/Roaming/Cursor/Cursor.exe')
        ];

        for (const exePath of winPaths) {
          try {
            await fs.access(exePath);
            result.detected = true;
            result.executable = exePath;
            result.configPath = path.join(os.homedir(), '.cursor/mcp.json');
            result.status = 'found';
            break;
          } catch (error) {
            // Continue checking other paths
          }
        }
      }

      // Check Linux installation
      if (process.platform === 'linux') {
        const linuxPaths = [
          '/usr/local/bin/cursor',
          '/usr/bin/cursor',
          path.join(os.homedir(), '.local/bin/cursor')
        ];

        for (const exePath of linuxPaths) {
          try {
            await fs.access(exePath);
            result.detected = true;
            result.executable = exePath;
            result.configPath = path.join(os.homedir(), '.cursor/mcp.json');
            result.status = 'found';
            break;
          } catch (error) {
            // Continue checking other paths
          }
        }
      }

      // Check if already configured
      if (result.detected && result.configPath) {
        const configStatus = await this.checkExistingConfig(result.configPath);
        result.configured = configStatus.configured;
        result.hasHubspotBanana = configStatus.hasHubspotBanana;
        result.configValid = configStatus.valid;
      }

    } catch (error) {
      logger.error('Error detecting Cursor:', error);
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  /**
   * Detect VS Code installation
   */
  async detectVSCode() {
    const result = {
      detected: false,
      name: 'VS Code',
      version: null,
      configPath: null,
      executable: null,
      status: 'not_found'
    };

    try {
      // Check if VS Code is installed
      if (process.platform === 'darwin') {
        const macPaths = [
          '/Applications/Visual Studio Code.app',
          path.join(os.homedir(), 'Applications/Visual Studio Code.app')
        ];

        for (const appPath of macPaths) {
          try {
            await fs.access(appPath);
            result.detected = true;
            result.executable = appPath;
            result.configPath = path.join(os.homedir(), '.vscode/mcp.json');
            result.status = 'found';
            break;
          } catch (error) {
            // Continue checking other paths
          }
        }
      }

      // Note: VS Code doesn't have native MCP support yet
      if (result.detected) {
        result.status = 'not_supported';
        result.note = 'VS Code detected but MCP support not yet available';
      }

    } catch (error) {
      logger.error('Error detecting VS Code:', error);
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  /**
   * Detect Continue.dev installation
   */
  async detectContinue() {
    const result = {
      detected: false,
      name: 'Continue.dev',
      version: null,
      configPath: null,
      executable: null,
      status: 'not_found'
    };

    try {
      // Check for Continue.dev VS Code extension
      const continueConfigPath = path.join(os.homedir(), '.continue/config.json');
      
      try {
        await fs.access(continueConfigPath);
        result.detected = true;
        result.configPath = continueConfigPath;
        result.status = 'found';
        result.note = 'Continue.dev VS Code extension detected';
      } catch (error) {
        // Continue.dev not found
      }

    } catch (error) {
      logger.error('Error detecting Continue.dev:', error);
      result.status = 'error';
      result.error = error.message;
    }

    return result;
  }

  /**
   * Get Claude Desktop version
   */
  async getClaudeDesktopVersion(executable) {
    try {
      if (process.platform === 'darwin') {
        const plistPath = path.join(executable, 'Contents/Info.plist');
        const plistContent = await fs.readFile(plistPath, 'utf8');
        const versionMatch = plistContent.match(/<key>CFBundleShortVersionString<\/key>\s*<string>(.*?)<\/string>/);
        return versionMatch ? versionMatch[1] : 'unknown';
      }
      
      // For other platforms, return unknown for now
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Check existing configuration
   */
  async checkExistingConfig(configPath) {
    const result = {
      configured: false,
      hasHubspotBanana: false,
      valid: false,
      issues: []
    };

    try {
      await fs.access(configPath);
      const configContent = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configContent);

      result.configured = true;

      // Check for HubSpot Banana MCP server
      if (config.mcpServers && config.mcpServers['hubspot-banana-hybrid']) {
        result.hasHubspotBanana = true;
        
        // Validate configuration
        const mcpServerConfig = config.mcpServers['hubspot-banana-hybrid'];
        if (mcpServerConfig.command && mcpServerConfig.args) {
          result.valid = true;
        } else {
          result.issues.push('Missing command or args in MCP server configuration');
        }

        // Check environment variables
        if (mcpServerConfig.env) {
          const requiredEnvVars = ['PRIVATE_APP_ACCESS_TOKEN', 'BANANA_API_KEY'];
          const missingEnvVars = requiredEnvVars.filter(envVar => !mcpServerConfig.env[envVar]);
          if (missingEnvVars.length > 0) {
            result.issues.push(`Missing environment variables: ${missingEnvVars.join(', ')}`);
          }
        } else {
          result.issues.push('Missing environment variables configuration');
        }
      }

    } catch (error) {
      if (error.code !== 'ENOENT') {
        result.issues.push(`Error reading config: ${error.message}`);
      }
    }

    return result;
  }

  /**
   * Auto-configure all detected clients
   */
  async autoConfigureAll() {
    const results = new Map();
    
    // Detect clients first
    await this.detectClients();

    for (const [clientName, clientInfo] of this.detectedClients) {
      try {
        const configResult = await this.autoConfigureClient(clientName, clientInfo);
        results.set(clientName, configResult);
      } catch (error) {
        logger.error(`Error auto-configuring ${clientName}:`, error);
        results.set(clientName, {
          success: false,
          error: error.message,
          clientInfo
        });
      }
    }

    logger.info(`🍌 Auto-configuration complete: ${results.size} clients processed`);
    return results;
  }

  /**
   * Auto-configure a specific client
   */
  async autoConfigureClient(clientName, clientInfo) {
    if (!clientInfo.detected) {
      throw new Error(`Client ${clientName} not detected`);
    }

    if (clientInfo.status === 'not_supported') {
      return {
        success: false,
        reason: 'Client does not support MCP',
        clientInfo
      };
    }

    // Skip if already properly configured
    if (clientInfo.configured && clientInfo.hasHubspotBanana && clientInfo.configValid) {
      logger.info(`🍌 ${clientName} already properly configured`);
      return {
        success: true,
        action: 'skipped',
        reason: 'Already configured',
        clientInfo
      };
    }

    // Generate configuration
    const clientConfig = this.clientConfig.configs[clientName];
    if (!clientConfig) {
      throw new Error(`No configuration template for ${clientName}`);
    }

    // Update config path from detection
    clientConfig.config_path = clientInfo.configPath;

    // Generate, merge, and write configuration
    const config = await this.clientConfig.generateConfig(clientName, clientConfig);
    const mergedConfig = await this.clientConfig.mergeConfig(clientName, config);
    await this.clientConfig.writeConfig(clientName, mergedConfig);

    // Validate the configuration
    const validationResult = await this.validateConfiguration(clientName, mergedConfig);

    // Create backup and record hash
    await this.createConfigBackup(clientName, clientInfo.configPath);
    await this.recordConfigHash(clientName, clientInfo.configPath);

    logger.info(`🍌 ${clientName} auto-configured successfully`);

    return {
      success: true,
      action: 'configured',
      config: mergedConfig,
      validation: validationResult,
      clientInfo
    };
  }

  /**
   * Validate configuration
   */
  async validateConfiguration(clientName, config) {
    const validation = {
      valid: true,
      issues: [],
      warnings: []
    };

    // Check basic structure
    if (!config.mcpServers) {
      validation.valid = false;
      validation.issues.push('Missing mcpServers configuration');
      return validation;
    }

    if (!config.mcpServers['hubspot-banana-hybrid']) {
      validation.valid = false;
      validation.issues.push('Missing hubspot-banana-hybrid server configuration');
      return validation;
    }

    const serverConfig = config.mcpServers['hubspot-banana-hybrid'];

    // Check command and args
    if (!serverConfig.command) {
      validation.valid = false;
      validation.issues.push('Missing command in server configuration');
    }

    if (!serverConfig.args || !Array.isArray(serverConfig.args)) {
      validation.valid = false;
      validation.issues.push('Missing or invalid args in server configuration');
    }

    // Check environment variables
    if (!serverConfig.env) {
      validation.valid = false;
      validation.issues.push('Missing environment variables configuration');
    } else {
      const requiredEnvVars = ['PRIVATE_APP_ACCESS_TOKEN', 'BANANA_API_KEY'];
      const missingEnvVars = requiredEnvVars.filter(envVar => !serverConfig.env[envVar]);
      
      if (missingEnvVars.length > 0) {
        validation.valid = false;
        validation.issues.push(`Missing environment variables: ${missingEnvVars.join(', ')}`);
      }

      // Check for placeholder values
      for (const [key, value] of Object.entries(serverConfig.env)) {
        if (typeof value === 'string' && value.includes('${') && value.includes('}')) {
          validation.warnings.push(`Environment variable ${key} contains placeholder: ${value}`);
        }
      }
    }

    // Store validation result
    this.validationResults.set(clientName, validation);

    return validation;
  }

  /**
   * Create configuration backup
   */
  async createConfigBackup(clientName, configPath) {
    try {
      const backupPath = `${configPath}.backup.${Date.now()}`;
      await fs.copyFile(configPath, backupPath);
      logger.info(`🍌 Created backup: ${backupPath}`);
    } catch (error) {
      logger.warn(`Failed to create backup for ${clientName}:`, error);
    }
  }

  /**
   * Record configuration hash for drift detection
   */
  async recordConfigHash(clientName, configPath) {
    try {
      const configContent = await fs.readFile(configPath, 'utf8');
      const hash = crypto.createHash('sha256').update(configContent).digest('hex');
      this.configHashes.set(clientName, {
        hash,
        timestamp: Date.now(),
        path: configPath
      });
    } catch (error) {
      logger.warn(`Failed to record config hash for ${clientName}:`, error);
    }
  }

  /**
   * Start configuration drift monitoring
   */
  async startDriftMonitoring() {
    if (!this.autoHealingEnabled) {
      return;
    }

    // Monitor configuration files for changes
    for (const [clientName, clientInfo] of this.detectedClients) {
      if (clientInfo.configPath) {
        try {
          const watcher = await this.watchConfigFile(clientName, clientInfo.configPath);
          this.configWatchers.set(clientName, watcher);
        } catch (error) {
          logger.warn(`Failed to start drift monitoring for ${clientName}:`, error);
        }
      }
    }

    logger.info('🍌 Configuration drift monitoring started');
  }

  /**
   * Watch configuration file for changes
   */
  async watchConfigFile(clientName, configPath) {
    const fs = require('fs');
    
    return fs.watch(configPath, { persistent: false }, async (eventType, filename) => {
      if (eventType === 'change') {
        logger.info(`🍌 Configuration change detected for ${clientName}`);
        
        // Check for drift
        const driftResult = await this.checkConfigurationDrift(clientName, configPath);
        
        if (driftResult.driftDetected) {
          logger.warn(`🍌 Configuration drift detected for ${clientName}`, driftResult);
          
          if (this.autoHealingEnabled) {
            await this.healConfigurationDrift(clientName, configPath, driftResult);
          }
        }
      }
    });
  }

  /**
   * Check for configuration drift
   */
  async checkConfigurationDrift(clientName, configPath) {
    const result = {
      driftDetected: false,
      changes: [],
      severity: 'low'
    };

    try {
      const currentContent = await fs.readFile(configPath, 'utf8');
      const currentHash = crypto.createHash('sha256').update(currentContent).digest('hex');
      
      const recordedHash = this.configHashes.get(clientName);
      
      if (recordedHash && recordedHash.hash !== currentHash) {
        result.driftDetected = true;
        
        // Analyze the configuration
        const currentConfig = JSON.parse(currentContent);
        const expectedConfig = await this.clientConfig.generateConfig(clientName, this.clientConfig.configs[clientName]);
        
        // Check for missing HubSpot Banana server
        if (!currentConfig.mcpServers || !currentConfig.mcpServers['hubspot-banana-hybrid']) {
          result.changes.push('HubSpot Banana MCP server removed');
          result.severity = 'high';
        }
        
        // Check for modified environment variables
        if (currentConfig.mcpServers && currentConfig.mcpServers['hubspot-banana-hybrid']) {
          const currentEnv = currentConfig.mcpServers['hubspot-banana-hybrid'].env || {};
          const expectedEnv = expectedConfig.mcpServers['hubspot-banana-hybrid'].env || {};
          
          for (const [key, expectedValue] of Object.entries(expectedEnv)) {
            if (currentEnv[key] !== expectedValue) {
              result.changes.push(`Environment variable ${key} modified`);
              result.severity = 'medium';
            }
          }
        }
        
        // Update hash
        this.configHashes.set(clientName, {
          hash: currentHash,
          timestamp: Date.now(),
          path: configPath
        });
      }
      
    } catch (error) {
      logger.error(`Error checking configuration drift for ${clientName}:`, error);
    }

    return result;
  }

  /**
   * Heal configuration drift
   */
  async healConfigurationDrift(clientName, configPath, driftResult) {
    logger.info(`🍌 Attempting to heal configuration drift for ${clientName}`);
    
    try {
      // Create backup before healing
      await this.createConfigBackup(clientName, configPath);
      
      // Re-apply configuration
      const clientConfig = this.clientConfig.configs[clientName];
      const config = await this.clientConfig.generateConfig(clientName, clientConfig);
      const mergedConfig = await this.clientConfig.mergeConfig(clientName, config);
      await this.clientConfig.writeConfig(clientName, mergedConfig);
      
      // Update hash
      await this.recordConfigHash(clientName, configPath);
      
      logger.info(`🍌 Configuration drift healed for ${clientName}`);
      
    } catch (error) {
      logger.error(`Failed to heal configuration drift for ${clientName}:`, error);
    }
  }

  /**
   * Get comprehensive status
   */
  getStatus() {
    const status = {
      detectedClients: this.detectedClients.size,
      configuredClients: 0,
      validConfigurations: 0,
      driftMonitoring: this.configWatchers.size > 0,
      autoHealingEnabled: this.autoHealingEnabled,
      clients: {}
    };

    for (const [clientName, clientInfo] of this.detectedClients) {
      status.clients[clientName] = {
        ...clientInfo,
        validation: this.validationResults.get(clientName),
        configHash: this.configHashes.get(clientName)?.hash?.substring(0, 16) + '...',
        monitoring: this.configWatchers.has(clientName)
      };

      if (clientInfo.configured) {
        status.configuredClients++;
      }

      if (clientInfo.configValid) {
        status.validConfigurations++;
      }
    }

    return status;
  }

  /**
   * Stop auto-configuration monitoring
   */
  stop() {
    // Close all file watchers
    for (const [clientName, watcher] of this.configWatchers) {
      try {
        watcher.close();
      } catch (error) {
        logger.warn(`Error closing watcher for ${clientName}:`, error);
      }
    }
    
    this.configWatchers.clear();
    logger.info('🍌 MCP Auto-Configuration System stopped');
  }
}

module.exports = MCPAutoConfig;