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
      
      // Exclude non-general-purpose or noise models
      const EXCLUDE_PATTERNS = [
        /^gemma-(?!4)/,          // Gemma family except Gemma 4
        /^deep-research-/,       // Research tool, not text generation
        /^nano-banana/,          // Internal codename
        /computer-use/,          // Specialised computer-use variant
        /robotics/,              // Robotics specialised model
        /-image-/,               // Image generation models
        /-latest$/,              // Mutable aliases — use pinned versions
        /customtools/,           // Custom-tools variant
        /^gemini-3-pro-preview$/ // Deprecated March 9 2026
      ];

      // Filter and format models for text generation
      const availableModels = [];

      if (data.models && Array.isArray(data.models)) {
        for (const model of data.models) {
          const id = model.name.replace('models/', '');
          const excluded = EXCLUDE_PATTERNS.some(p => p.test(id));
          // Only include thinking models that support generateContent and aren't excluded
          if (!excluded && model.supportedGenerationMethods?.includes('generateContent') && model.thinking === true) {
            availableModels.push({
              value: id,
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
      
      // Return fallback thinking models on error (kept in sync with live model list)
      return reply.send({
        models: [
          { value: 'gemini-3.1-pro-preview',      label: 'Gemini 3.1 Pro Preview',      description: 'Latest generation — advanced agentic reasoning', thinking: true },
          { value: 'gemini-3-flash-preview',       label: 'Gemini 3 Flash Preview',       description: 'Gemini 3 — high performance at reduced cost',  thinking: true },
          { value: 'gemini-3.1-flash-lite-preview',label: 'Gemini 3.1 Flash-Lite Preview',description: 'Gemini 3.1 — frontier-class, budget-efficient',  thinking: true },
          { value: 'gemini-2.5-pro',               label: 'Gemini 2.5 Pro',               description: 'Stable — deep reasoning, complex tasks',         thinking: true },
          { value: 'gemini-2.5-flash',             label: 'Gemini 2.5 Flash',             description: 'Stable — fast, cost-effective reasoning',        thinking: true },
          { value: 'gemini-2.5-flash-lite',        label: 'Gemini 2.5 Flash-Lite',        description: 'Stable — budget-efficient with thinking',        thinking: true },
        ],
        defaultModel: 'gemini-2.5-flash',
        error: 'Failed to fetch models from API, using defaults'
      });
    }
  });
};

export default modelsRoute;