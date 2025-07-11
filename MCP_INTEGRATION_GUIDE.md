# 🍌 BANANA BOX MCP INTEGRATION GUIDE 🍌

## Overview

Your banana box is now **MAXIMUM POWERED** with official HubSpot MCP server integration! This guide shows you how to leverage the new hybrid MCP architecture.

## 🚀 What You Get

### **20+ Official HubSpot MCP Tools**
- `hubspot-list-objects` - List CRM objects with pagination
- `hubspot-search-objects` - Advanced search with filters
- `hubspot-batch-create-objects` - Create multiple records
- `hubspot-batch-update-objects` - Update multiple records
- `hubspot-create-engagement` - Create notes and tasks
- `hubspot-list-associations` - Manage CRM relationships
- `hubspot-get-workflows` - Access workflow data
- And 13 more official tools!

### **Banana-Powered Optimizations**
- `banana-get-contacts-cached` - 3-minute intelligent caching
- `banana-get-contacts-streaming` - Stream large datasets
- `banana-search-cached` - 2-minute search caching
- `banana-usage-analytics` - Performance metrics
- Plus all your existing banana middleware!

## 🛠️ Quick Setup

### 1. Environment Variables
```bash
# Generate template
npm run mcp:env-template > .env.local

# Edit and add your tokens
HUBSPOT_PRIVATE_APP_TOKEN=your_token_here
BANANA_ADMIN_KEY=your_admin_key_here
```

### 2. Setup Claude Desktop
```bash
npm run mcp:setup-claude
```

### 3. Setup Cursor
```bash
npm run mcp:setup-cursor
```

### 4. Check Status
```bash
npm run mcp:status
```

## 🎯 Usage Examples

### Claude Desktop
After setup, you can use prompts like:
- "Get the latest update about Acme Inc from my HubSpot account"
- "Create a new contact for john@example.com at Acme Inc"
- "Show me all deals in 'Decision maker bought in' stage over $1000"
- "Get performance analytics for the last 24 hours"

### Cursor
Same commands work in Cursor with MCP integration!

## 🔧 Configuration

### Client Configuration
Edit `/config/mcp-config.json` to:
- Enable/disable official vs banana tools
- Configure routing rules
- Set up monitoring preferences

### Routing Strategy
The system intelligently routes requests:
- **Simple reads** → Banana (cached performance)
- **Complex operations** → Official HubSpot tools
- **Batch operations** → Official HubSpot tools
- **Streaming** → Banana (custom streaming)

## 📊 Monitoring

### Web Dashboard
- Visit `/monitoring/mcp/status` - MCP client status
- Visit `/monitoring/mcp/tools` - Available tools
- Visit `/monitoring/mcp/instructions` - Setup instructions

### API Endpoints
```bash
# Get MCP status
curl -H "x-api-key: $ADMIN_KEY" http://localhost:3000/monitoring/mcp/status

# Setup client configuration
curl -X POST -H "x-api-key: $ADMIN_KEY" \
  http://localhost:3000/monitoring/mcp/setup/claude_desktop
```

## 🎨 Advanced Features

### Hybrid Server
Run the hybrid MCP server directly:
```bash
npm run mcp:hybrid
```

### Custom Tool Development
Add new banana tools in `/mcp-server/hybrid-server.js`:
```javascript
{
  name: 'banana-custom-tool',
  description: 'Your custom banana-powered tool',
  inputSchema: { /* schema */ },
  source: 'banana'
}
```

### Performance Optimization
The system automatically:
- Caches frequent requests
- Routes based on complexity
- Streams large datasets
- Provides analytics

## 🔍 Troubleshooting

### Common Issues

1. **MCP Tools Not Showing**
   - Check environment variables
   - Restart your MCP client
   - Verify config file location

2. **Authentication Errors**
   - Validate HubSpot private app token
   - Check API key permissions
   - Review CORS settings

3. **Performance Issues**
   - Check routing configuration
   - Monitor cache hit rates
   - Review streaming settings

### Debug Commands
```bash
# Check client status
npm run mcp:status

# Test hybrid server
npm run mcp:hybrid

# Check logs
tail -f logs/app.log
```

## 🌟 Best Practices

1. **Use Cached Tools** for repeated data access
2. **Use Official Tools** for complex CRM operations
3. **Monitor Performance** through the dashboard
4. **Update Regularly** to get new HubSpot features
5. **Secure Your Tokens** - never commit to git

## 📈 Performance Metrics

Track your banana box performance:
- Tool usage distribution (Official vs Banana)
- Response time averages
- Cache hit rates
- Error rates
- Cost optimization savings

## 🍌 Maximum Banana Power Activated!

Your banana box now has the **BEST OF BOTH WORLDS**:
- Official HubSpot MCP tools for comprehensive CRM operations
- Banana-powered optimizations for maximum performance
- Intelligent routing for optimal efficiency
- Enterprise-grade monitoring and analytics

---

*Need help? Check the monitoring dashboard or create an issue in the repo!*