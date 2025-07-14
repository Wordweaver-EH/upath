import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../server';
import { FastifyInstance } from 'fastify';
import { stepRegistry } from '../pipeline/core/registry';

describe('State Management API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    stepRegistry.clear();
    process.env.GEMINI_API_KEY = 'test-key';
    app = await buildApp();
    await app.listen({ port: 0 }); // Dynamic port
  });

  afterAll(async () => {
    await app?.close();
    delete process.env.GEMINI_API_KEY;
    stepRegistry.clear();
  });

  describe('POST /api/state/save', () => {
    it('should return error for missing sessionId', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/state/save',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing required field: sessionId');
    });

    it('should return error for non-existent session', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/state/save',
        payload: {
          sessionId: 'non-existent-session'
        }
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Session non-existent-session not found');
    });
  });

  describe('POST /api/state/load', () => {
    it('should return error for missing stateData', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/state/load',
        payload: {}
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing required field: stateData');
    });

    it('should return error for invalid stateData', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/state/load',
        payload: {
          stateData: {
            invalidField: 'invalid'
          }
        }
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Failed to load state');
    });
  });

  describe('Integration: Save and Load State', () => {
    it('should save and load a complete session state', async () => {
      // First create a session
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/graph/session',
        payload: {
          transcripts: [{
            id: 'test-transcript-1',
            filename: 'test.txt',
            content: 'Test transcript content for state management testing.'
          }],
          settings: {
            model: 'gemini-1.5-flash',
            temperature: 0.7,
            userDvFocus: 'attention and focus'
          }
        }
      });

      expect(createResponse.statusCode).toBe(201);
      const sessionData = JSON.parse(createResponse.body);
      const sessionId = sessionData.sessionId;

      // Save the state
      const saveResponse = await app.inject({
        method: 'POST',
        url: '/api/state/save',
        payload: {
          sessionId,
          filename: 'test-state.json'
        }
      });

      expect(saveResponse.statusCode).toBe(200);
      const saveData = JSON.parse(saveResponse.body);
      expect(saveData.success).toBe(true);
      expect(saveData.savedState).toBeDefined();
      expect(saveData.filename).toBe('test-state.json');
      expect(saveData.metadata.sessionId).toBe(sessionId);

      // Verify saved state structure
      const savedState = saveData.savedState;
      expect(savedState.pipelineId).toBe(sessionId);
      expect(savedState.transcripts).toHaveLength(1);
      expect(savedState.transcripts[0].id).toBe('test-transcript-1');
      expect(savedState.status).toBe('idle');
      expect(savedState.metadata.version).toBe('2.0.0');
      expect(savedState.promptHistory).toEqual([]);

      // Load the state into a new session
      const loadResponse = await app.inject({
        method: 'POST',
        url: '/api/state/load',
        payload: {
          stateData: savedState
        }
      });

      expect(loadResponse.statusCode).toBe(201);
      const loadData = JSON.parse(loadResponse.body);
      expect(loadData.success).toBe(true);
      expect(loadData.sessionId).toBe(sessionId);
      expect(loadData.transcriptCount).toBe(1);
      expect(loadData.completedSteps).toBe(0);
      expect(loadData.promptHistoryCount).toBe(0);

      // Verify the loaded session exists and has correct data
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/graph/session/${sessionId}`
      });

      expect(getResponse.statusCode).toBe(200);
      const sessionInfo = JSON.parse(getResponse.body);
      expect(sessionInfo.sessionId).toBe(sessionId);
      expect(sessionInfo.status).toBe('idle');
    });
  });

  describe('GET /api/state/session/:sessionId/stats', () => {
    it('should return session statistics', async () => {
      // Create a session first
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/graph/session',
        payload: {
          transcripts: [{
            id: 'stats-test',
            filename: 'stats.txt', 
            content: 'Stats test content.'
          }],
          settings: {}
        }
      });

      const sessionData = JSON.parse(createResponse.body);
      const sessionId = sessionData.sessionId;

      // Get stats
      const statsResponse = await app.inject({
        method: 'GET',
        url: `/api/state/session/${sessionId}/stats`
      });

      expect(statsResponse.statusCode).toBe(200);
      const stats = JSON.parse(statsResponse.body);
      expect(stats.sessionId).toBe(sessionId);
      expect(stats.transcriptCount).toBe(1);
      expect(stats.completedSteps).toBe(0);
      expect(stats.promptHistoryCount).toBe(0);
      expect(stats.tokenStats).toBeDefined();
      expect(stats.createdAt).toBeDefined();
    });

    it('should return 404 for non-existent session', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/state/session/non-existent/stats'
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Session non-existent not found');
    });
  });
});