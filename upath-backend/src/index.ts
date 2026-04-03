import dotenv from 'dotenv';
import { buildApp } from './server';

// Load environment variables
dotenv.config();

// Start server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3003;
    const app = await buildApp();
    
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Backend server running on port ${port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();