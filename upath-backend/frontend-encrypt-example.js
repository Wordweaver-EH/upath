/**
 * Frontend Encryption Example for µPath Backend
 * 
 * This file demonstrates how to encrypt prompts in the frontend
 * before sending them to the backend API.
 * 
 * Dependencies:
 * - crypto-js (npm install crypto-js)
 * 
 * Usage:
 * 1. Include crypto-js in your frontend project
 * 2. Copy the encryptPrompt function
 * 3. Use it to encrypt prompts before sending to the backend
 * 4. Set encrypted: true in your request
 */

// In a real application, you would import crypto-js like this:
// import CryptoJS from 'crypto-js';

// This is the encryption key from your backend .env file
// IMPORTANT: In a real application, this should be stored securely
// and potentially retrieved from a secure backend endpoint
const ENCRYPTION_KEY = "b630a313659957d2370d66f6378596b0d2478569f360af08cadf305d4f12968a";

/**
 * Encrypts a prompt string using AES-256-CBC
 * 
 * @param {string} text - The prompt text to encrypt
 * @param {string} key - The encryption key (must match backend ENCRYPTION_KEY)
 * @returns {string} - Encrypted string in format 'iv:ciphertext'
 */
function encryptPrompt(text, key) {
  // For browser environments, you would use crypto-js like this:
  
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
  return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
}

/**
 * Example usage in a React component:
 * 
 * import CryptoJS from 'crypto-js';
 * 
 * function GeminiChat() {
 *   const [prompt, setPrompt] = useState('');
 *   const [response, setResponse] = useState('');
 * 
 *   const handleSubmit = async (e) => {
 *     e.preventDefault();
 *     
 *     // Encrypt the prompt
 *     const encryptedPrompt = encryptPrompt(prompt, ENCRYPTION_KEY);
 *     
 *     // Send to backend with encrypted flag
 *     const result = await fetch('/api/analyze', {
 *       method: 'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body: JSON.stringify({
 *         prompt: encryptedPrompt,
 *         encrypted: true,
 *         model: 'gemini-1.5-flash',
 *         temperature: 0.2
 *       })
 *     });
 *     
 *     const data = await result.json();
 *     setResponse(data.text);
 *   };
 * 
 *   return (
 *     <div>
 *       <form onSubmit={handleSubmit}>
 *         <textarea 
 *           value={prompt} 
 *           onChange={(e) => setPrompt(e.target.value)}
 *         />
 *         <button type="submit">Send Encrypted</button>
 *       </form>
 *       <div>{response}</div>
 *     </div>
 *   );
 * }
 */