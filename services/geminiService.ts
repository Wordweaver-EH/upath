
import type { GroundingChunk } from '../types';
import { createApiRequestBody, encryptionConfig } from './encryptionService';
import { GEMINI_MODEL_TEXT } from '../constants';

const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'
  : 'http://localhost:3001';

/**
 * Health Check Cache
 * 
 * Caches backend health status to avoid excessive network requests.
 * The frontend may call isApiKeySet() frequently during UI updates,
 * so caching prevents unnecessary load on the backend health endpoint.
 */
let healthCheckCache: { isHealthy: boolean; timestamp: number } | null = null;
const HEALTH_CHECK_CACHE_DURATION = 30000; // 30 seconds

/**
 * Check if backend is available and properly configured
 * 
 * This function replaces the original API key check with a proper health check
 * against the backend server. It verifies that:
 * - Backend server is running and reachable
 * - Backend can respond to HTTP requests
 * - Network connectivity is working
 * 
 * Uses caching to avoid excessive requests while providing real-time status.
 * 
 * @returns Promise<boolean> - true if backend is healthy, false otherwise
 */
export async function isApiKeySet(): Promise<boolean> {
  // CACHE CHECK: Return cached result if still valid
  // Reduces network load and improves UI responsiveness
  if (healthCheckCache && (Date.now() - healthCheckCache.timestamp < HEALTH_CHECK_CACHE_DURATION)) {
    return healthCheckCache.isHealthy;
  }

  try {
    // HEALTH CHECK: Call backend health endpoint
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const isHealthy = response.ok;
    
    // CACHE UPDATE: Store result with timestamp
    healthCheckCache = {
      isHealthy,
      timestamp: Date.now()
    };

    return isHealthy;
  } catch (error) {
    // ERROR HANDLING: Log warning and cache failure result
    // This handles network errors, server down, etc.
    console.warn('Backend health check failed:', error);
    
    healthCheckCache = {
      isHealthy: false,
      timestamp: Date.now()
    };

    return false;
  }
}

/**
 * Synchronous version of API key check using cached data
 * 
 * Provided for backward compatibility with code that expects
 * a synchronous function. Returns cached health status or false
 * if no cached data is available.
 * 
 * @returns boolean - cached health status
 */
export function isApiKeySetSync(): boolean {
  return healthCheckCache?.isHealthy || false;
}

// Helper function to estimate tokens (1 token ~ 4 chars)
function estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
}

// Helper function to extract JSON string
function extractJsonContent(rawText: string): string {
    let textToParse = rawText.trim();
    
    // Attempt 1: Extract from a markdown code block if present
    const fenceRegex = /```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```/;
    const fenceMatch = textToParse.match(fenceRegex);

    if (fenceMatch && fenceMatch[1]) {
        // If a fenced block is found, its content is the primary candidate.
        textToParse = fenceMatch[1].trim();
    }
    // Now, textToParse is either the content from the fence or the original trimmed text.
    // We need to handle cases where this textToParse *still* has trailing characters
    // after a valid JSON object/array. e.g. "{...} extra" or "[...] extra"

    // Attempt 2: Find the boundaries of the first significant balanced JSON structure.
    let balance = 0;
    let startIndex = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < textToParse.length; i++) {
        const char = textToParse[i];

        if (escapeNext) {
            escapeNext = false;
            continue;
        }

        if (char === '\\') {
            escapeNext = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
        }

        if (inString) {
            continue; // Skip characters inside strings
        }

        if (char === '{' || char === '[') {
            if (startIndex === -1) {
                startIndex = i; // Mark the start of the potential JSON
            }
            balance++;
        } else if (char === '}' || char === ']') {
            if (startIndex !== -1) { // Only decrease balance if we are already inside a structure
                balance--;
                if (balance === 0) {
                    // We found a balanced structure
                    // Extract this candidate.
                    const candidate = textToParse.substring(startIndex, i + 1);
                    // It's not strictly necessary to parse here, as the caller will parse.
                    // The main goal is to trim trailing garbage.
                    return candidate; 
                }
            }
        }
    }

    // If no balanced structure was found and returned (e.g., string doesn't start with { or [),
    // or if JSON started but wasn't balanced (e.g. "{..."),
    // return the textToParse (which is post-fence-stripping or original).
    // This allows JSON.parse in callGeminiAPI to attempt parsing and report a more specific error if it's malformed.
    return textToParse;
}


