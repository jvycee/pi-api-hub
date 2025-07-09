const logger = require('../shared/logger');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');

/**
 * 🔐 ENTERPRISE AUTHENTICATION MANAGER 🔐
 * Advanced authentication with SSO, RBAC, and enterprise identity providers
 */
class AuthManager {
  constructor(options = {}) {
    this.jwtSecret = options.jwtSecret || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
    this.jwtExpiresIn = options.jwtExpiresIn || '1h';
    this.refreshTokenExpiresIn = options.refreshTokenExpiresIn || '7d';
    this.enableTwoFA = options.enableTwoFA || false;
    this.enableSSO = options.enableSSO || false;
    
    // In-memory stores (would use database in production)
    this.users = new Map();
    this.roles = new Map();
    this.permissions = new Map();
    this.refreshTokens = new Map();
    this.sessions = new Map();
    this.apiKeys = new Map();
    
    this.initializeAuthManager();
    
    logger.info('🔐 Enterprise Authentication Manager initialized');
  }

  /**
   * Initialize authentication manager
   */
  initializeAuthManager() {
    // Create default roles and permissions
    this.createDefaultRoles();
    this.createDefaultPermissions();
    
    // Create admin user if not exists
    this.createDefaultAdminUser();
    
    logger.info('🔐 Authentication manager initialization complete');
  }

  /**
   * Create default roles
   */
  createDefaultRoles() {
    const defaultRoles = [
      {
        id: 'super_admin',
        name: 'Super Administrator',
        description: 'Full system access',
        permissions: ['*'],
        priority: 1000
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Tenant administration access',
        permissions: ['read', 'write', 'delete', 'manage_users', 'manage_settings'],
        priority: 800
      },
      {
        id: 'manager',
        name: 'Manager',
        description: 'Management access with limited admin functions',
        permissions: ['read', 'write', 'manage_users'],
        priority: 600
      },
      {
        id: 'user',
        name: 'User',
        description: 'Standard user access',
        permissions: ['read', 'write'],
        priority: 400
      },
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access',
        permissions: ['read'],
        priority: 200
      }
    ];
    
