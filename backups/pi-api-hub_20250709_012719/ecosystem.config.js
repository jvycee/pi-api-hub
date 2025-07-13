module.exports = {
  apps: [{
    name: 'pi-api-hub',
    script: 'app.js',
    instances: 4, // Pi 5 has 4 cores!
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    // Pi 5 optimizations
    max_memory_restart: '1500M', // Restart if using more than 1.5GB
    node_args: '--max-old-space-size=1024', // Limit old space to 1GB
    
    // Logging
    log_file: './logs/combined.log',
    out_file: './logs/out.log',
    error_file: './logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    
    // Auto-restart configuration
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    
    // Advanced PM2 features
    min_uptime: '10s',
    max_restarts: 10,
    
    // Health monitoring
    health_check_grace_period: 3000,
    health_check_timeout: 5000
  }]
};