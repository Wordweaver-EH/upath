// Debug script for autosave functionality
// Run this in the browser console to check autosave status

console.log('=== µ-PATH Autosave Debug ===');

// Check if localforage is available
console.log('1. LocalForage available:', typeof localforage !== 'undefined');

// Check current store state
if (typeof window !== 'undefined' && window.usePipelineStore) {
  const state = window.usePipelineStore.getState();
  console.log('2. Current store state:');
  console.log('   - Raw transcripts:', state.rawTranscripts?.length || 0);
  console.log('   - Processed data entries:', state.processedData?.size || 0);
} else {
  console.log('2. Store not available on window object');
}

// Check what's in IndexedDB
if (typeof localforage !== 'undefined') {
  localforage.getItem('upath-autosave-session-v2-localforage')
    .then(data => {
      console.log('3. Data in IndexedDB:');
      if (data) {
        const parsed = JSON.parse(data);
        console.log('   - Raw transcripts:', parsed.state?.rawTranscripts?.length || 0);
        console.log('   - Processed data entries:', parsed.state?.processedData?.length || 0);
        console.log('   - Full data:', parsed);
      } else {
        console.log('   - No data found in IndexedDB');
      }
    })
    .catch(err => {
      console.error('   - Error reading IndexedDB:', err);
    });
} else {
  console.log('3. LocalForage not available');
}

// Check UI store hydration state
if (typeof window !== 'undefined' && window.useUIStore) {
  const uiState = window.useUIStore.getState();
  console.log('4. UI Store hydration:');
  console.log('   - Has rehydrated:', uiState.hasRehydrated);
  console.log('   - Session was restored:', uiState.sessionWasRestored);
} else {
  console.log('4. UI Store not available');
}