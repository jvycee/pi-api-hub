# 🍌 MCP Integration Setup for Mark

## Quick Test API Endpoint

### Local Testing:
```bash
curl -X POST \
  http://localhost:3000/api/hubspot/mcp/test \
  -H 'Content-Type: application/json' \
  -d '{"model_id": "my_hubspot_model", "input": {"name": "John Doe"}}'
```

### Production (when deployed):
```bash
curl -X POST \
  https://your-domain.com/api/hubspot/mcp/test \
  -H 'Content-Type: application/json' \
  -d '{"model_id": "my_hubspot_model", "input": {"name": "John Doe"}}'
```

## Expected Response:
```json
{
  "success": true,
  "data": {
    "tool_used": "hubspot-create-contact",
    "model_id": "my_hubspot_model",
    "input_processed": {
      "name": "John Doe"
    },
    "hubspot_response": {
      "id": "12345",
      "properties": {
        "firstname": "John",
        "lastname": "Doe",
        "email": "john.doe@example.com",
        "createdate": "2025-07-11T06:35:00.000Z",
        "lastmodifieddate": "2025-07-11T06:35:00.000Z"
      }
    },
    "banana_optimization": {
      "cached": false,
      "response_time_ms": 145,
      "routing_decision": "official_mcp_tool",
      "performance_grade": "A+"
    },
    "mcp_server_info": {
      "mode": "hybrid",
      "official_tools": 4,
      "banana_tools": 4,
      "version": "1.0.0"
    }
  },
  "message": "🍌 MCP integration test successful!",
  "timestamp": "2025-07-11T06:35:00.000Z"
}
```

## Complete Setup:

### 1. Environment Variables:
```bash
# Set these environment variables:
export HUBSPOT_PRIVATE_APP_TOKEN="your_hubspot_token"
export BANANA_ADMIN_KEY="your_admin_key"
export BANANA_SERVER_PORT="3000"
export MCP_MODE="hybrid"
```

### 2. Start Server:
```bash
NODE_ENV=production node app.js
```

### 3. Test MCP Integration:
```bash
# Check MCP status
PRIVATE_APP_ACCESS_TOKEN=$HUBSPOT_PRIVATE_APP_TOKEN BANANA_API_KEY=$BANANA_ADMIN_KEY npm run mcp:status

# Start hybrid MCP server
PRIVATE_APP_ACCESS_TOKEN=$HUBSPOT_PRIVATE_APP_TOKEN BANANA_API_KEY=$BANANA_ADMIN_KEY npm run mcp:hybrid
```

## Features Available:

### 🎯 Hybrid MCP Tools:
- **4 Official HubSpot Tools**: Enterprise-grade CRM operations
- **4 Banana Tools**: Performance-optimized with caching
- **Intelligent Routing**: Automatic optimization based on request type

### 🚀 API Endpoints:
- `POST /api/hubspot/mcp/test` - Test MCP integration
- `GET /api/hubspot/contacts` - Get contacts (with caching)
- `POST /api/hubspot/search/:objectType` - Search with filters
- `GET /monitoring/mcp/status` - MCP client status
- `GET /monitoring/mcp/tools` - Available tools

### 🔧 Client Integration:
- **Claude Desktop**: Full MCP integration
- **Cursor**: Full MCP integration
- **REST API**: External testing endpoint

This gives you the **best of both worlds**: official HubSpot MCP tools + banana-powered performance optimizations! 🍌

---

*Ready for production deployment and external API testing!*