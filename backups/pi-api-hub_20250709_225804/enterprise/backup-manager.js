const logger = require('../shared/logger');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const { spawn } = require('child_process');
const zlib = require('zlib');

/**
 * 🔄 ENTERPRISE BACKUP MANAGER 🔄
 * Automated backups and disaster recovery with encryption and compression
 */
class BackupManager {
  constructor(options = {}) {
    this.backupPath = options.backupPath || path.join(__dirname, '../backups');
    this.encryptionKey = options.encryptionKey || process.env.BACKUP_ENCRYPTION_KEY;
    this.compressionLevel = options.compressionLevel || 6;
    this.retentionDays = options.retentionDays || 30;
    this.enableEncryption = options.enableEncryption || true;
    this.enableCompression = options.enableCompression || true;
    this.maxBackupSize = options.maxBackupSize || 1024 * 1024 * 1024; // 1GB
    
    // Backup configuration
    this.backupSources = options.backupSources || [
      {
        name: 'tenant_data',
        path: path.join(__dirname, '../data/tenants'),
        type: 'directory',
        priority: 'high'
      },
      {
        name: 'user_data',
        path: path.join(__dirname, '../data/users'),
        type: 'directory',
        priority: 'high'
      },
      {
        name: 'reports',
        path: path.join(__dirname, '../data/reports'),
        type: 'directory',
        priority: 'medium'
      },
      {
        name: 'logs',
        path: path.join(__dirname, '../logs'),
        type: 'directory',
        priority: 'low'
      }
    ];
    
    // Backup metadata
    this.backups = new Map();
    this.backupSchedule = new Map();
    
    this.initializeBackupManager();
    
    logger.info('🔄 Enterprise Backup Manager initialized');
  }

  /**
   * Initialize backup manager
   */
  async initializeBackupManager() {
    try {
      // Ensure backup directory exists
      await fs.mkdir(this.backupPath, { recursive: true });
      
      // Load existing backup metadata
      await this.loadBackupMetadata();
      
      // Start scheduled backup processor
      this.startScheduledBackups();
      
      // Start retention cleanup
      this.startRetentionCleanup();
      
      logger.info('🔄 Backup Manager initialization complete');
    } catch (error) {
      logger.error('Failed to initialize backup manager:', error);
      throw error;
    }
  }

  /**
   * Load existing backup metadata
   */
  async loadBackupMetadata() {
    try {
      const metadataFile = path.join(this.backupPath, 'backup_metadata.json');
      const data = await fs.readFile(metadataFile, 'utf8');
      const metadata = JSON.parse(data);
      
      metadata.backups.forEach(backup => {
        this.backups.set(backup.id, backup);
      });
      
      logger.info('📂 Loaded backup metadata', {
        backupCount: this.backups.size
      });
    } catch (error) {
      logger.info('No existing backup metadata found, starting fresh');
    }
  }

  /**
   * Save backup metadata
   */
  async saveBackupMetadata() {
    try {
      const metadataFile = path.join(this.backupPath, 'backup_metadata.json');
      const metadata = {
        backups: Array.from(this.backups.values()),
        lastUpdate: Date.now()
      };
      
      await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    } catch (error) {
      logger.error('Failed to save backup metadata:', error);
    }
  }

