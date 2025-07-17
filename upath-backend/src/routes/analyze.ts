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

const VALID_MODELS = [
  'gemini-2.5-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro'
];

export default async function analyzeRoute(fastify: FastifyInstance) {
  fastify.post<AnalyzeRequest>('/analyze', async (request: FastifyRequest<AnalyzeRequest>, reply: FastifyReply) => {
    const { prompt, encrypted = false, model = DEFAULT_MODEL, isJsonOutput = false, temperature = 0.0 } = request.body;
    
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
      const geminiModel = genAI.getGenerativeModel({ model: VALID_MODELS.includes(model) ? model : DEFAULT_MODEL });

      // Configure request
      const generationConfig: any = { temperature, maxOutputTokens: 65536 };
      
      if (isJsonOutput) {
        generationConfig.responseMimeType = 'application/json';
      }

      // Make API call
      const result = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: actualPrompt }] }],
        generationConfig
      });
      
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