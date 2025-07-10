const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const logger = require('../shared/logger');

class BananaMFA {
  constructor() {
    this.mfaSecrets = new Map(); // In production, store in encrypted database
    this.backupCodes = new Map();
    this.mfaAttempts = new Map();
    this.maxAttempts = 3;
    this.lockoutTime = 15 * 60 * 1000; // 15 minutes
    
    this.initializeBananaMFA();
  }

  initializeBananaMFA() {
    logger.info('🍌🔐 BANANA MFA FORTRESS INITIALIZED 🔐🍌', {
      service: 'banana-mfa',
      securityLevel: 'MAXIMUM_BANANA_PROTECTION'
    });
  }

  // 🍌 Generate MFA secret for user 🍌
  async generateBananaMFASecret(userId, userEmail) {
    try {
      const secret = speakeasy.generateSecret({
        name: `🍌 Pi API Hub (${userEmail})`,
        issuer: '🍌 Banana Mothership Security 🍌',
        length: 32
      });

      // Store secret securely
      this.mfaSecrets.set(userId, {
        secret: secret.base32,
        tempSecret: secret.base32, // For verification before enabling
        enabled: false,
        backupCodes: this.generateBackupCodes(),
        createdAt: new Date().toISOString(),
        bananaLevel: 'MAXIMUM'
      });

      // Generate QR code
      const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

      logger.info('🍌 BANANA MFA SECRET GENERATED', {
        userId,
        timestamp: new Date().toISOString(),
        bananaSecurityLevel: 'ENHANCED'
      });

      return {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
        backupCodes: this.mfaSecrets.get(userId).backupCodes,
        bananaMessage: '🍌 BANANA FORTRESS MFA READY 🍌'
      };

    } catch (error) {
      logger.error('🚨 BANANA MFA SECRET GENERATION FAILED', {
        userId,
        error: error.message
      });
      throw new Error('Failed to generate MFA secret');
    }
  }

  // 🍌 Verify MFA token 🍌
  verifyBananaMFAToken(userId, token) {
    try {
      const userMFA = this.mfaSecrets.get(userId);
      
      if (!userMFA) {
        logger.warn('🚨 MFA VERIFICATION FAILED - NO SECRET', { userId });
        return {
          verified: false,
          reason: 'MFA_NOT_SETUP',
          bananaMessage: '🍌 No banana security found! 🍌'
        };
      }

      // Check if user is locked out
      if (this.isUserLockedOut(userId)) {
        logger.warn('🚨 MFA VERIFICATION FAILED - USER LOCKED OUT', { userId });
        return {
          verified: false,
          reason: 'MFA_LOCKED_OUT',
          bananaMessage: '🚫🍌 Banana fortress locked! Try again later 🍌🚫'
        };
      }

      // Check if it's a backup code
      if (this.verifyBackupCode(userId, token)) {
        logger.info('🍌 BACKUP CODE VERIFIED', { userId });
        return {
          verified: true,
          method: 'BACKUP_CODE',
          bananaMessage: '🍌 Backup banana code accepted! 🍌'
        };
      }

      // Verify TOTP token
      const verified = speakeasy.totp.verify({
        secret: userMFA.secret,
        token: token,
        window: 2, // Allow 2 time windows (60 seconds)
        encoding: 'base32'
      });

      // Track attempt
      this.trackMFAAttempt(userId, verified);

      if (verified) {
        logger.info('🍌 BANANA MFA VERIFICATION SUCCESS', {
          userId,
          timestamp: new Date().toISOString()
        });
        
        // Clear failed attempts on success
        this.clearMFAAttempts(userId);
        
        return {
          verified: true,
          method: 'TOTP',
          bananaMessage: '🍌 Banana security verified! Access granted! 🍌'
        };
      } else {
        logger.warn('🚨 BANANA MFA VERIFICATION FAILED', {
          userId,
          timestamp: new Date().toISOString()
        });
        
        return {
          verified: false,
          reason: 'INVALID_TOKEN',
          remainingAttempts: this.getRemainingAttempts(userId),
          bananaMessage: '🚫🍌 Invalid banana code! Try again! 🍌🚫'
        };
      }

    } catch (error) {
      logger.error('🚨 BANANA MFA VERIFICATION ERROR', {
        userId,
        error: error.message
      });
      
      return {
        verified: false,
        reason: 'MFA_ERROR',
        bananaMessage: '🚨🍌 Banana security error! Contact admin! 🍌🚨'
      };
    }
  }

