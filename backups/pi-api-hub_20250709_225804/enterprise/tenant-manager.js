const logger = require('../shared/logger');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * 🏢 ENTERPRISE TENANT MANAGER 🏢
 * Multi-tenant support with isolated environments per client
 */
class TenantManager {
  constructor(options = {}) {
    this.tenantDataPath = options.tenantDataPath || path.join(__dirname, '../data/tenants');
    this.defaultTenantConfig = options.defaultTenantConfig || this.getDefaultTenantConfig();
    this.tenantCache = new Map();
    this.configCache = new Map();
    
    this.initializeTenantManager();
    
    logger.info('🏢 Enterprise Tenant Manager initialized');
  }

  /**
   * Initialize tenant manager
   */
  async initializeTenantManager() {
    try {
      // Ensure tenant data directory exists
      await fs.mkdir(this.tenantDataPath, { recursive: true });
      
      // Load existing tenants
      await this.loadExistingTenants();
      
      logger.info('🏢 Tenant manager initialization complete', {
        tenantsLoaded: this.tenantCache.size
      });
    } catch (error) {
      logger.error('Failed to initialize tenant manager:', error);
      throw error;
    }
  }

  /**
   * Load existing tenants from storage
   */
  async loadExistingTenants() {
    try {
      const tenantFiles = await fs.readdir(this.tenantDataPath);
      const tenantJsonFiles = tenantFiles.filter(file => file.endsWith('.json'));
      
      for (const file of tenantJsonFiles) {
        const tenantId = path.basename(file, '.json');
        const tenantData = await this.loadTenantData(tenantId);
        if (tenantData) {
          this.tenantCache.set(tenantId, tenantData);
        }
      }
      
      logger.info('📂 Loaded existing tenants', {
        tenantCount: tenantJsonFiles.length
      });
    } catch (error) {
      logger.error('Failed to load existing tenants:', error);
    }
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantData) {
    try {
      const tenantId = this.generateTenantId();
      const timestamp = Date.now();
      
      const tenant = {
        id: tenantId,
        ...tenantData,
        createdAt: timestamp,
        updatedAt: timestamp,
        status: 'active',
        config: {
          ...this.defaultTenantConfig,
          ...tenantData.config
        },
        resources: {
          apiKeys: [],
          databases: [],
          storage: {
            used: 0,
            limit: tenantData.config?.storage?.limit || 1000000000 // 1GB default
          }
        },
        billing: {
          plan: tenantData.billing?.plan || 'starter',
          usage: {
            requests: 0,
            storage: 0,
            bandwidth: 0
          }
        }
      };

      // Save tenant data
      await this.saveTenantData(tenantId, tenant);
      
      // Cache tenant
      this.tenantCache.set(tenantId, tenant);
      
      // Create tenant-specific directories
      await this.createTenantDirectories(tenantId);
      
      logger.info('🏢 New tenant created', {
        tenantId,
        name: tenant.name,
        plan: tenant.billing.plan
      });
      
      return tenant;
    } catch (error) {
      logger.error('Failed to create tenant:', error);
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenant(tenantId) {
    try {
      // Check cache first
      if (this.tenantCache.has(tenantId)) {
        return this.tenantCache.get(tenantId);
      }
      
      // Load from storage
      const tenant = await this.loadTenantData(tenantId);
      if (tenant) {
        this.tenantCache.set(tenantId, tenant);
      }
      
      return tenant;
    } catch (error) {
      logger.error('Failed to get tenant:', error);
      return null;
    }
  }

  /**
   * Update tenant configuration
   */
  async updateTenant(tenantId, updateData) {
    try {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }
      
      const updatedTenant = {
        ...tenant,
        ...updateData,
        updatedAt: Date.now()
      };
      
      // Save updated tenant
      await this.saveTenantData(tenantId, updatedTenant);
      
      // Update cache
      this.tenantCache.set(tenantId, updatedTenant);
      
      logger.info('🏢 Tenant updated', {
        tenantId,
        updateFields: Object.keys(updateData)
      });
      
      return updatedTenant;
    } catch (error) {
      logger.error('Failed to update tenant:', error);
      throw error;
    }
  }

  /**
   * Delete tenant
   */
  async deleteTenant(tenantId) {
    try {
      const tenant = await this.getTenant(tenantId);
      if (!tenant) {
        throw new Error(`Tenant ${tenantId} not found`);
      }
      
      // Remove tenant file
      const tenantFile = path.join(this.tenantDataPath, `${tenantId}.json`);
      await fs.unlink(tenantFile);
      
      // Remove from cache
      this.tenantCache.delete(tenantId);
      
      // Clean up tenant directories
      await this.cleanupTenantDirectories(tenantId);
      
      logger.info('🏢 Tenant deleted', { tenantId });
      
      return true;
    } catch (error) {
      logger.error('Failed to delete tenant:', error);
      throw error;
    }
  }

  /**
   * List all tenants
   */
  async listTenants(options = {}) {
    try {
      const { status, plan, limit = 100, offset = 0 } = options;
      
      let tenants = Array.from(this.tenantCache.values());
      
      // Apply filters
      if (status) {
        tenants = tenants.filter(tenant => tenant.status === status);
      }
      if (plan) {
        tenants = tenants.filter(tenant => tenant.billing.plan === plan);
      }
      
      // Apply pagination
      const total = tenants.length;
      tenants = tenants.slice(offset, offset + limit);
      
      return {
        tenants,
        total,
        limit,
        offset
      };
    } catch (error) {
      logger.error('Failed to list tenants:', error);
      throw error;
    }
  }

  /**
   * Extract tenant ID from request
   */
  extractTenantId(req) {
    // Try multiple methods to identify tenant
    
    // 1. Check subdomain (e.g., tenant1.api.example.com)
    const host = req.get('host');
    if (host) {
      const subdomain = host.split('.')[0];
      if (subdomain !== 'api' && subdomain !== 'www') {
        return subdomain;
      }
    }
    
    // 2. Check custom header
    const tenantHeader = req.get('x-tenant-id');
    if (tenantHeader) {
      return tenantHeader;
    }
    
    // 3. Check API key prefix
    const apiKey = req.get('x-api-key') || req.get('authorization');
    if (apiKey) {
      const parts = apiKey.split('_');
      if (parts.length > 1) {
        return parts[0]; // Assume format: tenantId_actualKey
      }
    }
    
    // 4. Check URL path (e.g., /api/v1/tenant/tenant1/...)
    const tenantFromPath = req.path.match(/\/tenant\/([^\/]+)/);
    if (tenantFromPath) {
      return tenantFromPath[1];
    }
    
    // Default to 'default' tenant
    return 'default';
  }

  /**
   * Middleware for tenant identification and isolation
   */
  middleware() {
    return async (req, res, next) => {
      try {
        const tenantId = this.extractTenantId(req);
        
        if (!tenantId) {
          return res.status(400).json({
            success: false,
            error: 'Tenant identification required',
            timestamp: new Date().toISOString()
          });
        }
        
        const tenant = await this.getTenant(tenantId);
        
        if (!tenant) {
          return res.status(404).json({
            success: false,
            error: `Tenant ${tenantId} not found`,
            timestamp: new Date().toISOString()
          });
        }
        
        if (tenant.status !== 'active') {
          return res.status(403).json({
            success: false,
            error: `Tenant ${tenantId} is not active`,
            timestamp: new Date().toISOString()
          });
        }
        
        // Attach tenant to request
        req.tenant = tenant;
        req.tenantId = tenantId;
        
        // Set tenant-specific configuration
        req.tenantConfig = tenant.config;
        
        next();
      } catch (error) {
        logger.error('Tenant middleware error:', error);
        res.status(500).json({
          success: false,
          error: 'Tenant processing failed',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Generate unique tenant ID
   */
  generateTenantId() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Get default tenant configuration
   */
  getDefaultTenantConfig() {
    return {
      features: {
        analytics: true,
        reporting: true,
        webhooks: true,
        aiRouting: true,
        customDomains: false
      },
      limits: {
        requestsPerHour: 10000,
        storageGB: 1,
        apiKeys: 5,
        webhookEndpoints: 10
      },
      security: {
        requireSSL: true,
        enableCORS: true,
        allowedOrigins: ['*'],
        ipWhitelist: []
      },
      monitoring: {
        enableMetrics: true,
        enableAlerts: true,
        retentionDays: 30
      }
    };
  }

  /**
   * Create tenant-specific directories
   */
  async createTenantDirectories(tenantId) {
    const directories = [
      path.join(this.tenantDataPath, tenantId, 'data'),
      path.join(this.tenantDataPath, tenantId, 'logs'),
      path.join(this.tenantDataPath, tenantId, 'backups'),
      path.join(this.tenantDataPath, tenantId, 'reports')
    ];
    
    for (const dir of directories) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  /**
   * Clean up tenant directories
   */
  async cleanupTenantDirectories(tenantId) {
    const tenantDir = path.join(this.tenantDataPath, tenantId);
    try {
      await fs.rmdir(tenantDir, { recursive: true });
    } catch (error) {
      logger.warn('Failed to cleanup tenant directories:', error);
    }
  }

  /**
   * Save tenant data to file
   */
  async saveTenantData(tenantId, tenant) {
    const tenantFile = path.join(this.tenantDataPath, `${tenantId}.json`);
    await fs.writeFile(tenantFile, JSON.stringify(tenant, null, 2));
  }

  /**
   * Load tenant data from file
   */
  async loadTenantData(tenantId) {
    try {
      const tenantFile = path.join(this.tenantDataPath, `${tenantId}.json`);
      const data = await fs.readFile(tenantFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get tenant statistics
   */
  getTenantStats() {
    const stats = {
      totalTenants: this.tenantCache.size,
      activeTenants: 0,
      inactiveTenants: 0,
      planDistribution: {},
      resourceUsage: {
        totalStorage: 0,
        totalRequests: 0
      }
    };
    
    for (const tenant of this.tenantCache.values()) {
      if (tenant.status === 'active') {
        stats.activeTenants++;
      } else {
        stats.inactiveTenants++;
      }
      
      const plan = tenant.billing.plan;
      stats.planDistribution[plan] = (stats.planDistribution[plan] || 0) + 1;
      
      stats.resourceUsage.totalStorage += tenant.resources.storage.used;
      stats.resourceUsage.totalRequests += tenant.billing.usage.requests;
    }
    
    return stats;
  }
}

module.exports = TenantManager;