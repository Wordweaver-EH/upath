import { describe, it, expect, beforeAll, vi } from 'vitest';
import { buildApp } from '../../../server';
import { FastifyInstance } from 'fastify';

describe('LangGraph Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Set required environment variables
    process.env.GEMINI_API_KEY = 'test-api-key';
    
    // Build the app
    app = await buildApp();
  });

  it('should have LangGraph health endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/langgraph/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.version).toBe('1.0.0-mvp');
  });

  it('should validate transcript input', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/langgraph/process',
      payload: {
        transcripts: [], // Empty array should fail validation
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Invalid input');
    expect(body.message).toContain('must not be empty');
  });

  it('should accept valid transcript input', async () => {
    // Mock the pipeline stream to avoid full execution
    const mockStream = async function* () {
      yield { 
        pipelineId: 'test-123',
        status: 'running',
        progress: 0,
      };
      yield { 
        pipelineId: 'test-123',
        status: 'completed',
        progress: 100,
      };
    };

    // We'll just test that the endpoint accepts the request
    // In a real test, we'd mock the pipeline execution
    const response = await app.inject({
      method: 'POST',
      url: '/api/langgraph/process',
      payload: {
        transcripts: [{
          id: '1',
          content: 'Test transcript',
        }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    
    // The response will be SSE format
    const body = response.body;
    expect(body).toContain('data:');
  });

  it('should handle missing transcript content', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/langgraph/process',
      payload: {
        transcripts: [{
          id: '1',
          // Missing content
        }],
      },
    });

    // Even with missing content, the endpoint should accept it
    // The pipeline will handle validation internally
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
  });

  it('should return 501 for pause endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/langgraph/pause/test-123',
    });

    expect(response.statusCode).toBe(501);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Not implemented');
    expect(body.message).toContain('not available in MVP');
  });

  it('should return 501 for resume endpoint', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/langgraph/resume/test-123',
    });

    expect(response.statusCode).toBe(501);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Not implemented');
    expect(body.message).toContain('not available in MVP');
  });

  it('should handle status endpoint', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/langgraph/status/test-123',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.pipelineId).toBe('test-123');
    expect(body.status).toBe('unknown');
    expect(body.message).toContain('not implemented in MVP');
  });
});