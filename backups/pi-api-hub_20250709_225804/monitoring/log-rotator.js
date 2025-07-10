const fs = require('fs').promises;
const path = require('path');
const { createReadStream, createWriteStream } = require('fs');
const { createGzip } = require('zlib');
const { pipeline } = require('stream/promises');
const logger = require('../shared/logger');

class LogRotator {
  constructor(options = {}) {
    this.logDir = options.logDir || path.join(__dirname, '../logs');
    this.maxFileSize = options.maxFileSize || 100 * 1024 * 1024; // 100MB
    this.maxFiles = options.maxFiles || 10;
    this.compressionLevel = options.compressionLevel || 6;
    this.checkInterval = options.checkInterval || 60000; // 1 minute
    this.enabled = options.enabled !== false;
    
    if (this.enabled) {
      this.startRotationCheck();
    }
  }

  startRotationCheck() {
    setInterval(async () => {
      try {
        await this.checkAndRotateLogs();
      } catch (error) {
        console.error('Log rotation error:', error);
      }
    }, this.checkInterval);
    
    logger.info('Log rotation service started', {
      maxFileSize: this.formatBytes(this.maxFileSize),
      maxFiles: this.maxFiles,
      checkInterval: this.checkInterval
    });
  }

  async checkAndRotateLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => 
        file.endsWith('.log') && !file.includes('.') // Active log files only
      );

      for (const logFile of logFiles) {
        const filePath = path.join(this.logDir, logFile);
        const stats = await fs.stat(filePath);
        
        if (stats.size > this.maxFileSize) {
          await this.rotateLog(filePath);
        }
      }

      // Clean up old rotated logs
      await this.cleanupOldLogs();

    } catch (error) {
      logger.error('Error checking logs for rotation:', error);
    }
  }

  async rotateLog(filePath) {
    const fileName = path.basename(filePath, '.log');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedName = `${fileName}.${timestamp}.log`;
    const rotatedPath = path.join(this.logDir, rotatedName);
    const compressedPath = `${rotatedPath}.gz`;

    try {
      // Create new log file first
      await fs.writeFile(filePath + '.tmp', '');
      
      // Move current log to rotated name
      await fs.rename(filePath, rotatedPath);
      
      // Rename temp file to active log
      await fs.rename(filePath + '.tmp', filePath);

      // Compress the rotated log
      await this.compressFile(rotatedPath, compressedPath);
      
      // Remove uncompressed rotated file
      await fs.unlink(rotatedPath);

      logger.info('Log rotated successfully', {
        original: filePath,
        compressed: compressedPath,
        compressionRatio: await this.getCompressionRatio(rotatedPath, compressedPath)
      });

    } catch (error) {
      logger.error('Log rotation failed:', error);
      
      // Try to recover by renaming back if rotation failed
      try {
        await fs.rename(rotatedPath, filePath);
      } catch (recoveryError) {
        logger.error('Failed to recover from rotation error:', recoveryError);
      }
    }
  }

  async compressFile(inputPath, outputPath) {
    try {
      const readStream = createReadStream(inputPath);
      const writeStream = createWriteStream(outputPath);
      const gzipStream = createGzip({ level: this.compressionLevel });

      await pipeline(readStream, gzipStream, writeStream);
      
    } catch (error) {
      logger.error('File compression failed:', error);
      throw error;
    }
  }

  async getCompressionRatio(originalPath, compressedPath) {
    try {
      const [originalStats, compressedStats] = await Promise.all([
        fs.stat(originalPath),
        fs.stat(compressedPath)
      ]);
      
      const ratio = ((originalStats.size - compressedStats.size) / originalStats.size * 100).toFixed(2);
      return `${ratio}%`;
    } catch (error) {
      return 'unknown';
    }
  }

  async cleanupOldLogs() {
    try {
      const files = await fs.readdir(this.logDir);
      const rotatedLogs = files
        .filter(file => file.includes('.log.gz'))
        .map(file => ({
          name: file,
          path: path.join(this.logDir, file),
          basename: file.split('.')[0] // Get the original log name
        }));

      // Group by base log name
      const logGroups = {};
      rotatedLogs.forEach(log => {
        if (!logGroups[log.basename]) {
          logGroups[log.basename] = [];
        }
        logGroups[log.basename].push(log);
      });

      // Clean up each group
      for (const [basename, logs] of Object.entries(logGroups)) {
        if (logs.length > this.maxFiles) {
          // Sort by creation time (newest first)
          const sortedLogs = await Promise.all(
            logs.map(async log => ({
              ...log,
              stats: await fs.stat(log.path)
            }))
          );
          
          sortedLogs.sort((a, b) => b.stats.mtime - a.stats.mtime);
          
          // Remove oldest files
          const filesToRemove = sortedLogs.slice(this.maxFiles);
          
          for (const fileToRemove of filesToRemove) {
            await fs.unlink(fileToRemove.path);
            logger.info('Old log file removed', {
              file: fileToRemove.name,
              age: Math.round((Date.now() - fileToRemove.stats.mtime) / (1000 * 60 * 60 * 24)) + ' days'
            });
          }
        }
      }

    } catch (error) {
      logger.error('Error cleaning up old logs:', error);
    }
  }

  formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  }

  async getLogStats() {
    try {
      const files = await fs.readdir(this.logDir);
      const logFiles = files.filter(file => file.endsWith('.log') || file.endsWith('.log.gz'));
      
      let totalSize = 0;
      let activeSize = 0;
      let compressedSize = 0;
      let fileCount = 0;

      for (const file of logFiles) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);
        
        totalSize += stats.size;
        fileCount++;
        
        if (file.endsWith('.log')) {
          activeSize += stats.size;
        } else if (file.endsWith('.gz')) {
          compressedSize += stats.size;
        }
      }

      return {
        totalFiles: fileCount,
        totalSize: this.formatBytes(totalSize),
        activeSize: this.formatBytes(activeSize),
        compressedSize: this.formatBytes(compressedSize),
        compressionSavings: totalSize > 0 ? 
          `${((compressedSize / totalSize) * 100).toFixed(2)}%` : '0%',
        maxFileSize: this.formatBytes(this.maxFileSize),
        maxFiles: this.maxFiles
      };
    } catch (error) {
      logger.error('Error getting log stats:', error);
      return null;
    }
  }

  // Force rotation of specific log file
  async forceRotation(logFileName) {
    const filePath = path.join(this.logDir, logFileName);
    
    try {
      await fs.access(filePath);
      await this.rotateLog(filePath);
      return true;
    } catch (error) {
      logger.error('Force rotation failed:', error);
      return false;
    }
  }

  // Get disk usage for log directory
  async getDiskUsage() {
    try {
      const { execSync } = require('child_process');
      const output = execSync(`df -h "${this.logDir}"`, { encoding: 'utf8' });
      const lines = output.trim().split('\n');
      const data = lines[1].split(/\s+/);
      
      return {
        filesystem: data[0],
        size: data[1],
        used: data[2],
        available: data[3],
        usePercentage: data[4],
        mountPoint: data[5]
      };
    } catch (error) {
      logger.error('Error getting disk usage:', error);
      return null;
    }
  }
}

module.exports = LogRotator;