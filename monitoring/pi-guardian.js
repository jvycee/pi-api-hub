// Carmack-style Pi hardware guardian - rockstar Pi monitoring
const { exec } = require('child_process');
const fs = require('fs').promises;
const { safeInterval } = require('../shared/interval-manager');
const logger = require('../shared/logger');

class PiGuardian {
  constructor() {
    this.metrics = {
      temperature: 0,
      throttled: false,
      diskHealth: 100,
      memoryPressure: false,
      networkUp: true,
      lastCheck: 0
    };
    
    this.thresholds = {
      tempWarning: 70,    // °C
      tempCritical: 80,   // °C  
      diskWarning: 85,    // % full
      memoryWarning: 90   // % used
    };
    
    this.emergencyMode = false;
    this.startMonitoring();
  }

  startMonitoring() {
    // Pi-specific monitoring every 30 seconds
    safeInterval(() => this.checkHardware(), 30000);
    safeInterval(() => this.checkStorage(), 60000);
    safeInterval(() => this.checkNetwork(), 45000);
    
    logger.info('🍓 Pi Guardian monitoring started');
  }

  async checkHardware() {
    try {
      // CPU temperature
      const temp = await this.execCommand('vcgencmd measure_temp');
      this.metrics.temperature = parseFloat(temp.match(/[\d.]+/)[0]);
      
      // Throttling status  
      const throttled = await this.execCommand('vcgencmd get_throttled');
      this.metrics.throttled = throttled.includes('0x50000') || throttled.includes('0x50005');
      
      // Memory pressure
      const memInfo = await fs.readFile('/proc/meminfo', 'utf8');
      const memAvailable = parseInt(memInfo.match(/MemAvailable:\s+(\d+)/)[1]);
      const memTotal = parseInt(memInfo.match(/MemTotal:\s+(\d+)/)[1]);
      this.metrics.memoryPressure = ((memTotal - memAvailable) / memTotal) > 0.9;
      
      this.handleThermal();
      this.metrics.lastCheck = Date.now();
      
    } catch (error) {
      logger.warn('Pi hardware check failed:', error.message);
    }
  }

  async checkStorage() {
    try {
      const df = await this.execCommand('df / | tail -1');
      const usage = parseInt(df.split(/\s+/)[4].replace('%', ''));
      this.metrics.diskHealth = 100 - usage;
      
      if (usage > this.thresholds.diskWarning) {
        logger.warn(`💾 Storage warning: ${usage}% full`);
        this.cleanupLogs();
      }
    } catch (error) {
      logger.warn('Storage check failed:', error.message);
    }
  }

  async checkNetwork() {
    try {
      await this.execCommand('ping -c 1 8.8.8.8', 5000);
      this.metrics.networkUp = true;
    } catch {
      this.metrics.networkUp = false;
      logger.warn('🌐 Network connectivity lost');
    }
  }

  handleThermal() {
    const temp = this.metrics.temperature;
    
    if (temp > this.thresholds.tempCritical && !this.emergencyMode) {
      logger.error(`🔥 THERMAL EMERGENCY: ${temp}°C - Activating protection`);
      this.emergencyMode = true;
      this.emergencyCool();
    } else if (temp > this.thresholds.tempWarning) {
      logger.warn(`🌡️  High temperature: ${temp}°C`);
    } else if (temp < this.thresholds.tempWarning && this.emergencyMode) {
      logger.info(`❄️  Temperature normalized: ${temp}°C`);
      this.emergencyMode = false;
    }
  }

  emergencyCool() {
    // Reduce system load during thermal emergency
    process.emit('thermal-emergency', this.metrics.temperature);
    
    // Could implement:
    // - Pause non-critical background tasks
    // - Reduce AI processing frequency  
    // - Lower CPU governor to powersave
  }

  async cleanupLogs() {
    try {
      // Keep only last 7 days of logs
      await this.execCommand('find logs/ -name "*.log" -mtime +7 -delete');
      logger.info('📁 Old logs cleaned up');
    } catch (error) {
      logger.warn('Log cleanup failed:', error.message);
    }
  }

  execCommand(cmd, timeout = 10000) {
    return new Promise((resolve, reject) => {
      exec(cmd, { timeout }, (error, stdout) => {
        if (error) reject(error);
        else resolve(stdout.trim());
      });
    });
  }

  // Get current Pi health status
  getStatus() {
    return {
      ...this.metrics,
      status: this.emergencyMode ? 'emergency' : 
              this.metrics.temperature > this.thresholds.tempWarning ? 'warning' : 'healthy',
      uptime: process.uptime(),
      piModel: this.getPiModel()
    };
  }

  getPiModel() {
    // Detect Pi model from /proc/cpuinfo if available
    try {
      return 'Raspberry Pi'; // Simplified for now
    } catch {
      return 'Unknown';
    }
  }

  // Middleware for adding Pi health to monitoring endpoints
  middleware() {
    return (req, res, next) => {
      req.piHealth = this.getStatus();
      next();
    };
  }
}

module.exports = PiGuardian;