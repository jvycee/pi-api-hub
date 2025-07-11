const MCPClientConfig = require('../../helpers/mcp-client-config');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

// Mock dependencies
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    access: jest.fn(),
    mkdir: jest.fn()
  }
}));

jest.mock('../../shared/logger');
jest.mock('../../shared/config', () => ({
  server: { port: 3000 }
}));

/**
 * 🍌 BANANA-POWERED MCP CLIENT CONFIG TEST SUITE 🍌
 */
describe('🍌 MCP Client Configuration Tests', () => {
  let mcpClientConfig;
  let mockFs;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs = fs;
    mcpClientConfig = new MCPClientConfig();
  });

  describe('🚀 Configuration Generation', () => {
    test('should generate Claude Desktop configuration', async () => {
      const clientConfig = {
        enabled: true,
        config_path: '~/Library/Application Support/Claude/claude_desktop_config.json',
        server_command: 'node',
        server_args: ['mcp-server/hybrid-server.js'],
        env_vars: {
          PRIVATE_APP_ACCESS_TOKEN: '${HUBSPOT_PRIVATE_APP_TOKEN}',
          BANANA_API_KEY: '${BANANA_ADMIN_KEY}'
        }
      };

      const result = await mcpClientConfig.generateConfig('claude_desktop', clientConfig);

      expect(result).toMatchObject({
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['mcp-server/hybrid-server.js'],
            env: {
              PRIVATE_APP_ACCESS_TOKEN: '${HUBSPOT_PRIVATE_APP_TOKEN}',
              BANANA_API_KEY: '${BANANA_ADMIN_KEY}'
            }
          }
        }
      });
    });

    test('should generate Cursor configuration', async () => {
      const clientConfig = {
        enabled: true,
        config_path: '.cursor/mcp.json',
        server_command: 'node',
        server_args: ['mcp-server/hybrid-server.js'],
        env_vars: {
          PRIVATE_APP_ACCESS_TOKEN: '${HUBSPOT_PRIVATE_APP_TOKEN}',
          BANANA_API_KEY: '${BANANA_ADMIN_KEY}'
        }
      };

      const result = await mcpClientConfig.generateConfig('cursor', clientConfig);

      expect(result).toMatchObject({
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['mcp-server/hybrid-server.js'],
            env: {
              PRIVATE_APP_ACCESS_TOKEN: '${HUBSPOT_PRIVATE_APP_TOKEN}',
              BANANA_API_KEY: '${BANANA_ADMIN_KEY}'
            }
          }
        }
      });
    });

    test('should handle absolute paths correctly', async () => {
      const clientConfig = {
        enabled: true,
        config_path: '/absolute/path/to/config.json',
        server_command: 'node',
        server_args: ['mcp-server/hybrid-server.js'],
        env_vars: {}
      };

      const result = await mcpClientConfig.generateConfig('test_client', clientConfig);

      expect(result.mcpServers['hubspot-banana-hybrid'].command).toBe('node');
    });
  });

  describe('🔧 Configuration Merging', () => {
    test('should merge with existing configuration', async () => {
      const existingConfig = {
        mcpServers: {
          'existing-server': {
            command: 'existing-command',
            args: ['existing-arg']
          }
        }
      };

      const newConfig = {
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['mcp-server/hybrid-server.js']
          }
        }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(existingConfig));

      const result = await mcpClientConfig.mergeConfig('claude_desktop', newConfig);

      expect(result.mcpServers).toHaveProperty('existing-server');
      expect(result.mcpServers).toHaveProperty('hubspot-banana-hybrid');
      expect(Object.keys(result.mcpServers)).toHaveLength(2);
    });

    test('should handle missing config file', async () => {
      const newConfig = {
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['mcp-server/hybrid-server.js']
          }
        }
      };

      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await mcpClientConfig.mergeConfig('claude_desktop', newConfig);

      expect(result).toEqual(newConfig);
    });

    test('should handle malformed JSON', async () => {
      const newConfig = {
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['mcp-server/hybrid-server.js']
          }
        }
      };

      mockFs.readFile.mockResolvedValue('{ invalid json }');

      const result = await mcpClientConfig.mergeConfig('claude_desktop', newConfig);

      expect(result).toEqual(newConfig);
    });

    test('should update existing server configuration', async () => {
      const existingConfig = {
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'old-command',
            args: ['old-arg']
          }
        }
      };

      const newConfig = {
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['mcp-server/hybrid-server.js']
          }
        }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(existingConfig));

      const result = await mcpClientConfig.mergeConfig('claude_desktop', newConfig);

      expect(result.mcpServers['hubspot-banana-hybrid']).toEqual(newConfig.mcpServers['hubspot-banana-hybrid']);
    });
  });

  describe('💾 Configuration Writing', () => {
    test('should write configuration to file', async () => {
      const config = {
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['mcp-server/hybrid-server.js']
          }
        }
      };

      const clientConfig = {
        config_path: '~/Library/Application Support/Claude/claude_desktop_config.json'
      };

      mcpClientConfig.configs = { claude_desktop: clientConfig };

      await mcpClientConfig.writeConfig('claude_desktop', config);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('claude_desktop_config.json'),
        JSON.stringify(config, null, 2),
        'utf8'
      );
    });

    test('should create directory if it does not exist', async () => {
      const config = { mcpServers: {} };
      const clientConfig = {
        config_path: '~/new/directory/config.json'
      };

      mcpClientConfig.configs = { test_client: clientConfig };
      mockFs.access.mockRejectedValue(new Error('ENOENT'));

      await mcpClientConfig.writeConfig('test_client', config);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('new/directory'),
        { recursive: true }
      );
    });

    test('should handle write errors', async () => {
      const config = { mcpServers: {} };
      const clientConfig = {
        config_path: '~/test/config.json'
      };

      mcpClientConfig.configs = { test_client: clientConfig };
      mockFs.writeFile.mockRejectedValue(new Error('Permission denied'));

      await expect(mcpClientConfig.writeConfig('test_client', config)).rejects.toThrow('Permission denied');
    });
  });

  describe('🔍 Status Checking', () => {
    test('should get status for all clients', async () => {
      const mockConfigs = {
        claude_desktop: {
          enabled: true,
          config_path: '~/Library/Application Support/Claude/claude_desktop_config.json'
        },
        cursor: {
          enabled: true,
          config_path: '.cursor/mcp.json'
        }
      };

      mcpClientConfig.configs = mockConfigs;

      // Mock file existence check
      mockFs.access
        .mockResolvedValueOnce(undefined) // claude_desktop exists
        .mockRejectedValueOnce(new Error('ENOENT')); // cursor does not exist

      const status = await mcpClientConfig.getStatus();

      expect(status).toHaveProperty('claude_desktop');
      expect(status).toHaveProperty('cursor');
      expect(status.claude_desktop.configured).toBe(true);
      expect(status.cursor.configured).toBe(false);
    });

    test('should validate configuration content', async () => {
      const validConfig = {
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['mcp-server/hybrid-server.js']
          }
        }
      };

      const invalidConfig = {
        mcpServers: {
          'other-server': {
            command: 'other-command'
          }
        }
      };

      mcpClientConfig.configs = {
        valid_client: { config_path: '~/valid.json' },
        invalid_client: { config_path: '~/invalid.json' }
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile
        .mockResolvedValueOnce(JSON.stringify(validConfig))
        .mockResolvedValueOnce(JSON.stringify(invalidConfig));

      const status = await mcpClientConfig.getStatus();

      expect(status.valid_client.hasHubspotBanana).toBe(true);
      expect(status.invalid_client.hasHubspotBanana).toBe(false);
    });
  });

  describe('📝 Setup Instructions', () => {
    test('should generate setup instructions', () => {
      const instructions = mcpClientConfig.generateSetupInstructions();

      expect(instructions).toHaveProperty('claude_desktop');
      expect(instructions).toHaveProperty('cursor');
      expect(instructions).toHaveProperty('environment');

      expect(instructions.claude_desktop.steps).toContain('Run: npm run mcp:setup-claude');
      expect(instructions.cursor.steps).toContain('Run: npm run mcp:setup-cursor');
    });

    test('should include environment template', () => {
      const envTemplate = mcpClientConfig.generateEnvTemplate();

      expect(envTemplate).toContain('HUBSPOT_PRIVATE_APP_TOKEN=');
      expect(envTemplate).toContain('BANANA_ADMIN_KEY=');
      expect(envTemplate).toContain('# HubSpot Private App Token');
      expect(envTemplate).toContain('# Banana Admin API Key');
    });
  });

  describe('🛠️ Utility Functions', () => {
    test('should resolve home directory paths', () => {
      const homePath = '~/test/path';
      const resolvedPath = mcpClientConfig.resolvePath(homePath);

      expect(resolvedPath).toBe(path.join(os.homedir(), 'test/path'));
    });

    test('should handle absolute paths', () => {
      const absolutePath = '/absolute/test/path';
      const resolvedPath = mcpClientConfig.resolvePath(absolutePath);

      expect(resolvedPath).toBe(absolutePath);
    });

    test('should handle relative paths', () => {
      const relativePath = './relative/path';
      const resolvedPath = mcpClientConfig.resolvePath(relativePath);

      expect(resolvedPath).toBe(path.resolve(relativePath));
    });
  });

  describe('⚡ Error Handling', () => {
    test('should handle file system errors gracefully', async () => {
      const clientConfig = {
        config_path: '/read-only/path/config.json'
      };

      mockFs.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(
        mcpClientConfig.writeConfig('test_client', { mcpServers: {} })
      ).rejects.toThrow();
    });

    test('should handle invalid client names', async () => {
      await expect(
        mcpClientConfig.generateConfig('invalid_client', {})
      ).rejects.toThrow();
    });

    test('should handle missing client configuration', async () => {
      await expect(
        mcpClientConfig.writeConfig('nonexistent_client', {})
      ).rejects.toThrow();
    });
  });

  describe('🎯 Integration Tests', () => {
    test('should handle complete configuration workflow', async () => {
      const clientConfig = {
        enabled: true,
        config_path: '~/test/config.json',
        server_command: 'node',
        server_args: ['mcp-server/hybrid-server.js'],
        env_vars: {
          PRIVATE_APP_ACCESS_TOKEN: '${HUBSPOT_PRIVATE_APP_TOKEN}',
          BANANA_API_KEY: '${BANANA_ADMIN_KEY}'
        }
      };

      // Mock successful workflow
      mockFs.readFile.mockResolvedValue('{}');
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.access.mockResolvedValue(undefined);

      // Generate configuration
      const config = await mcpClientConfig.generateConfig('test_client', clientConfig);
      expect(config.mcpServers).toHaveProperty('hubspot-banana-hybrid');

      // Merge with existing
      const mergedConfig = await mcpClientConfig.mergeConfig('test_client', config);
      expect(mergedConfig.mcpServers).toHaveProperty('hubspot-banana-hybrid');

      // Write configuration
      await mcpClientConfig.writeConfig('test_client', mergedConfig);
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    test('should handle configuration updates', async () => {
      const existingConfig = {
        mcpServers: {
          'hubspot-banana-hybrid': {
            command: 'node',
            args: ['old-server.js']
          }
        }
      };

      const updatedClientConfig = {
        enabled: true,
        config_path: '~/test/config.json',
        server_command: 'node',
        server_args: ['mcp-server/hybrid-server.js'],
        env_vars: {
          PRIVATE_APP_ACCESS_TOKEN: '${HUBSPOT_PRIVATE_APP_TOKEN}',
          BANANA_API_KEY: '${BANANA_ADMIN_KEY}'
        }
      };

      mockFs.readFile.mockResolvedValue(JSON.stringify(existingConfig));
      mockFs.writeFile.mockResolvedValue(undefined);

      const newConfig = await mcpClientConfig.generateConfig('test_client', updatedClientConfig);
      const mergedConfig = await mcpClientConfig.mergeConfig('test_client', newConfig);

      expect(mergedConfig.mcpServers['hubspot-banana-hybrid'].args).toEqual(['mcp-server/hybrid-server.js']);
    });
  });
});