import React from 'react';
import { encryptPrompt, createApiRequestBody, encryptionConfig } from '../services/encryptionService';
import { useEncryptedPrompt } from '../src/hooks/useEncryptedPrompt';

/**
 * Example component demonstrating encrypted prompt usage
 * This shows how to use the encryption service with the Gemini API
 */
export function EncryptedPromptExample() {
  // Use our custom hook for encrypted prompts
  const {
    prompt,
    setPrompt,
    response,
    loading,
    error,
    sendPrompt,
    useEncryption,
    setUseEncryption
  } = useEncryptedPrompt({
    defaultUseEncryption: encryptionConfig.enabled,
    defaultTemperature: 0.2
  });
  
  // Example of making a direct API call with manual encryption
  const handleManualSubmit = async () => {
    if (!prompt.trim()) return;
    
    // Create an encrypted request body
    const requestBody = createApiRequestBody(prompt, useEncryption, {
      model: 'gemini-1.5-flash',
      temperature: 0.2
    });
    
    // Log for debugging
    console.log('Sending manual request with encryption:', useEncryption);
    console.log('Request body:', requestBody);
    
    // Show alert about manual method
    alert('This demonstrates creating your own API calls with encryption. Check console for details.');
  };
  
  // Using our hook's built-in sendPrompt method
  const handleServiceSubmit = async () => {
    await sendPrompt();
  };
  
  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h2>Encrypted Prompt Example</h2>
      
      <div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Enter your prompt here..."
          style={{ width: '100%', height: '100px', padding: '8px', marginBottom: '10px' }}
        />
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
        <div style={{ backgroundColor: '#e6f7ff', padding: '8px', borderRadius: '4px', width: '100%', border: '1px solid #91d5ff' }}>
          <span role="img" aria-label="lock" style={{ marginRight: '8px' }}>🔒</span>
          <strong>Encryption is always enabled</strong> - Your prompts are encrypted before sending to the server
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={handleServiceSubmit}
          disabled={loading || !prompt.trim()}
          style={{ padding: '8px 16px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          {loading ? 'Sending Encrypted Message...' : '🔒 Send Encrypted Prompt'}
        </button>
        
        <button 
          onClick={handleManualSubmit}
          disabled={loading || !prompt.trim()}
          style={{ padding: '8px 16px' }}
        >
          Show Request Details
        </button>
      </div>
      
      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ffeeee', color: '#cc0000', marginBottom: '15px', borderRadius: '4px' }}>
          {error}
        </div>
      )}
      
      {response && (
        <div>
          <h3>Response:</h3>
          <div style={{ padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>
            {response}
          </div>
        </div>
      )}
      
      {prompt && (
        <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f0f8ff', borderRadius: '4px' }}>
          <h4>🔒 Encryption Preview:</h4>
          <div style={{ fontSize: '0.8em', wordBreak: 'break-all' }}>
            <strong>Original:</strong> {prompt}<br /><br />
            <strong>Encrypted:</strong> {encryptPrompt(prompt)}
          </div>
          <div style={{ marginTop: '10px', fontSize: '0.8em', color: '#666' }}>
            This is what will be sent over the network - the original prompt is never transmitted in plain text.
          </div>
        </div>
      )}
    </div>
  );
}