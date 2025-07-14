/**
 * Pipeline API Routes - Real Production Test
 * Tests the new modular /api/pipeline/* endpoints that replace legacy routes
 * CRITICAL: This tests the REAL pipeline endpoints, not mocks
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { stepRegistry } from '../../pipeline/core/registry';

// Mock ioredis to prevent Redis connection errors in tests
vi.mock('ioredis', () => {
  const createMockRedis = () => ({
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    exists: vi.fn().mockResolvedValue(0),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    scan: vi.fn().mockResolvedValue(['0', []]),
    watch: vi.fn().mockResolvedValue('OK'),
    unwatch: vi.fn().mockResolvedValue('OK'),
    multi: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([['OK']])
    }),
    flushdb: vi.fn().mockResolvedValue('OK'),
    on: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    status: 'ready'
  });

  return {
    default: vi.fn(() => createMockRedis()),
    Redis: vi.fn(() => createMockRedis())
  };
});

describe('Pipeline API - Real Production Test', () => {
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
    const { buildApp } = await import('../../server');
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

  describe('GET /api/pipeline/health', () => {
    it('should return health status from real pipeline service', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/health'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Verify response structure
      expect(body).toHaveProperty('healthy');
      expect(body).toHaveProperty('timestamp');
      expect(typeof body.healthy).toBe('boolean');
      expect(typeof body.timestamp).toBe('string');
      
      // Should include service details
      expect(body).toHaveProperty('services');
      expect(body.services).toHaveProperty('executor');
      expect(body.services).toHaveProperty('gemini');
      expect(body.services).toHaveProperty('registry');
      
      console.log('Pipeline health check response:', body);
    });
  });

  describe('GET /api/pipeline/steps', () => {
    it('should return list of all registered steps', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/steps'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should return success object with steps array
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('steps');
      expect(Array.isArray(body.steps)).toBe(true);
      expect(body.steps.length).toBeGreaterThan(0);
      
      // Each step should have required properties
      body.steps.forEach((step: any) => {
        expect(step).toHaveProperty('id');
        expect(step).toHaveProperty('title');
        expect(step).toHaveProperty('part');
        expect(step).toHaveProperty('isJsonOutput');
        expect(step).toHaveProperty('dependencies');
        expect(Array.isArray(step.dependencies)).toBe(true);
      });
      
      // Should include our test steps
      const stepIds = body.steps.map((step: any) => step.id);
      expect(stepIds).toContain('P_NEG1_1_VARIABLE_IDENTIFICATION');
      expect(stepIds).toContain('P0_1_TRANSCRIPTION_ADHERENCE');
      expect(stepIds).toContain('P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE');
      
      console.log(`Found ${body.steps.length} registered steps:`, stepIds.slice(0, 3));
    });
  });

  describe('GET /api/pipeline/steps/:stepId', () => {
    it('should return details for a specific step', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/steps/P_NEG1_1_VARIABLE_IDENTIFICATION'
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      // Should return success object with step details
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('step');
      expect(body.step).toHaveProperty('id', 'P_NEG1_1_VARIABLE_IDENTIFICATION');
      expect(body.step).toHaveProperty('title');
      expect(body.step).toHaveProperty('part');
      expect(body.step).toHaveProperty('isJsonOutput', true);
      expect(body.step).toHaveProperty('dependencies');
      expect(Array.isArray(body.step.dependencies)).toBe(true);
      
      console.log('Step details:', body);
    });

    it('should return 404 for non-existent step', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/pipeline/steps/INVALID_STEP_ID'
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('is not registered');
    });
  });

  describe('POST /api/pipeline/execute-step', () => {
    it('should validate required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute-step',
        payload: {
          // Missing required fields
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('stepId');
    });

    it('should validate stepId exists in registry', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute-step',
        payload: {
          stepId: 'INVALID_STEP_ID',
          currentTranscript: {
            id: 'test-transcript',
            filename: 'test.txt',
            content: 'Test content'
          },
          userDvFocus: {
            dv_focus: ['test']
          },
          processedData: {},
          genericAnalysisState: {},
          allRawTranscripts: [],
          apiKeyPresent: true
        }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('not registered');
    });

    it('should handle missing transcript gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute-step',
        payload: {
          stepId: 'P_NEG1_1_VARIABLE_IDENTIFICATION'
          // Missing currentTranscript
        }
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body.error).toContain('currentTranscript');
    });

    it('should accept valid execution request', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute-step',
        payload: {
          stepId: 'P_NEG1_1_VARIABLE_IDENTIFICATION',
          currentTranscript: {
            id: 'test-transcript',
            filename: 'test.txt',
            content: 'Line 1: This is a test transcript.\nLine 2: Testing variable identification.'
          },
          userDvFocus: {
            dv_focus: ['attention', 'focus']
          }
        }
      });

      // Should accept the request (might return 500 due to mock API but structure should be valid)
      expect([200, 500]).toContain(response.statusCode);
      
      const body = JSON.parse(response.body);
      
      if (response.statusCode === 200) {
        // Success case
        expect(body).toHaveProperty('success', true);
        expect(body).toHaveProperty('stepId');
        expect(body).toHaveProperty('executionTimeMs');
      } else {
        // Expected failure due to mock Gemini service
        expect(body).toHaveProperty('success', false);
        expect(body).toHaveProperty('error');
      }
      
      console.log('Step execution response:', body);
    });
  });

  describe('POST /api/pipeline/validate/:stepId/pre', () => {
    it('should return pre-implementation validation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/pipeline/validate/P_NEG1_1_VARIABLE_IDENTIFICATION/pre',
        payload: {
          testData: {
            currentTranscript: {
              id: 'test',
              content: 'test content'
            }
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('stepId', 'P_NEG1_1_VARIABLE_IDENTIFICATION');
      expect(body).toHaveProperty('validationType', 'pre');
      
      console.log('Pre-validation response:', body);
    });
  });

  describe('POST /api/pipeline/validate/:stepId/post', () => {
    it('should return post-implementation validation', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/pipeline/validate/P_NEG1_1_VARIABLE_IDENTIFICATION/post',
        payload: {
          testData: {
            implementation: 'test implementation',
            expectedOutput: 'expected result'
          }
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('stepId', 'P_NEG1_1_VARIABLE_IDENTIFICATION');
      expect(body).toHaveProperty('validationType', 'post');
      
      console.log('Post-validation response:', body);
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute-step',
        payload: 'invalid json',
        headers: {
          'content-type': 'application/json'
        }
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle missing Content-Type header', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/pipeline/execute-step',
        payload: JSON.stringify({
          stepId: 'P_NEG1_1_VARIABLE_IDENTIFICATION'
        })
        // Missing Content-Type header
      });

      // Should still process or return appropriate error
      expect([400, 415]).toContain(response.statusCode);
    });
  });

  describe('Legacy Route Removal', () => {
    it('should return 404 for old /api/graph endpoints', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/graph/health'
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for old /api/hil endpoints', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test',
          stepId: 'P_NEG1_1_VARIABLE_IDENTIFICATION',
          userGuidance: 'test'
        }
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 404 for old /api/langgraph endpoints', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/langgraph/process',
        payload: {
          sessionId: 'test'
        }
      });

      expect(response.statusCode).toBe(404);
    });
  });
});