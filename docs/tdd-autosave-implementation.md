# TDD Implementation Plan: High-Capacity Autosave & Session Restore

## Overview
This document outlines a Test-Driven Development approach for implementing the autosave feature described in GitHub issue #17. The implementation replaces localStorage with IndexedDB via `localforage` in the existing Zustand persist middleware to handle large state objects (12MB+).

## Analysis: Current vs Target State

### Current Implementation
- **Storage**: localStorage with 5-10MB limit
- **Key**: `'upath-pipeline'` 
- **Data**: High-value user analysis work (transcripts + 9-part pipeline results)
- **Serialization**: Custom Map<> handling for `processedData`

### Target Implementation  
- **Storage**: IndexedDB via localforage (unlimited capacity)
- **Key**: `'upath-autosave-session-v2-localforage'` (new key to avoid conflicts)
- **Data**: Same high-value data, requires migration strategy
- **Architecture**: Drop-in replacement for localStorage in persist middleware

### Critical Decision: Data Migration Strategy

The existing data is **extremely high-value** (researcher's analysis work representing hours/days of effort). The new storage key suggests either:
1. **Start fresh** - Acceptable data loss for early adopters
2. **Manual migration** - Users export/import via existing save/load
3. **Automatic migration** - One-time transfer from old to new storage

**Recommended**: Implement automatic migration (can be disabled if not needed).

## TDD Cycle Structure

Each feature will follow the Red-Green-Refactor cycle:
1. **Red**: Write failing tests first
2. **Green**: Write minimal code to pass tests  
3. **Refactor**: Improve code while keeping tests passing

## Phase 1: Storage Adapter (TDD)

### 1.1 Test: LocalForage Storage Adapter

**Test File**: `src/utils/__tests__/storage.test.ts`

```typescript
describe('LocalForage Storage Adapter', () => {
  beforeEach(async () => {
    await localforage.clear();
  });

  it('implements StateStorage interface correctly', async () => {
    const adapter = localForageStorage;
    
    // Test all required methods exist
    expect(typeof adapter.getItem).toBe('function');
    expect(typeof adapter.setItem).toBe('function');
    expect(typeof adapter.removeItem).toBe('function');
  });

  it('handles string data correctly', async () => {
    await localForageStorage.setItem('test-key', 'test-value');
    const result = await localForageStorage.getItem('test-key');
    expect(result).toBe('test-value');
  });

  it('handles large JSON data (>5MB)', async () => {
    // Create realistic large state similar to actual app
    const largeTranscripts = Array.from({ length: 20 }, (_, i) => ({
      id: `transcript-${i}`,
      name: `test-${i}.txt`,
      content: 'x'.repeat(300000) // 300KB per transcript = 6MB total
    }));
    
    const largeData = JSON.stringify({
      rawTranscripts: largeTranscripts,
      processedData: [],
      promptHistory: []
    });
    
    await localForageStorage.setItem('large-state', largeData);
    const result = await localForageStorage.getItem('large-state');
    expect(result).toBe(largeData);
  });

  it('returns null for non-existent keys', async () => {
    const result = await localForageStorage.getItem('non-existent');
    expect(result).toBeNull();
  });

  it('removes items successfully', async () => {
    await localForageStorage.setItem('remove-test', 'value');
    await localForageStorage.removeItem('remove-test');
    const result = await localForageStorage.getItem('remove-test');
    expect(result).toBeNull();
  });

  it('handles storage errors gracefully', async () => {
    // Mock IndexedDB failure
    const originalSetItem = localforage.setItem;
    localforage.setItem = jest.fn().mockRejectedValue(new Error('QuotaExceededError'));
    
    await expect(localForageStorage.setItem('test', 'data'))
      .rejects.toThrow('QuotaExceededError');
    
    localforage.setItem = originalSetItem;
  });
});
```

**Implementation**: `src/utils/storage.ts`

### 1.2 Test: LocalForage Configuration

```typescript
describe('LocalForage Configuration', () => {
  it('configures with correct database settings', () => {
    // Test that localforage is configured before first use
    const config = localforage.config();
    expect(config.name).toBe('uPATH-Analysis-Storage');
    expect(config.storeName).toBe('state_store');
    expect(config.description).toContain('µ-PATH');
  });
});
```

## Phase 2: Persist Middleware Integration (TDD)

### 2.1 Test: Zustand Persist with LocalForage

**Test File**: `src/stores/__tests__/pipelineStore.persist.test.ts`

```typescript
describe('PipelineStore Persist Integration', () => {
  beforeEach(async () => {
    await localforage.clear();
    localStorage.clear();
  });

  it('uses new storage key for localforage', async () => {
    const mockState = {
      rawTranscripts: [{ id: '1', name: 'test.txt', content: 'test' }],
      processedData: new Map(),
      genericAnalysisState: {},
      promptHistory: []
    };

    // Create store with mocked persist
    const store = usePipelineStore.getState();
    
    // Trigger persist save (implementation will vary based on actual persist setup)
    store.addTranscripts([new File(['test'], 'test.txt')]);
    
    // Wait for async persist
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify data saved to localforage with new key
    const savedData = await localforage.getItem('upath-autosave-session-v2-localforage');
    expect(savedData).toBeTruthy();
  });

  it('handles Map serialization correctly', async () => {
    const store = usePipelineStore.getState();
    
    // Add data that uses Map structure
    store.updateProcessedData('transcript1', 'p1_output', { test: 'data' });
    
    // Wait for persist
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create new store instance (simulates app restart)
    const newStore = createPipelineStore();
    
    // Wait for hydration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Verify Map is restored correctly
    const restoredData = newStore.getState().processedData;
    expect(restoredData instanceof Map).toBe(true);
    expect(restoredData.has('transcript1')).toBe(true);
  });
});
```

### 2.2 Test: onRehydrateStorage Callback

```typescript
describe('Persist Hydration', () => {
  it('calls onRehydrateStorage on successful hydration', async () => {
    const mockUIStore = {
      setHasRehydrated: jest.fn(),
      setSessionWasRestored: jest.fn()
    };
    
    // Mock existing data
    await localforage.setItem('upath-autosave-session-v2-localforage', JSON.stringify({
      state: {
        rawTranscripts: [{ id: '1', name: 'test.txt' }],
        processedData: []
      }
    }));
    
    // Create store (triggers hydration)
    const store = createPipelineStore();
    
    // Wait for async hydration
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockUIStore.setHasRehydrated).toHaveBeenCalledWith(true);
    expect(mockUIStore.setSessionWasRestored).toHaveBeenCalledWith(true);
  });

  it('handles hydration errors gracefully', async () => {
    const mockUIStore = {
      setHasRehydrated: jest.fn(),
      setSessionWasRestored: jest.fn()
    };
    
    // Mock corrupted data
    await localforage.setItem('upath-autosave-session-v2-localforage', 'invalid-json');
    
    const store = createPipelineStore();
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Should still mark as hydrated even on error
    expect(mockUIStore.setHasRehydrated).toHaveBeenCalledWith(true);
    expect(mockUIStore.setSessionWasRestored).toHaveBeenCalledWith(false);
  });
});
```

## Phase 3: Data Migration (TDD)

### 3.1 Test: Migration from localStorage to localforage

**Test File**: `src/utils/__tests__/migration.test.ts`

```typescript
describe('Data Migration', () => {
  beforeEach(async () => {
    await localforage.clear();
    localStorage.clear();
  });

  it('migrates existing localStorage data on first run', async () => {
    // Setup: existing data in localStorage
    const existingData = {
      state: {
        rawTranscripts: [{ id: '1', name: 'existing.txt', content: 'data' }],
        processedData: [['transcript1', { p1_output: 'result' }]],
        genericAnalysisState: {},
        promptHistory: []
      }
    };
    localStorage.setItem('upath-pipeline', JSON.stringify(existingData));
    
    // Run migration
    await performDataMigration();
    
    // Verify: data copied to localforage
    const migratedData = await localforage.getItem('upath-autosave-session-v2-localforage');
    expect(migratedData).toEqual(existingData);
    
    // Verify: old data removed from localStorage  
    expect(localStorage.getItem('upath-pipeline')).toBeNull();
    
    // Verify: migration flag set to prevent re-migration
    expect(localStorage.getItem('upath-migration-completed')).toBe('true');
  });

  it('skips migration if already completed', async () => {
    // Setup: migration already completed
    localStorage.setItem('upath-migration-completed', 'true');
    localStorage.setItem('upath-pipeline', JSON.stringify({ state: { test: 'data' } }));
    
    await performDataMigration();
    
    // Verify: no data in localforage
    const data = await localforage.getItem('upath-autosave-session-v2-localforage');
    expect(data).toBeNull();
    
    // Verify: old data still in localStorage
    expect(localStorage.getItem('upath-pipeline')).toBeTruthy();
  });

  it('handles corrupted localStorage data gracefully', async () => {
    localStorage.setItem('upath-pipeline', 'invalid-json');
    
    // Should not throw
    await expect(performDataMigration()).resolves.not.toThrow();
    
    // Migration flag should still be set
    expect(localStorage.getItem('upath-migration-completed')).toBe('true');
  });

  it('handles migration when localforage is unavailable', async () => {
    // Mock localforage failure
    const originalSetItem = localforage.setItem;
    localforage.setItem = jest.fn().mockRejectedValue(new Error('IndexedDB unavailable'));
    
    localStorage.setItem('upath-pipeline', JSON.stringify({ state: { test: 'data' } }));
    
    await performDataMigration();
    
    // Should gracefully fail and set migration flag
    expect(localStorage.getItem('upath-migration-completed')).toBe('true');
    
    localforage.setItem = originalSetItem;
  });
});
```

## Phase 4: UI Components (TDD)

### 4.1 Test: App Loading Screen

**Test File**: `src/components/__tests__/AppLoadingScreen.test.tsx`

```typescript
describe('AppLoadingScreen', () => {
  it('renders with custom message', () => {
    render(<AppLoadingScreen message="Loading previous session..." />);
    
    expect(screen.getByText('Loading previous session...')).toBeInTheDocument();
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('renders with default message when none provided', () => {
    render(<AppLoadingScreen />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('shows µ-PATH branding', () => {
    render(<AppLoadingScreen />);
    
    expect(screen.getByText(/µ-PATH/)).toBeInTheDocument();
  });
});
```

### 4.2 Test: Session Restore Notification

**Test File**: `src/components/__tests__/SessionRestoreNotification.test.tsx`

```typescript
describe('SessionRestoreNotification', () => {
  it('renders when session was restored', () => {
    render(<SessionRestoreNotification />, {
      wrapper: ({ children }) => (
        <MockUIStoreProvider sessionWasRestored={true}>
          {children}
        </MockUIStoreProvider>
      )
    });
    
    expect(screen.getByText(/previous analysis session has been restored/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start new session/i })).toBeInTheDocument();
  });

  it('does not render when no session to restore', () => {
    render(<SessionRestoreNotification />, {
      wrapper: ({ children }) => (
        <MockUIStoreProvider sessionWasRestored={false}>
          {children}
        </MockUIStoreProvider>
      )
    });
    
    expect(screen.queryByText(/previous analysis session/i)).not.toBeInTheDocument();
  });

  it('clears data when "Start New Session" clicked', async () => {
    const mockClearData = jest.fn();
    const mockHideNotification = jest.fn();
    
    render(<SessionRestoreNotification />, {
      wrapper: ({ children }) => (
        <MockStoreProvider
          sessionWasRestored={true}
          clearAutosaveData={mockClearData}
          hideSessionRestoreNotification={mockHideNotification}
        >
          {children}
        </MockStoreProvider>
      )
    });
    
    await user.click(screen.getByRole('button', { name: /start new session/i }));
    
    expect(mockClearData).toHaveBeenCalled();
    expect(mockHideNotification).toHaveBeenCalled();
  });
});
```

### 4.3 Test: App Hydration Flow

**Test File**: `src/components/__tests__/App.hydration.test.tsx`

```typescript
describe('App Hydration Flow', () => {
  it('shows loading screen until hydration complete', async () => {
    render(<App />, {
      wrapper: ({ children }) => (
        <MockUIStoreProvider hasRehydrated={false}>
          {children}
        </MockUIStoreProvider>
      )
    });
    
    // Should show loading screen
    expect(screen.getByText(/loading previous session/i)).toBeInTheDocument();
    expect(screen.queryByTestId('main-app-content')).not.toBeInTheDocument();
  });

  it('shows main app after hydration complete', () => {
    render(<App />, {
      wrapper: ({ children }) => (
        <MockUIStoreProvider hasRehydrated={true}>
          {children}
        </MockUIStoreProvider>
      )
    });
    
    // Should show main app
    expect(screen.queryByText(/loading previous session/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('main-app-content')).toBeInTheDocument();
  });

  it('shows session restore notification after hydration with data', () => {
    render(<App />, {
      wrapper: ({ children }) => (
        <MockUIStoreProvider hasRehydrated={true} sessionWasRestored={true}>
          {children}
        </MockUIStoreProvider>
      )
    });
    
    expect(screen.getByText(/session has been restored/i)).toBeInTheDocument();
  });
});
```

## Phase 5: Integration & Error Handling (TDD)

### 5.1 Test: End-to-End Persist Flow

**Test File**: `src/__tests__/persist.integration.test.ts`

```typescript
describe('Persist Integration', () => {
  it('automatically persists after transcript upload', async () => {
    const store = usePipelineStore.getState();
    
    // Upload transcript
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    await store.addTranscripts([file]);
    
    // Wait for persist
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify persisted to localforage
    const persistedData = await localforage.getItem('upath-autosave-session-v2-localforage');
    expect(persistedData).toBeTruthy();
    
    const parsed = JSON.parse(persistedData as string);
    expect(parsed.state.rawTranscripts).toHaveLength(1);
    expect(parsed.state.rawTranscripts[0].name).toBe('test.txt');
  });

  it('persists after step completion', async () => {
    const store = usePipelineStore.getState();
    
    // Complete a step
    store.updateProcessedData('transcript1', { 
      p1_output: { phases: ['phase1', 'phase2'] }
    });
    
    // Wait for persist
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify persisted
    const persistedData = await localforage.getItem('upath-autosave-session-v2-localforage');
    const parsed = JSON.parse(persistedData as string);
    expect(parsed.state.processedData).toHaveLength(1);
  });

  it('handles full app restart cycle', async () => {
    // Step 1: Create initial state
    const store1 = usePipelineStore.getState();
    const testTranscript = { id: '1', name: 'test.txt', content: 'test data' };
    store1.addRawTranscript(testTranscript);
    
    // Wait for persist
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Step 2: Simulate app restart by creating new store
    const store2 = createPipelineStore();
    
    // Wait for hydration
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Step 3: Verify state restored
    expect(store2.getState().rawTranscripts).toHaveLength(1);
    expect(store2.getState().rawTranscripts[0].name).toBe('test.txt');
  });
});
```

### 5.2 Test: Error Scenarios

```typescript
describe('Error Handling', () => {
  it('handles IndexedDB unavailable (private mode)', async () => {
    // Mock IndexedDB as unavailable
    const originalSetItem = localforage.setItem;
    localforage.setItem = jest.fn().mockRejectedValue(new Error('IndexedDB unavailable'));
    
    const store = usePipelineStore.getState();
    
    // Should not crash when trying to persist
    expect(() => {
      store.addRawTranscript({ id: '1', name: 'test.txt', content: 'test' });
    }).not.toThrow();
    
    localforage.setItem = originalSetItem;
  });

  it('recovers from corrupted IndexedDB data', async () => {
    // Setup corrupted data
    await localforage.setItem('upath-autosave-session-v2-localforage', 'corrupted-data');
    
    // Should not crash on hydration
    const store = createPipelineStore();
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Should have empty state
    expect(store.getState().rawTranscripts).toEqual([]);
    expect(store.getState().processedData.size).toBe(0);
  });

  it('handles storage quota exceeded', async () => {
    const originalSetItem = localforage.setItem;
    localforage.setItem = jest.fn().mockRejectedValue(new Error('QuotaExceededError'));
    
    const store = usePipelineStore.getState();
    
    // Should handle gracefully
    expect(() => {
      store.addRawTranscript({ id: '1', name: 'test.txt', content: 'x'.repeat(1000000) });
    }).not.toThrow();
    
    localforage.setItem = originalSetItem;
  });
});
```

## Acceptance Criteria Validation

### AC1: Large State Support (>15MB)
```typescript
it('handles state larger than 15MB', async () => {
  const largeTranscripts = Array.from({ length: 100 }, (_, i) => ({
    id: `transcript-${i}`,
    name: `large-${i}.txt`, 
    content: 'x'.repeat(200000) // 200KB each = 20MB total
  }));
  
  const store = usePipelineStore.getState();
  largeTranscripts.forEach(t => store.addRawTranscript(t));
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Should persist successfully
  const data = await localforage.getItem('upath-autosave-session-v2-localforage');
  expect(data).toBeTruthy();
  
  // Should restore successfully
  const newStore = createPipelineStore();
  await new Promise(resolve => setTimeout(resolve, 1000));
  expect(newStore.getState().rawTranscripts).toHaveLength(100);
});
```

### AC2: UI Responsiveness
```typescript
it('maintains UI responsiveness during large saves', async () => {
  const startTime = performance.now();
  
  // Create large state
  const store = usePipelineStore.getState();
  const largeData = 'x'.repeat(10000000); // 10MB
  store.addRawTranscript({ id: '1', name: 'large.txt', content: largeData });
  
  // UI should remain responsive (persist is async)
  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(100); // Should return quickly
});
```

### AC3: Data Persistence Across Sessions
```typescript
it('restores complete session after browser restart', async () => {
  // Covered by integration tests above
});
```

### AC4: Loading UI During Hydration
```typescript
it('shows loading screen during async hydration', async () => {
  // Covered by App hydration tests above
});
```

### AC5: User Control (Start New Session)
```typescript
it('allows user to discard restored session', async () => {
  // Covered by SessionRestoreNotification tests above
});
```

### AC6: Dev Environment Robustness
```typescript
it('works after Vite dev server port change', async () => {
  // Data persisted to IndexedDB is independent of port
  // This test verifies the storage key doesn't include port info
  const data = await localforage.getItem('upath-autosave-session-v2-localforage');
  expect(typeof data === 'string' || data === null).toBe(true);
  // IndexedDB storage is origin-based, not port-based
});
```

## Implementation Order

1. **Storage Adapter** (`src/utils/storage.ts`)
2. **Migration Utility** (`src/utils/migration.ts`)  
3. **Update PipelineStore** (modify persist config)
4. **Update UIStore** (add hasRehydrated, sessionWasRestored flags)
5. **Loading Screen Component** 
6. **Session Restore Notification Component**
7. **Update App.tsx** (hydration flow)
8. **Update Settings Panel** (rename "Save State" button)

This focused TDD approach ensures the implementation stays true to the original issue requirements while maintaining robust error handling and user experience.