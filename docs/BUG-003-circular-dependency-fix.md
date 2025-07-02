# Bug 003: Circular Dependency Fix Documentation

**Date Started:** 2025-01-02  
**Status:** In Progress  
**Severity:** High Priority (P1)  

## Problem Statement

A circular dependency exists between `pipelineStore` and `uiStore`:
- `pipelineStore.ts` contains 22 instances of `useUIStore.getState()` calls
- `uiStore.ts` dynamically imports `pipelineStore` 

This creates initialization race conditions, HMR failures, and testing difficulties.

## Solution Overview

Implement dependency injection pattern with centralized store initialization to break the circular dependency.

## Implementation Plan

### Phase 1: Dependency Injection Setup ✅ PARTIALLY COMPLETE

**Status:** The `initializeStores()` function already exists in `src/stores/index.ts`

```typescript
// Already implemented:
export const initializeStores = () => {
  const uiStore = useUIStore.getState()
  const pipelineStore = usePipelineStore.getState()
  
  // Set up dependency injection
  uiStore.setFileDropCallback(pipelineStore.handleDroppedFiles)
  
  return { uiStore, pipelineStore, settingsStore, irrStore }
}
```

### Phase 2: Update UI Store ✅ COMPLETE

**Required Changes:**
1. ✅ Add `setFileDropCallback` method to uiStore - Already implemented
2. ✅ Add `fileDropCallback` to state - Already exists as `onFilesDropped`
3. ✅ Remove dynamic import of pipelineStore - Removed from handleHilSubmit
4. ✅ Use the injected callback instead of direct import - Using callback pattern

**Implementation:**
```typescript
// In uiStore.ts
interface UIState {
  // ... existing state
  fileDropCallback?: (files: FileList) => void;
}

interface UIActions {
  // ... existing actions
  setFileDropCallback: (callback: (files: FileList) => void) => void;
  handleFileDrop: (files: FileList) => void;
}

// Implementation:
setFileDropCallback: (callback) => set({ fileDropCallback: callback }),

handleFileDrop: (files) => {
  const { fileDropCallback } = get();
  if (fileDropCallback) {
    fileDropCallback(files);
  }
}
```

### Phase 3: Refactor Pipeline Store ✅ COMPLETE

**Required Changes:**
Remove all 22 instances of `useUIStore.getState()` and replace with state-only updates.

**Progress: 22/22 completed** 🎉

✅ **All refactoring completed:**
1. **Line 30**: Import removed
2. **Line 148**: Dynamic import fallback - Removed
3. **Line 293**: `processSingleStep` - Now updates lastStepInfo and shouldStopAutorun
4. **Line 522**: handleStepError - Now updates lastStepInfo and lastError
5. **Line 582**: Error handling - Now sets shouldStopAutorun
6. **Line 588**: handleReportGeneration - Updates pipeline state
7. **Line 621**: handleSuccessfulStep - Updates lastStepInfo
8. **Line 1078**: getNextStepDetails - Now takes parameters
9. **Line 1271**: processNextStep - Takes parameters, updates state
10. **Line 1306**: invalidateStateFromStep - Takes activeTranscriptIndex parameter
11. **Line 1338**: resetPipeline - Updates pipeline state directly
12. **Line 1361**: loadState - Removed UI updates
13. **Line 1366**: getSaveState - Takes parameters instead of reading stores
14. **Line 1388**: getPreviousStepDetails - Takes parameters
15. **Lines 1410-1450**: All selectors updated to take parameters
16. **Line 1453**: downloadOutput - Takes parameters
17. **Line 1574**: File upload - Updates pipeline state
18. **Line 1598**: handleDroppedFiles - Updates pipeline state
19. **Line 1612**: setActiveTranscriptByIndex - Removed (unused)
20. **Line 1638**: retryWithUserSeed - Takes parameters
21. **Line 151-159**: Removed getUIStoreSync helper
22. **All setTimeout UI updates**: Replaced with state updates

**New pipeline state fields needed:**
```typescript
interface PipelineState {
  // ... existing state
  lastStepInfo?: CurrentStepInfo;
  lastError?: string;
  lastHilContext?: HilContext;
  shouldStopAutorun?: boolean;
}
```

**Pattern to follow:**
```typescript
// Before:
const uiStore = useUIStore.getState();
uiStore.setCurrentStepInfo(info);

// After:
set(state => ({
  ...state,
  lastStepInfo: info // Store in pipeline state
}));
// App.tsx will listen to this change
```

### Phase 4: Update App.tsx ✅ COMPLETE (with fix)

**Required Changes:**
1. ✅ Call `initializeStores()` in useEffect on mount
2. ✅ Create listeners for pipeline state changes
3. ✅ Act as orchestrator between stores

**Critical Learning:** Order matters! useEffect hooks must be placed AFTER all variables they depend on are defined. The initial implementation had useEffect hooks before the store selectors, causing a temporal dead zone error.

**Implementation:**
```typescript
// In App.tsx
useEffect(() => {
  initializeStores();
}, []);

// Listen to pipeline changes
useEffect(() => {
  const unsubscribe = usePipelineStore.subscribe(
    (state) => state.lastStepInfo,
    (lastStepInfo) => {
      if (lastStepInfo) {
        setCurrentStepInfo(lastStepInfo);
      }
    }
  );
  return unsubscribe;
}, []);
```

## Critical Bug Found During Testing

### Issue: "Cannot access 'processSingleStep' before initialization"
**Problem:** The useEffect hooks were placed before the store selectors, causing a temporal dead zone error.
**Root Cause:** JavaScript hoisting - the useEffect dependency array referenced `processSingleStep` before it was extracted from the store.
**Solution:** Moved all useEffect hooks to after the store selectors are defined.

## Testing Checklist

- [x] No circular import warnings in console
- [x] HMR works after making changes to stores
- [ ] File drop functionality works
- [ ] All UI updates from pipeline actions work
- [ ] No race conditions during initialization
- [ ] Unit tests pass for both stores
- [x] App starts without "before initialization" errors

## Progress Tracking

### Completed
- [x] Initial analysis and dependency mapping
- [x] initializeStores function exists

### In Progress
- [ ] Adding setFileDropCallback to uiStore
- [ ] Removing dynamic import from uiStore

### TODO
- [ ] Remove all useUIStore.getState() from pipelineStore (22 instances)
- [ ] Update App.tsx to orchestrate stores
- [ ] Test the circular dependency is resolved
- [ ] Update unit tests

## Notes

The existing `initializeStores` function suggests someone already started this refactoring. We need to:
1. Complete the UI store changes
2. Systematically remove all UI store calls from pipeline store
3. Ensure App.tsx properly orchestrates the communication

## Next Steps

1. Check if `setFileDropCallback` exists in uiStore
2. If not, implement it
3. Remove the dynamic import of pipelineStore from uiStore
4. Start refactoring pipelineStore methods one by one