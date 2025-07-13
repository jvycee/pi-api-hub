# 🍌 PI API HUB - MAXIMUM BANANA API DOCUMENTATION 🍌

## 🚀 Welcome to the Ultimate API Reference

This is your complete guide to the **MAXIMUM BANANA POWERED** API endpoints. Every request gets you closer to banana perfection! 

## 📊 Base Information

- **Base URL**: `http://your-pi-ip:3000`
- **Response Format**: JSON
- **Authentication**: API keys via environment variables
- **Rate Limiting**: 100 requests per 15 minutes per IP
- **Timeouts**: 60 seconds (optimized for Pi 5 ARM CPU)

## 🏥 Health & Monitoring Endpoints

### GET /health
Basic health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "worker": {
    "pid": 1234,
    "isMaster": false,
    "clustered": true
  },
  "performance": {
    "memory": {
      "status": "healthy",
      "totalMemory": "2.50 GB",
      "heapUtilization": "45.20%"
    },
    "requestQueue": {
      "status": "healthy",
      "queueUtilization": "25.50%",
      "activeRequests": 3
    }
  }
}
```

### GET /monitoring/dashboard 🍌
**MAXIMUM BANANA DASHBOARD** - Complete system overview.

**Response:**
```json
{
  "title": "🍌 PI API HUB - MAXIMUM BANANA DASHBOARD 🍌",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "status": "BANANA POWERED",
  "system": {
    "cpu": {
      "usage": 35,
      "cores": 4,
      "loadAverage": [0.5, 0.3, 0.2]
    },
    "memory": {
      "totalGB": "8.00",
      "usedGB": "2.50",
      "freeGB": "5.50",
      "usagePercentage": "31.25",
      "processHeapMB": "150.20",
      "heapUtilization": "45.30"
    },
    "uptime": {
      "system": "24 hours",
      "process": "12 hours"
    },
    "disk": {
      "size": "32G",
      "used": "12G",
      "available": "18G",
      "usePercentage": "40%"
    }
  },
  "performance": {
    "requestsPerMinute": "15.50",
    "avgResponseTime": "125.30ms",
    "errorRate": "0.12%",
    "totalRequests": 1550,
    "streaming": {
      "activeStreams": 2,
      "totalBytesStreamed": "∞ TB",
      "compressionRatio": "99.9%"
    }
  },
  "apis": {
    "hubspot": {
      "totalCalls": 450,
      "errors": 2,
      "errorRate": "0.44%"
    },
    "anthropic": {
      "totalCalls": 125,
      "errors": 0,
      "errorRate": "0.00%"
    }
  },
  "infrastructure": {
    "clustering": {
      "mode": "4-Core Beast Mode",
      "workers": 4,
      "loadBalancing": "Round Robin Banana Distribution"
    },
    "logging": {
      "totalFiles": 15,
      "totalSize": "250.50 MB",
      "activeSize": "50.20 MB",
      "compressedSize": "200.30 MB"
    }
  },
  "bananaMetrics": {
    "totalBananasEarned": "∞",
    "bananasPerSecond": "🍌🍌🍌",
    "peelEfficiency": "100%",
    "monkeyApproval": "👍 MAXIMUM"
  }
}
```

### GET /monitoring/metrics
Performance metrics with optional filtering.

**Query Parameters:**
- `timeRange` (optional): `1h`, `6h`, `24h` (default: `1h`)
- `type` (optional): `cpu`, `memory`, `requests`, `errors`, `hubspot`, `anthropic`

**Response:**
```json
{
  "timestamp": 1640995200000,
  "system": {
    "cpu": { "usage": 35, "cores": 4 },
    "memory": { "usagePercentage": "31.25" }
  },
  "performance": {
    "requestsPerMinute": "15.50",
    "avgResponseTime": "125.30ms",
    "errorRate": "0.12%"
  },
  "apis": {
    "hubspot": { "errorRate": "0.44%" },
    "anthropic": { "errorRate": "0.00%" }
  }
}
```

### GET /monitoring/logs
Log management and statistics.

**Response:**
```json
{
  "stats": {
    "totalFiles": 15,
    "totalSize": "250.50 MB",
    "activeSize": "50.20 MB",
    "compressedSize": "200.30 MB",
    "maxFileSize": "100.00 MB",
    "maxFiles": 10
  },
  "disk": {
    "size": "32G",
    "used": "12G",
    "available": "18G",
    "usePercentage": "40%"
  },
  "actions": {
    "forceRotation": "/monitoring/logs/rotate",
    "exportLogs": "/monitoring/logs/export"
  }
}
```

### POST /monitoring/logs/rotate
Force log rotation for disk space management.

**Request Body:**
```json
{
  "logFile": "combined.log"  // optional, defaults to combined.log
}
```

**Response:**
```json
{
  "success": true,
  "message": "Log rotation completed for combined.log",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### POST /monitoring/restart 🚨
**EMERGENCY BANANA RESTART** - Nuclear option for system restart.

**Request Body:**
```json
{
  "reason": "Manual restart via dashboard"  // optional
}
```

**Response:**
```json
{
  "success": true,
  "message": "🍌 EMERGENCY BANANA RESTART INITIATED! 🍌",
  "reason": "Manual restart via dashboard",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🔗 API Connection Testing

### GET /api/test-connections
Test connectivity to external APIs.

**Response:**
```json
{
  "success": true,
  "connections": {
    "hubspot": {
      "status": "connected",
      "error": null
    },
    "hubspotGraphQL": {
      "status": "connected", 
      "error": null
    },
    "anthropic": {
      "status": "connected",
      "error": null
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 👥 HubSpot CRM Endpoints

### GET /api/hubspot/contacts
Retrieve HubSpot contacts with streaming support.

**Query Parameters:**
- `limit` (optional): Number of contacts (default: 10, max: 100)
- `after` (optional): Pagination cursor
- `stream` (optional): Set to `true` for streaming response
- `properties` (optional): Comma-separated list of properties
- `associations` (optional): Associated objects to include

**Standard Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "12345",
        "properties": {
          "email": "contact@example.com",
          "firstname": "John",
          "lastname": "Doe",
          "createdate": "2024-01-01T12:00:00.000Z"
        },
        "createdAt": "2024-01-01T12:00:00.000Z",
        "updatedAt": "2024-01-01T12:00:00.000Z"
      }
    ],
    "paging": {
      "next": {
        "after": "next_cursor_value"
      }
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Streaming Response** (when `stream=true`):
```json
{
  "results": [
    {"id": "1", "properties": {...}},
    {"id": "2", "properties": {...}}
  ],
  "stream": true
}
```

### POST /api/hubspot/contacts
Create a new HubSpot contact.

**Request Body:**
```json
{
  "email": "newcontact@example.com",
  "firstname": "Jane",
  "lastname": "Smith",
  "phone": "+1234567890",
  "company": "Example Corp"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "67890",
    "properties": {
      "email": "newcontact@example.com",
      "firstname": "Jane",
      "lastname": "Smith",
      "createdate": "2024-01-01T12:00:00.000Z"
    },
    "createdAt": "2024-01-01T12:00:00.000Z"
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### POST /api/hubspot/search/:objectType
Advanced search across HubSpot objects.

**Supported Object Types:**
- `contacts`
- `companies` 
- `deals`
- `tickets`
- `products`

**Request Body:**
```json
{
  "filterGroups": [
    {
      "filters": [
        {
          "propertyName": "email",
          "operator": "CONTAINS_TOKEN",
          "value": "example.com"
        }
      ]
    }
  ],
  "sorts": [
    {
      "propertyName": "createdate",
      "direction": "DESCENDING"
    }
  ],
  "properties": ["email", "firstname", "lastname", "company"],
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 150,
    "results": [
      {
        "id": "12345",
        "properties": {
          "email": "user@example.com",
          "firstname": "John",
          "lastname": "Doe"
        }
      }
    ],
    "paging": {
      "next": {
        "after": "cursor_value"
      }
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### POST /api/hubspot/graphql
Execute GraphQL queries with streaming support.

**Request Body:**
```json
{
  "query": "query { CRM { contact_collection(limit: 10) { items { id properties { email firstname lastname } } } } }",
  "variables": {},
  "stream": false  // Set to true for streaming response
}
```

**Standard Response:**
```json
{
  "success": true,
  "data": {
    "data": {
      "CRM": {
        "contact_collection": {
          "items": [
            {
              "id": "12345",
              "properties": {
                "email": "contact@example.com",
                "firstname": "John",
                "lastname": "Doe"
              }
            }
          ]
        }
      }
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

**Streaming Response** (when `stream: true`):
Response will be streamed in chunks with `Transfer-Encoding: chunked` and `X-GraphQL-Stream: true` header.

### ALL /api/hubspot/*
Generic proxy to any HubSpot endpoint.

**Example:**
```
GET /api/hubspot/crm/v3/objects/companies?limit=20
POST /api/hubspot/crm/v3/objects/deals
PUT /api/hubspot/crm/v3/objects/contacts/12345
DELETE /api/hubspot/crm/v3/objects/contacts/12345
```

Supports all HTTP methods and forwards the request to HubSpot's API.

## 🤖 Anthropic Claude Endpoints

### POST /api/anthropic/messages
Send messages to Claude AI.

**Request Body:**
```json
{
  "model": "claude-3-haiku-20240307",
  "max_tokens": 1000,
  "messages": [
    {
      "role": "user",
      "content": "Hello! Can you help me with API integration?"
    }
  ]
}
```

**Available Models:**
- `claude-3-haiku-20240307` (fast, efficient)
- `claude-3-sonnet-20240229` (balanced)
- `claude-3-opus-20240229` (most capable)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "msg_123456",
    "type": "message",
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "Hello! I'd be happy to help you with API integration. What specific aspects would you like assistance with?"
      }
    ],
    "model": "claude-3-haiku-20240307",
    "stop_reason": "end_turn",
    "usage": {
      "input_tokens": 15,
      "output_tokens": 25
    }
  },
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## 🔧 Performance Features

### Request Queuing
- **Maximum concurrent requests**: 10 (configurable)
- **Queue timeout**: 30 seconds
- **Automatic load balancing** across 4 Pi cores

### Response Size Limiting
- **Maximum response size**: 50MB (configurable)
- **Automatic truncation** for large responses
- **Memory-efficient streaming** for large datasets

### Memory Management
- **Warning threshold**: 6GB RAM usage
- **Critical threshold**: 7GB RAM usage
- **Automatic garbage collection** on high usage
- **Process restart** on critical memory levels

### Streaming Support
All endpoints support streaming for large datasets:
- Add `?stream=true` for GET endpoints
- Add `"stream": true` for POST endpoints
- Responses use `Transfer-Encoding: chunked`
- Memory usage limited to 1MB chunks

## 🚨 Error Responses

### Standard Error Format
```json
{
  "success": false,
  "error": "Error description",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### HTTP Status Codes
- **200**: Success
- **400**: Bad Request (invalid parameters)
- **401**: Unauthorized (missing/invalid API keys)
- **413**: Payload Too Large (response size limit exceeded)
- **429**: Too Many Requests (rate limit exceeded)
- **500**: Internal Server Error
- **503**: Service Unavailable (queue full)

### Error Examples

**Rate Limit Exceeded:**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "queueStats": {
    "activeRequests": 10,
    "queueLength": 25,
    "maxConcurrent": 10
  }
}
```

**Memory Limit Exceeded:**
```json
{
  "success": false,
  "error": "Response too large for Pi memory constraints",
  "maxSize": "50.00 MB"
}
```

## 📈 Performance Monitoring

### Response Headers
Development mode includes performance headers:
- `X-Memory-Usage`: Current memory usage
- `X-Heap-Utilization`: Heap utilization percentage
- `X-Streaming`: Indicates streaming response
- `X-GraphQL-Stream`: GraphQL streaming indicator

### Banana Metrics
Monitor your banana efficiency:
- **Bananas earned**: Successful API calls
- **Bananas per second**: Request throughput
- **Peel efficiency**: Memory optimization
- **Monkey approval**: Overall system health

## 🍌 Maximum Banana Usage Examples

### Streaming Large Contact Lists
```bash
# Stream all contacts efficiently
curl "http://localhost:3000/api/hubspot/contacts?stream=true&limit=100&properties=email,firstname,lastname"
```

### Advanced Search with Pagination
```bash
# Search for contacts from specific domain
curl -X POST http://localhost:3000/api/hubspot/search/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "filterGroups": [{
      "filters": [{
        "propertyName": "email",
        "operator": "CONTAINS_TOKEN", 
        "value": "example.com"
      }]
    }],
    "properties": ["email", "firstname", "lastname", "company"],
    "limit": 50
  }'
```

### Streaming GraphQL Query
```bash
# Large GraphQL query with streaming
curl -X POST http://localhost:3000/api/hubspot/graphql \
  -H "Content-Type: application/json" \
  -d '{
    "query": "query { CRM { contact_collection(limit: 1000) { items { id properties { email firstname lastname company phone } } } } }",
    "stream": true
  }'
```

### Monitor System Performance
```bash
# Real-time banana dashboard
curl http://localhost:3000/monitoring/dashboard | jq .

# Get performance metrics
curl "http://localhost:3000/monitoring/metrics?timeRange=24h&type=cpu"

# Check banana efficiency
curl http://localhost:3000/monitoring/dashboard | jq .bananaMetrics
```

## 🔐 Security Considerations

### API Key Management
- Store API keys in `.env` file
- Never commit API keys to version control
- Rotate keys regularly
- Monitor for unauthorized usage

### Rate Limiting
- Default: 100 requests per 15 minutes per IP
- Configurable via `RATE_LIMIT_MAX_REQUESTS` and `RATE_LIMIT_WINDOW_MS`
- Automatic blocking of excessive requests

### Memory Protection
- Automatic response size limiting
- Memory usage monitoring
- Process restart on memory exhaustion
- Request queuing to prevent overload

---

## 🎉 Congratulations!

You now have complete knowledge of the **MAXIMUM BANANA POWERED API**! 

Remember:
- 🍌 Every request earns you bananas
- 🚀 Streaming maximizes efficiency  
- 📊 Monitor your banana metrics
- 🔧 Use the dashboard for system health

**Happy coding with maximum banana power!** 🍌💪