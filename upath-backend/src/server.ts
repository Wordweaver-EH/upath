import Fastify from 'fastify';
import cors from '@fastify/cors';
import analyzeRoute from './routes/analyze';

/**
 * Builds the Fastify application instance
 * 
 * This function is separated from index.ts to make the server testable.
 * Tests can import and use this function to create server instances
 * without automatically starting them.
 * 
 * CRITICAL PATTERN: This separation enables proper TDD methodology by allowing
 * tests to:
 * 1. Import actual production code (not mocks)
 * 2. Create isolated server instances per test
 * 3. Use dynamic port allocation to prevent conflicts
 * 4. Test real route implementations
 * 
 * Without this pattern, tests would either:
 * - Need to test against a running server (flaky, port conflicts)
 * - Create mock routes (fraudulent testing, provides no value)
 * 
 * Example usage in tests:
 * ```typescript
 * import { buildApp } from '../server';
 * const app = await buildApp();
 * const response = await app.inject({ method: 'GET', url: '/health' });
 * ```
 */
export async function buildApp() {
  // Create Fastify instance
  const app = Fastify({
    logger: true
  });

  // Parse CORS origins from environment
  const corsOrigins = process.env.CORS_ORIGINS 
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

  // Register CORS
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true
  });

  // Register routes
  await app.register(analyzeRoute, { prefix: '/api' });

  // Health check endpoint
  app.get('/health', async (request, reply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  return app;
}