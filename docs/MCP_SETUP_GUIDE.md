# 🍌 MCP Setup Guide - Step by Step

## Prerequisites

Before setting up MCP integration, ensure you have:

1. **Node.js** (v16 or higher)
2. **Pi API Hub** running
3. **HubSpot Private App Token**
4. **Admin API Key** from Pi API Hub
5. **Supported MCP Client** (Claude Desktop or Cursor)

## Step 1: Environment Configuration

### 1.1 Generate Environment Template

```bash
npm run mcp:env-template
```

This creates a template with all required environment variables:

```env
# HubSpot Private App Token
# Get this from HubSpot Developer Portal > Private Apps
HUBSPOT_PRIVATE_APP_TOKEN=your_hubspot_token_here

# Banana Admin API Key
# Get this from Pi API Hub /setup/admin-key endpoint
BANANA_ADMIN_KEY=your_admin_api_key_here

# Optional: MCP Server Configuration
MCP_MODE=hybrid
BANANA_SERVER_PORT=3000
```

### 1.2 Set Environment Variables

**Option A: .env file (Recommended)**
```bash
# Copy template to .env
npm run mcp:env-template > .env

# Edit .env with your actual values
nano .env
```

**Option B: Export variables**
```bash
export HUBSPOT_PRIVATE_APP_TOKEN="your_token"
export BANANA_ADMIN_KEY="your_admin_key"
```

## Step 2: Get Required Tokens

### 2.1 HubSpot Private App Token

1. Go to [HubSpot Developer Portal](https://developers.hubspot.com/)
2. Navigate to **Private Apps**
3. Click **Create a private app**
4. Configure scopes:
   - `contacts` (Read/Write)
   - `companies` (Read/Write)
   - `deals` (Read/Write)
   - `tickets` (Read/Write)
   - `crm.objects.custom` (Read/Write)
5. Copy the **Access Token**

### 2.2 Banana Admin API Key

```bash
# Get admin key from Pi API Hub
curl http://localhost:3000/setup/admin-key

# Or use the web interface
open http://localhost:3000/setup/admin-key
```

## Step 3: Client Detection and Setup

### 3.1 Automatic Client Detection

```bash
# Check what MCP clients are available
npm run mcp:status
```

Expected output:
```json
{
  "claude_desktop": {
    "detected": true,
    "configured": false,
    "version": "1.0.0",
    "configPath": "~/Library/Application Support/Claude/claude_desktop_config.json"
  },
  "cursor": {
    "detected": true,
    "configured": false,
    "configPath": "~/.cursor/mcp.json"
  }
}
```

### 3.2 Automatic Configuration

**For Claude Desktop:**
```bash
npm run mcp:setup-claude
```

**For Cursor:**
```bash
npm run mcp:setup-cursor
```

**For Both:**
```bash
npm run mcp:setup-claude && npm run mcp:setup-cursor
```

## Step 4: Manual Configuration (Alternative)

### 4.1 Claude Desktop Manual Setup

1. **Find Config File:**
   ```bash
   # macOS
   ~/Library/Application Support/Claude/claude_desktop_config.json
   
   # Windows
   %APPDATA%/Claude/claude_desktop_config.json
   
   # Linux
   ~/.config/claude/claude_desktop_config.json
   ```

2. **Edit Configuration:**
   ```json
   {
     "mcpServers": {
       "hubspot-banana-hybrid": {
         "command": "node",
         "args": ["mcp-server/hybrid-server.js"],
         "env": {
           "PRIVATE_APP_ACCESS_TOKEN": "your_hubspot_token",
           "BANANA_API_KEY": "your_admin_key",
           "BANANA_SERVER_PORT": "3000"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

### 4.2 Cursor Manual Setup

1. **Find Config File:**
   ```bash
   ~/.cursor/mcp.json
   ```

2. **Create Configuration:**
   ```json
   {
     "mcpServers": {
       "hubspot-banana-hybrid": {
         "command": "node",
         "args": ["mcp-server/hybrid-server.js"],
         "env": {
           "PRIVATE_APP_ACCESS_TOKEN": "your_hubspot_token",
           "BANANA_API_KEY": "your_admin_key",
           "BANANA_SERVER_PORT": "3000"
         }
       }
     }
   }
   ```

3. **Restart Cursor**

## Step 5: Verification

### 5.1 Check MCP Status

```bash
# Check configuration status
npm run mcp:status

# Expected output should show configured: true
```

### 5.2 Test MCP Functionality

```bash
# Test MCP server directly
curl -X POST http://localhost:3000/api/hubspot/mcp/test \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANANA_ADMIN_KEY" \
  -d '{
    "model_id": "test",
    "input": {
      "name": "Test User",
      "email": "test@example.com"
    }
  }'
