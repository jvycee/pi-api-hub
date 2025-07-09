const fs = require('fs-extra');
const path = require('path');
const cron = require('node-cron');
const { execSync } = require('child_process');
const logger = require('../shared/logger');

/**
 * 🍌 SMART BANANA BACKUP SYSTEM 🍌
 * Simple, Pi-optimized backup system for critical data
 */
class SimpleBackupSystem {
  constructor(options = {}) {
    this.config = {
      backupDir: options.backupDir || path.join(process.cwd(), 'backups'),
      maxBackups: options.maxBackups || 10,
      backupSchedule: options.backupSchedule || '0 2 * * *', // Daily at 2 AM
      compressionLevel: options.compressionLevel || 6,
      includePatterns: options.includePatterns || [
        'data/',
        'config/',
        'middleware/',
        'shared/',
        'analytics/',
        'monitoring/',
        'helpers/',
        'mcp-server/',
        'package.json',
        'package-lock.json',
        'app.js',
        'cluster.js',
        '.env'
      ],
      excludePatterns: options.excludePatterns || [
        'node_modules/',
        'backups/',
        'logs/',
        'coverage/',
        'tests/',
        '.git/',
        'tmp/',
        '*.log',
        '*.tmp'
      ]
    };
    
    this.stats = {
      totalBackups: 0,
      successfulBackups: 0,
      failedBackups: 0,
      lastBackupTime: null,
      lastBackupSize: 0,
      totalBackupSize: 0
    };
    
    this.cronJob = null;
    this.isRunning = false;
    
    this.init();
  }
  
  async init() {
    try {
      // Create backup directory if it doesn't exist
      await fs.ensureDir(this.config.backupDir);
      
      // Load existing backup stats
      await this.loadStats();
      
      // Schedule automatic backups
      this.scheduleBackups();
      
      logger.info('🍌 Simple Backup System initialized', {
        service: 'pi-api-hub',
        backupDir: this.config.backupDir,
        schedule: this.config.backupSchedule,
        maxBackups: this.config.maxBackups
      });
      
    } catch (error) {
      logger.error('Failed to initialize backup system:', error);
      throw error;
    }
  }
  
  scheduleBackups() {
    if (this.cronJob) {
      this.cronJob.stop();
    }
    
    this.cronJob = cron.schedule(this.config.backupSchedule, async () => {
      logger.info('🍌 Scheduled backup starting...');
      await this.createBackup();
    }, {
      scheduled: true,
      timezone: 'America/New_York'
    });
    
    this.isRunning = true;
    logger.info('🍌 Backup scheduler started', {
      service: 'pi-api-hub',
      schedule: this.config.backupSchedule
    });
  }
  
  async createBackup() {
    const backupId = this.generateBackupId();
    const backupPath = path.join(this.config.backupDir, `${backupId}.tar.gz`);
    
    try {
      logger.info('🍌 Creating backup...', {
        service: 'pi-api-hub',
        backupId,
        backupPath
      });
      
      // Create tar command with compression
      const includeArgs = this.config.includePatterns.map(pattern => 
        `--include='${pattern}'`
      ).join(' ');
      
      const excludeArgs = this.config.excludePatterns.map(pattern => 
        `--exclude='${pattern}'`
      ).join(' ');
      
      const tarCommand = `tar -czf "${backupPath}" ${excludeArgs} ${includeArgs} --exclude-vcs .`;
      
      // Execute backup command
      const startTime = Date.now();
      execSync(tarCommand, { 
        cwd: process.cwd(),
        stdio: 'pipe'
      });
      const endTime = Date.now();
      
      // Get backup file size
      const backupStats = await fs.stat(backupPath);
      const backupSize = backupStats.size;
      
      // Update statistics
      this.stats.totalBackups++;
      this.stats.successfulBackups++;
      this.stats.lastBackupTime = Date.now();
      this.stats.lastBackupSize = backupSize;
      this.stats.totalBackupSize += backupSize;
      
      // Save updated stats
      await this.saveStats();
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      logger.info('🍌 Backup created successfully', {
        service: 'pi-api-hub',
        backupId,
        backupSize: this.formatBytes(backupSize),
        duration: `${endTime - startTime}ms`
      });
      
      return {
        success: true,
        backupId,
        backupPath,
        backupSize,
        duration: endTime - startTime
      };
      
    } catch (error) {
      this.stats.totalBackups++;
      this.stats.failedBackups++;
      await this.saveStats();
      
      logger.error('🍌 Backup failed:', {
        service: 'pi-api-hub',
        backupId,
        error: error.message
      });
      
      // Clean up failed backup file
      try {
        await fs.remove(backupPath);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup failed backup file:', cleanupError);
      }
      
      throw error;
    }
  }
  
