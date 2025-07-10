# Pi API Hub

API Middleware and MCP Server for HubSpot and Anthropic APIs

## Setup

1. Copy `.env.example` to `.env`
2. Add your API keys
3. Run `npm install`
4. Run `npm start`

## Endpoints

- `GET /health` - Health check
- `GET /api/test-connections` - Test API connections
- `POST /api/hubspot/graphql` - HubSpot GraphQL queries
- `GET /api/hubspot/contacts` - Get contacts
- `POST /api/anthropic/messages` - Claude API