```

### 5.3 Test in Client

**In Claude Desktop:**
1. Open a new conversation
2. Type: "List my HubSpot contacts"
3. Claude should use the MCP tools to retrieve contacts

**In Cursor:**
1. Open a new file
2. Use the MCP tools in the AI assistant
3. Test with: "Show me my HubSpot contacts"

## Step 6: Monitoring and Optimization

### 6.1 Access Monitoring Dashboard

```bash
# Check MCP server health
curl -H "X-API-Key: $BANANA_ADMIN_KEY" \
  http://localhost:3000/monitoring/mcp/status

# View available tools
curl -H "X-API-Key: $BANANA_ADMIN_KEY" \
  http://localhost:3000/monitoring/mcp/tools

# Get performance analytics
curl -H "X-API-Key: $BANANA_ADMIN_KEY" \
  http://localhost:3000/monitoring/analytics
```

### 6.2 Web Dashboard

Open in browser:
- Security Dashboard: `http://localhost:3000/dashboard.html`
- Add your admin API key when prompted
- Navigate to MCP monitoring section

## Common Setup Issues

### Issue 1: "Command not found"

**Problem:** MCP server command not found

**Solution:**
```bash
# Ensure you're in the project directory
cd /path/to/pi-api-hub

# Check if mcp-server directory exists
ls -la mcp-server/

# If missing, check git status
git status
```

### Issue 2: "Authentication failed"

**Problem:** Invalid API tokens

**Solution:**
```bash
# Test HubSpot token
curl -H "Authorization: Bearer $HUBSPOT_PRIVATE_APP_TOKEN" \
  https://api.hubapi.com/crm/v3/objects/contacts

# Test Banana API key
curl -H "X-API-Key: $BANANA_ADMIN_KEY" \
  http://localhost:3000/health
```

### Issue 3: "Config file not found"

**Problem:** MCP client config path incorrect

**Solution:**
```bash
# For Claude Desktop on macOS
ls -la "~/Library/Application Support/Claude/"

# Create directory if missing
mkdir -p "~/Library/Application Support/Claude/"

# For Cursor
ls -la ~/.cursor/
mkdir -p ~/.cursor/
```

### Issue 4: "Port already in use"

**Problem:** MCP server port conflict

**Solution:**
```bash
# Check what's using port 3000
lsof -i :3000

# Change port in environment
export BANANA_SERVER_PORT=3001

# Or in .env file
echo "BANANA_SERVER_PORT=3001" >> .env
```

## Advanced Setup Options

### Multi-Environment Setup

```bash
# Development environment
export MCP_MODE=hybrid
export BANANA_SERVER_PORT=3000

# Production environment
export MCP_MODE=banana
export BANANA_SERVER_PORT=8080
```

### Custom Tool Configuration

```javascript
// In mcp-server/hybrid-server.js
const customConfig = {
  tools: {
    enabled: ['hubspot-*', 'banana-*'],
    disabled: ['hubspot-batch-*']
  },
  cache: {
    contacts: 300000,  // 5 minutes
    search: 180000     // 3 minutes
  }
};
```

### Performance Tuning

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Enable debug mode
export DEBUG=mcp:*

# Adjust cache settings
export CACHE_TTL_CONTACTS=300000
export CACHE_TTL_SEARCH=180000
```

## Security Considerations

### 1. Token Security

```bash
# Never commit tokens to version control
echo ".env" >> .gitignore

# Use environment variables in production
export HUBSPOT_PRIVATE_APP_TOKEN="token_from_secure_vault"
```

### 2. Network Security

```bash
# Restrict MCP server access
iptables -A INPUT -p tcp --dport 3000 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 3000 -j DROP
```

### 3. File Permissions

```bash
# Secure config files
chmod 600 ~/.env
chmod 600 "~/Library/Application Support/Claude/claude_desktop_config.json"
```

## Backup and Recovery

### 1. Backup Configuration

```bash
# Create backup script
cat > backup_mcp.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p backups/$DATE

# Backup Claude Desktop config
cp "~/Library/Application Support/Claude/claude_desktop_config.json" \
   "backups/$DATE/claude_desktop_config.json"

# Backup Cursor config
cp ~/.cursor/mcp.json "backups/$DATE/cursor_mcp.json"

# Backup environment
cp .env "backups/$DATE/env"

