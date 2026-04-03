import { decryptPrompt } from '../routes/analyze';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

// Create a test prompt to encrypt/decrypt
const testPrompt = 'This is a test prompt for encryption';

// Create our own encrypted data for testing
function createTestEncrypted() {
  // Generate a random IV (16 bytes)
  const iv = Buffer.from('1234567890abcdef1234567890abcdef', 'hex');
  
  // Use the key from environment
  const key = process.env.ENCRYPTION_KEY || '';
  const keyBuffer = Buffer.from(key.padEnd(32).slice(0, 32));
  
  // Create cipher
  const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
  
  // Encrypt the text
  let encrypted = cipher.update(testPrompt, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  // Return the encrypted data in the format iv:ciphertext
  return {
    ivHex: iv.toString('hex'),
    encryptedB64: encrypted,
    combined: `${iv.toString('hex')}:${encrypted}`
  };
}

// Generate test data
const testEncrypted = createTestEncrypted();

// Mock encrypted data for testing
const mockEncrypted = {
  // Freshly encrypted test prompt
  freshTest: testEncrypted.combined,
  
  // Test with a real encrypted prompt
  realExample: "aa1f77979cc878727dbee24847e8fb4f:47a7cf0833c9f95ff8eb8f84c14ddad7c95ffe69a95c018e9cbb62f2ab1d9093a2dd33baaf666b90376dee1cbb4ecb462655da528dc67f2164e5c3a8ea5aa08c"
};

async function testDecryption() {
  console.log('\n🔐 TESTING DECRYPTION COMPATIBILITY 🔐\n');
  
  // Check encryption key
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    console.error('ERROR: No ENCRYPTION_KEY found in environment variables');
    process.exit(1);
  }
  
  console.log(`Using encryption key: ${key.substring(0, 8)}...${key.substring(key.length-8)}`);
  
  // Test freshly encrypted prompt
  try {
    console.log('\n--- Testing Fresh Encryption ---');
    console.log('Original:', testPrompt);
    console.log('Encrypted:', mockEncrypted.freshTest);
    const decrypted = decryptPrompt(mockEncrypted.freshTest);
    console.log('Decrypted:', decrypted);
    
    if (decrypted === testPrompt) {
      console.log('✅ Successfully decrypted fresh test (MATCH)');
    } else {
      console.log('⚠️ Decryption worked but text doesn\'t match');
      console.log('  Expected:', testPrompt);
      console.log('  Got:', decrypted);
    }
  } catch (error) {
    console.error('❌ Failed to decrypt fresh test:', error);
  }
  
  // Test real example
  try {
    console.log('\n--- Testing Real Example ---');
    const decrypted = decryptPrompt(mockEncrypted.realExample);
    console.log('Decrypted:', decrypted);
    console.log('✅ Successfully decrypted real example');
  } catch (error) {
    console.error('❌ Failed to decrypt real example:', error);
  }
  
  console.log('\n🔐 DECRYPTION TEST COMPLETE 🔐\n');
}

testDecryption();