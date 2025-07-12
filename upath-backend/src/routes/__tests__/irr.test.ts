import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../server';
import { FastifyInstance } from 'fastify';

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

// Mock GoogleGenerativeAI to prevent actual API calls in tests
vi.mock('@google/generative-ai', () => {
  const mockResponse = {
    response: {
      text: () => JSON.stringify({
        gdu_mappings: [
          {
            run_a_gdu_id: 'GDU_A_1',
            run_a_definition: 'First GDU from Run A',
            run_a_contributing_rdu_count: 3,
            run_b_gdu_id: 'GDU_B_1',
            run_b_definition: 'First GDU from Run B',
            run_b_contributing_rdu_count: 2,
            semantic_similarity_score: 0.85,
            mapping_justification: 'Both refer to similar conceptual patterns'
          },
          {
            run_a_gdu_id: 'GDU_A_2',
            run_a_definition: 'Second GDU from Run A',
            run_a_contributing_rdu_count: 1,
            run_b_gdu_id: null,
            run_b_definition: null,
            run_b_contributing_rdu_count: 0,
            semantic_similarity_score: 0,
            mapping_justification: 'No semantic match found in Run B'
          }
        ]
      })
    }
  };

  const mockModel = {
    generateContent: vi.fn().mockResolvedValue(mockResponse)
  };

  const mockGenAI = {
    getGenerativeModel: vi.fn().mockReturnValue(mockModel)
  };

  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => mockGenAI)
  };
});