  // 🍌 Enable MFA for user 🍌
  enableBananaMFA(userId, verificationToken) {
    const userMFA = this.mfaSecrets.get(userId);
    
    if (!userMFA || !userMFA.tempSecret) {
      return {
        success: false,
        reason: 'NO_TEMP_SECRET',
        bananaMessage: '🚫🍌 No banana secret to verify! 🍌🚫'
      };
    }

    // Verify the token with temp secret
    const verified = speakeasy.totp.verify({
      secret: userMFA.tempSecret,
      token: verificationToken,
      window: 2,
      encoding: 'base32'
    });

    if (verified) {
      // Enable MFA
      userMFA.enabled = true;
      userMFA.secret = userMFA.tempSecret;
      delete userMFA.tempSecret;
      userMFA.enabledAt = new Date().toISOString();

      logger.info('🍌 BANANA MFA ENABLED', {
        userId,
        timestamp: userMFA.enabledAt
      });

      return {
        success: true,
        backupCodes: userMFA.backupCodes,
        bananaMessage: '🍌🔐 Banana MFA fortress activated! Save your backup codes! 🔐🍌'
      };
    } else {
      return {
        success: false,
        reason: 'INVALID_VERIFICATION_TOKEN',
        bananaMessage: '🚫🍌 Invalid verification banana! Try again! 🍌🚫'
      };
    }
  }

  // 🍌 Disable MFA 🍌
  disableBananaMFA(userId, currentPassword, mfaToken) {
    const userMFA = this.mfaSecrets.get(userId);
    
    if (!userMFA || !userMFA.enabled) {
      return {
        success: false,
        reason: 'MFA_NOT_ENABLED',
        bananaMessage: '🍌 MFA not enabled! 🍌'
      };
    }

    // Verify current MFA token
    const mfaVerified = this.verifyBananaMFAToken(userId, mfaToken);
    
    if (!mfaVerified.verified) {
      return {
        success: false,
        reason: 'MFA_VERIFICATION_FAILED',
        bananaMessage: '🚫🍌 Invalid banana code! Cannot disable MFA! 🍌🚫'
      };
    }

    // Disable MFA
    this.mfaSecrets.delete(userId);
    this.backupCodes.delete(userId);
    this.clearMFAAttempts(userId);

    logger.warn('🍌 BANANA MFA DISABLED', {
      userId,
      timestamp: new Date().toISOString(),
      securityReduction: 'MFA_REMOVED'
    });

    return {
      success: true,
      bananaMessage: '🍌 Banana MFA disabled! Security level reduced! 🍌'
    };
  }