  async cleanupOldBackups() {
    try {
      const backupFiles = await fs.readdir(this.config.backupDir);
      const backupRegex = /^pi-api-hub_(\d{8}_\d{6})\.tar\.gz$/;
      
      // Filter and sort backup files by date
      const sortedBackups = backupFiles
        .filter(file => backupRegex.test(file))
        .map(file => {
          const match = file.match(backupRegex);
          return {
            filename: file,
            timestamp: match[1],
            path: path.join(this.config.backupDir, file)
          };
        })
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      
      // Remove old backups if we exceed the limit
      if (sortedBackups.length > this.config.maxBackups) {
        const backupsToRemove = sortedBackups.slice(this.config.maxBackups);
        
        for (const backup of backupsToRemove) {
          try {
            const backupStats = await fs.stat(backup.path);
            this.stats.totalBackupSize -= backupStats.size;
            await fs.remove(backup.path);
            
            logger.info('🍌 Old backup removed', {
              service: 'pi-api-hub',
              filename: backup.filename
            });
          } catch (error) {
            logger.warn('Failed to remove old backup:', error);
          }
        }
        
        await this.saveStats();
      }
      
    } catch (error) {
      logger.error('Failed to cleanup old backups:', error);
    }
  }
  
  async restoreBackup(backupId) {
    const backupPath = path.join(this.config.backupDir, `${backupId}.tar.gz`);
    
    try {
      // Check if backup exists
      if (!await fs.exists(backupPath)) {
        throw new Error(`Backup ${backupId} not found`);
      }
      
      logger.info('🍌 Starting backup restoration...', {
        service: 'pi-api-hub',
        backupId,
        backupPath
      });
      
      // Create restore directory
      const restoreDir = path.join(this.config.backupDir, `restore_${backupId}`);
      await fs.ensureDir(restoreDir);
      
      // Extract backup
      const tarCommand = `tar -xzf "${backupPath}" -C "${restoreDir}"`;
      execSync(tarCommand, { stdio: 'pipe' });
      
      logger.info('🍌 Backup restored successfully', {
        service: 'pi-api-hub',
        backupId,
        restoreDir
      });
      
      return {
        success: true,
        backupId,
        restoreDir
      };
      
    } catch (error) {
      logger.error('🍌 Backup restoration failed:', error);
      throw error;
    }
  }
  
  async listBackups() {
    try {
      const backupFiles = await fs.readdir(this.config.backupDir);
      const backupRegex = /^pi-api-hub_(\d{8}_\d{6})\.tar\.gz$/;
      
      const backups = [];
      
      for (const file of backupFiles) {
        if (backupRegex.test(file)) {
          const match = file.match(backupRegex);
          const backupPath = path.join(this.config.backupDir, file);
          const stats = await fs.stat(backupPath);
          
          backups.push({
            id: match[1],
            filename: file,
            path: backupPath,
            size: stats.size,
            formattedSize: this.formatBytes(stats.size),
            created: stats.ctime,
            modified: stats.mtime
          });
        }
      }
      
      // Sort by creation time (newest first)
      backups.sort((a, b) => b.created - a.created);
      
      return backups;
      
    } catch (error) {
      logger.error('Failed to list backups:', error);
      throw error;
    }
  }
  
  async getBackupStats() {
    return {
      ...this.stats,
      lastBackupAge: this.stats.lastBackupTime ? 
        Date.now() - this.stats.lastBackupTime : null,
      formattedLastBackupSize: this.formatBytes(this.stats.lastBackupSize),
      formattedTotalBackupSize: this.formatBytes(this.stats.totalBackupSize),
      isRunning: this.isRunning,
      nextBackupTime: this.cronJob ? this.cronJob.nextDates(1)[0] : null
    };
  }
  
  async loadStats() {
    const statsPath = path.join(this.config.backupDir, 'backup-stats.json');
    
    try {
      if (await fs.exists(statsPath)) {
        const statsData = await fs.readJson(statsPath);
        this.stats = { ...this.stats, ...statsData };
      }
    } catch (error) {
      logger.warn('Failed to load backup stats:', error);
    }
  }
  
  async saveStats() {
    const statsPath = path.join(this.config.backupDir, 'backup-stats.json');
    
    try {
      await fs.writeJson(statsPath, this.stats, { spaces: 2 });
    } catch (error) {
      logger.warn('Failed to save backup stats:', error);
    }
  }
  
  generateBackupId() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');
    
    return `pi-api-hub_${year}${month}${day}_${hour}${minute}${second}`;
  }
  
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.isRunning = false;
      
      logger.info('🍌 Backup scheduler stopped', {
        service: 'pi-api-hub'
      });
    }
  }
  
  start() {
    if (this.cronJob) {
      this.cronJob.start();
      this.isRunning = true;
      
      logger.info('🍌 Backup scheduler started', {
        service: 'pi-api-hub'
      });
    }
  }
}

module.exports = SimpleBackupSystem;