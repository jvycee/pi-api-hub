const logger = require('../shared/logger');
const { SignJWT, jwtVerify } = require('jose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

/**
 * 🔐 SIMPLE JWT AUTHENTICATION 🔐
 * Pi-sized JWT authentication without the enterprise complexity
 */
class SimpleAuth {
  constructor(options = {}) {
    this.usersFile = options.usersFile || path.join(__dirname, '../data/users.json');
    this.jwtSecret = options.jwtSecret || process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
    this.jwtExpiry = options.jwtExpiry || '24h';
    this.refreshExpiry = options.refreshExpiry || '7d';
    
    // In-memory stores for performance
    this.users = new Map();
    this.refreshTokens = new Map();
    this.apiKeys = new Map();
    
    // JWT secret as Uint8Array for jose
    this.jwtSecretKey = new TextEncoder().encode(this.jwtSecret);
    
    this.initializeAuth();
    
    logger.info('🔐 Simple JWT Authentication initialized');
  }

  /**
   * Initialize authentication system
   */
  async initializeAuth() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.usersFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      // Load existing users
      await this.loadUsers();
      
      // Create default admin if no users exist
      if (this.users.size === 0) {
        await this.createDefaultAdmin();
      }
      
      logger.info('🔐 Authentication system initialized', {
        userCount: this.users.size
      });
    } catch (error) {
      logger.error('Failed to initialize authentication:', error);
      // Create default admin and continue
      await this.createDefaultAdmin();
    }
  }

  /**
   * Load users from file
   */
  async loadUsers() {
    try {
      const data = await fs.readFile(this.usersFile, 'utf8');
      const { safeParse } = require('../shared/safe-json');
      const users = safeParse(data, {});
      
      this.users.clear();
      Object.entries(users).forEach(([userId, user]) => {
        this.users.set(userId, user);
      });
      
      logger.info('🔐 Users loaded from file', {
        userCount: this.users.size
      });
    } catch (error) {
      logger.info('No existing users file found, starting fresh');
    }
  }

  /**
   * Save users to file
   */
  async saveUsers() {
    try {
      const usersObject = Object.fromEntries(this.users);
      await fs.writeFile(this.usersFile, JSON.stringify(usersObject, null, 2));
      
      logger.info('🔐 Users saved to file');
    } catch (error) {
      logger.error('Failed to save users:', error);
    }
  }

  /**
   * Create default admin user
   */
  async createDefaultAdmin() {
    const adminUser = {
      id: 'admin',
      username: 'admin',
      email: 'admin@pi-api-hub.local',
      password: await bcrypt.hash('admin123', 10), // Should be changed immediately
      role: 'admin',
      tenantId: 'default',
      status: 'active',
      mustChangePassword: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.users.set('admin', adminUser);
    await this.saveUsers();
    
    logger.info('🔐 Default admin user created', {
      username: 'admin',
      password: 'admin123',
      warning: 'CHANGE PASSWORD IMMEDIATELY'
    });
  }

  /**
   * Create a new user
   */
  async createUser(userData) {
    const userId = crypto.randomBytes(8).toString('hex');
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const user = {
      id: userId,
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      role: userData.role || 'user',
      tenantId: userData.tenantId || 'default',
      status: 'active',
      mustChangePassword: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    this.users.set(userId, user);
    await this.saveUsers();
    
    logger.info('🔐 User created', {
      userId,
      username: userData.username,
      role: userData.role
    });
    
    return this.sanitizeUser(user);
  }

  /**
   * Authenticate user with username/email and password
   */
  async authenticateUser(identifier, password, tenantId = 'default') {
    try {
      // Find user by username or email within tenant
      const user = Array.from(this.users.values()).find(u => 
        (u.username === identifier || u.email === identifier) && 
        u.tenantId === tenantId
      );
      
      if (!user) {
        logger.warn('Authentication failed - user not found', { identifier, tenantId });
        return null;
      }
      
      if (user.status !== 'active') {
        logger.warn('Authentication failed - user not active', { identifier, tenantId });
        return null;
      }
      
      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        logger.warn('Authentication failed - invalid password', { identifier, tenantId });
        return null;
      }
      
      // Update last login
      user.lastLogin = Date.now();
      this.users.set(user.id, user);
      await this.saveUsers();
      
      logger.info('🔐 User authenticated successfully', {
        userId: user.id,
        username: user.username,
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
  async generateToken(user, expiresIn = this.jwtExpiry) {
    try {
      const payload = {
        userId: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        permissions: this.getRolePermissions(user.role)
      };
      
      const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime(expiresIn)
        .setIssuer('pi-api-hub')
        .setAudience(user.tenantId)
        .sign(this.jwtSecretKey);
      
      return token;
    } catch (error) {
      logger.error('Token generation failed:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token
   */
  async verifyToken(token) {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecretKey, {
        issuer: 'pi-api-hub'
      });
      
      return payload;
    } catch (error) {
      logger.error('Token verification failed:', error);
      return null;
    }
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
      
      const newToken = await this.generateToken(user);
      const newRefreshToken = this.generateRefreshToken(user);
      
      // Remove old refresh token
      this.refreshTokens.delete(refreshToken);
      
      return {
        accessToken: newToken,
        refreshToken: newRefreshToken,
        user: this.sanitizeUser(user)
      };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      return null;
    }
  }

  /**
   * Get role permissions (simple RBAC)
   */
  getRolePermissions(role) {
    const permissions = {
      admin: ['read', 'write', 'delete', 'manage_users', 'manage_tenants', 'manage_system'],
      user: ['read', 'write'],
      viewer: ['read']
    };
    
    return permissions[role] || permissions.viewer;
  }

  /**
   * Check if user has permission
   */
  hasPermission(user, permission) {
    const userPermissions = this.getRolePermissions(user.role);
    return userPermissions.includes(permission);
  }

  /**
   * Generate API key
   */
  generateApiKey(user, name = 'Default API Key') {
    const keyId = crypto.randomBytes(8).toString('hex');
    const keySecret = crypto.randomBytes(32).toString('hex');
    const apiKey = `${user.tenantId}_${keyId}_${keySecret}`;
    
    const keyData = {
      id: keyId,
      name,
      key: apiKey,
      userId: user.id,
      tenantId: user.tenantId,
      permissions: this.getRolePermissions(user.role),
      status: 'active',
      createdAt: Date.now(),
      lastUsed: null
    };
    
    this.apiKeys.set(apiKey, keyData);
    
    logger.info('🔐 API key generated', {
      userId: user.id,
      keyName: name,
      keyId
    });
    
    return keyData;
  }

  /**
   * Verify API key
   */
  verifyApiKey(apiKey) {
    const keyData = this.apiKeys.get(apiKey);
    
    if (!keyData || keyData.status !== 'active') {
      return null;
    }
    
    // Update last used
    keyData.lastUsed = Date.now();
    this.apiKeys.set(apiKey, keyData);
    
    return keyData;
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
        
        // Check if it's an API key (contains underscores)
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
          if (!user || user.status !== 'active') {
            return res.status(401).json({
              success: false,
              error: 'User not found or inactive',
              timestamp: new Date().toISOString()
            });
          }
          
          req.user = this.sanitizeUser(user);
          req.authMethod = 'api_key';
          req.permissions = keyData.permissions;
        } else {
          // JWT token
          const payload = await this.verifyToken(token);
          if (!payload) {
            return res.status(401).json({
              success: false,
              error: 'Invalid token',
              timestamp: new Date().toISOString()
            });
          }
          
          const user = this.users.get(payload.userId);
          if (!user || user.status !== 'active') {
            return res.status(401).json({
              success: false,
              error: 'User not found or inactive',
              timestamp: new Date().toISOString()
            });
          }
          
          req.user = this.sanitizeUser(user);
          req.authMethod = 'jwt';
          req.permissions = payload.permissions;
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
      
      if (!req.permissions.includes(permission)) {
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
   * Sanitize user (remove sensitive data)
   */
  sanitizeUser(user) {
    const { password, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Get authentication statistics
   */
  getAuthStats() {
    const stats = {
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.status === 'active').length,
      totalApiKeys: this.apiKeys.size,
      activeApiKeys: Array.from(this.apiKeys.values()).filter(k => k.status === 'active').length,
      refreshTokens: this.refreshTokens.size,
      roleDistribution: {}
    };
    
    // Count users by role
    for (const user of this.users.values()) {
      stats.roleDistribution[user.role] = (stats.roleDistribution[user.role] || 0) + 1;
    }
    
    return stats;
  }

  /**
   * List users (admin only)
   */
  listUsers(tenantId = null) {
    const users = Array.from(this.users.values())
      .filter(user => !tenantId || user.tenantId === tenantId)
      .map(user => this.sanitizeUser(user));
    
    return users;
  }

  /**
   * Update user
   */
  async updateUser(userId, updates) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Hash password if being updated
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, 10);
    }
    
    const updatedUser = {
      ...user,
      ...updates,
      updatedAt: Date.now()
    };
    
    this.users.set(userId, updatedUser);
    await this.saveUsers();
    
    logger.info('🔐 User updated', { userId, updates: Object.keys(updates) });
    
    return this.sanitizeUser(updatedUser);
  }

  /**
   * Delete user
   */
  async deleteUser(userId) {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    this.users.delete(userId);
    await this.saveUsers();
    
    logger.info('🔐 User deleted', { userId });
    
    return true;
  }
}

module.exports = SimpleAuth;