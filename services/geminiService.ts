

import { GoogleGenAI, GenerateContentResponse, GenerateContentParameters } from "@google/genai";
import type { GroundingChunk } from '../types'; // Ensure GroundingChunk types are imported if used
import { GEMINI_MODEL_TEXT } from '../constants';

const API_KEY = process.env.API_KEY;

let ai: GoogleGenAI | null = null;

if (API_KEY) {
  try {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    ai = null; 
  }
} else {
  console.warn("Gemini API Key (process.env.API_KEY) is not set. API calls will be disabled.");
}

export function isApiKeySet(): boolean {
  return !!API_KEY && !!ai;
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
    originalPromptForFixer?: string 
): Promise<{ 
    responseText: string; 
    response?: GenerateContentResponse; 
    error?: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
}> {
    if (!isApiKeySet() || !ai) {
        return { 
            responseText: "", 
            error: "API Key not configured or Gemini AI not initialized.",
            estimatedInputTokens: estimateTokens(originalPromptForFixer || prompt),
            estimatedOutputTokens: 0
        };
    }

    const effectivePrompt = originalPromptForFixer || prompt;
    const estimatedInputTokens = estimateTokens(effectivePrompt);

    const params: GenerateContentParameters = {
        model: GEMINI_MODEL_TEXT,
        contents: effectivePrompt, // Use effectivePrompt for the API call
        config: {
            temperature: temperature, 
        }
    };

    if (seed !== undefined && !isNaN(seed) && seed > 0) {
        params.config = { ...params.config, seed: seed };
    }

    if (isJsonOutput && !useGrounding) {
        params.config = { ...params.config, responseMimeType: "application/json" };
    }
    
    if (useGrounding) {
        if (params.config?.responseMimeType === "application/json") {
            delete params.config.responseMimeType;
        }
        params.config = { ...params.config, tools: [{googleSearch: {}}] };
    }

    try {
        const response: GenerateContentResponse = await ai.models.generateContent(params);
        const responseText = response.text ?? ""; // Ensure responseText is always a string
        const estimatedOutputTokens = estimateTokens(responseText);
        return { responseText, response, estimatedInputTokens, estimatedOutputTokens };
    } catch (error) {
        console.error("Gemini API call failed:", error, "Prompt:", effectivePrompt, "Params:", params);
        return { 
            responseText: "", 
            error: `Gemini API call error: ${(error as Error).message || "Unknown Gemini API error"}${originalPromptForFixer ? ' (during retry attempt)' : ''}`,
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
  attempt: number = 1 
): Promise<{ 
    text?: string; 
    parsedJson?: any; 
    error?: string; 
    groundingSources?: GroundingChunk[];
    estimatedInputTokens?: number;
    estimatedOutputTokens?: number;
}> {
  if (!isApiKeySet() || !ai) {
    return { 
        error: "API Key not configured or Gemini AI not initialized.",
        estimatedInputTokens: estimateTokens(prompt),
        estimatedOutputTokens: 0
    };
  }

  const initialCallResult = await performGeminiCall(prompt, isJsonOutput, useGrounding, temperature, seed);
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
  if (useGrounding && response?.candidates?.[0]?.groundingMetadata?.groundingChunks) {
      groundingSources = response.candidates[0].groundingMetadata.groundingChunks as GroundingChunk[];
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

Please analyze the original prompt's instructions for JSON output (paying close attention to the expected schema, field names, data types, and overall structure, especially for long string fields like markdown reports).
Then, correct the malformed response to be valid JSON that accurately reflects the data described and adheres to the original prompt's schema.
The output MUST be ONLY the corrected, valid JSON object or array. Ensure all string values are complete and correctly quoted, and that there are no trailing characters or missing terminators.
Do not include any explanations, apologies, or surrounding text like markdown fences. Just the raw, corrected JSON.`;
        
        // Pass `prompt` as `originalPromptForFixer` to `performGeminiCall` for accurate input token counting for the fixer call itself
        const retryResult = await performGeminiCall(fixerPrompt, true, false, 0.0, undefined, fixerPrompt); 

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