echo "Backup created: backups/$DATE"
EOF

chmod +x backup_mcp.sh
```

### 2. Recovery

```bash
# Restore from backup
BACKUP_DATE="20240101_120000"
cp "backups/$BACKUP_DATE/claude_desktop_config.json" \
   "~/Library/Application Support/Claude/claude_desktop_config.json"
```

## Testing Your Setup

### 1. Unit Tests

```bash
# Run MCP-specific tests
npm test tests/mcp/

# Run integration tests
npm test tests/mcp/mcp-integration.test.js
```

### 2. Manual Testing

```bash
# Test contact retrieval
curl -X POST http://localhost:3000/api/hubspot/mcp/test \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANANA_ADMIN_KEY" \
  -d '{"model_id": "test", "input": {"limit": 5}}'

# Test search functionality
curl -X POST http://localhost:3000/api/hubspot/mcp/test \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $BANANA_ADMIN_KEY" \
  -d '{"model_id": "test", "input": {"query": "test"}}'
```

### 3. Performance Testing

```bash
# Load test MCP server
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/hubspot/mcp/test \
    -H "Content-Type: application/json" \
    -H "X-API-Key: $BANANA_ADMIN_KEY" \
    -d '{"model_id": "test", "input": {"name": "User'$i'"}}' &
done
wait
```

## Maintenance

### 1. Regular Updates

```bash
# Update MCP server dependencies
npm update

# Check for security vulnerabilities
npm audit

# Update configuration if needed
npm run mcp:setup-claude
npm run mcp:setup-cursor
```

### 2. Log Rotation

```bash
# Setup log rotation
cat > /etc/logrotate.d/mcp << 'EOF'
/path/to/pi-api-hub/logs/mcp.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 user user
}
EOF
```

### 3. Monitoring

```bash
# Add to crontab for health checks
crontab -e

# Add line:
# */5 * * * * curl -f http://localhost:3000/monitoring/mcp/status || echo "MCP Down" | mail -s "MCP Alert" admin@example.com
```

## Getting Help

### 1. Debug Information

```bash
# Collect debug information
cat > debug_info.sh << 'EOF'
#!/bin/bash
echo "=== MCP Debug Information ==="
echo "Node.js Version: $(node --version)"
echo "NPM Version: $(npm --version)"
echo "Platform: $(uname -a)"
echo ""
echo "=== Environment Variables ==="
env | grep -E "(HUBSPOT|BANANA|MCP)" | sed 's/=.*/=***/'
echo ""
echo "=== MCP Status ==="
npm run mcp:status 2>&1
echo ""
echo "=== Process Information ==="
ps aux | grep -E "(node|mcp)"
echo ""
echo "=== Port Status ==="
lsof -i :3000
EOF

chmod +x debug_info.sh
./debug_info.sh
```

### 2. Log Analysis

```bash
# Analyze MCP logs
grep -E "(ERROR|WARN)" logs/mcp.log | tail -20

# Check for specific errors
grep -i "authentication" logs/mcp.log
grep -i "connection" logs/mcp.log
```

### 3. Support Checklist

Before seeking help, ensure you have:
- [ ] Latest version of Pi API Hub
- [ ] Valid HubSpot Private App Token
- [ ] Valid Banana Admin API Key
- [ ] Correct client configuration
- [ ] No firewall blocking connections
- [ ] Proper file permissions
- [ ] Debug logs available

## Success Checklist

✅ **Environment Setup Complete**
- [ ] Environment variables configured
- [ ] HubSpot token obtained and tested
- [ ] Banana admin key obtained and tested

✅ **Client Configuration Complete**
- [ ] Claude Desktop configured (if using)
- [ ] Cursor configured (if using)
- [ ] Configuration files backed up

✅ **Testing Complete**
- [ ] MCP server responds to health checks
- [ ] Test API endpoint works
- [ ] Tools available in MCP client
- [ ] Contact retrieval works
- [ ] Search functionality works

✅ **Monitoring Setup**
- [ ] Can access monitoring dashboard
- [ ] Performance metrics available
- [ ] Error tracking operational
- [ ] Alerts configured (optional)

## Next Steps

After successful setup:

1. **Explore Tools**: Try different MCP tools in your client
2. **Monitor Performance**: Check analytics dashboard regularly
3. **Optimize Configuration**: Adjust cache settings based on usage
4. **Read Documentation**: Review the full MCP Integration Guide
5. **Join Community**: Contribute to the project or report issues

---

**🍌 Congratulations! Your MCP integration is now ready for maximum banana-powered productivity! 🍌**