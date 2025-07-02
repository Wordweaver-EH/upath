# BUG-001: Critical Upload Failure - Fix Implementation Plan

## Bug Summary
The transcript upload mechanism fails due to data structure mismatches between the `addTranscripts` action and the `TranscriptProcessedData` interface.

## Root Cause Analysis

### Primary Issues
1. **Field Name Mismatches:**
   - Code uses `fileName` → Interface requires `filename`
   - Code uses `isFullyProcessedSpecific` → Interface requires `isFullyProcessedSpecificDiachronic`
   - Missing required field `isFullyProcessedSpecificSynchronic`

2. **Data Type Mismatches:**
   - `processFileContent` returns `content: string[]` → `RawTranscript` expects `content: string`
   - Code references non-existent `transcript.metadata.fileName`

3. **Obsolete Fields:**
   - `rawContent` (doesn't exist in interface)
   - Incorrect error field naming patterns

### Secondary Issues
- Missing `enableMapSet()` call for Immer Map support
- Unused `TranscriptUploadHandler.tsx` component

## Implementation Tasks

### 🔴 High Priority
- [ ] **Fix processFileContent** to return proper RawTranscript structure
  - Change `content: lines` to `content: text` (string, not array)
  - Remove metadata object
  - Use `filename` directly from file.name

- [ ] **Fix addTranscripts** action field names and data structure
  - Change `fileName` to `filename`
  - Change `isFullyProcessedSpecific` to `isFullyProcessedSpecificDiachronic`
  - Add `isFullyProcessedSpecificSynchronic: false`
  - Remove all obsolete fields
  - Fix reference from `transcript.metadata.fileName` to `transcript.filename`

- [ ] **Test upload functionality** after fixes
  - Verify files upload successfully
  - Check state updates correctly
  - Confirm UI reflects changes

### 🟡 Medium Priority
- [ ] **Add enableMapSet()** call in stores/index.ts
  - Import from 'immer'
  - Call before store initialization

### 🟢 Low Priority
- [ ] **Delete unused TranscriptUploadHandler.tsx**
  - Remove from components directory

## Code Changes Required

### 1. Fix processFileContent (src/stores/pipelineStore.ts)
```typescript
const processFileContent = async (file: File): Promise<RawTranscript> => {
  const text = await file.text()
  
  return {
    id: `transcript-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    filename: file.name,
    content: text
  }
}
```

### 2. Fix addTranscripts (src/stores/pipelineStore.ts)
```typescript
addTranscripts: async (files: File[]) => {
  const newTranscripts = await Promise.all(files.map(processFileContent))
  
  set((state: PipelineState) => {
    state.rawTranscripts = [...state.rawTranscripts, ...newTranscripts]
    
    // Initialize processed data for new transcripts
    newTranscripts.forEach(transcript => {
      state.processedData.set(transcript.id, {
        id: transcript.id,
        filename: transcript.filename, // FIXED: was fileName
        isFullyProcessedSpecificDiachronic: false, // FIXED: was isFullyProcessedSpecific
        isFullyProcessedSpecificSynchronic: false  // ADDED: required field
      } as TranscriptProcessedData)
    })
  })
}
```

### 3. Enable Map Support (src/stores/index.ts)
```typescript
import { enableMapSet } from 'immer'

// Enable Immer's Map support
enableMapSet()

// ... rest of store initialization
```

## Verification Steps
1. Upload multiple .txt files via drag-and-drop
2. Upload files via file picker
3. Verify transcripts appear in UI list
4. Check browser console for any errors
5. Reload page and verify state persistence

## Expected Outcome
- Upload functionality works without errors
- Files are processed and added to state
- UI updates to show uploaded transcripts
- Application advances to first pipeline step