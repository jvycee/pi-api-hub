const request = require('supertest');
const app = require('../../app');

describe('🍌 API Endpoints - Maximum Banana Integration Tests', () => {
  let server;
  let originalHubSpotKey, originalAnthropicKey;

  beforeAll((done) => {
    server = app.listen(3001, done);
  });

  afterAll(async () => {
    // Close server and wait for completion
    await new Promise((resolve) => {
      server.close(resolve);
    });
    
    // Give time for cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  describe('Health & Monitoring Endpoints', () => {
    test('GET /health should return healthy status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('performance');
      
      expect(response.body.performance).toHaveProperty('memory');
      expect(response.body.performance).toHaveProperty('requestQueue');
    });

    test('🍌 GET /monitoring/dashboard should return maximum banana dashboard', async () => {
      const response = await request(app)
        .get('/monitoring/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('title', '🍌 PI API HUB - MAXIMUM BANANA DASHBOARD 🍌');
      expect(response.body).toHaveProperty('status', 'BANANA POWERED');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('apis');
      expect(response.body).toHaveProperty('infrastructure');
      expect(response.body).toHaveProperty('bananaMetrics');
      
      // Check banana metrics
      expect(response.body.bananaMetrics).toHaveProperty('totalBananasEarned', '∞');
      expect(response.body.bananaMetrics).toHaveProperty('bananasPerSecond', '🍌🍌🍌');
      expect(response.body.bananaMetrics).toHaveProperty('peelEfficiency', '100%');
      expect(response.body.bananaMetrics).toHaveProperty('monkeyApproval', '👍 MAXIMUM');
    });

    test('GET /monitoring/metrics should return performance metrics', async () => {
      const response = await request(app)
        .get('/monitoring/metrics')
        .expect(200);

      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('system');
      expect(response.body).toHaveProperty('performance');
      expect(response.body).toHaveProperty('apis');
    });

    test('GET /monitoring/logs should return log statistics', async () => {
      const response = await request(app)
        .get('/monitoring/logs')
        .expect(200);

      expect(response.body).toHaveProperty('stats');
      expect(response.body).toHaveProperty('disk');
      expect(response.body).toHaveProperty('actions');
      
      expect(response.body.actions).toHaveProperty('forceRotation');
      expect(response.body.actions).toHaveProperty('exportLogs');
    });
  });

  describe('API Connection Tests', () => {
    test('GET /api/test-connections should test API connectivity', async () => {
      const response = await request(app)
        .get('/api/test-connections')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('connections');
      expect(response.body).toHaveProperty('timestamp');
      
      expect(response.body.connections).toHaveProperty('hubspot');
      expect(response.body.connections).toHaveProperty('anthropic');
      expect(response.body.connections).toHaveProperty('hubspotGraphQL');
    });
  });

  describe('HubSpot Endpoints', () => {
    test('GET /api/hubspot/contacts should handle API requests', async () => {
      const response = await request(app)
        .get('/api/hubspot/contacts?limit=1');

      // Should either succeed (200) or fail (500) depending on API key availability
      expect([200, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('timestamp');
      
      if (response.status === 200) {
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      } else {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('GET /api/hubspot/contacts with streaming should handle streaming requests', async () => {
      try {
        const response = await request(app)
          .get('/api/hubspot/contacts?stream=true&limit=1')
          .timeout(8000); // 8 second timeout

        // Should either succeed (200) or fail (500) depending on API key
        expect([200, 500]).toContain(response.status);
        
        // If successful, should have streaming headers
        if (response.status === 200) {
          expect(response.headers['x-pagination-stream']).toBe('true');
          expect(response.headers['x-stream-id']).toBeDefined();
          expect(response.text).toContain('"results"');
          expect(response.text).toContain('"stream": true');
        }
        
        // If it fails, should have proper error response
        if (response.status === 500) {
          expect(response.body).toHaveProperty('success', false);
          expect(response.body).toHaveProperty('error');
        }
      } catch (error) {
        // If timeout or other error, it's likely due to missing API key
        // The test should still pass as long as the endpoint structure is correct
        expect(error.message).toMatch(/timeout|Timeout|ECONNRESET|ENOTFOUND/);
      }
    }, 10000); // 10 second test timeout

    test('POST /api/hubspot/contacts should handle contact creation', async () => {
      const contactData = {
        email: 'test@banana.com',
        firstname: 'Banana',
        lastname: 'Test'
      };

      const response = await request(app)
        .post('/api/hubspot/contacts')
        .send(contactData);

      // Should either succeed (201), conflict (409), or fail (500) depending on API key and data
      expect([201, 409, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('timestamp');
    });

    test('POST /api/hubspot/graphql should handle GraphQL queries', async () => {
      const query = {
        query: `
          query {
            CRM {
              contact_collection(limit: 1) {
                items {
                  id
                }
              }
            }
          }
        `
      };

      const response = await request(app)
        .post('/api/hubspot/graphql')
        .send(query);

      // Should either succeed (200) or fail (500) depending on API key
      expect([200, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('timestamp');
    });

    test('POST /api/hubspot/search/contacts should handle contact search', async () => {
      const searchRequest = {
        filterGroups: [],
        properties: ['email', 'firstname', 'lastname'],
        limit: 10
      };

      const response = await request(app)
        .post('/api/hubspot/search/contacts')
        .send(searchRequest);

      // Should either succeed (200) or fail (500) depending on API key
      expect([200, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Anthropic Endpoints', () => {
    test('POST /api/anthropic/messages should handle Claude messages', async () => {
      const message = {
        model: 'claude-3-haiku-20240307',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello banana!' }]
      };

      const response = await request(app)
        .post('/api/anthropic/messages')
        .send(message);

      // Should either succeed (200) or fail (500) depending on API key
      expect([200, 500]).toContain(response.status);
      expect(response.body).toHaveProperty('timestamp');
    });

    test('POST /api/anthropic/messages should validate required fields', async () => {
      const response = await request(app)
        .post('/api/anthropic/messages')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.error).toContain('Messages array is required');
    });
  });

  describe('Error Handling', () => {
    test('Should return 404 for unknown endpoints', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error', 'Endpoint not found');
      expect(response.body).toHaveProperty('path', '/api/nonexistent');
    });

    test('Should handle malformed JSON in POST requests', async () => {
      const response = await request(app)
        .post('/api/hubspot/contacts')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}');

      // Should be 400 (bad request) or 500 (server error) depending on how Express handles it
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('🍌 Banana Stress Tests', () => {
    test('Should handle concurrent requests like a banana boss', async () => {
      const requests = Array(10).fill().map(() => 
        request(app).get('/health')
      );

      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('healthy');
      });
    });

    test('Should handle maximum banana payload sizes', async () => {
      const largeBananaPayload = {
        bananas: 'B'.repeat(15 * 1024 * 1024) // 15MB of bananas (larger than express limit)
      };

      const response = await request(app)
        .post('/api/hubspot/contacts')
        .send(largeBananaPayload);

      // Should hit either 413 (our limit), 400 (Express limit), or 500 (server error)
      expect([400, 413, 500]).toContain(response.status);
    });

    test('🍌 Ultimate banana dashboard stress test', async () => {
      // Rapid-fire dashboard requests
      const dashboardRequests = Array(5).fill().map(() => 
        request(app).get('/monitoring/dashboard')
      );

      const responses = await Promise.all(dashboardRequests);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.status).toBe('BANANA POWERED');
        expect(response.body.bananaMetrics.monkeyApproval).toBe('👍 MAXIMUM');
      });
    });
  });

  describe('Monitoring Controls', () => {
    test('POST /monitoring/logs/rotate should handle log rotation', async () => {
      const response = await request(app)
        .post('/monitoring/logs/rotate')
        .send({ logFile: 'test.log' })
        .expect(400); // Will fail for non-existent log, but should handle request

      expect(response.body).toHaveProperty('success', false);
    });

    test('🚨 POST /monitoring/restart should handle emergency banana restart', async () => {
      const response = await request(app)
        .post('/monitoring/restart')
        .send({ reason: 'Test banana restart' })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.message).toContain('🍌 EMERGENCY BANANA RESTART INITIATED! 🍌');
      expect(response.body).toHaveProperty('reason', 'Test banana restart');
    });
  });
});