  /**
   * Create a full backup
   */
  async createFullBackup(options = {}) {
    const backupId = this.generateBackupId();
    const timestamp = Date.now();
    
    const backup = {
      id: backupId,
      type: 'full',
      status: 'in_progress',
      startTime: timestamp,
      endTime: null,
      size: 0,
      compressedSize: 0,
      sources: [],
      filePath: null,
      checksum: null,
      encrypted: this.enableEncryption,
      compressed: this.enableCompression,
      retentionDate: timestamp + (this.retentionDays * 24 * 60 * 60 * 1000),
      metadata: {
        version: '1.0',
        createdBy: options.userId || 'system',
        tenantId: options.tenantId || 'all',
        description: options.description || 'Automated full backup'
      }
    };
    
    this.backups.set(backupId, backup);
    
    try {
      logger.info('🔄 Starting full backup', { backupId });
      
      // Create backup archive
      const backupResult = await this.createBackupArchive(backup);
      
      backup.status = 'completed';
      backup.endTime = Date.now();
      backup.size = backupResult.size;
      backup.compressedSize = backupResult.compressedSize;
      backup.filePath = backupResult.filePath;
      backup.checksum = backupResult.checksum;
      backup.sources = backupResult.sources;
      
      // Update metadata
      this.backups.set(backupId, backup);
      await this.saveBackupMetadata();
      
      logger.info('🔄 Full backup completed', {
        backupId,
        size: backup.size,
        compressedSize: backup.compressedSize,
        duration: backup.endTime - backup.startTime
      });
      
      return backup;
    } catch (error) {
      logger.error('Full backup failed:', error);
      
      backup.status = 'failed';
      backup.endTime = Date.now();
      backup.error = error.message;
      this.backups.set(backupId, backup);
      
      throw error;
    }
  }

  /**
   * Create an incremental backup
   */
  async createIncrementalBackup(options = {}) {
    const lastFullBackup = this.getLastFullBackup();
    if (!lastFullBackup) {
      logger.info('No full backup found, creating full backup instead');
      return this.createFullBackup(options);
    }
    
    const backupId = this.generateBackupId();
    const timestamp = Date.now();
    
    const backup = {
      id: backupId,
      type: 'incremental',
      status: 'in_progress',
      startTime: timestamp,
      endTime: null,
      size: 0,
      compressedSize: 0,
      sources: [],
      filePath: null,
      checksum: null,
      encrypted: this.enableEncryption,
      compressed: this.enableCompression,
      retentionDate: timestamp + (this.retentionDays * 24 * 60 * 60 * 1000),
      baseBackupId: lastFullBackup.id,
      metadata: {
        version: '1.0',
        createdBy: options.userId || 'system',
        tenantId: options.tenantId || 'all',
        description: options.description || 'Automated incremental backup'
      }
    };
    
    this.backups.set(backupId, backup);
    
    try {
      logger.info('🔄 Starting incremental backup', { 
        backupId,
        baseBackupId: lastFullBackup.id
      });
      
      // Create incremental backup archive
      const backupResult = await this.createIncrementalArchive(backup, lastFullBackup);
      
      backup.status = 'completed';
      backup.endTime = Date.now();
      backup.size = backupResult.size;
      backup.compressedSize = backupResult.compressedSize;
      backup.filePath = backupResult.filePath;
      backup.checksum = backupResult.checksum;
      backup.sources = backupResult.sources;
      
      // Update metadata
      this.backups.set(backupId, backup);
      await this.saveBackupMetadata();
      
      logger.info('🔄 Incremental backup completed', {
        backupId,
        size: backup.size,
        compressedSize: backup.compressedSize,
        duration: backup.endTime - backup.startTime
      });
      
      return backup;
    } catch (error) {
      logger.error('Incremental backup failed:', error);
      
      backup.status = 'failed';
      backup.endTime = Date.now();
      backup.error = error.message;
      this.backups.set(backupId, backup);
      
      throw error;
    }
  }

  /**
   * Create backup archive
   */
  async createBackupArchive(backup) {
    const archivePath = path.join(this.backupPath, `${backup.id}.tar`);
    const sources = [];
    let totalSize = 0;
    
    // Create tar archive
    const tarArgs = ['cf', archivePath];
    
    // Add all backup sources
    for (const source of this.backupSources) {
      try {
        const stats = await fs.stat(source.path);
        if (stats.isDirectory() || stats.isFile()) {
          tarArgs.push('-C', path.dirname(source.path), path.basename(source.path));
          sources.push({
            name: source.name,
            path: source.path,
            size: stats.size,
            lastModified: stats.mtime.getTime()
          });
          totalSize += stats.size;
        }
      } catch (error) {
        logger.warn(`Backup source not found: ${source.path}`);
      }
    }
    
    if (sources.length === 0) {
      throw new Error('No backup sources found');
    }
    
    // Execute tar command
    await this.executeCommand('tar', tarArgs);
    
    let finalPath = archivePath;
    let compressedSize = totalSize;
    
    // Compress if enabled
    if (this.enableCompression) {
      const compressedPath = `${archivePath}.gz`;
      await this.compressFile(archivePath, compressedPath);
      await fs.unlink(archivePath);
      finalPath = compressedPath;
      
      const compressedStats = await fs.stat(compressedPath);
      compressedSize = compressedStats.size;
    }
    
    // Encrypt if enabled
    if (this.enableEncryption) {
      const encryptedPath = `${finalPath}.enc`;
      await this.encryptFile(finalPath, encryptedPath);
      await fs.unlink(finalPath);
      finalPath = encryptedPath;
    }
    
    // Calculate checksum
    const checksum = await this.calculateChecksum(finalPath);
    
    return {
      size: totalSize,
      compressedSize,
      filePath: finalPath,
      checksum,
      sources
    };
  }

