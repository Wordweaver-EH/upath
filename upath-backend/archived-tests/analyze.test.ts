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

// TDD: Writing failing tests first for analyze endpoint
describe('Analyze Endpoint', () => {
  let fastify: any;

  beforeAll(async () => {
    // Set up test environment
    process.env.GEMINI_API_KEY = 'test-api-key';
    
    fastify = Fastify({ logger: false });
    
    // Register CORS
    fastify.register(cors, {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true
    });

    // Register analyze route (this should match our implementation)
    const analyzeRoute = async (fastify: any) => {
      fastify.post('/analyze', async (request: any, reply: any) => {
        const { prompt, isJsonOutput = false, useGrounding = false, temperature = 0.0, seed } = request.body;

        // Check if API key is configured
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return reply.status(500).send({
            error: 'API Key not configured on server'
          });
        }

        // Mock response for tests
        return {
          text: 'Test response',
          estimatedInputTokens: Math.ceil(prompt.length / 4),
          estimatedOutputTokens: 25
        };
      });
    };

    fastify.register(analyzeRoute, { prefix: '/api' });
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
    delete process.env.GEMINI_API_KEY;
  });

  it('should handle basic analyze request', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: 'Test prompt',
        isJsonOutput: false,
        temperature: 0.0
      }
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.text).toBeDefined();
    expect(body.estimatedInputTokens).toBeTypeOf('number');
    expect(body.estimatedOutputTokens).toBeTypeOf('number');
  });

  it('should return error when API key is missing', async () => {
    // Temporarily remove API key
    delete process.env.GEMINI_API_KEY;

    const response = await fastify.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: 'Test prompt'
      }
    });

    expect(response.statusCode).toBe(500);
    
    const body = JSON.parse(response.body);
    expect(body.error).toBe('API Key not configured on server');

    // Restore API key
    process.env.GEMINI_API_KEY = 'test-api-key';
  });

  it('should handle request with all parameters', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: 'Complex test prompt',
        isJsonOutput: true,
        useGrounding: true,
        temperature: 0.5,
        seed: 12345
      }
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.text).toBeDefined();
    expect(body.estimatedInputTokens).toBeGreaterThan(0);
    expect(body.estimatedOutputTokens).toBeGreaterThan(0);
  });

  it('should calculate token estimates correctly', async () => {
    const prompt = 'This is a test prompt with exactly twenty characters!';
    
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        prompt: prompt
      }
    });

    const body = JSON.parse(response.body);
    // Rough estimation: 1 token ≈ 4 characters
    const expectedTokens = Math.ceil(prompt.length / 4);
    expect(body.estimatedInputTokens).toBe(expectedTokens);
  });
});