  // Generate backup codes
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      // Generate 8-digit codes
      const code = Math.random().toString().substr(2, 8);
      codes.push(`🍌${code}`);
    }
    return codes;
  }

  // Verify backup code
  verifyBackupCode(userId, code) {
    const userMFA = this.mfaSecrets.get(userId);
    if (!userMFA || !userMFA.backupCodes) return false;

    const codeIndex = userMFA.backupCodes.indexOf(code);
    if (codeIndex !== -1) {
      // Remove used backup code
      userMFA.backupCodes.splice(codeIndex, 1);
      userMFA.lastBackupCodeUsed = new Date().toISOString();
      
      logger.info('🍌 BACKUP CODE USED', {
        userId,
        remainingCodes: userMFA.backupCodes.length
      });
      
      return true;
    }
    
    return false;
  }

  // Track MFA attempts
  trackMFAAttempt(userId, success) {
    if (!this.mfaAttempts.has(userId)) {
      this.mfaAttempts.set(userId, {
        attempts: [],
        lockoutUntil: null
      });
    }

    const userAttempts = this.mfaAttempts.get(userId);
    const now = Date.now();
    
    // Add attempt
    userAttempts.attempts.push({
      timestamp: now,
      success
    });

    // Clean old attempts (keep last hour)
    const oneHourAgo = now - (60 * 60 * 1000);
    userAttempts.attempts = userAttempts.attempts.filter(
      attempt => attempt.timestamp > oneHourAgo
    );

    // Check if should lock out
    const recentFailedAttempts = userAttempts.attempts.filter(
      attempt => !attempt.success && attempt.timestamp > (now - 15 * 60 * 1000)
    ).length;

    if (recentFailedAttempts >= this.maxAttempts) {
      userAttempts.lockoutUntil = now + this.lockoutTime;
      
      logger.warn('🚨 BANANA MFA USER LOCKED OUT', {
        userId,
        failedAttempts: recentFailedAttempts,
        lockoutUntil: new Date(userAttempts.lockoutUntil).toISOString()
      });
    }
  }

  // Check if user is locked out
  isUserLockedOut(userId) {
    const userAttempts = this.mfaAttempts.get(userId);
    if (!userAttempts || !userAttempts.lockoutUntil) return false;
    
    return Date.now() < userAttempts.lockoutUntil;
  }

  // Get remaining attempts
  getRemainingAttempts(userId) {
    const userAttempts = this.mfaAttempts.get(userId);
    if (!userAttempts) return this.maxAttempts;
    
    const now = Date.now();
    const recentFailedAttempts = userAttempts.attempts.filter(
      attempt => !attempt.success && attempt.timestamp > (now - 15 * 60 * 1000)
    ).length;

    return Math.max(0, this.maxAttempts - recentFailedAttempts);
  }

  // Clear MFA attempts
  clearMFAAttempts(userId) {
    this.mfaAttempts.delete(userId);
  }

  // 🍌 MFA middleware 🍌
  requireBananaMFA() {
    return (req, res, next) => {
      // Skip MFA for certain endpoints
      const skipPaths = ['/auth/login', '/auth/mfa/setup', '/auth/mfa/verify'];
      if (skipPaths.some(path => req.path.startsWith(path))) {
        return next();
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          bananaMessage: '🚫🍌 No banana authentication! 🍌🚫'
        });
      }

      const userMFA = this.mfaSecrets.get(userId);
      
      // If MFA is enabled for user, check if verified in session
      if (userMFA && userMFA.enabled) {
        if (!req.session?.mfaVerified) {
          return res.status(403).json({
            success: false,
            error: 'MFA verification required',
            requireMFA: true,
            bananaMessage: '🔐🍌 Banana MFA verification required! 🍌🔐'
          });
        }
      }

      next();
    };
  }

  // Get MFA status for user
  getMFAStatus(userId) {
    const userMFA = this.mfaSecrets.get(userId);
    const userAttempts = this.mfaAttempts.get(userId);
    
    return {
      enabled: userMFA?.enabled || false,
      hasBackupCodes: userMFA?.backupCodes?.length > 0,
      remainingBackupCodes: userMFA?.backupCodes?.length || 0,
      isLockedOut: this.isUserLockedOut(userId),
      remainingAttempts: this.getRemainingAttempts(userId),
      lockoutUntil: userAttempts?.lockoutUntil ? new Date(userAttempts.lockoutUntil).toISOString() : null,
      bananaStatus: userMFA?.enabled ? '🍌🔐 BANANA FORTRESS PROTECTED 🔐🍌' : '🍌 Basic banana protection 🍌'
    };
  }

  // Get MFA stats for admin
  getMFAStats() {
    const totalUsers = this.mfaSecrets.size;
    const enabledUsers = Array.from(this.mfaSecrets.values()).filter(mfa => mfa.enabled).length;
    const lockedOutUsers = Array.from(this.mfaAttempts.values()).filter(
      attempts => attempts.lockoutUntil && Date.now() < attempts.lockoutUntil
    ).length;

    return {
      totalMFAUsers: totalUsers,
      enabledMFAUsers: enabledUsers,
      disabledMFAUsers: totalUsers - enabledUsers,
      lockedOutUsers,
      mfaAdoptionRate: totalUsers > 0 ? (enabledUsers / totalUsers * 100).toFixed(1) + '%' : '0%',
      bananaSecurityLevel: enabledUsers > 0 ? 'ENHANCED' : 'BASIC',
      lastMFAActivity: this.getLastMFAActivity()
    };
  }

  // Get last MFA activity
  getLastMFAActivity() {
    let lastActivity = 0;
    
    this.mfaAttempts.forEach(attempts => {
      attempts.attempts.forEach(attempt => {
        if (attempt.timestamp > lastActivity) {
          lastActivity = attempt.timestamp;
        }
      });
    });

    return lastActivity > 0 ? new Date(lastActivity).toISOString() : null;
  }

  // 🍌 Generate new backup codes 🍌
  generateNewBackupCodes(userId) {
    const userMFA = this.mfaSecrets.get(userId);
    if (!userMFA || !userMFA.enabled) {
      return {
        success: false,
        reason: 'MFA_NOT_ENABLED',
        bananaMessage: '🚫🍌 MFA not enabled! 🍌🚫'
      };
    }

    const newCodes = this.generateBackupCodes();
    userMFA.backupCodes = newCodes;
    userMFA.backupCodesGeneratedAt = new Date().toISOString();

    logger.info('🍌 NEW BACKUP CODES GENERATED', {
      userId,
      timestamp: userMFA.backupCodesGeneratedAt
    });

    return {
      success: true,
      backupCodes: newCodes,
      bananaMessage: '🍌 New banana backup codes generated! Save them safely! 🍌'
    };
  }

  // 🍌 BANANA MFA SECURITY REPORT 🍌
  getBananaMFASecurityReport() {
    const stats = this.getMFAStats();
    
    return {
      title: '🍌🔐 BANANA MFA SECURITY REPORT 🔐🍌',
      timestamp: new Date().toISOString(),
      summary: {
        mfaAdoption: stats.mfaAdoptionRate,
        securityLevel: stats.bananaSecurityLevel,
        totalProtectedUsers: stats.enabledMFAUsers,
        securityIncidents: stats.lockedOutUsers
      },
      recommendations: this.getMFARecommendations(stats),
      bananaConclusion: stats.enabledMFAUsers > 0 ? 
        '🍌🔐 BANANA MFA FORTRESS STRONG! 🔐🍌' : 
        '🍌 MORE BANANA SECURITY NEEDED! 🍌'
    };
  }

  // Get MFA recommendations
  getMFARecommendations(stats) {
    const recommendations = [];
    
    if (stats.enabledMFAUsers === 0) {
      recommendations.push({
        priority: 'CRITICAL',
        action: 'Enable MFA for admin accounts',
        bananaMessage: '🚨🍌 Critical banana security needed! 🍌🚨'
      });
    }
    
    if (parseInt(stats.mfaAdoptionRate) < 50) {
      recommendations.push({
        priority: 'HIGH',
        action: 'Encourage MFA adoption',
        bananaMessage: '🍌 More users need banana protection! 🍌'
      });
    }
    
    if (stats.lockedOutUsers > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        action: 'Review locked out users',
        bananaMessage: '🔒🍌 Some bananas are locked out! 🍌🔒'
      });
    }
    
    return recommendations;
  }
}

module.exports = BananaMFA;