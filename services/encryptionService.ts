import CryptoJS from 'crypto-js';

// Read encryption settings from environment variables
// These should match the backend settings
const ENCRYPTION_ENABLED = process.env.REACT_APP_USE_ENCRYPTION === 'true';
const ENCRYPTION_KEY = process.env.REACT_APP_ENCRYPTION_KEY || "b630a313659957d2370d66f6378596b0d2478569f360af08cadf305d4f12968a";

// Export configuration for other modules to use
export const encryptionConfig = {
  enabled: ENCRYPTION_ENABLED,
  key: ENCRYPTION_KEY
};

/**
 * Encrypts a prompt string using AES-256-CBC
 * Compatible with the backend decryption
 * 
 * @param text The prompt text to encrypt
 * @param key Optional: Custom encryption key (defaults to ENCRYPTION_KEY)
 * @returns Encrypted string in format 'iv:ciphertext'
 */
export function encryptPrompt(text: string, key: string = ENCRYPTION_KEY): string {
  try {
    // Log message (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔒 Encrypting prompt for secure transmission');
    }
    
    // Generate random IV
    const iv = CryptoJS.lib.WordArray.random(16);
    
    // Create key (ensuring it's 32 bytes)
    const keyBytes = CryptoJS.enc.Utf8.parse(key.padEnd(32).slice(0, 32));
    
    // Encrypt the text
    const encrypted = CryptoJS.AES.encrypt(text, keyBytes, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    // Format as 'iv:ciphertext'
    // Use hex encoding for IV and base64 for ciphertext
    // This format works best with Node.js crypto module
    return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString(); // Gives base64 output
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt prompt');
  }
}

/**
 * Checks if a string appears to be encrypted (has the iv:ciphertext format)
 * 
 * @param text The text to check
 * @returns True if the text appears to be encrypted
 */
export function isEncrypted(text: string): boolean {
  // Check if the text matches the iv:ciphertext pattern
  // IV is 16 bytes (32 hex chars) followed by : and ciphertext
  return /^[0-9a-f]{32}:.+$/i.test(text);
}

/**
 * Creates an API request body with optional encryption
 * 
 * @param prompt The prompt to send
 * @param useEncryption Whether to encrypt the prompt
 * @param options Additional API options
 * @returns Request body for the API
 */
export function createApiRequestBody(
  prompt: string,
  useEncryption: boolean = false,
  options: {
    model?: string;
    isJsonOutput?: boolean;
    useGrounding?: boolean;
    temperature?: number;
    seed?: number;
    responseSchema?: object;
  } = {}
): Record<string, any> {
  // Encrypt the prompt if encryption is enabled
  const finalPrompt = useEncryption ? encryptPrompt(prompt) : prompt;
  
  // Return the request body with all options
  return {
    prompt: finalPrompt,
    encrypted: useEncryption,
    ...options
  };
}