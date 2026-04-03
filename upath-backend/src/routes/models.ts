import { FastifyPluginAsync } from 'fastify';

const modelsRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/models', async (request, reply) => {
    try {
      // Validate API key
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey.trim().length === 0) {
        return reply.code(500).send({ 
          error: 'Gemini API key not configured',
          models: [] 
        });
      }

      // Fetch models using REST API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as { models: any[] };
      
      // Filter and format models for text generation
      const availableModels = [];
      
      if (data.models && Array.isArray(data.models)) {
        for (const model of data.models) {
          // Only include thinking models that support generateContent
          if (model.supportedGenerationMethods?.includes('generateContent') && model.thinking === true) {
            availableModels.push({
              value: model.name.replace('models/', ''), // Remove 'models/' prefix
              label: model.displayName || model.name,
              description: model.description,
              inputTokenLimit: model.inputTokenLimit,
              outputTokenLimit: model.outputTokenLimit,
              supportedMethods: model.supportedGenerationMethods,
              thinking: true
            });
          }
        }
      }

      // Sort models by name for consistent ordering
      availableModels.sort((a, b) => {
        // Prioritize newer models (2.5 before 1.5, etc)
        const aVersion = parseFloat(a.value.match(/[\d.]+/)?.[0] || '0');
        const bVersion = parseFloat(b.value.match(/[\d.]+/)?.[0] || '0');
        if (aVersion !== bVersion) {
          return bVersion - aVersion; // Descending order
        }
        return a.value.localeCompare(b.value);
      });

      return reply.send({ 
        models: availableModels,
        defaultModel: availableModels.find(m => m.value.includes('gemini-2.5-flash'))?.value || availableModels[0]?.value || 'gemini-2.5-flash'
      });

    } catch (error) {
      fastify.log.error('Failed to fetch Gemini models:', error);
      
      // Return fallback thinking models on error
      return reply.send({ 
        models: [
          { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', description: 'Stable version with thinking capabilities', thinking: true },
          { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', description: 'Advanced reasoning with thinking mode', thinking: true },
          { value: 'gemini-2.0-flash-thinking-exp', label: 'Gemini 2.0 Flash Thinking Experimental', description: 'Experimental thinking model', thinking: true }
        ],
        defaultModel: 'gemini-2.5-flash',
        error: 'Failed to fetch models from API, using defaults'
      });
    }
  });
};

export default modelsRoute;