import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../server';
import { FastifyInstance } from 'fastify';
import { StepId } from '../../graph/types/enums';
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

describe('/api/hil endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    // Clear registry to prevent pollution from previous tests
    stepRegistry.clear();
    
    // Set required environment variable
    process.env.GEMINI_API_KEY = 'test-api-key';
    
    // Build the app with all real routes
    app = await buildApp();
    await app.listen({ port: 0 }); // Dynamic port allocation
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    delete process.env.GEMINI_API_KEY;
    // Clear registry after test to prevent pollution
    stepRegistry.clear();
  });

  describe('Request validation', () => {
    it('should reject request with missing sessionId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: 'Please fix this'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('sessionId');
    });

    it('should reject request with missing stepId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          userGuidance: 'Please fix this'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('stepId');
    });

    it('should reject request with missing userGuidance', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('userGuidance');
    });

    it('should reject request with empty userGuidance', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: '   '
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('userGuidance');
    });

    it('should reject request with unsupported stepId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'UNSUPPORTED_STEP',
          userGuidance: 'Please fix this'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('does not support HIL correction');
      expect(result.error).toContain('Please refer to the documentation');
      expect(result.error).not.toContain('P0_1_TRANSCRIPTION_ADHERENCE'); // Should not expose supported steps list
    });

    it('should reject request with invalid temperature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: 'Please fix this',
          temperature: 1.5
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('temperature must be between 0 and 1');
    });
  });

  describe('API key validation', () => {
    it('should return 500 when API key is not configured', async () => {
      delete process.env.GEMINI_API_KEY;
      
      // Rebuild app without API key
      await app.close();
      stepRegistry.clear(); // Clear registry before rebuilding app
      app = await buildApp();
      await app.listen({ port: 0 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: 'Please fix this'
        }
      });

      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('API Key not configured');
    });
  });

  describe('Session validation', () => {
    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'non-existent-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: 'Please fix this'
        }
      });

      expect(response.statusCode).toBe(404);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Session non-existent-session not found');
    });
  });

  describe('Step validation', () => {
    it('should validate that supported steps are accepted', async () => {
      // Test a few supported steps to ensure they pass validation
      const supportedSteps = [
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        StepId.P0_2_REFINE_DATA_TYPES,
        StepId.P1_1_INITIAL_SEGMENTATION,
        StepId.P9_1_SEMANTIC_GDU_MAPPING
      ];

      for (const stepId of supportedSteps) {
        const response = await app.inject({
          method: 'POST',
          url: '/api/hil',
          payload: {
            sessionId: 'test-session',
            stepId: stepId,
            userGuidance: 'Please fix this'
          }
        });

        // Should not fail on step validation (may fail later on session not found)
        if (response.statusCode === 400) {
          const result = JSON.parse(response.payload);
          expect(result.error).not.toContain('does not support HIL correction');
        }
      }
    });
  });

  describe('Request structure', () => {
    it('should accept valid request with all optional parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: 'Please fix the line numbering format',
          originalPrompt: 'Original prompt text',
          previousResponse: 'Previous response text',
          transcriptId: 'transcript-123',
          temperature: 0.5,
          seed: 42
        }
      });

      // Should not fail on request validation
      // (May fail on session not found, but that's a different validation)
      expect(response.statusCode).not.toBe(400);
    });

    it('should accept valid request with only required parameters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: 'Please fix this issue'
        }
      });

      // Should not fail on request validation
      expect(response.statusCode).not.toBe(400);
    });
  });

  describe('Response format', () => {
    it('should return proper error structure for validation errors', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'INVALID_STEP',
          userGuidance: 'Please fix this'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      
      // Verify error response structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });
  });

  describe('Content-Type handling', () => {
    it('should handle JSON request properly', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        headers: {
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          sessionId: 'test-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: 'Please fix this'
        })
      });

      // Should accept JSON content type
      expect(response.statusCode).not.toBe(415); // Not Unsupported Media Type
    });
  });

  describe('Edge cases', () => {
    it('should handle very long userGuidance', async () => {
      const longGuidance = 'Please fix this issue. '.repeat(1000); // ~21KB string
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: longGuidance
        }
      });

      // Should accept long guidance (may fail later on session issues)
      expect(response.statusCode).not.toBe(413); // Not Payload Too Large
    });

    it('should handle special characters in userGuidance', async () => {
      const specialGuidance = 'Fix this: {"key": "value"} & <tag>content</tag> 🚀';
      
      const response = await app.inject({
        method: 'POST',
        url: '/api/hil',
        payload: {
          sessionId: 'test-session',
          stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
          userGuidance: specialGuidance
        }
      });

      // Should handle special characters without validation error
      if (response.statusCode === 400) {
        const result = JSON.parse(response.payload);
        expect(result.error).not.toContain('userGuidance');
      }
    });
  });
});