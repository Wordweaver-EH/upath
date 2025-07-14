/**
 * Gemini API Service
 * Ported from working prototype's services/geminiService.ts
 * Handles LLM interactions with Google Gemini API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GeminiApiParams, GeminiApiResponse } from '../pipeline/core/interfaces';

/**
 * Gemini API Service Implementation
 * Exactly matches the working prototype's callGeminiAPI pattern
 */
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    if (!this.apiKey) {
      console.error('[GeminiService] GEMINI_API_KEY not found in environment variables');
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    console.log('[GeminiService] Initialized with API key');
  }

  /**
   * Call Gemini API
   * Exactly matches the working prototype's callGeminiAPI function signature and behavior
   */
  async callGeminiAPI(params: GeminiApiParams): Promise<GeminiApiResponse> {
    const {
      prompt,
      isJsonOutput,
      useGrounding = false,
      model,
      temperature = 0.0,
      seed,
      attempt = 1
    } = params;

    console.log(`[GeminiService] Calling Gemini API (attempt ${attempt})`);
    console.log(`[GeminiService] Parameters: model=${model || 'default'}, isJsonOutput=${isJsonOutput}, temperature=${temperature}, useGrounding=${useGrounding}, seed=${seed}`);

    try {
      // Check if API key is set (matches prototype pattern)
      if (!this.isApiKeySet()) {
        return {
          error: 'API Key not configured on server',
        };
      }

      // Call the actual Gemini API
      const result = await this.performGeminiCall(prompt, isJsonOutput, useGrounding, temperature, seed, model);

      if (result.error) {
        return result;
      }

      // Handle JSON output parsing (matches prototype pattern)
      if (isJsonOutput && result.text) {
        try {
          const parsedJson = this.extractAndParseJson(result.text);
          return {
            parsedJson,
            estimatedInputTokens: result.estimatedInputTokens,
            estimatedOutputTokens: result.estimatedOutputTokens,
            groundingSources: result.groundingSources,
          };
        } catch (parseError) {
          console.warn(`[GeminiService] JSON parsing failed, attempting self-correction (attempt ${attempt})`);
          
          // Self-correction attempt (matches prototype pattern)
          if (attempt === 1) {
            const fixerPrompt = this.generateJsonFixerPrompt(result.text);
            return await this.callGeminiAPI({
              prompt: fixerPrompt,
              isJsonOutput: true,
              useGrounding: false,
              temperature: 0,
              seed,
              attempt: 2
            });
          } else {
            return {
              error: `JSON parsing failed after self-correction: ${parseError.message}. Raw response: ${result.text}`,
            };
          }
        }
      }

      // Return text result for non-JSON output
      return {
        text: result.text,
        estimatedInputTokens: result.estimatedInputTokens,
        estimatedOutputTokens: result.estimatedOutputTokens,
        groundingSources: result.groundingSources,
      };

    } catch (error) {
      console.error('[GeminiService] API call failed:', error);
      return {
        error: `API call failed: ${error.message}`,
      };
    }
  }

  /**
   * Check if API key is set (matches prototype pattern)
   */
  private isApiKeySet(): boolean {
    return !!(this.apiKey && this.apiKey.trim().length > 0);
  }

  /**
   * Perform actual Gemini API call (matches prototype's performGeminiCall)
   */
  private async performGeminiCall(
    prompt: string,
    isJsonOutput: boolean,
    useGrounding: boolean,
    temperature: number,
    seed?: number,
    model?: string
  ): Promise<{
    text?: string;
    error?: string;
    estimatedInputTokens?: number;
    estimatedOutputTokens?: number;
    groundingSources?: Array<{ uri?: string; title?: string }>;
  }> {
    try {
      // Get the appropriate model (use provided model or fallback to default)
      const modelName = model || this.getModelName();
      const generativeModel = this.genAI.getGenerativeModel({ model: modelName });

      // Prepare generation config (matches prototype pattern)
      const generationConfig: any = {
        temperature,
        maxOutputTokens: 8192, // Reasonable default
      };

      // Add seed for deterministic output if provided
      if (seed !== undefined) {
        generationConfig.seed = seed;
      }

      // Set response MIME type for JSON output (matches prototype pattern)
      if (isJsonOutput) {
        generationConfig.responseMimeType = 'application/json';
      }

      // Prepare request parameters
      const requestParams = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      };

      // Add grounding if requested (matches prototype pattern)
      if (useGrounding) {
        // Note: Grounding configuration would go here
        // The exact implementation depends on Gemini's grounding API
        console.log('[GeminiService] Grounding requested but not implemented yet');
      }

      console.log(`[GeminiService] Sending request to ${modelName}`);
      
      // Make the API call
      const response = await generativeModel.generateContent(requestParams);
      
      if (!response || !response.response) {
        throw new Error('Empty response from Gemini API');
      }

      const responseText = response.response.text();
      
      if (!responseText) {
        throw new Error('Empty text in Gemini API response');
      }

      console.log(`[GeminiService] Received response (${responseText.length} characters)`);

      // Estimate token usage (approximate, matches prototype pattern)
      const estimatedInputTokens = this.estimateTokens(prompt);
      const estimatedOutputTokens = this.estimateTokens(responseText);

      // Extract grounding sources if available
      let groundingSources: Array<{ uri?: string; title?: string }> | undefined;
      if (useGrounding && response.response.candidates?.[0]) {
        // Check if groundingAttribution exists (optional in newer SDK versions)
        const candidate = response.response.candidates[0] as any;
        if (candidate.groundingAttribution) {
          groundingSources = this.extractGroundingSources(candidate.groundingAttribution);
        }
      }

      const result: {
        text?: string;
        error?: string;
        estimatedInputTokens?: number;
        estimatedOutputTokens?: number;
        groundingSources?: Array<{ uri?: string; title?: string }>;
      } = {
        text: responseText,
        estimatedInputTokens,
        estimatedOutputTokens,
      };
      
      if (groundingSources) {
        result.groundingSources = groundingSources;
      }
      
      return result;

    } catch (error) {
      console.error('[GeminiService] performGeminiCall error:', error);
      return {
        error: error.message,
      };
    }
  }

  /**
   * Extract and parse JSON from response text (matches prototype pattern)
   */
  private extractAndParseJson(text: string): any {
    try {
      // Try direct JSON parsing first
      return JSON.parse(text);
    } catch (directParseError) {
      // Try to extract JSON from markdown code blocks or other formats
      const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || 
                       text.match(/\{[\s\S]*\}/) || 
                       text.match(/\[[\s\S]*\]/);
      
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[1] || jsonMatch[0]);
        } catch (extractParseError) {
          throw new Error(`JSON extraction and parsing failed: ${extractParseError.message}`);
        }
      }
      
      throw new Error(`No valid JSON found in response: ${text.substring(0, 200)}...`);
    }
  }

  /**
   * Generate JSON fixer prompt for self-correction (matches prototype pattern)
   */
  private generateJsonFixerPrompt(malformedJson: string): string {
    return `You are a JSON repair assistant. The following text contains malformed JSON that needs to be fixed. Please return ONLY the corrected JSON object, with no additional text or markdown formatting:

${malformedJson}

Return the corrected JSON:`;
  }

  /**
   * Get appropriate model name (matches prototype pattern)
   */
  private getModelName(): string {
    // Use environment variable or default model
    return process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  }

  /**
   * Estimate token count (approximate, matches prototype pattern)
   */
  private estimateTokens(text: string): number {
    // Simple approximation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Extract grounding sources from API response
   */
  private extractGroundingSources(groundingAttribution: any): Array<{ uri?: string; title?: string }> {
    // This would extract grounding sources from the API response
    // Implementation depends on the actual grounding API structure
    return [];
  }

  /**
   * Health check for the service
   */
  async healthCheck(): Promise<{ healthy: boolean; details: Record<string, any> }> {
    const hasApiKey = this.isApiKeySet();
    
    // Optional: make a simple test call to verify API connectivity
    let apiConnectivity = false;
    try {
      if (hasApiKey) {
        const model = this.genAI.getGenerativeModel({ model: this.getModelName() });
        const response = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: 'Hello' }] }],
          generationConfig: { maxOutputTokens: 10 }
        });
        apiConnectivity = !!response?.response?.text();
      }
    } catch (error) {
      console.warn('[GeminiService] Health check API test failed:', error.message);
    }

    return {
      healthy: hasApiKey,
      details: {
        hasApiKey,
        apiConnectivity,
        modelName: this.getModelName(),
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalApiCalls: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    averageResponseTime: number;
  } {
    // This would be implemented with proper metrics collection
    return {
      totalApiCalls: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      averageResponseTime: 0,
    };
  }
}

// Export singleton instance - lazy initialization to ensure dotenv is loaded
let _geminiService: GeminiService | null = null;

export const geminiService = {
  get instance(): GeminiService {
    if (!_geminiService) {
      _geminiService = new GeminiService();
    }
    return _geminiService;
  },
  
  // For direct method access
  callGeminiAPI: (...args: Parameters<GeminiService['callGeminiAPI']>) => {
    return geminiService.instance.callGeminiAPI(...args);
  },
  
  getStats: () => {
    return geminiService.instance.getStats();
  },
  
  healthCheck: async () => {
    return geminiService.instance.healthCheck();
  }
};