  /**
   * Create incremental archive
   */
  async createIncrementalArchive(backup, baseBackup) {
    const archivePath = path.join(this.backupPath, `${backup.id}.tar`);
    const sources = [];
    let totalSize = 0;
    
    // Create tar archive with files newer than base backup
    const tarArgs = ['cf', archivePath];
    const baseTime = new Date(baseBackup.startTime);
    
    // Add modified files since base backup
    for (const source of this.backupSources) {
      try {
        const modifiedFiles = await this.findModifiedFiles(source.path, baseTime);
        
        if (modifiedFiles.length > 0) {
          for (const file of modifiedFiles) {
            tarArgs.push('-C', path.dirname(file.path), path.basename(file.path));
            sources.push({
              name: source.name,
              path: file.path,
              size: file.size,
              lastModified: file.lastModified
            });
            totalSize += file.size;
          }
        }
      } catch (error) {
        logger.warn(`Error processing incremental source: ${source.path}`);
      }
    }
    
    if (sources.length === 0) {
      logger.info('No changes detected since last backup');
      return {
        size: 0,
        compressedSize: 0,
        filePath: null,
        checksum: null,
        sources: []
      };
    }
    
    // Execute tar command
    await this.executeCommand('tar', tarArgs);
    
    let finalPath = archivePath;
    let compressedSize = totalSize;
    
    // Compress if enabled
    if (this.enableCompression) {
      const compressedPath = `${archivePath}.gz`;
      await this.compressFile(archivePath, compressedPath);
      await fs.unlink(archivePath);
      finalPath = compressedPath;
      
      const compressedStats = await fs.stat(compressedPath);
      compressedSize = compressedStats.size;
    }
    
    // Encrypt if enabled
    if (this.enableEncryption) {
      const encryptedPath = `${finalPath}.enc`;
      await this.encryptFile(finalPath, encryptedPath);
      await fs.unlink(finalPath);
      finalPath = encryptedPath;
    }
    
    // Calculate checksum
    const checksum = await this.calculateChecksum(finalPath);
    
    return {
      size: totalSize,
      compressedSize,
      filePath: finalPath,
      checksum,
      sources
    };
  }

