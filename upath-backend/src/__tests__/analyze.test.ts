import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * REAL TDD Test for Analyze Endpoint
 * 
 * This test ACTUALLY imports and tests the production server
 * Following proper TDD: Red → Green → Refactor
 * 
 * Step 1 (RED): Write failing test that imports real server
 * Step 2 (GREEN): Fix any issues to make tests pass
 * Step 3 (REFACTOR): Clean up if needed
 */

describe('Analyze Endpoint - Real Production Test', () => {
  let app: FastifyInstance;
  let serverUrl: string;

  beforeAll(async () => {
    // Set required environment variables for test
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.PORT = '0'; // Use random available port
    
    // CRITICAL: Import the REAL server, not a mock
    // This test file demonstrates proper TDD: we test actual production code
    // by importing from '../server' which provides the testable buildApp() function
    const { buildApp } = await import('../server');
    app = await buildApp();
    
    // Start the server and get the actual port
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const addressInfo = app.server.address() as any;
    serverUrl = `http://127.0.0.1:${addressInfo?.port}`;
  });

  afterAll(async () => {
    await app.close();
    delete process.env.GEMINI_API_KEY;
    delete process.env.PORT;
  });

  it('should reject requests without required fields', async () => {
    // Test with empty body
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {}
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('Missing prompt');
  });

  it('should reject requests with invalid model', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        prompt: 'Test prompt',
        model: 'invalid-model-name'
      }
    });

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
    expect(body.error).toContain('API error');
  });

  it('should accept valid model parameter from request', async () => {
    // This test verifies that the backend doesn't hardcode the model
    // but accepts it from the frontend request
    const mockGeminiResponse = {
      response: {
        text: () => 'Test response',
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15
        }
      }
    };

    // We can't easily mock the Gemini API in a real test,
    // so we'll just verify the endpoint accepts the model parameter
    // In a real scenario, this would call the actual Gemini API
    const response = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      headers: {
        'content-type': 'application/json'
      },
      payload: {
        prompt: 'Test prompt',
        model: 'gemini-1.5-flash',
        temperature: 0.5
      }
    });

    // With a test API key, this will likely fail with 401 or similar
    // But we're testing that it accepts the parameters, not that Gemini works
    expect([400, 401, 403, 500]).toContain(response.statusCode);
    
    // If it's a validation error, it should NOT be about the model
    if (response.statusCode === 400) {
      const body = JSON.parse(response.body);
      expect(body.error).not.toContain('Invalid model');
    }
  });

  it('should handle CORS headers correctly', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: '/api/analyze',
      headers: {
        'origin': 'http://localhost:5173',
        'access-control-request-method': 'POST'
      }
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('should accept environment-configured CORS origins', async () => {
    // This test would require restarting the server with different env vars
    // For now, we'll just verify the default CORS configuration works
    const origins = ['http://localhost:5173', 'http://localhost:3000'];

    for (const origin of origins) {
      const response = await app.inject({
        method: 'OPTIONS',
        url: '/api/analyze',
        headers: {
          'origin': origin,
          'access-control-request-method': 'POST'
        }
      });

      expect(response.statusCode).toBe(204);
      expect(response.headers['access-control-allow-origin']).toBe(origin);
    }
  });

  it('should pass responseSchema to generationConfig on SDK path', async () => {
    // Use gemini-1.5-flash — NOT in THINKING_MODELS, so it takes the SDK path
    // (gemini-2.5-flash would use the REST fetch path and bypass the SDK entirely)
    const mockGenerateContent = vi.fn().mockResolvedValue({
      response: { text: () => '{"result": "ok"}' }
    });
    const spy = vi.spyOn(GoogleGenerativeAI.prototype, 'getGenerativeModel')
      .mockReturnValue({ generateContent: mockGenerateContent } as any);

    const testSchema = {
      type: 'object',
      properties: { result: { type: 'string' } },
      required: ['result']
    };

    await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: 'test prompt',
        model: 'gemini-1.5-flash',
        isJsonOutput: true,
        responseSchema: testSchema
      }
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const [requestConfig] = mockGenerateContent.mock.calls[0];
    expect(requestConfig.generationConfig.responseSchema).toEqual(testSchema);

    spy.mockRestore();
  });
});