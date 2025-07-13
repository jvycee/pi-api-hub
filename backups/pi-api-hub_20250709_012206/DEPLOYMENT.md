# 🍌 PI API HUB - MAXIMUM BANANA DEPLOYMENT GUIDE 🍌

## 🚀 Welcome to Maximum Banana Power!

This guide will help you deploy the ultimate banana-powered API hub on your Raspberry Pi 5. Get ready for **MAXIMUM BANANA EFFICIENCY**! 

## 📋 Prerequisites

### Hardware Requirements
- **Raspberry Pi 5** (8GB RAM recommended for maximum banana power)
- **32GB+ microSD card** (Class 10 or better)
- **Stable internet connection**
- **Power supply** (official Pi 5 power adapter recommended)

### Software Requirements
- **Raspberry Pi OS** (64-bit, latest version)
- **Node.js 18.x or higher**
- **Git**
- **PM2** (for production process management)

## 🔧 System Setup

### 1. Prepare Your Pi 5

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install essential tools
sudo apt install -y git curl build-essential

# Install Node.js (using NodeSource repository)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version  # Should be 18.x or higher
npm --version
```

### 2. Install PM2 (Production Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Set up PM2 to start on boot
pm2 startup
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u pi --hp /home/pi
```

### 3. Optimize Pi 5 for Maximum Banana Performance

```bash
# Increase swap size for heavy loads
sudo dphys-swapfile swapoff
sudo nano /etc/dphys-swapfile
# Change CONF_SWAPSIZE=2048 (2GB swap)
sudo dphys-swapfile setup
sudo dphys-swapfile swapon

# Optimize memory settings
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
echo 'vm.vfs_cache_pressure=50' | sudo tee -a /etc/sysctl.conf

# Increase file descriptor limits
echo 'pi soft nofile 65536' | sudo tee -a /etc/security/limits.conf
echo 'pi hard nofile 65536' | sudo tee -a /etc/security/limits.conf

# Enable memory overcommit for Node.js
echo 'vm.overcommit_memory=1' | sudo tee -a /etc/sysctl.conf
```

## 📦 Application Deployment

### 1. Clone the Repository

```bash
# Clone to your home directory
cd ~
git clone https://github.com/jvycee/pi-api-hub.git
cd pi-api-hub

# Install dependencies
npm install

# Install development dependencies for testing (optional)
npm install --save-dev jest supertest
```

### 2. Environment Configuration

```bash
# Create environment file
cp .env.example .env
nano .env
```

Add your configuration:
```env
# Required API Keys
HUBSPOT_API_KEY=your_hubspot_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Server Configuration
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# Performance Tuning for Pi 5
MAX_RESPONSE_SIZE=50485760  # 50MB
MAX_CONCURRENT_REQUESTS=10
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes

# Memory Thresholds (8GB Pi 5)
MEMORY_WARNING_THRESHOLD=6442450944   # 6GB
MEMORY_CRITICAL_THRESHOLD=7516192768  # 7GB
```

### 3. Create Logs Directory

```bash
mkdir -p logs
chmod 755 logs
```

### 4. Test the Application

```bash
# Run basic tests
npm test

# Test single-core mode
npm start

# Test cluster mode
npm run start:cluster

# Run performance benchmarks (optional)
BENCHMARK_MODE=true npm test -- tests/benchmarks/
```

## 🚀 Production Deployment

### 1. PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'pi-api-hub',
    script: 'cluster.js',
    instances: 1, // Let our cluster manager handle workers
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Memory and CPU limits for Pi 5
    max_memory_restart: '6G',
    node_args: '--max-old-space-size=6144',
    
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto-restart configuration
    autorestart: true,
    watch: false,
    max_restarts: 10,
    min_uptime: '10s',
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_fatal_exceptions: true
  }]
};
```

### 2. Start with PM2

```bash
# Start in production mode
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Check status
pm2 status
pm2 logs pi-api-hub
```

### 3. Set up Nginx (Optional - for reverse proxy)

```bash
# Install Nginx
sudo apt install -y nginx

