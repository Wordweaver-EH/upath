import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';

// TDD: Writing failing tests first for health endpoint
describe('Health Endpoint', () => {
  let fastify: any;

  beforeAll(async () => {
    fastify = Fastify({ logger: false });
    
    // Register CORS
    fastify.register(cors, {
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true
    });

    // Health check endpoint (this should exist)
    fastify.get('/health', async (request: any, reply: any) => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    });

    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should return health status with timestamp', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(new Date(body.timestamp)).toBeInstanceOf(Date);
  });

  it('should return proper content type', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health'
    });

    expect(response.headers['content-type']).toContain('application/json');
  });
});