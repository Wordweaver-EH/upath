import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { GoogleGenerativeAI } from '@google/generative-ai';
import crypto from 'crypto';

interface AnalyzeRequest {
  Body: {
    prompt: string;
    encrypted?: boolean;
    model?: string;
    temperature?: number;
    isJsonOutput?: boolean;
    seed?: number;
    useGrounding?: boolean;
  };
}

// Encryption functions for prompt security
export function decryptPrompt(encryptedText: string): string {
  try {
    // The encryption key should be stored in environment variables
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-key-please-change-in-production';
    
    // Pad key to 32 bytes (same as frontend)
    const keyBuffer = Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32));
    
    // Split the encrypted text into parts (IV and ciphertext)
    const textParts = encryptedText.split(':');
    if (textParts.length < 2) {
      throw new Error('Invalid encrypted format: Missing IV or ciphertext');
    }
    
    // Extract IV and encrypted data
    const ivHex = textParts[0];
    const encryptedData = textParts.slice(1).join(':');
    
    // Validate IV (must be 16 bytes / 32 hex chars)
    if (ivHex.length !== 32 || !/^[0-9a-f]+$/i.test(ivHex)) {
      throw new Error('Invalid IV format: Must be 32 hex characters');
    }
    
    // Convert IV to Buffer
    const iv = Buffer.from(ivHex, 'hex');
    
    // First try base64 decoding (used by frontend crypto-js)
    try {
      // Create decipher with base64 input
      const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
      let decrypted = decipher.update(Buffer.from(encryptedData, 'base64'));
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      return decrypted.toString('utf8');
    } catch (base64Error) {
      // If base64 fails, try hex decoding
      try {
        // Create decipher with hex input
        const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
        let decrypted = decipher.update(Buffer.from(encryptedData, 'hex'));
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString('utf8');
      } catch (hexError) {
        // If both attempts fail, log and throw error
        console.error('Base64 decryption error:', base64Error);
        console.error('Hex decryption error:', hexError);
        throw new Error('Failed to decrypt with either base64 or hex format');
      }
    }
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt prompt');
  }
}

const DEFAULT_MODEL = 'gemini-2.5-flash';

// Thinking models that support thinking mode
const THINKING_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-flash-lite-preview-06-17',
  'gemini-2.5-flash-preview-05-20',
  'gemini-2.5-pro',
  'gemini-2.5-pro-preview-03-25',
  'gemini-2.5-pro-preview-05-06',
  'gemini-2.5-pro-preview-06-05',
  'gemini-2.0-flash-thinking-exp',
  'gemini-2.0-flash-thinking-exp-01-21',
  'gemini-2.0-flash-thinking-exp-1219',
  'gemini-2.0-pro-exp',
  'gemini-2.0-pro-exp-02-05',
  'gemini-exp-1206'
];

export default async function analyzeRoute(fastify: FastifyInstance) {
  fastify.post<AnalyzeRequest>('/analyze', async (request: FastifyRequest<AnalyzeRequest>, reply: FastifyReply) => {
    const { prompt, encrypted = false, model = DEFAULT_MODEL, isJsonOutput = false, temperature = 0.0, seed, useGrounding = false } = request.body;
    
    // Basic validation
    if (!prompt || typeof prompt !== 'string') {
      return reply.status(400).send({ error: 'Missing prompt' });
    }
    
    // Handle encrypted prompts
    let actualPrompt: string;
    try {
      actualPrompt = encrypted ? decryptPrompt(prompt) : prompt;
    } catch (error) {
      return reply.status(400).send({ error: 'Failed to decrypt prompt' });
    }

    // Check API key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return reply.status(500).send({ error: 'API Key not configured' });
    }

    try {
      // Set up Gemini API
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Use the model provided, defaulting to DEFAULT_MODEL if not specified
      const modelToUse = model || DEFAULT_MODEL;
      const geminiModel = genAI.getGenerativeModel({ model: modelToUse });

      // Configure request
      const generationConfig: any = { 
        temperature, 
        maxOutputTokens: 65536,
        ...(seed !== undefined && { seed })
      };
      
      if (isJsonOutput) {
        generationConfig.responseMimeType = 'application/json';
      }

      // Check if this is a thinking model
      const isThinkingModel = THINKING_MODELS.includes(modelToUse);
      
      // Log model and thinking mode status
      fastify.log.info(`Using model: ${modelToUse}, Thinking mode: ${isThinkingModel}, Temperature: ${temperature}, Seed: ${seed || 'none'}`);
      
      // Prepare system instruction for thinking models
      let systemInstruction = undefined;
      if (isThinkingModel) {
        systemInstruction = "You are a model with thinking capabilities. Please use your thinking mode to carefully analyze and reason through the request before providing your response.";
      }

      // Make API call
      const requestConfig: any = {
        contents: [{ role: 'user', parts: [{ text: actualPrompt }] }],
        generationConfig
      };
      
      // Add system instruction if it's a thinking model
      if (systemInstruction) {
        requestConfig.systemInstruction = systemInstruction;
      }
      
      // For thinking models, we need to use REST API with thinking_config
      // The SDK doesn't support thinking_config yet
      if (isThinkingModel) {
        // Use REST API directly for thinking models
        const modelPath = `https://generativelanguage.googleapis.com/v1beta/models/${modelToUse}:generateContent?key=${apiKey}`;
        
        const thinkingRequest: any = {
          contents: [{ parts: [{ text: actualPrompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens: 65536,
            ...(seed !== undefined && { seed }),
            ...(isJsonOutput && { responseMimeType: 'application/json' }),
            // Enable thinking with dynamic budget (-1 lets model decide)
            thinkingConfig: {
              thinkingBudget: -1,  // Let model decide thinking budget (0-24576 or -1 for dynamic)
              includeThoughts: true  // Include thought summaries in response for debugging
            }
          }
        };
        
        if (systemInstruction) {
          thinkingRequest.systemInstruction = { parts: [{ text: systemInstruction }] };
        }
        
        const thinkingResponse = await fetch(modelPath, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(thinkingRequest)
        });
        
        if (!thinkingResponse.ok) {
          const errorText = await thinkingResponse.text();
          throw new Error(`API request failed: ${errorText}`);
        }
        
        const thinkingData: any = await thinkingResponse.json();
        
        // Process all parts to separate thoughts from answers
        const parts = thinkingData.candidates?.[0]?.content?.parts || [];
        const thoughts = [];
        const answers = [];
        
        for (const part of parts) {
          if (part.text) {
            if (part.thought) {
              thoughts.push(part.text);
            } else {
              answers.push(part.text);
            }
          }
        }
        
        const thoughtsTokenCount = thinkingData.usageMetadata?.thoughtsTokenCount;
        
        return { 
          text: answers.join('\n'), // Main response text
          thoughts,                  // Array of thought summaries
          thoughtsTokenCount
        };
      }
      
      // For non-thinking models, use SDK as before
      const result = await geminiModel.generateContent(requestConfig);
      
      const response = await result.response;
      const text = response.text();

      // Return simplified response
      return { text };

    } catch (error) {
      fastify.log.error('Gemini API call failed:', error);
      return reply.status(500).send({
        error: `API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  });
}