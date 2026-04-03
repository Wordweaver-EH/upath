import { useState, useCallback } from 'react';
import { callGeminiAPI } from '../../services/geminiService';
import { encryptionConfig } from '../../services/encryptionService';

interface UseEncryptedPromptOptions {
  defaultUseEncryption?: boolean;
  defaultTemperature?: number;
  defaultUseGrounding?: boolean;
  defaultJsonOutput?: boolean;
}

interface UseEncryptedPromptResult {
  prompt: string;
  setPrompt: (prompt: string) => void;
  response: string | null;
  parsedJson: any | null;
  loading: boolean;
  error: string | null;
  sendPrompt: () => Promise<void>;
  useEncryption: boolean;
  setUseEncryption: (value: boolean) => void;
  groundingSources?: any[];
}

/**
 * Custom hook for managing encrypted prompts
 * 
 * Handles state management and API calls with optional encryption
 */
export function useEncryptedPrompt(options: UseEncryptedPromptOptions = {}): UseEncryptedPromptResult {
  // Default options
  const {
    defaultUseEncryption = true, // Always encrypt prompts
    defaultTemperature = 0.0,
    defaultUseGrounding = false,
    defaultJsonOutput = false
  } = options;

  // State
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState<string | null>(null);
  const [parsedJson, setParsedJson] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useEncryption, setUseEncryption] = useState(defaultUseEncryption);
  const [groundingSources, setGroundingSources] = useState<any[]>([]);

  // Send prompt to API
  const sendPrompt = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Prompt cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);
    setParsedJson(null);
    setGroundingSources([]);

    try {
      // Call API with encryption if enabled
      const result = await callGeminiAPI(
        prompt, 
        defaultJsonOutput,
        defaultUseGrounding,
        defaultTemperature
      );

      // Handle response
      if (result.error) {
        throw new Error(result.error);
      }

      // Set response based on type
      if (result.text) {
        setResponse(result.text);
      }
      
      if (result.parsedJson) {
        setParsedJson(result.parsedJson);
      }

      if (result.groundingSources) {
        setGroundingSources(result.groundingSources);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : String(err)}`);
      console.error('API call failed:', err);
    } finally {
      setLoading(false);
    }
  }, [prompt, defaultJsonOutput, defaultUseGrounding, defaultTemperature]);

  return {
    prompt,
    setPrompt,
    response,
    parsedJson,
    loading,
    error,
    sendPrompt,
    useEncryption,
    setUseEncryption,
    groundingSources
  };
}