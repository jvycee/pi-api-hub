# 🍌 Pi API Hub - Production Setup Guide

## Quick Start (Minimal Setup)

### 1. Install Dependencies
```bash
# Install Node.js dependencies
npm install

# Specifically ensure Joi is installed (required for config system)
npm install joi
```

### 2. Start Server (Basic Mode)
```bash
# Option 1: Using production startup script (recommended)
node start-production.js

# Option 2: Direct startup
NODE_ENV=production node app.js

# Option 3: Debug startup (for troubleshooting)
NODE_ENV=production node debug-start.js
```

The server will start in basic mode with the following features:
- ✅ Health check endpoint (`/health`)
- ✅ Basic API functionality  
- ✅ Monitoring dashboard
- ❌ HubSpot integration (disabled - requires tokens)
- ❌ Admin features (disabled - requires admin key)

## Full Setup (All Features)

### 1. Environment Variables
Create a `.env` file or set these environment variables:

```bash
# Required for HubSpot integration
export HUBSPOT_PRIVATE_APP_TOKEN="your_hubspot_token_here"

# Required for admin features
export BANANA_ADMIN_KEY="your_admin_key_here"

# Optional configurations
export PORT=3000
export NODE_ENV=production
export MCP_MODE=hybrid
```

### 2. Get Required Tokens

#### HubSpot Private App Token:
1. Go to HubSpot Developer Portal
2. Create a Private App
3. Copy the token

#### Banana Admin Key:
1. Start the server without admin key
2. Visit: `http://localhost:3000/setup/admin-key` (localhost only)
3. Copy the generated admin key
4. Set as `BANANA_ADMIN_KEY` environment variable
5. Restart server

### 3. Start with Full Features
```bash
# With environment variables set
NODE_ENV=production node start-production.js
```

## Production Deployment

### Systemd Service (Recommended)
Create `/etc/systemd/system/pi-api-hub.service`:

```ini
[Unit]
Description=Pi API Hub - Banana-Powered MCP Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pi-api-hub
ExecStart=/usr/bin/node start-production.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=HUBSPOT_PRIVATE_APP_TOKEN=your_token_here
Environment=BANANA_ADMIN_KEY=your_admin_key_here

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable pi-api-hub
sudo systemctl start pi-api-hub
sudo systemctl status pi-api-hub
```

### PM2 (Alternative)
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start start-production.js --name "pi-api-hub"

# Save PM2 config
pm2 save
pm2 startup
```

## Troubleshooting

### Server Won't Start
1. **Check dependencies**: `npm install`
2. **Check Node version**: Requires Node.js 16+
3. **Use debug script**: `NODE_ENV=production node debug-start.js`
4. **Check logs**: Look for specific error messages

### Common Issues

#### "Missing required environment variables"
- **Solution**: Either set the environment variables OR ignore the warning
- **Basic mode**: Server runs without HubSpot/admin features
- **Full mode**: Set `HUBSPOT_PRIVATE_APP_TOKEN` and `BANANA_ADMIN_KEY`

#### "Cannot find module 'joi'"
- **Solution**: `npm install joi`
- **Cause**: New configuration system requires Joi validation

#### "Admin API key not configured" 
- **Solution**: Set `BANANA_ADMIN_KEY` or run in basic mode
- **Basic mode**: Admin features will be disabled but server runs

#### Port already in use
- **Solution**: Change port with `PORT=3001 node start-production.js`
- **Check**: `lsof -i :3000` to see what's using port 3000

## Health Check

Once running, verify the server:
```bash
# Basic health check
curl http://localhost:3000/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2025-07-11T17:55:17.532Z",
  "service": "pi-api-hub"
}
```

## Available Endpoints

### Basic Mode (No Tokens Required)
- `GET /health` - Health check
- `GET /monitoring/dashboard` - Monitoring dashboard
- `GET /api/test-connections` - Test basic connectivity

### Full Mode (With Tokens)
- All basic mode endpoints plus:
- `GET /api/hubspot/*` - HubSpot integration
- `GET /monitoring/*` - Advanced monitoring (requires admin key)
- `POST /api/anthropic/messages` - AI routing
- `POST /webhooks/hubspot` - HubSpot webhooks

## Security Notes

- Admin endpoints require `BANANA_ADMIN_KEY`
- HubSpot endpoints require `HUBSPOT_PRIVATE_APP_TOKEN`
- Rate limiting is enabled by default
- CORS is configured for secure origins only
- Input validation on all endpoints

## Performance

The server includes:
- ✅ Intelligent caching
- ✅ Connection pooling  
- ✅ Rate limiting
- ✅ Memory monitoring
- ✅ Auto-restart on failures
- ✅ Cluster mode support (use `node cluster.js` for multi-core)

🍌 **Banana power level: MAXIMUM!** 🍌