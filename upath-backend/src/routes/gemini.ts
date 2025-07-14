import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';
import NodeCache from 'node-cache';

// Cache models for 6 hours to reduce API calls
const modelCache = new NodeCache({ stdTTL: 60 * 60 * 6 });
const CACHE_KEY = 'gemini_models_list';

/**
 * Interface for the cleaned model data we return to frontend
 */
interface GeminiModel {
  id: string;           // "models/gemini-2.5-flash-preview-04-17"
  value: string;        // "gemini-2.5-flash-preview-04-17" (clean ID for use)
  label: string;        // "Gemini 2.5 Flash (Preview)" (display name)
  description?: string; // Model description
  maxInputTokens?: number;
  maxOutputTokens?: number;
}

/**
 * Gemini models API routes
 * Provides secure proxy to Google's model list API with caching
 */
export default async function geminiRoutes(fastify: FastifyInstance) {
  
  /**
   * GET /api/gemini/models - Get list of available Gemini models
   * 
   * Returns cached list of models that support text generation.
   * API key is kept secure on backend, never exposed to frontend.
   */
  fastify.get('/models', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Check cache first
      const cached = modelCache.get<GeminiModel[]>(CACHE_KEY);
      if (cached) {
        fastify.log.info('Serving Gemini models from cache');
        return reply.status(200).send(cached);
      }

      // Check for API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        fastify.log.error('GEMINI_API_KEY not configured');
        return reply.status(500).send({
          error: 'Server configuration error: GEMINI_API_KEY not set'
        });
      }

      fastify.log.info('Fetching fresh Gemini models from Google API...');
      
      // Initialize Google AI client
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Fetch models from Google's API
      // Note: The GoogleGenerativeAI client doesn't have listModels in the current version
      // We'll need to make a direct API call instead
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      
      if (!response.ok) {
        throw new Error(`Google API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as any;
      const models = data.models || [];
      
      // Filter and format models for frontend consumption
      const usableModels: GeminiModel[] = models
        .filter((model: any) => 
          // Only include models that support text generation
          model.supportedGenerationMethods?.includes('generateContent')
        )
        .map((model: any) => ({
          id: model.name,                    // Full model path: "models/gemini-2.5-flash"
          value: model.name.replace('models/', ''), // Clean ID: "gemini-2.5-flash"
          label: model.displayName || model.name.replace('models/', '').replace(/-/g, ' '), // Human readable
          description: model.description,
          maxInputTokens: model.inputTokenLimit,
          maxOutputTokens: model.outputTokenLimit,
        }))
        .sort((a: any, b: any) => a.label.localeCompare(b.label)); // Sort alphabetically

      // Cache the results
      modelCache.set(CACHE_KEY, usableModels);
      
      fastify.log.info(`Successfully fetched ${usableModels.length} Gemini models`);
      
      return reply.status(200).send(usableModels);
      
    } catch (error) {
      fastify.log.error('Failed to fetch Gemini models:', error);
      
      if (error instanceof Error) {
        // Handle specific API errors
        if (error.message.includes('API_KEY_INVALID')) {
          return reply.status(401).send({
            error: 'Invalid API key configuration'
          });
        }
        if (error.message.includes('QUOTA_EXCEEDED')) {
          return reply.status(429).send({
            error: 'API quota exceeded'
          });
        }
      }
      
      return reply.status(500).send({
        error: 'Failed to fetch model list',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  /**
   * GET /api/gemini/models/refresh - Force refresh model cache
   * Useful for development or when you know Google released new models
   */
  fastify.get('/models/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Clear cache
      modelCache.del(CACHE_KEY);
      fastify.log.info('Gemini models cache cleared');
      
      return reply.status(200).send({
        message: 'Cache cleared successfully. Call /api/gemini/models to fetch fresh data.',
        cleared: true
      });
      
    } catch (error) {
      fastify.log.error('Failed to refresh models cache:', error);
      return reply.status(500).send({
        error: 'Failed to refresh model cache'
      });
    }
  });
}