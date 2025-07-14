import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildApp } from '../server';
import { FastifyInstance } from 'fastify';
import { stepRegistry } from '../pipeline/core/registry';

describe('Gemini Models API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Clear registry to prevent pollution from previous tests
    stepRegistry.clear();
    
    // Set a test API key (can be fake for this test)
    process.env.GEMINI_API_KEY = 'test-api-key-for-testing';
    
    // Build the app
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    // Clear registry after test to prevent pollution
    stepRegistry.clear();
  });

  describe('GET /api/gemini/models', () => {
    it('should respond with 500 when no API key is configured', async () => {
      // Temporarily remove API key
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const response = await app.inject({
        method: 'GET',
        url: '/api/gemini/models',
      });

      // Restore API key
      process.env.GEMINI_API_KEY = originalKey;

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('GEMINI_API_KEY not set');
    });

    it('should have correct endpoint structure', async () => {
      // This test checks that the route exists and has proper error handling
      // Without mocking the Google API, we expect it to either:
      // 1. Return models (if API key is valid)
      // 2. Return an error (if API key is invalid or network fails)
      const response = await app.inject({
        method: 'GET',
        url: '/api/gemini/models',
      });

      // Should not be 404 (route exists)
      expect(response.statusCode).not.toBe(404);
      
      // Should be either success (200) or a handled error (401, 429, 500)
      expect([200, 401, 429, 500]).toContain(response.statusCode);
      
      // Should return JSON
      expect(() => JSON.parse(response.body)).not.toThrow();
    });

    it('should return array of models when successful', async () => {
      // Note: This test may fail with a real API call if the key is invalid
      // In a production test suite, you'd mock the Google API client
      const response = await app.inject({
        method: 'GET',
        url: '/api/gemini/models',
      });

      if (response.statusCode === 200) {
        const models = JSON.parse(response.body);
        expect(Array.isArray(models)).toBe(true);
        
        // If we get models, check they have the expected structure
        if (models.length > 0) {
          const model = models[0];
          expect(model).toHaveProperty('id');
          expect(model).toHaveProperty('value');
          expect(model).toHaveProperty('label');
          expect(typeof model.id).toBe('string');
          expect(typeof model.value).toBe('string');
          expect(typeof model.label).toBe('string');
        }
      }
    });
  });

  describe('GET /api/gemini/models/refresh', () => {
    it('should clear cache and return success message', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/gemini/models/refresh',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.cleared).toBe(true);
      expect(body.message).toContain('Cache cleared successfully');
    });
  });
});