describe('/api/irr endpoint', () => {
  let app: FastifyInstance;

  const sampleRunAGdus = [
    {
      gdu_id: 'GDU_A_1',
      definition: 'First GDU from Run A',
      contributing_refined_du_ids: ['RDU_1', 'RDU_2', 'RDU_3']
    },
    {
      gdu_id: 'GDU_A_2',
      definition: 'Second GDU from Run A',
      contributing_refined_du_ids: ['RDU_4']
    }
  ];

  const sampleRunBGdus = [
    {
      gdu_id: 'GDU_B_1',
      definition: 'First GDU from Run B',
      contributing_refined_du_ids: ['RDU_5', 'RDU_6']
    },
    {
      gdu_id: 'GDU_B_2',
      definition: 'Second GDU from Run B',
      contributing_refined_du_ids: ['RDU_7', 'RDU_8', 'RDU_9']
    }
  ];

  beforeEach(async () => {
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
  });

  describe('Request validation', () => {
    it('should reject request with missing runAGdus', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('runAGdus');
    });

    it('should reject request with missing runBGdus', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('runBGdus');
    });

    it('should reject request with empty runAGdus array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: [],
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('runAGdus cannot be empty');
    });

    it('should reject request with empty runBGdus array', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus,
          runBGdus: []
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('runBGdus cannot be empty');
    });

    it('should reject request with invalid temperature', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus,
          runBGdus: sampleRunBGdus,
          temperature: 1.5
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('temperature must be between 0 and 1');
    });
  });

  describe('GDU structure validation', () => {
    it('should reject runAGdus with invalid structure', async () => {
      const invalidRunAGdus = [
        {
          gdu_id: 'GDU_A_1',
          // missing definition
          contributing_refined_du_ids: ['RDU_1']
        }
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: invalidRunAGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('definition must be a non-empty string');
    });

    it('should reject runBGdus with invalid structure', async () => {
      const invalidRunBGdus = [
        {
          // missing gdu_id
          definition: 'Some definition',
          contributing_refined_du_ids: ['RDU_1']
        }
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus,
          runBGdus: invalidRunBGdus
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('gdu_id must be a non-empty string');
    });

    it('should reject GDUs with non-array contributing_refined_du_ids', async () => {
      const invalidRunAGdus = [
        {
          gdu_id: 'GDU_A_1',
          definition: 'Some definition',
          contributing_refined_du_ids: 'not-an-array'
        }
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: invalidRunAGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('contributing_refined_du_ids must be an array');
    });
  });

  describe('API key validation', () => {
    it('should return 500 when API key is not configured', async () => {
      delete process.env.GEMINI_API_KEY;
      
      // Rebuild app without API key
      await app.close();
      app = await buildApp();
      await app.listen({ port: 0 });

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('API Key not configured');
    });
  });

  describe('Successful mapping generation', () => {
    it('should generate semantic mapping successfully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      expect(result.success).toBe(true);
      expect(result.mapping).toBeDefined();
      expect(result.mapping.gdu_mappings).toBeDefined();
      expect(Array.isArray(result.mapping.gdu_mappings)).toBe(true);
      expect(result.mapping.gdu_mappings.length).toBeGreaterThan(0);
      expect(result.message).toContain('IRR semantic mapping generated successfully');
    });

    it('should include all Run A GDUs in the mapping', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      const mappedRunAIds = result.mapping.gdu_mappings.map((m: any) => m.run_a_gdu_id);
      const expectedRunAIds = sampleRunAGdus.map(g => g.gdu_id);
      
      expect(mappedRunAIds.sort()).toEqual(expectedRunAIds.sort());
    });

    it('should handle optional parameters correctly', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus,
          runBGdus: sampleRunBGdus,
          temperature: 0.5,
          seed: 42,
          model: 'gemini-1.5-pro'
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
    });
  });

  describe('Response structure validation', () => {
    it('should return proper success structure', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      
      // Verify response structure
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('mapping');
      expect(result).toHaveProperty('message');
      expect(result.success).toBe(true);
      
      // Verify mapping structure
      expect(result.mapping).toHaveProperty('gdu_mappings');
      expect(Array.isArray(result.mapping.gdu_mappings)).toBe(true);
      
      // Verify individual mapping structure
      const mapping = result.mapping.gdu_mappings[0];
      expect(mapping).toHaveProperty('run_a_gdu_id');
      expect(mapping).toHaveProperty('run_a_definition');
      expect(mapping).toHaveProperty('run_a_contributing_rdu_count');
      expect(mapping).toHaveProperty('run_b_gdu_id');
      expect(mapping).toHaveProperty('run_b_definition');
      expect(mapping).toHaveProperty('run_b_contributing_rdu_count');
      expect(mapping).toHaveProperty('semantic_similarity_score');
      expect(mapping).toHaveProperty('mapping_justification');
      
      expect(typeof mapping.semantic_similarity_score).toBe('number');
      expect(mapping.semantic_similarity_score).toBeGreaterThanOrEqual(0);
      expect(mapping.semantic_similarity_score).toBeLessThanOrEqual(1);
    });
  });

  describe('Content-Type handling', () => {
    it('should handle JSON request properly', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        headers: {
          'content-type': 'application/json'
        },
        payload: JSON.stringify({
          runAGdus: sampleRunAGdus,
          runBGdus: sampleRunBGdus
        })
      });

      // Should accept JSON content type
      expect(response.statusCode).not.toBe(415); // Not Unsupported Media Type
      expect(response.statusCode).toBe(200);
    });
  });

  describe('Edge cases', () => {
    it('should handle large GDU sets', async () => {
      const largeRunAGdus = Array.from({ length: 50 }, (_, i) => ({
        gdu_id: `GDU_A_${i + 1}`,
        definition: `Definition for GDU A ${i + 1}`,
        contributing_refined_du_ids: [`RDU_A_${i + 1}`]
      }));

      const largeRunBGdus = Array.from({ length: 45 }, (_, i) => ({
        gdu_id: `GDU_B_${i + 1}`,
        definition: `Definition for GDU B ${i + 1}`,
        contributing_refined_du_ids: [`RDU_B_${i + 1}`]
      }));

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: largeRunAGdus,
          runBGdus: largeRunBGdus
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.mapping.gdu_mappings.length).toBe(50); // All Run A GDUs included
    });

    it('should handle special characters in GDU definitions', async () => {
      const specialGdus = [
        {
          gdu_id: 'GDU_SPECIAL_1',
          definition: 'Definition with "quotes" & <tags> 🚀 and émojis',
          contributing_refined_du_ids: ['RDU_1']
        }
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: specialGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
    });

    it('should handle GDUs with empty contributing_refined_du_ids', async () => {
      const emptyContribGdus = [
        {
          gdu_id: 'GDU_EMPTY_1',
          definition: 'GDU with no contributing RDUs',
          contributing_refined_du_ids: []
        }
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: emptyContribGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      
      const mapping = result.mapping.gdu_mappings.find((m: any) => m.run_a_gdu_id === 'GDU_EMPTY_1');
      expect(mapping.run_a_contributing_rdu_count).toBe(0);
    });

    it('should reject GDU with empty string gdu_id', async () => {
      const invalidRunAGdus = [
        {
          gdu_id: '   ',
          definition: 'Valid definition',
          contributing_refined_du_ids: ['RDU_1']
        }
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: invalidRunAGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('gdu_id must be a non-empty string');
    });

    it('should reject GDU with empty string definition', async () => {
      const invalidRunAGdus = [
        {
          gdu_id: 'VALID_ID',
          definition: '  ',
          contributing_refined_du_ids: ['RDU_1']
        }
      ];

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: invalidRunAGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('definition must be a non-empty string');
    });
  });

  describe('Error handling', () => {
    it('should handle LLM response parsing errors gracefully', async () => {
      // Mock invalid JSON response
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const mockGenAI = new GoogleGenerativeAI('test');
      const mockModel = mockGenAI.getGenerativeModel({ model: 'test' });
      
      vi.mocked(mockModel.generateContent).mockResolvedValueOnce({
        response: {
          text: () => 'invalid json response'
        }
      } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/irr',
        payload: {
          runAGdus: sampleRunAGdus,
          runBGdus: sampleRunBGdus
        }
      });

      expect(response.statusCode).toBe(500);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to parse LLM response');
    });
  });
});