  /**
   * Restore from backup
   */
  async restoreFromBackup(backupId, options = {}) {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    if (backup.status !== 'completed') {
      throw new Error(`Backup ${backupId} is not completed`);
    }
    
    const restoreId = this.generateRestoreId();
    const timestamp = Date.now();
    
    const restore = {
      id: restoreId,
      backupId,
      status: 'in_progress',
      startTime: timestamp,
      endTime: null,
      targetPath: options.targetPath || path.join(__dirname, '../data_restored'),
      metadata: {
        restoredBy: options.userId || 'system',
        description: options.description || 'Restore from backup'
      }
    };
    
    try {
      logger.info('🔄 Starting restore from backup', { restoreId, backupId });
      
      // Prepare restore directory
      await fs.mkdir(restore.targetPath, { recursive: true });
      
      // Process backup file
      let processedFile = backup.filePath;
      
      // Decrypt if needed
      if (backup.encrypted) {
        const decryptedPath = `${processedFile}.dec`;
        await this.decryptFile(processedFile, decryptedPath);
        processedFile = decryptedPath;
      }
      
      // Decompress if needed
      if (backup.compressed) {
        const decompressedPath = processedFile.replace('.gz', '');
        await this.decompressFile(processedFile, decompressedPath);
        if (backup.encrypted) {
          await fs.unlink(processedFile);
        }
        processedFile = decompressedPath;
      }
      
      // Extract archive
      const extractArgs = ['xf', processedFile, '-C', restore.targetPath];
      await this.executeCommand('tar', extractArgs);
      
      // Cleanup temporary files
      if (backup.encrypted || backup.compressed) {
        await fs.unlink(processedFile);
      }
      
      restore.status = 'completed';
      restore.endTime = Date.now();
      
      logger.info('🔄 Restore completed', {
        restoreId,
        backupId,
        duration: restore.endTime - restore.startTime
      });
      
      return restore;
    } catch (error) {
      logger.error('Restore failed:', error);
      
      restore.status = 'failed';
      restore.endTime = Date.now();
      restore.error = error.message;
      
      throw error;
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId) {
    const backup = this.backups.get(backupId);
    if (!backup) {
      throw new Error(`Backup ${backupId} not found`);
    }
    
    try {
      // Check file exists
      await fs.access(backup.filePath);
      
      // Verify checksum
      const currentChecksum = await this.calculateChecksum(backup.filePath);
      if (currentChecksum !== backup.checksum) {
        throw new Error('Checksum mismatch - backup file may be corrupted');
      }
      
      // Test archive integrity
      let testFile = backup.filePath;
      
      // Decrypt if needed for testing
      if (backup.encrypted) {
        const decryptedPath = `${testFile}.test_dec`;
        await this.decryptFile(testFile, decryptedPath);
        testFile = decryptedPath;
      }
      
      // Decompress if needed for testing
      if (backup.compressed) {
        const decompressedPath = testFile.replace('.gz', '');
        await this.decompressFile(testFile, decompressedPath);
        if (backup.encrypted) {
          await fs.unlink(testFile);
        }
        testFile = decompressedPath;
      }
      
      // Test tar archive
      const testArgs = ['tf', testFile];
      await this.executeCommand('tar', testArgs);
      
      // Cleanup test files
      if (backup.encrypted || backup.compressed) {
        await fs.unlink(testFile);
      }
      
      logger.info('🔄 Backup verification successful', { backupId });
      return { valid: true, checksum: currentChecksum };
    } catch (error) {
      logger.error('Backup verification failed:', error);
      return { valid: false, error: error.message };
    }
  }

  /**
   * Start scheduled backups
   */
  startScheduledBackups() {
    // Daily full backup at 2 AM
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 2 && now.getMinutes() === 0) {
        try {
          await this.createFullBackup();
        } catch (error) {
          logger.error('Scheduled full backup failed:', error);
        }
      }
    }, 60000); // Check every minute
    
    // Hourly incremental backups
    setInterval(async () => {
      const now = new Date();
      if (now.getMinutes() === 0) {
        try {
          await this.createIncrementalBackup();
        } catch (error) {
          logger.error('Scheduled incremental backup failed:', error);
        }
      }
    }, 60000); // Check every minute
    
    logger.info('📅 Scheduled backups started');
  }

  /**
   * Start retention cleanup
   */
  startRetentionCleanup() {
    setInterval(async () => {
      try {
        await this.cleanupOldBackups();
      } catch (error) {
        logger.error('Retention cleanup failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // Daily cleanup
    
    logger.info('🧹 Retention cleanup started');
  }

  /**
   * Cleanup old backups
   */
  async cleanupOldBackups() {
    const now = Date.now();
    const expiredBackups = [];
    
    for (const [backupId, backup] of this.backups) {
      if (backup.retentionDate < now) {
        expiredBackups.push(backup);
      }
    }
    
    for (const backup of expiredBackups) {
      try {
        if (backup.filePath) {
          await fs.unlink(backup.filePath);
        }
        this.backups.delete(backup.id);
        
        logger.info('🧹 Expired backup cleaned up', { backupId: backup.id });
      } catch (error) {
        logger.error('Failed to cleanup backup:', error);
      }
    }
    
    if (expiredBackups.length > 0) {
      await this.saveBackupMetadata();
    }
  }

  /**
   * Utility methods
   */
  
  async executeCommand(command, args) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      
      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });
      
      process.on('error', reject);
    });
  }

  async compressFile(inputPath, outputPath) {
    const input = require('fs').createReadStream(inputPath);
    const output = require('fs').createWriteStream(outputPath);
    const compress = zlib.createGzip({ level: this.compressionLevel });
    
    return new Promise((resolve, reject) => {
      input.pipe(compress).pipe(output);
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }

  async decompressFile(inputPath, outputPath) {
    const input = require('fs').createReadStream(inputPath);
    const output = require('fs').createWriteStream(outputPath);
    const decompress = zlib.createGunzip();
    
    return new Promise((resolve, reject) => {
      input.pipe(decompress).pipe(output);
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }

  async encryptFile(inputPath, outputPath) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, this.encryptionKey);
    
    const input = require('fs').createReadStream(inputPath);
    const output = require('fs').createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      output.write(iv);
      input.pipe(cipher).pipe(output);
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }

  async decryptFile(inputPath, outputPath) {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not configured');
    }
    
    const algorithm = 'aes-256-gcm';
    const input = require('fs').createReadStream(inputPath);
    const output = require('fs').createWriteStream(outputPath);
    
    return new Promise((resolve, reject) => {
      const iv = Buffer.alloc(16);
      input.once('readable', () => {
        input.read(16).copy(iv);
        const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
        input.pipe(decipher).pipe(output);
        output.on('finish', resolve);
        output.on('error', reject);
      });
      input.on('error', reject);
    });
  }

  async calculateChecksum(filePath) {
    const hash = crypto.createHash('sha256');
    const stream = require('fs').createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async findModifiedFiles(dirPath, sinceTime) {
    const modifiedFiles = [];
    
    try {
      const files = await fs.readdir(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime > sinceTime) {
          modifiedFiles.push({
            path: filePath,
            size: stats.size,
            lastModified: stats.mtime.getTime()
          });
        }
        
        if (stats.isDirectory()) {
          const subFiles = await this.findModifiedFiles(filePath, sinceTime);
          modifiedFiles.push(...subFiles);
        }
      }
    } catch (error) {
      logger.warn(`Error scanning directory: ${dirPath}`);
    }
    
    return modifiedFiles;
  }

  getLastFullBackup() {
    const fullBackups = Array.from(this.backups.values())
      .filter(backup => backup.type === 'full' && backup.status === 'completed')
      .sort((a, b) => b.startTime - a.startTime);
    
    return fullBackups[0] || null;
  }

  generateBackupId() {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateRestoreId() {
    return `restore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get backup statistics
   */
  getBackupStats() {
    const stats = {
      totalBackups: this.backups.size,
      fullBackups: Array.from(this.backups.values()).filter(b => b.type === 'full').length,
      incrementalBackups: Array.from(this.backups.values()).filter(b => b.type === 'incremental').length,
      completedBackups: Array.from(this.backups.values()).filter(b => b.status === 'completed').length,
      failedBackups: Array.from(this.backups.values()).filter(b => b.status === 'failed').length,
      totalSize: Array.from(this.backups.values()).reduce((sum, backup) => sum + (backup.size || 0), 0),
      totalCompressedSize: Array.from(this.backups.values()).reduce((sum, backup) => sum + (backup.compressedSize || 0), 0)
    };
    
    return stats;
  }

  /**
   * List backups
   */
  listBackups(options = {}) {
    const { type, status, limit = 50, offset = 0 } = options;
    
    let backups = Array.from(this.backups.values());
    
    if (type) {
      backups = backups.filter(backup => backup.type === type);
    }
    
    if (status) {
      backups = backups.filter(backup => backup.status === status);
    }
    
    // Sort by start time (newest first)
    backups.sort((a, b) => b.startTime - a.startTime);
    
    const total = backups.length;
    backups = backups.slice(offset, offset + limit);
    
    return {
      backups,
      total,
      limit,
      offset
    };
  }
}

module.exports = BackupManager;