    defaultRoles.forEach(role => {
      this.roles.set(role.id, role);
    });
  }

  /**
   * Create default permissions
   */
  createDefaultPermissions() {
    const defaultPermissions = [
      { id: 'read', name: 'Read', description: 'Read access to resources' },
      { id: 'write', name: 'Write', description: 'Write access to resources' },
      { id: 'delete', name: 'Delete', description: 'Delete access to resources' },
      { id: 'manage_users', name: 'Manage Users', description: 'User management access' },
      { id: 'manage_settings', name: 'Manage Settings', description: 'Settings management access' },
      { id: 'manage_billing', name: 'Manage Billing', description: 'Billing management access' },
      { id: 'view_analytics', name: 'View Analytics', description: 'Analytics viewing access' },
      { id: 'export_data', name: 'Export Data', description: 'Data export access' }
    ];
    
    defaultPermissions.forEach(permission => {
      this.permissions.set(permission.id, permission);
    });
  }

  /**
   * Create default admin user
   */
  async createDefaultAdminUser() {
    const adminExists = Array.from(this.users.values()).some(user => user.role === 'super_admin');
    
    if (!adminExists) {
      await this.createUser({
        email: 'admin@pi-api-hub.com',
        password: 'admin123', // Should be changed immediately
        firstName: 'System',
        lastName: 'Administrator',
        role: 'super_admin',
        tenantId: 'default',
        mustChangePassword: true
      });
      
      logger.info('🔐 Default admin user created');
    }
  }

  /**
   * Create a new user
   */
  async createUser(userData) {
    try {
      const userId = crypto.randomBytes(16).toString('hex');
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const user = {
        id: userId,
        email: userData.email,
        password: hashedPassword,
        firstName: userData.firstName,
        lastName: userData.lastName,
        role: userData.role || 'user',
        tenantId: userData.tenantId,
        status: 'active',
        mustChangePassword: userData.mustChangePassword || false,
        twoFactorEnabled: false,
        twoFactorSecret: null,
        lastLogin: null,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      this.users.set(userId, user);
      
      logger.info('👤 User created', {
        userId,
        email: userData.email,
        role: userData.role,
        tenantId: userData.tenantId
      });
      
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateUser(email, password, tenantId) {
    try {
      const user = Array.from(this.users.values()).find(u => 
        u.email === email && u.tenantId === tenantId
      );
      
      if (!user) {
        logger.warn('Authentication failed - user not found', { email, tenantId });
        return null;
      }
      
      if (user.status !== 'active') {
        logger.warn('Authentication failed - user not active', { email, tenantId });
        return null;
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn('Authentication failed - invalid password', { email, tenantId });
        return null;
      }
      
      // Update last login
      user.lastLogin = Date.now();
      this.users.set(user.id, user);
      
      logger.info('🔐 User authenticated successfully', {
        userId: user.id,
        email: user.email,
        tenantId: user.tenantId
      });
      
      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Authentication error:', error);
      return null;
    }
  }

  /**
   * Generate JWT token
   */
  generateToken(user, options = {}) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      permissions: this.getUserPermissions(user),
      iat: Math.floor(Date.now() / 1000)
    };
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: options.expiresIn || this.jwtExpiresIn,
      issuer: 'pi-api-hub',
      audience: user.tenantId
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(user) {
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    
    this.refreshTokens.set(refreshToken, {
      userId: user.id,
      tenantId: user.tenantId,
      expiresAt,
      createdAt: Date.now()
    });
    
    return refreshToken;
  }

  /**
   * Refresh JWT token
   */
  async refreshToken(refreshToken) {
    try {
      const tokenData = this.refreshTokens.get(refreshToken);
      
      if (!tokenData) {
        logger.warn('Invalid refresh token');
        return null;
      }
      
      if (tokenData.expiresAt < Date.now()) {
        logger.warn('Refresh token expired');
        this.refreshTokens.delete(refreshToken);
        return null;
      }
      
      const user = this.users.get(tokenData.userId);
      if (!user || user.status !== 'active') {
        logger.warn('User not found or inactive for refresh token');
        return null;
      }
      
      const newToken = this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);
      
      // Remove old refresh token
      this.refreshTokens.delete(refreshToken);
      
      return {
        accessToken: newToken,
        refreshToken: newRefreshToken,
        user: this.sanitizeUser(user)
      };
    } catch (error) {
      logger.error('Refresh token error:', error);
      return null;
    }
  }

  /**
   * Verify JWT token
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return null;
    }
  }

  /**
   * Get user permissions
   */
  getUserPermissions(user) {
    const role = this.roles.get(user.role);
    if (!role) return [];
    
    if (role.permissions.includes('*')) {
      return Array.from(this.permissions.keys());
    }
    
    return role.permissions;
  }

  /**
   * Check if user has permission
   */
  hasPermission(user, permission) {
    const userPermissions = this.getUserPermissions(user);
    return userPermissions.includes(permission) || userPermissions.includes('*');
  }

  /**
   * Generate API key
   */
  generateApiKey(user, name, permissions = []) {
    const keyId = crypto.randomBytes(8).toString('hex');
    const keySecret = crypto.randomBytes(32).toString('hex');
    const apiKey = `${user.tenantId}_${keyId}_${keySecret}`;
    
    const keyData = {
      id: keyId,
      name,
      key: apiKey,
      userId: user.id,
      tenantId: user.tenantId,
      permissions: permissions.length > 0 ? permissions : this.getUserPermissions(user),
      status: 'active',
      lastUsed: null,
      createdAt: Date.now(),
      expiresAt: null // No expiration by default
    };
    
    this.apiKeys.set(apiKey, keyData);
    
    logger.info('🔑 API key generated', {
      userId: user.id,
      tenantId: user.tenantId,
      keyName: name
    });
    
    return keyData;
  }

  /**
   * Verify API key
   */
  verifyApiKey(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    
    if (!keyData) {
      return null;
    }
    
    if (keyData.status !== 'active') {
      return null;
    }
    
    if (keyData.expiresAt && keyData.expiresAt < Date.now()) {
      return null;
    }
    
    // Update last used
    keyData.lastUsed = Date.now();
    this.apiKeys.set(apiKey, keyData);
    
    return keyData;
  }

  /**
   * Enable two-factor authentication
   */
  enableTwoFA(user) {
    const secret = speakeasy.generateSecret({
      name: `Pi API Hub (${user.email})`,
      issuer: 'Pi API Hub'
    });
    
    user.twoFactorSecret = secret.base32;
    user.twoFactorEnabled = true;
    this.users.set(user.id, user);
    
    return {
      secret: secret.base32,
      qrCode: secret.otpauth_url
    };
  }

  /**
   * Verify two-factor authentication token
   */
  verifyTwoFA(user, token) {
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return false;
    }
    
    return speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token,
      window: 1
    });
  }

  /**
   * Authentication middleware
   */
  middleware() {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          return res.status(401).json({
            success: false,
            error: 'Authentication required',
            timestamp: new Date().toISOString()
          });
        }
        
        // Check if it's an API key
        if (token.includes('_')) {
          const keyData = this.verifyApiKey(token);
          if (!keyData) {
            return res.status(401).json({
              success: false,
              error: 'Invalid API key',
              timestamp: new Date().toISOString()
            });
          }
          
          const user = this.users.get(keyData.userId);
          if (!user) {
            return res.status(401).json({
              success: false,
              error: 'User not found',
              timestamp: new Date().toISOString()
            });
          }
          
          req.user = this.sanitizeUser(user);
          req.authMethod = 'api_key';
          req.permissions = keyData.permissions;
        } else {
          // JWT token
          const decoded = this.verifyToken(token);
          if (!decoded) {
            return res.status(401).json({
              success: false,
              error: 'Invalid token',
              timestamp: new Date().toISOString()
            });
          }
          
          const user = this.users.get(decoded.userId);
          if (!user || user.status !== 'active') {
            return res.status(401).json({
              success: false,
              error: 'User not found or inactive',
              timestamp: new Date().toISOString()
            });
          }
          
          req.user = this.sanitizeUser(user);
          req.authMethod = 'jwt';
          req.permissions = decoded.permissions;
        }
        
        next();
      } catch (error) {
        logger.error('Authentication middleware error:', error);
        res.status(500).json({
          success: false,
          error: 'Authentication processing failed',
          timestamp: new Date().toISOString()
        });
      }
    };
  }

  /**
   * Permission middleware
   */
  requirePermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          timestamp: new Date().toISOString()
        });
      }
      
      if (!req.permissions.includes(permission) && !req.permissions.includes('*')) {
        return res.status(403).json({
          success: false,
          error: `Permission '${permission}' required`,
          timestamp: new Date().toISOString()
        });
      }
      
      next();
    };
  }

  /**
   * Extract token from request
   */
  extractToken(req) {
    const authHeader = req.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    const apiKey = req.get('x-api-key');
    if (apiKey) {
      return apiKey;
    }
    
    return null;
  }

  /**
   * Sanitize user data (remove sensitive fields)
   */
  sanitizeUser(user) {
    const { password, twoFactorSecret, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Get authentication statistics
   */
  getAuthStats() {
    const stats = {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.status === 'active').length,
      totalRoles: this.roles.size,
      totalPermissions: this.permissions.size,
      totalApiKeys: this.apiKeys.size,
      activeApiKeys: Array.from(this.apiKeys.values()).filter(k => k.status === 'active').length,
      activeSessions: this.sessions.size,
      activeRefreshTokens: this.refreshTokens.size
    };
    
    return stats;
  }
}

module.exports = AuthManager;