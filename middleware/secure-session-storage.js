const redis = require('redis');
const crypto = require('crypto');
const logger = require('../shared/logger');

class SecureSessionStorage {
  constructor(options = {}) {
    this.redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.sessionTimeout = options.sessionTimeout || 30 * 60 * 1000; // 30 minutes
    this.encryptionKey = process.env.SESSION_ENCRYPTION_KEY || this.generateEncryptionKey();
    this.keyPrefix = options.keyPrefix || 'session:';
    this.client = null;
    this.fallbackStorage = new Map(); // Fallback to memory if Redis unavailable
    this.useRedis = true;
    
    this.initializeRedis();
  }

  generateEncryptionKey() {
    const key = crypto.randomBytes(32).toString('hex');
    logger.warn('Generated new session encryption key. Set SESSION_ENCRYPTION_KEY environment variable for persistence.');
    return key;
  }

  async initializeRedis() {
    try {
      this.client = redis.createClient({
        url: this.redisUrl,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis connection error, falling back to memory storage:', err.message);
        this.useRedis = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis connected for session storage');
        this.useRedis = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Redis disconnected, using memory storage');
        this.useRedis = false;
      });

      await this.client.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis, using memory storage:', error.message);
      this.useRedis = false;
    }
  }

  encrypt(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  decrypt(encryptedData) {
    try {
      const [ivHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Failed to decrypt session data:', error.message);
      return null;
    }
  }

  async createSession(sessionId, sessionData) {
    const sessionKey = this.keyPrefix + sessionId;
    const encryptedData = this.encrypt(sessionData);
    const ttl = Math.floor(this.sessionTimeout / 1000);

    try {
      if (this.useRedis && this.client) {
        await this.client.setEx(sessionKey, ttl, encryptedData);
        logger.debug('Session created in Redis:', { sessionId, ttl });
      } else {
        // Fallback to memory storage
        this.fallbackStorage.set(sessionKey, {
          data: encryptedData,
          expires: Date.now() + this.sessionTimeout
        });
        logger.debug('Session created in memory:', { sessionId, ttl });
      }
      return true;
    } catch (error) {
      logger.error('Failed to create session:', error.message);
      return false;
    }
  }

  async getSession(sessionId) {
    const sessionKey = this.keyPrefix + sessionId;

    try {
      let encryptedData = null;

      if (this.useRedis && this.client) {
        encryptedData = await this.client.get(sessionKey);
      } else {
        // Fallback to memory storage
        const memorySession = this.fallbackStorage.get(sessionKey);
        if (memorySession) {
          if (Date.now() > memorySession.expires) {
            this.fallbackStorage.delete(sessionKey);
            return null;
          }
          encryptedData = memorySession.data;
        }
      }

      if (!encryptedData) {
        return null;
      }

      const sessionData = this.decrypt(encryptedData);
      if (!sessionData) {
        await this.deleteSession(sessionId);
        return null;
      }

      logger.debug('Session retrieved:', { sessionId });
      return sessionData;
    } catch (error) {
      logger.error('Failed to get session:', error.message);
      return null;
    }
  }

  async deleteSession(sessionId) {
    const sessionKey = this.keyPrefix + sessionId;

    try {
      if (this.useRedis && this.client) {
        await this.client.del(sessionKey);
      } else {
        this.fallbackStorage.delete(sessionKey);
      }
      logger.debug('Session deleted:', { sessionId });
      return true;
    } catch (error) {
      logger.error('Failed to delete session:', error.message);
      return false;
    }
  }

  async refreshSession(sessionId) {
    const sessionData = await this.getSession(sessionId);
    if (!sessionData) {
      return false;
    }

    sessionData.lastActivity = Date.now();
    return await this.createSession(sessionId, sessionData);
  }

  async cleanupExpiredSessions() {
    if (!this.useRedis) {
      // Clean up memory storage
      const now = Date.now();
      for (const [key, session] of this.fallbackStorage.entries()) {
        if (now > session.expires) {
          this.fallbackStorage.delete(key);
        }
      }
    }
    // Redis automatically handles TTL cleanup
  }

  async getSessionCount() {
    try {
      if (this.useRedis && this.client) {
        const keys = await this.client.keys(this.keyPrefix + '*');
        return keys.length;
      } else {
        return this.fallbackStorage.size;
      }
    } catch (error) {
      logger.error('Failed to get session count:', error.message);
      return 0;
    }
  }

  async getStats() {
    const sessionCount = await this.getSessionCount();
    
    return {
      sessionCount,
      storageType: this.useRedis ? 'redis' : 'memory',
      sessionTimeout: this.sessionTimeout,
      redisConnected: this.useRedis && this.client?.isOpen
    };
  }

  async close() {
    if (this.client) {
      await this.client.quit();
    }
    this.fallbackStorage.clear();
  }
}

module.exports = SecureSessionStorage;