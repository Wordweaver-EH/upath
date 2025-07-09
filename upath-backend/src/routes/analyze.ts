import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Request interface for the /api/analyze endpoint
 * Accepts all parameters needed for Gemini API calls while maintaining
 * compatibility with the existing frontend service interface
 */
interface AnalyzeRequest {
  Body: {
    prompt: string;        // Required: The text prompt to send to Gemini
    model?: string;        // Optional: Gemini model name (defaults to DEFAULT_MODEL)
    isJsonOutput?: boolean; // Optional: Whether to request JSON response format
    useGrounding?: boolean; // Optional: Whether to enable Google Search grounding
    temperature?: number;   // Optional: Response randomness (0.0-1.0)
    seed?: number;         // Optional: Deterministic seed for reproducible outputs
  };
}

/**
 * Default Gemini model to use when none is specified
 * Should match GEMINI_MODEL_TEXT constant from frontend constants.tsx
 * This ensures consistency across the application
 */
const DEFAULT_MODEL = 'gemini-2.5-flash-preview-04-17';

/**
 * Valid Gemini model names
 * This list should be kept in sync with available models from Google
 * 
 * MAINTENANCE NOTE: When Google releases new models or deprecates old ones,
 * update this list. The frontend constants.tsx file should also be checked
 * to ensure model names are consistent across the application.
 * 
 * Current models as of 2025-07:
 * - gemini-2.5-flash-preview-04-17: Latest preview model (DEFAULT)
 * - gemini-1.5-flash: Fast, efficient model
 * - gemini-1.5-pro: More capable but slower
 * - gemini-pro: Legacy model
 * - gemini-pro-vision: Legacy multimodal model
 */
const VALID_MODELS = [
  'gemini-2.5-flash-preview-04-17',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro',
  'gemini-pro-vision'
];

/**
 * Registers the /api/analyze route for secure Gemini API proxy
 * 
 * This route acts as a secure proxy between the frontend and Google's Gemini API,
 * ensuring that API keys are never exposed to the client while maintaining
 * full compatibility with the existing frontend service interface.
 * 
 * Security features:
 * - API key stored securely in server environment
 * - Input validation prevents malformed requests
 * - Error handling prevents information leakage
 * - Model parameter validation and defaults
 */
export default async function analyzeRoute(fastify: FastifyInstance) {
  fastify.post<AnalyzeRequest>('/analyze', async (request: FastifyRequest<AnalyzeRequest>, reply: FastifyReply) => {
    // Extract parameters with sensible defaults
    const { prompt, model = DEFAULT_MODEL, isJsonOutput = false, useGrounding = false, temperature = 0.0, seed } = request.body;

    // VALIDATION: Ensure prompt is provided and valid
    // The prompt is the only required parameter for any Gemini API call
    if (!prompt || typeof prompt !== 'string') {
      return reply.status(400).send({
        error: 'Missing or invalid prompt parameter'
      });
    }

    // VALIDATION: Ensure model is valid if provided
    if (model && !VALID_MODELS.includes(model)) {
      return reply.status(400).send({
        error: `Invalid model: ${model}. Valid models are: ${VALID_MODELS.join(', ')}`
      });
    }

    // SECURITY: Verify API key is configured on the server
    // This prevents the server from attempting API calls without credentials
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({
        error: 'API Key not configured on server'
      });
    }

    try {
      // GEMINI API SETUP: Initialize client with server-side API key
      const genAI = new GoogleGenerativeAI(apiKey);
      const geminiModel = genAI.getGenerativeModel({ model });

      // GENERATION CONFIG: Prepare parameters for the API call
      // These settings control the behavior and output format of the model
      const generationConfig: any = {
        temperature,           // Controls randomness (0.0 = deterministic, 1.0 = very random)
        maxOutputTokens: 8192, // Maximum length of generated response
      };

      // REPRODUCIBILITY: Add seed for deterministic outputs when provided
      // This is useful for testing and ensuring consistent results
      if (seed !== undefined && !isNaN(seed) && seed > 0) {
        generationConfig.seed = seed;
      }

      // JSON OUTPUT: Request structured JSON response when needed
      // Note: JSON mode is disabled when grounding is enabled (Gemini limitation)
      if (isJsonOutput && !useGrounding) {
        generationConfig.responseMimeType = 'application/json';
      }

      // REQUEST PREPARATION: Build the request object for Gemini API
      const requestOptions: any = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      };

      // GROUNDING: Enable Google Search integration when requested
      // This allows the model to access current information from web search
      if (useGrounding) {
        requestOptions.tools = [{ googleSearchRetrieval: {} }];
      }

      // API CALL: Execute the request to Gemini API
      const result = await geminiModel.generateContent(requestOptions);
      const response = await result.response;
      const text = response.text();

      // GROUNDING EXTRACTION: Parse grounding sources if available
      // These provide citations and sources for grounded responses
      let groundingSources;
      if (useGrounding && response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        groundingSources = response.candidates[0].groundingMetadata.groundingChunks;
      }

      // TOKEN ESTIMATION: Calculate approximate token usage
      // Uses rough approximation of 1 token ≈ 4 characters (English text)
      const estimatedInputTokens = Math.ceil(prompt.length / 4);
      const estimatedOutputTokens = Math.ceil(text.length / 4);

      // SUCCESS RESPONSE: Return processed results to frontend
      return {
        text,
        groundingSources,
        estimatedInputTokens,
        estimatedOutputTokens
      };

    } catch (error) {
      // ERROR HANDLING: Log error securely and return safe error message
      // Prevents information leakage while providing useful debugging info
      fastify.log.error('Gemini API call failed:', error);
      return reply.status(500).send({
        error: `Gemini API call error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });
}