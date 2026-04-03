import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../server';

describe('Models Route', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set up test environment
    process.env.GEMINI_API_KEY = 'test-api-key';
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/models', () => {
    it('should return available models', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/models'
      });

      expect(response.statusCode).toBe(200);
      const data = JSON.parse(response.body);
      
      // Should have models array
      expect(data).toHaveProperty('models');
      expect(Array.isArray(data.models)).toBe(true);
      
      // Should have defaultModel
      expect(data).toHaveProperty('defaultModel');
      expect(typeof data.defaultModel).toBe('string');
      
      // Each model should have required properties
      if (data.models.length > 0) {
        const model = data.models[0];
        expect(model).toHaveProperty('value');
        expect(model).toHaveProperty('label');
      }
    });

    it('should handle missing API key', async () => {
      // Temporarily remove API key
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const response = await app.inject({
        method: 'GET',
        url: '/api/models'
      });

      expect(response.statusCode).toBe(500);
      const data = JSON.parse(response.body);
      expect(data.error).toBe('Gemini API key not configured');
      expect(data.models).toEqual([]);

      // Restore API key
      process.env.GEMINI_API_KEY = originalKey;
    });
  });
});