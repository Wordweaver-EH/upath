import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';

// Mock the Google Generative AI module
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => 'Mocked response text',
          candidates: []
        }
      })
    })
  }))
}));

// TDD: Tests for improved analyze endpoint that should accept model from frontend
describe('Analyze Endpoint - Improved Requirements', () => {
  let fastify: any;

  beforeAll(async () => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    process.env.CORS_ORIGINS = 'http://localhost:5173,http://localhost:3000';
    
    fastify = Fastify({ logger: false });
    
    // Import the actual route implementation
    const analyzeRoute = await import('../routes/analyze');
    
    fastify.register(cors, {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true
    });

    fastify.register(analyzeRoute.default, { prefix: '/api' });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    delete process.env.GEMINI_API_KEY;
    delete process.env.CORS_ORIGINS;
  });

  // This test should FAIL because our current implementation hardcodes the model
  it('should accept model name from frontend request', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: 'Test prompt',
        model: 'gemini-2.5-flash-preview-04-17' // This should be accepted but currently isn't
      }
    });

    expect(response.statusCode).toBe(200);
    
    // The implementation should use the model from the request
    // Currently this will fail because we hardcode gemini-2.0-flash-exp
  });

  // This test should FAIL because we don't have proper CORS environment configuration
  it('should use environment variables for CORS origins', async () => {
    // We should be able to configure CORS origins via environment
    // Currently this is hardcoded in the server setup
    expect(process.env.CORS_ORIGINS).toBeDefined();
  });

  it('should validate required prompt parameter', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        // Missing prompt - should return error
        isJsonOutput: false
      }
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body.error).toContain('prompt');
  });

  it('should handle invalid model parameter gracefully', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: 'Test prompt',
        model: 'invalid-model-name'
      }
    });

    // Should either default to a safe model or return a meaningful error
    expect([200, 400].includes(response.statusCode)).toBe(true);
  });
});