async function performGeminiCall(
    prompt: string,
    isJsonOutput: boolean,
    useGrounding: boolean,
    temperature: number, 
    seed?: number,
    model: string = GEMINI_MODEL_TEXT,        
    originalPromptForFixer?: string 
): Promise<{ 
    responseText: string; 
    response?: any; 
    error?: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
}> {
    const effectivePrompt = originalPromptForFixer || prompt;
    const estimatedInputTokens = estimateTokens(effectivePrompt);

    try {
        const response = await fetch(`${BACKEND_URL}/api/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(createApiRequestBody(
                effectivePrompt,
                true, // Always encrypt prompts for network calls
                {
                    model,
                    isJsonOutput,
                    useGrounding,
                    temperature,
                    seed
                }
            )),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        
        return { 
            responseText: data.text || "", 
            response: data, // The full response from backend
            estimatedInputTokens: data.estimatedInputTokens || estimatedInputTokens,
            estimatedOutputTokens: data.estimatedOutputTokens || estimateTokens(data.text || "")
        };
    } catch (error) {
        console.error("Backend API call failed:", error, "Prompt:", effectivePrompt);
        return { 
            responseText: "", 
            error: `Backend API call error: ${(error as Error).message || "Unknown backend API error"}${originalPromptForFixer ? ' (during retry attempt)' : ''}`,
            estimatedInputTokens,
            estimatedOutputTokens: 0
        };
    }
}


export async function callGeminiAPI(
  prompt: string,
  isJsonOutput: boolean,
  useGrounding: boolean = false,
  temperature: number = 0.0, 
  seed?: number,
  model: string = GEMINI_MODEL_TEXT,
  attempt: number = 1 
): Promise<{ 
    text?: string; 
    parsedJson?: any; 
    error?: string; 
    groundingSources?: GroundingChunk[];
    estimatedInputTokens?: number;
    estimatedOutputTokens?: number;
}> {
  const initialCallResult = await performGeminiCall(prompt, isJsonOutput, useGrounding, temperature, seed, model);
  let totalEstimatedInputTokens = initialCallResult.estimatedInputTokens;
  let totalEstimatedOutputTokens = initialCallResult.estimatedOutputTokens;

  if (initialCallResult.error) {
    return { 
        error: initialCallResult.error,
        estimatedInputTokens: totalEstimatedInputTokens,
        estimatedOutputTokens: totalEstimatedOutputTokens
    };
  }
  
  const responseText = initialCallResult.responseText;
  const response = initialCallResult.response;
  
  let groundingSources: GroundingChunk[] | undefined = undefined;
  if (useGrounding && response?.groundingSources) {
      groundingSources = response.groundingSources as GroundingChunk[];
  }

  if (isJsonOutput || (useGrounding && prompt.toLowerCase().includes("json"))) {
    const jsonStrToParse = extractJsonContent(responseText);
    try {
      const parsedJson = JSON.parse(jsonStrToParse);
      return { 
          parsedJson, 
          groundingSources,
          estimatedInputTokens: totalEstimatedInputTokens,
          estimatedOutputTokens: totalEstimatedOutputTokens
      };
    } catch (e) {
      console.warn(`Failed to parse JSON on attempt ${attempt}. Raw text:`, responseText, "Extracted to parse:", jsonStrToParse, "Error:", e);
      
      if (attempt === 1) {
        console.log("Attempting self-correction for JSON parsing error...");
        const fixerPrompt = `The following original prompt was given to an AI:
--- ORIGINAL PROMPT START ---
${prompt}
--- ORIGINAL PROMPT END ---

The AI responded with the following text, which is not valid JSON or does not match the schema implied by the original prompt:
--- MALFORMED RESPONSE START ---
${responseText}
--- MALFORMED RESPONSE END ---

Please analyze the original prompt's instructions for JSON output (paying close attention to the expected schema, field names, data types, and overall structure).
Then, correct the malformed response to be valid JSON that accurately reflects the data described and adheres to the original prompt's schema.
IMPORTANT: If the original prompt requested minified JSON, output minified JSON with no unnecessary whitespace.
The output MUST be ONLY the corrected, valid JSON object or array. Ensure all string values are complete and correctly quoted, and that there are no trailing characters or missing terminators.
Do not include any explanations, apologies, or surrounding text like markdown fences. Just the raw, corrected JSON.`;
        
        // Pass `prompt` as `originalPromptForFixer` to `performGeminiCall` for accurate input token counting for the fixer call itself
        const retryResult = await performGeminiCall(fixerPrompt, true, false, 0.0, seed, model, fixerPrompt); 

        totalEstimatedInputTokens += retryResult.estimatedInputTokens;
        totalEstimatedOutputTokens += retryResult.estimatedOutputTokens;

        if (retryResult.error) {
          return { 
              error: `JSON parsing failed. Self-correction attempt also failed with API error: ${retryResult.error}`, 
              groundingSources,
              estimatedInputTokens: totalEstimatedInputTokens,
              estimatedOutputTokens: totalEstimatedOutputTokens
          };
        }

        const correctedJsonToParse = extractJsonContent(retryResult.responseText);
        
        try {
          const correctedParsedJson = JSON.parse(correctedJsonToParse);
          console.log("Self-correction successful. Parsed JSON:", correctedParsedJson);
          return { 
              parsedJson: correctedParsedJson, 
              groundingSources,
              estimatedInputTokens: totalEstimatedInputTokens,
              estimatedOutputTokens: totalEstimatedOutputTokens
          };
        } catch (retryError) {
          console.error("Failed to parse JSON even after self-correction attempt. Raw corrected text:", retryResult.responseText, "Extracted to parse:", correctedJsonToParse, "Error:", retryError);
          return { 
            error: `Failed to parse JSON response after self-correction. Error: ${(retryError as Error).message}. Original malformed: ${responseText}. Corrected attempt: ${retryResult.responseText}`, 
            groundingSources,
            estimatedInputTokens: totalEstimatedInputTokens,
            estimatedOutputTokens: totalEstimatedOutputTokens
          };
        }
      }
      return { 
          error: `Failed to parse JSON response. Error: ${(e as Error).message}. Raw: ${responseText}`, 
          groundingSources,
          estimatedInputTokens: totalEstimatedInputTokens,
          estimatedOutputTokens: totalEstimatedOutputTokens
      };
    }
  }
  return { 
      text: responseText, 
      groundingSources,
      estimatedInputTokens: totalEstimatedInputTokens,
      estimatedOutputTokens: totalEstimatedOutputTokens
  };
}