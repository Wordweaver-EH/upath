import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { stepRegistry } from '../pipeline/core/registry';

/**
 * REAL TDD Test for Health Endpoint
 * 
 * This test ACTUALLY imports and tests the production server from src/index.ts
 * Following proper TDD: Red → Green → Refactor
 * 
 * Step 1 (RED): Write failing test that imports real server
 * Step 2 (GREEN): The server should already work, making this pass
 * Step 3 (REFACTOR): Clean up if needed
 */

describe('Health Endpoint - Real Production Test', () => {
  let app: FastifyInstance;
  let serverUrl: string;

  beforeAll(async () => {
    // Clear registry to prevent pollution from previous tests
    stepRegistry.clear();
    
    // Set required environment variables for test
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.PORT = '0'; // Use random available port
    
    // CRITICAL: Import the REAL server, not a mock
    // This ensures we're testing actual production code
    // We import from '../server' not '../index' because:
    // 1. server.ts exports the buildApp() function for testability
    // 2. index.ts would start the server immediately (port conflicts)
    // 3. This pattern allows dynamic port allocation per test
    const { buildApp } = await import('../server');
    app = await buildApp();
    
    // Start the server and get the actual port
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    serverUrl = `http://127.0.0.1:${app.server.address()?.port}`;
    
    console.log(`Test server started at ${serverUrl}`);
  });

  afterAll(async () => {
    await app.close();
    delete process.env.GEMINI_API_KEY;
    delete process.env.PORT;
    // Clear registry after test to prevent pollution
    stepRegistry.clear();
  });

  it('should return health status from real server', async () => {
    // Test the ACTUAL health endpoint
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body).toEqual({
      status: 'ok',
      timestamp: expect.any(String)
    });
    
    // Verify timestamp is valid
    const timestamp = new Date(body.timestamp);
    expect(timestamp.getTime()).toBeGreaterThan(0);
    expect(timestamp.toISOString()).toBe(body.timestamp);
  });

  it('should return correct content-type header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.headers['content-type']).toContain('application/json');
  });

  it('should handle concurrent health check requests', async () => {
    // Test that the server can handle multiple simultaneous requests
    const promises = Array(10).fill(null).map(() => 
      app.inject({
        method: 'GET',
        url: '/health'
      })
    );

    const responses = await Promise.all(promises);
    
    responses.forEach(response => {
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });
  });
});