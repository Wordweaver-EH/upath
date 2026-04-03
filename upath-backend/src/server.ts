import Fastify from 'fastify';
import cors from '@fastify/cors';
import analyzeRoute from './routes/analyze';
export async function buildApp() {
  // Create Fastify instance
  const app = Fastify({
    logger: true
  });

  // Simple CORS setup
  await app.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true
  });

  // Register routes
  await app.register(analyzeRoute, { prefix: '/api' });

  // Health check endpoint
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}