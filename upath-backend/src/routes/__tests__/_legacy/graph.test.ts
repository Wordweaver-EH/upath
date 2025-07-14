import { FastifyInstance } from 'fastify';
import { buildApp } from '../../server';
import { stepRegistry } from '../../pipeline/core/registry';

describe('Graph API Endpoints', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    stepRegistry.clear();
    // Set required environment variables for testing
    process.env.GEMINI_API_KEY = 'test-key-for-graph-execution';
    
    // Build the server app with real production code
    app = await buildApp();
    await app.listen({ port: 0 });
  });

  afterAll(async () => {
    await app.close();
    delete process.env.GEMINI_API_KEY;
    stepRegistry.clear();
  });

  describe('POST /api/graph/session', () => {
    it('should create a new graph execution session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/graph/session',
        payload: {
          transcripts: [{
            id: 'test-transcript-1',
            filename: 'test.txt',
            content: 'Test transcript content for analysis'
          }],
          settings: {
            userDvFocus: 'test-focus'
          }
        }
      });

      expect(response.statusCode).toBe(201);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('sessionId');
      expect(result.sessionId).toMatch(/^session-/);
      expect(result).toHaveProperty('currentStep');
      expect(result).toHaveProperty('status', 'initialized');
    });

    it('should validate required transcripts field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/graph/session',
        payload: {
          settings: {}
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.error).toContain('transcripts');
    });

    it('should validate transcripts array is not empty', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/graph/session',
        payload: {
          transcripts: [],
          settings: {}
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.error).toContain('empty');
    });
  });

  describe('GET /api/graph/session/:sessionId', () => {
    let testSessionId: string;

    beforeEach(async () => {
      // Create a test session
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/graph/session',
        payload: {
          transcripts: [{
            id: 'test-transcript-1',
            filename: 'test.txt',
            content: 'Test content'
          }],
          settings: {}
        }
      });
      const createResult = JSON.parse(createResponse.payload);
      testSessionId = createResult.sessionId;
    });

    it('should get session status and state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/graph/session/${testSessionId}`
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('sessionId', testSessionId);
      expect(result).toHaveProperty('currentStep');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('progress');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/graph/session/non-existent-session'
      });

      expect(response.statusCode).toBe(404);
      const result = JSON.parse(response.payload);
      expect(result.error).toContain('not found');
    });
  });

  describe('POST /api/graph/execute', () => {
    let testSessionId: string;

    beforeEach(async () => {
      // Create a test session
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/graph/session',
        payload: {
          transcripts: [{
            id: 'test-transcript-1',
            filename: 'test.txt',
            content: 'Test content for graph execution'
          }],
          settings: {}
        }
      });
      const createResult = JSON.parse(createResponse.payload);
      testSessionId = createResult.sessionId;
    });

    it('should execute next step in graph', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/graph/execute',
        payload: {
          sessionId: testSessionId,
          model: 'gemini-1.5-flash',
          temperature: 0.0
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('completedStep');
      expect(result).toHaveProperty('hasMore');
    });

    it('should validate required sessionId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/graph/execute',
        payload: {
          model: 'gemini-1.5-flash'
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      expect(result.error).toContain('sessionId');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/graph/execute',
        payload: {
          sessionId: 'non-existent-session',
          model: 'gemini-1.5-flash'
        }
      });

      expect(response.statusCode).toBe(404);
      const result = JSON.parse(response.payload);
      expect(result.error).toContain('not found');
    });
  });

  describe('DELETE /api/graph/session/:sessionId', () => {
    let testSessionId: string;

    beforeEach(async () => {
      // Create a test session
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/graph/session',
        payload: {
          transcripts: [{
            id: 'test-transcript-1',
            filename: 'test.txt',
            content: 'Test content'
          }],
          settings: {}
        }
      });
      const createResult = JSON.parse(createResponse.payload);
      testSessionId = createResult.sessionId;
    });

    it('should delete existing session', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/api/graph/session/${testSessionId}`
      });

      expect(response.statusCode).toBe(204);
      
      // Verify session is deleted
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/graph/session/${testSessionId}`
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/graph/session/non-existent-session'
      });

      expect(response.statusCode).toBe(404);
      const result = JSON.parse(response.payload);
      expect(result.error).toContain('not found');
    });
  });
});