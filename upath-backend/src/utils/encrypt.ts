import crypto from 'crypto';

// Encryption function for frontend usage
export function encryptPrompt(text: string, key: string): string {
  try {
    // Create a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher using the key and iv
    const cipher = crypto.createCipheriv(
      'aes-256-cbc', 
      Buffer.from(key.padEnd(32).slice(0, 32)), 
      iv
    );
    
    // Encrypt the text
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // Return iv + encrypted data as hex string
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt prompt');
  }
}

// Generate a random encryption key
export function generateEncryptionKey(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Example usage
if (require.main === module) {
  // Use the key from environment or generate a new one
  const key = process.env.ENCRYPTION_KEY || generateEncryptionKey();
  
  if (!process.env.ENCRYPTION_KEY) {
    console.log('Generated Key:', key);
    console.log('Add this to your .env file as ENCRYPTION_KEY=your_key');
  } else {
    console.log('Using encryption key from environment variables');
  }
  
  // Example encryption
  const plaintext = 'This is a secret prompt that should be encrypted';
  const encrypted = encryptPrompt(plaintext, key);
  console.log('\nExample:');
  console.log('Original:', plaintext);
  console.log('Encrypted:', encrypted);
  
  console.log('\nFrontend Encryption Example (JavaScript):');
  console.log(`
// Frontend code example (in JavaScript)
async function encryptPrompt(text, key) {
  // This would be implemented in your frontend
  // You can use libraries like crypto-js:
  
  // With crypto-js:
  const CryptoJS = require('crypto-js');
  
  // Generate random IV
  const iv = CryptoJS.lib.WordArray.random(16);
  
  // Create key
  const keyBytes = CryptoJS.enc.Utf8.parse(key.padEnd(32).slice(0, 32));
  
  // Encrypt
  const encrypted = CryptoJS.AES.encrypt(text, keyBytes, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  // Format as iv:ciphertext
  return iv.toString(CryptoJS.enc.Hex) + ':' + encrypted.toString();
}

// Example usage:
const encryptedPrompt = await encryptPrompt("Secret prompt", "${key}");
console.log(encryptedPrompt);

// Send to backend with encrypted flag
fetch('/api/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: encryptedPrompt,
    encrypted: true,
    model: 'gemini-1.5-flash'
  })
})
.then(response => response.json())
.then(data => console.log(data));
`);
}