# Create site configuration
sudo nano /etc/nginx/sites-available/pi-api-hub
```

Add configuration:
```nginx
server {
    listen 80;
    server_name your-pi-hostname.local;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for Pi 5
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }
    
    # Monitoring dashboard
    location /monitoring {
        proxy_pass http://localhost:3000/monitoring;
        # Optional: Add basic auth for security
        # auth_basic "Banana Monitoring";
        # auth_basic_user_file /etc/nginx/.htpasswd;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/pi-api-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 📊 Monitoring & Maintenance

### 1. Built-in Monitoring

Access the **MAXIMUM BANANA DASHBOARD**:
```
http://your-pi-ip:3000/monitoring/dashboard
```

Key endpoints:
- `/health` - Basic health check
- `/monitoring/dashboard` - Complete system overview
- `/monitoring/metrics` - Performance metrics
- `/monitoring/logs` - Log management

### 2. PM2 Monitoring

```bash
# Check application status
pm2 status

# Monitor in real-time
pm2 monit

# View logs
pm2 logs pi-api-hub

# Restart if needed
pm2 restart pi-api-hub

# Reload with zero downtime
pm2 reload pi-api-hub
```

### 3. System Monitoring Commands

```bash
# Check system resources
htop              # CPU and memory usage
df -h             # Disk usage
free -h           # Memory usage
iostat -x 1       # I/O statistics

# Monitor network
netstat -tulpn | grep :3000   # Check port usage
ss -tulpn | grep :3000        # Alternative network check

# Check application logs
tail -f logs/combined.log     # Application logs
journalctl -u nginx -f       # Nginx logs
```

## 🔧 Performance Tuning

### 1. Node.js Optimization

```bash
# Set NODE_OPTIONS for production
export NODE_OPTIONS="--max-old-space-size=6144 --gc-interval=100"

# Add to ~/.bashrc for persistence
echo 'export NODE_OPTIONS="--max-old-space-size=6144 --gc-interval=100"' >> ~/.bashrc
```

### 2. System-level Optimizations

```bash
# Optimize network settings
echo 'net.core.somaxconn = 65535' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv4.tcp_max_syn_backlog = 65535' | sudo tee -a /etc/sysctl.conf
echo 'net.ipv4.tcp_tw_reuse = 1' | sudo tee -a /etc/sysctl.conf

# Apply changes
sudo sysctl -p
```

### 3. Automated Maintenance Scripts

Create maintenance script:
```bash
nano ~/maintenance.sh
chmod +x ~/maintenance.sh
```

```bash
#!/bin/bash
# Pi API Hub Maintenance Script

echo "🍌 Starting Pi API Hub maintenance..."

# Rotate logs manually if needed
curl -X POST http://localhost:3000/monitoring/logs/rotate

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "⚠️  Warning: Disk usage is ${DISK_USAGE}%"
    # Clean old logs
    find logs/ -name "*.gz" -mtime +7 -delete
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100}')
if [ $MEMORY_USAGE -gt 90 ]; then
    echo "⚠️  Warning: Memory usage is ${MEMORY_USAGE}%"
    # Force garbage collection
    pm2 reload pi-api-hub
fi

# Restart weekly on Sunday
if [ $(date +%u) -eq 7 ]; then
    echo "🔄 Weekly restart..."
    pm2 restart pi-api-hub
fi

echo "✅ Maintenance complete!"
```

Set up cron job:
```bash
crontab -e
# Add: 0 2 * * * /home/pi/maintenance.sh >> /home/pi/maintenance.log 2>&1
```

## 🚨 Troubleshooting

### Common Issues

**Application won't start:**
```bash
# Check environment variables
cat .env

# Check Node.js version
node --version

# Check dependencies
npm install

# Check logs
pm2 logs pi-api-hub
```

**High memory usage:**
```bash
# Check memory stats
curl http://localhost:3000/monitoring/dashboard | jq '.system.memory'

# Force restart
curl -X POST http://localhost:3000/monitoring/restart
```

**API connection issues:**
```bash
# Test API connections
curl http://localhost:3000/api/test-connections

# Check API keys in .env
grep API_KEY .env
```

### Performance Issues

**Slow responses:**
```bash
# Check system load
uptime

# Monitor in real-time
curl http://localhost:3000/monitoring/metrics

# Run benchmarks
BENCHMARK_MODE=true npm test -- tests/benchmarks/
```

## 📚 Additional Resources

### Useful Commands
```bash
# Complete application restart
pm2 delete pi-api-hub && pm2 start ecosystem.config.js --env production

# Update application
git pull origin main && npm install && pm2 reload pi-api-hub

# Backup configuration
tar -czf pi-api-hub-backup-$(date +%Y%m%d).tar.gz .env logs/ ecosystem.config.js

# Monitor banana metrics
watch -n 5 'curl -s http://localhost:3000/monitoring/dashboard | jq .bananaMetrics'
```

### Monitoring URLs
- Dashboard: `http://your-pi-ip:3000/monitoring/dashboard`
- Metrics: `http://your-pi-ip:3000/monitoring/metrics`
- Health: `http://your-pi-ip:3000/health`
- Logs: `http://your-pi-ip:3000/monitoring/logs`

## 🍌 Congratulations!

Your Pi 5 is now running at **MAXIMUM BANANA POWER**! 🎉

The system includes:
- ✅ 4-core cluster mode for maximum throughput
- ✅ Intelligent memory management (6GB/7GB thresholds)
- ✅ Auto-restart on high load/errors
- ✅ Real-time monitoring dashboard
- ✅ Log rotation and maintenance
- ✅ Streaming support for large datasets
- ✅ Production-ready performance monitoring

**Monitor your banana metrics and enjoy maximum API power!** 🍌💪

---

*For support, check the monitoring dashboard or review the logs. Remember: Every problem is just an opportunity for more bananas!* 🍌