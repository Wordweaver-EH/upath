// Simple debug - paste this in browser console after uploading a transcript
// This checks if the stores are working by inspecting React DevTools globals

console.log('=== Simple Debug ===');

// Check if React DevTools has access to stores
if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
  console.log('React DevTools available - check Components tab for store state');
} else {
  console.log('React DevTools not available');
}

// Check IndexedDB directly
if ('indexedDB' in window) {
  console.log('IndexedDB available');
  
  // Open the database to see if data is there
  const request = indexedDB.open('uPATH-Analysis-Storage');
  request.onsuccess = function(event) {
    const db = event.target.result;
    console.log('Database opened successfully');
    console.log('Object stores:', Array.from(db.objectStoreNames));
    
    if (db.objectStoreNames.contains('state_store')) {
      const transaction = db.transaction(['state_store'], 'readonly');
      const objectStore = transaction.objectStore('state_store');
      const getAllRequest = objectStore.getAll();
      
      getAllRequest.onsuccess = function() {
        console.log('Data in IndexedDB:', getAllRequest.result);
      };
    }
  };
  
  request.onerror = function() {
    console.log('Failed to open database');
  };
} else {
  console.log('IndexedDB not available');
}