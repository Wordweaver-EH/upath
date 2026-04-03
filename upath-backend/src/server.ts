import Fastify from 'fastify';
import cors from '@fastify/cors';
import analyzeRoute from './routes/analyze';
import modelsRoute from './routes/models';

export async function buildApp() {
  const app = Fastify({
    logger: true
  });

  const rawCorsOrigins = process.env.CORS_ORIGINS ?? '';
  const corsOrigins = rawCorsOrigins.trim().length > 0
    ? rawCorsOrigins.split(',').map(o => o.trim()).filter(Boolean)
    : ['http://localhost:5173'];

  await app.register(cors, {
    origin: corsOrigins,
    credentials: true
  });

  await app.register(analyzeRoute, { prefix: '/api' });
  await app.register(modelsRoute, { prefix: '/api' });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
