const logger = require('../shared/logger');
const path = require('path');
const fs = require('fs').promises;

/**
 * 🍌 SIMPLE TENANT MANAGER 🍌
 * Pi-sized multi-tenant support without the enterprise bloat
 */
class SimpleTenantManager {
  constructor(options = {}) {
    this.tenantsFile = options.tenantsFile || path.join(__dirname, '../data/tenants.json');
    this.defaultTenant = options.defaultTenant || 'default';
    this.tenantCache = new Map();
    this.lastCacheUpdate = 0;
    this.cacheExpiry = 60000; // 1 minute cache
    
    this.initializeTenantManager();
    
    logger.info('🍌 Simple Tenant Manager initialized');
  }

  /**
   * Initialize tenant manager
   */
  async initializeTenantManager() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.tenantsFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      // Load tenant configurations
      await this.loadTenantConfigurations();
      
      // Create default tenant if it doesn't exist
      await this.ensureDefaultTenant();
      
      logger.info('🍌 Tenant Manager initialization complete');
    } catch (error) {
      logger.error('Failed to initialize tenant manager:', error);
      // Don't throw - create default config
      await this.createDefaultTenantConfig();
    }
  }

  /**
   * Load tenant configurations from file
   */
  async loadTenantConfigurations() {
    try {
      const data = await fs.readFile(this.tenantsFile, 'utf8');
      const tenants = JSON.parse(data);
      
      // Cache all tenants
      this.tenantCache.clear();
      Object.entries(tenants).forEach(([tenantId, config]) => {
        this.tenantCache.set(tenantId, config);
      });
      
      this.lastCacheUpdate = Date.now();
      
      logger.info('🍌 Loaded tenant configurations', {
        tenantCount: this.tenantCache.size
      });
    } catch (error) {
      logger.warn('Could not load tenant configurations, using defaults');
      await this.createDefaultTenantConfig();
    }
  }

  /**
   * Create default tenant configuration
   */
  async createDefaultTenantConfig() {
    const defaultConfig = {
      [this.defaultTenant]: {
        name: 'Default Tenant',
        description: 'Default tenant for Pi API Hub',
        status: 'active',
        features: {
          analytics: true,
          aiRouting: true,
          webhooks: true
        },
        limits: {
          requestsPerHour: 10000,
          maxUsers: 10
        },
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };
    
    await this.saveTenantConfigurations(defaultConfig);
    
    // Update cache
    this.tenantCache.set(this.defaultTenant, defaultConfig[this.defaultTenant]);
    this.lastCacheUpdate = Date.now();
  }

  /**
   * Ensure default tenant exists
   */
  async ensureDefaultTenant() {
    if (!this.tenantCache.has(this.defaultTenant)) {
      await this.createDefaultTenantConfig();
    }
  }

  /**
   * Save tenant configurations to file
   */
  async saveTenantConfigurations(tenants) {
    try {
      const tenantsObject = tenants || Object.fromEntries(this.tenantCache);
      await fs.writeFile(this.tenantsFile, JSON.stringify(tenantsObject, null, 2));
      
      logger.info('🍌 Tenant configurations saved');
    } catch (error) {
      logger.error('Failed to save tenant configurations:', error);
      throw error;
    }
  }

  /**
   * Extract tenant ID from request
   */
  extractTenantId(req) {
    // Method 1: Check x-tenant-id header (most common for APIs)
    const tenantHeader = req.get('x-tenant-id');
    if (tenantHeader) {
      return tenantHeader.toLowerCase();
    }
    
    // Method 2: Check subdomain (e.g., tenant1.api.local)
    const host = req.get('host');
    if (host) {
      const subdomain = host.split('.')[0];
      // Skip common subdomains
      if (subdomain && !['api', 'www', 'localhost'].includes(subdomain)) {
        return subdomain.toLowerCase();
      }
    }
    
    // Method 3: Check URL path prefix (e.g., /tenant/tenant1/api/...)
    const pathMatch = req.path.match(/^\/tenant\/([^\/]+)/);
    if (pathMatch) {
      return pathMatch[1].toLowerCase();
    }
    
    // Method 4: Check query parameter (e.g., ?tenant=tenant1)
    const queryTenant = req.query.tenant;
    if (queryTenant) {
      return queryTenant.toLowerCase();
    }
    
    // Default to default tenant
    return this.defaultTenant;
  }

  /**
   * Get tenant configuration
   */
  async getTenantConfig(tenantId) {
    // Refresh cache if needed
    if (Date.now() - this.lastCacheUpdate > this.cacheExpiry) {
      await this.loadTenantConfigurations();
    }
    
    const config = this.tenantCache.get(tenantId);
    if (!config) {
      logger.warn(`Tenant ${tenantId} not found, using default`);
      return this.tenantCache.get(this.defaultTenant);
    }
    
    return config;
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenantId, config) {
    const tenantConfig = {
      name: config.name || tenantId,
      description: config.description || `Tenant ${tenantId}`,
      status: 'active',
      features: {
        analytics: true,
        aiRouting: true,
        webhooks: true,
        ...config.features
      },
      limits: {
        requestsPerHour: 5000,
        maxUsers: 5,
        ...config.limits
      },
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    // Add to cache
    this.tenantCache.set(tenantId, tenantConfig);
    
    // Save to file
    await this.saveTenantConfigurations();
    
    logger.info('🍌 New tenant created', { tenantId, name: tenantConfig.name });
    
    return tenantConfig;
  }

  /**
   * Update tenant configuration
   */
  async updateTenant(tenantId, updates) {
    const existing = this.tenantCache.get(tenantId);
    if (!existing) {
      throw new Error(`Tenant ${tenantId} not found`);
    }
    
    const updated = {
      ...existing,
      ...updates,
      updatedAt: Date.now()
    };
    
    // Update cache
    this.tenantCache.set(tenantId, updated);
    
    // Save to file
    await this.saveTenantConfigurations();
    
    logger.info('🍌 Tenant updated', { tenantId });
    
    return updated;
  }

  /**
   * List all tenants
   */
  listTenants() {
    const tenants = {};
    for (const [tenantId, config] of this.tenantCache) {
      tenants[tenantId] = {
        name: config.name,
        status: config.status,
        features: config.features,
        limits: config.limits,
        createdAt: config.createdAt
      };
    }
    
    return tenants;
  }

  /**
   * Check if tenant has feature enabled
   */
  hasFeature(tenantConfig, feature) {
    return tenantConfig?.features?.[feature] === true;
  }

  /**
   * Check if tenant is within limits
   */
  isWithinLimits(tenantConfig, metric, currentValue) {
    const limit = tenantConfig?.limits?.[metric];
    if (!limit) return true;
    
    return currentValue < limit;
  }

  /**
   * Express middleware for tenant identification
   */
  middleware() {
    return async (req, res, next) => {
      try {
        // Extract tenant ID
        const tenantId = this.extractTenantId(req);
        
        // Get tenant configuration
        const tenantConfig = await this.getTenantConfig(tenantId);
        
        if (!tenantConfig) {
          return res.status(404).json({
            success: false,
            error: `Tenant ${tenantId} not found`,
            timestamp: new Date().toISOString()
          });
        }
        
        // Check if tenant is active
        if (tenantConfig.status !== 'active') {
          return res.status(403).json({
            success: false,
            error: `Tenant ${tenantId} is not active`,
            timestamp: new Date().toISOString()
          });
        }
        
        // Attach tenant info to request
        req.tenant = {
          id: tenantId,
          config: tenantConfig
        };
        
        // Add tenant context to response headers (for debugging)
        res.set('X-Tenant-ID', tenantId);
        res.set('X-Tenant-Name', tenantConfig.name);
        
        logger.debug('🍌 Tenant identified', { 
          tenantId, 
          tenantName: tenantConfig.name,
          path: req.path 
        });
        
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
   * Get tenant statistics
   */
  getStats() {
    const stats = {
      totalTenants: this.tenantCache.size,
      activeTenants: 0,
      inactiveTenants: 0,
      defaultTenant: this.defaultTenant,
      cacheAge: Date.now() - this.lastCacheUpdate
    };
    
    for (const config of this.tenantCache.values()) {
      if (config.status === 'active') {
        stats.activeTenants++;
      } else {
        stats.inactiveTenants++;
      }
    }
    
    return stats;
  }
}

module.exports = SimpleTenantManager;