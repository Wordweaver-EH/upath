import dotenv from 'dotenv';
import { buildApp } from './server';

/**
 * µ-PATH Backend Server Entry Point
 * 
 * This file loads environment configuration and starts the server.
 * The actual server building logic is in server.ts to make it testable.
 */

// ENVIRONMENT: Load configuration from .env file
// This must be called before accessing any process.env variables
dotenv.config();

// Start server
const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    const app = await buildApp();
    
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`Backend server running on port ${port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

start();