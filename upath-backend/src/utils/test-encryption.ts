import { encryptPrompt } from './encrypt';
import dotenv from 'dotenv';
import { decryptPrompt } from '../routes/analyze';

// Load environment variables
dotenv.config();

// Test the encryption and decryption
async function testEncryption() {
  const key = process.env.ENCRYPTION_KEY;
  
  if (!key) {
    console.error('ERROR: No ENCRYPTION_KEY found in environment variables');
    process.exit(1);
  }
  
  console.log('Testing encryption with key from .env file');
  
  // Original prompt
  const originalPrompt = 'This is a test prompt that needs to be kept secret';
  console.log(`\nOriginal prompt: "${originalPrompt}"`);
  
  // Encrypt
  const encrypted = encryptPrompt(originalPrompt, key);
  console.log(`\nEncrypted prompt: ${encrypted}`);
  
  // Decrypt
  const decrypted = decryptPrompt(encrypted);
  console.log(`\nDecrypted prompt: "${decrypted}"`);
  
  // Verify
  if (decrypted === originalPrompt) {
    console.log('\n✅ SUCCESS: Encryption and decryption working correctly!');
  } else {
    console.error('\n❌ ERROR: Decrypted text does not match original');
  }
  
  // Sample request payload
  console.log('\nSample frontend request:');
  console.log(JSON.stringify({
    prompt: encrypted,
    encrypted: true,
    model: 'gemini-1.5-flash',
    temperature: 0.2
  }, null, 2));
}

testEncryption();