import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enableMapSet } from 'immer';
import { useTranscriptStore } from '../transcriptStore';
import type { RawTranscript, TranscriptProcessedData } from '../../../types';

// Enable Immer MapSet plugin
enableMapSet();

// Mock the storage adapter
vi.mock('../../utils/storage', () => {
  const mockStorage = {
    getItem: vi.fn(async (name) => null),
    setItem: vi.fn(async (name, value) => {
      // The real storage converts between strings and objects
      return undefined;
    }),
    removeItem: vi.fn(async (name) => undefined),
  };
  return {
    localForageStorage: mockStorage
  };
});

// Import after mocks are set up
import { localForageStorage } from '../../utils/storage';

// Type the mock
const mockLocalForageStorage = localForageStorage as {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

describe('TranscriptStore Integration Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset store to initial state
    useTranscriptStore.setState({
      rawTranscripts: [],
      processedData: new Map()
    });
    
    // Clear any persisted state
    mockLocalForageStorage.getItem.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('Store Persistence', () => {
    it('should initialize persist middleware', () => {
      // @ts-ignore - accessing internal persist api
      expect(useTranscriptStore.persist).toBeDefined();
      // @ts-ignore
      expect(useTranscriptStore.persist.getOptions).toBeDefined();
      // @ts-ignore
      const options = useTranscriptStore.persist.getOptions();
      expect(options.name).toBe('transcript-storage');
      expect(options.version).toBe(1);
    });
    it('should persist state changes to storage using the correct key', async () => {
      // Add data to trigger persistence
      const transcript: RawTranscript = {
        id: 'test-123',
        name: 'test.txt',
        content: 'This is test content',
        uploadedAt: Date.now()
      };

      // Directly update state to trigger persistence
      useTranscriptStore.setState({
        rawTranscripts: [transcript],
        processedData: new Map([
          ['test-123', {
            id: 'test-123',
            filename: 'test.txt',
            isFullyProcessedSpecificDiachronic: false,
            isFullyProcessedSpecificSynchronic: false
          } as TranscriptProcessedData]
        ])
      });

      // Advance timers to trigger debounced persist
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Verify data was persisted with correct key
      expect(mockLocalForageStorage.setItem).toHaveBeenCalledWith(
        'transcript-storage',
        expect.any(Object)
      );

      // Verify the persisted data structure
      const calls = mockLocalForageStorage.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeDefined();
      
      if (lastCall) {
        const [key, value] = lastCall;
        expect(key).toBe('transcript-storage');
        // Zustand persist sends a string, but our adapter parses it
        const data = typeof value === 'string' ? JSON.parse(value) : value;
        expect(data).toMatchObject({
          version: 1,
          state: {
            rawTranscripts: expect.any(Array),
            processedData: expect.any(Object) // Map gets serialized
          }
        });
      }
    });

    it.skip('should restore state from storage on rehydration', async () => {
      // Mock existing data in storage
      const storedData = {
        version: 1,
        state: {
          rawTranscripts: [{
            id: 'stored-123',
            name: 'stored.txt',
            content: 'Stored content',
            uploadedAt: 1234567890
          }],
          processedData: [
            ['stored-123', {
              id: 'stored-123',
              filename: 'stored.txt',
              isFullyProcessedSpecificDiachronic: true,
              isFullyProcessedSpecificSynchronic: false,
              p1_1_output: { some: 'data' }
            }]
          ]
        }
      };

      // Return as JSON string since that's what the storage adapter returns
      mockLocalForageStorage.getItem.mockResolvedValueOnce(JSON.stringify(storedData));

      // Reset store state first
      useTranscriptStore.setState({
        rawTranscripts: [],
        processedData: new Map()
      });

      // Trigger rehydration
      // @ts-ignore - accessing internal persist api
      await useTranscriptStore.persist.rehydrate();
      
      // Wait for async operations
      await vi.runAllTimersAsync();

      // Check if getItem was called
      expect(mockLocalForageStorage.getItem).toHaveBeenCalledWith('transcript-storage');

      // Verify state was restored
      const state = useTranscriptStore.getState();
      expect(state.rawTranscripts).toHaveLength(1);
      expect(state.rawTranscripts[0].id).toBe('stored-123');
      expect(state.rawTranscripts[0].name).toBe('stored.txt');
      
      // Verify Map was restored correctly
      expect(state.processedData).toBeInstanceOf(Map);
      expect(state.processedData.size).toBe(1);
      expect(state.processedData.has('stored-123')).toBe(true);
      
      const processedData = state.processedData.get('stored-123');
      expect(processedData?.isFullyProcessedSpecificDiachronic).toBe(true);
      expect(processedData?.p1_1_output).toEqual({ some: 'data' });
      
    });

    it('should persist a payload with an undefined state when the store is empty', async () => {
      // Clear any previous mock calls
      mockLocalForageStorage.setItem.mockClear();

      // Ensure store is empty
      useTranscriptStore.setState({
        rawTranscripts: [],
        processedData: new Map(),
      });

      // Advance timers to trigger debounced persist
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // The store is configured via `partialize` to return undefined for an empty state.
      // The persist middleware then calls setItem with a value where `state` is undefined.
      expect(mockLocalForageStorage.setItem).toHaveBeenCalled();

      const calls = mockLocalForageStorage.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      const [key, value] = lastCall;
      expect(key).toBe('transcript-storage');
      expect(value.state).toBeUndefined();
    });
  });

  describe('File Processing Actions', () => {
    it('should handle File objects and extract content', async () => {
      // Create a real File object
      const fileContent = 'This is the file content';
      const file = new File([fileContent], 'test-file.txt', { type: 'text/plain' });
      
      // Mock the File.text() method - need to mock the prototype
      const textMock = vi.fn().mockResolvedValue(fileContent);
      Object.defineProperty(file, 'text', {
        value: textMock,
        configurable: true
      });

      // Add transcript using the file
      const store = useTranscriptStore.getState();
      await store.addTranscripts([file]);

      // Verify transcript was added correctly
      const state = useTranscriptStore.getState();
      expect(state.rawTranscripts).toHaveLength(1);
      expect(state.rawTranscripts[0]).toMatchObject({
        id: expect.stringMatching(/^transcript-\d+-[a-z0-9]+$/),
        name: 'test-file.txt',
        content: fileContent,
        uploadedAt: expect.any(Number)
      });

      // Verify processed data was initialized
      const transcriptId = state.rawTranscripts[0].id;
      expect(state.processedData.has(transcriptId)).toBe(true);
      expect(state.processedData.get(transcriptId)).toMatchObject({
        id: transcriptId,
        filename: 'test-file.txt',
        isFullyProcessedSpecificDiachronic: false,
        isFullyProcessedSpecificSynchronic: false
      });
    });

    it('should handle multiple files concurrently', async () => {
      const files = [
        new File(['Content 1'], 'file1.txt', { type: 'text/plain' }),
        new File(['Content 2'], 'file2.txt', { type: 'text/plain' }),
        new File(['Content 3'], 'file3.txt', { type: 'text/plain' })
      ];

      // Mock all file text() methods
      files.forEach((file, index) => {
        const textMock = vi.fn().mockResolvedValue(`Content ${index + 1}`);
        Object.defineProperty(file, 'text', {
          value: textMock,
          configurable: true
        });
      });

      const store = useTranscriptStore.getState();
      await store.addTranscripts(files);

      const state = useTranscriptStore.getState();
      expect(state.rawTranscripts).toHaveLength(3);
      expect(state.processedData.size).toBe(3);

      // Verify each file was processed correctly
      state.rawTranscripts.forEach((transcript, index) => {
        expect(transcript.name).toBe(`file${index + 1}.txt`);
        expect(transcript.content).toBe(`Content ${index + 1}`);
        expect(state.processedData.has(transcript.id)).toBe(true);
      });
    });
  });

  describe('State Management Actions', () => {
    it('should update processed data correctly', () => {
      const transcriptId = 'test-id';
      
      // Initial update
      const store = useTranscriptStore.getState();
      store.updateProcessedData(transcriptId, {
        id: transcriptId,
        filename: 'test.txt',
        p1_1_output: { initial: 'data' }
      });

      let state = useTranscriptStore.getState();
      expect(state.processedData.get(transcriptId)?.p1_1_output).toEqual({ initial: 'data' });

      // Merge update
      store.updateProcessedData(transcriptId, {
        p1_2_output: { additional: 'data' },
        isFullyProcessedSpecificDiachronic: true
      });

      state = useTranscriptStore.getState();
      const processedData = state.processedData.get(transcriptId);
      expect(processedData?.p1_1_output).toEqual({ initial: 'data' });
      expect(processedData?.p1_2_output).toEqual({ additional: 'data' });
      expect(processedData?.isFullyProcessedSpecificDiachronic).toBe(true);
    });

    it('should remove transcript and its processed data', () => {
      const transcript: RawTranscript = {
        id: 'remove-test',
        name: 'remove.txt',
        content: 'To be removed',
        uploadedAt: Date.now()
      };

      // Add transcript
      const store = useTranscriptStore.getState();
      store.addTranscriptsSync([transcript]);
      store.updateProcessedData('remove-test', {
        id: 'remove-test',
        filename: 'remove.txt',
        p1_1_output: { some: 'data' }
      });

      // Verify it was added
      let state = useTranscriptStore.getState();
      expect(state.rawTranscripts).toHaveLength(1);
      expect(state.processedData.has('remove-test')).toBe(true);

      // Remove it
      store.removeTranscript('remove-test');

      // Verify removal
      state = useTranscriptStore.getState();
      expect(state.rawTranscripts).toHaveLength(0);
      expect(state.processedData.has('remove-test')).toBe(false);
    });

    it('should reset store to initial state', () => {
      // Add some data
      const store = useTranscriptStore.getState();
      store.addTranscriptsSync([{
        id: 'test',
        name: 'test.txt',
        content: 'content',
        uploadedAt: Date.now()
      }]);
      store.updateProcessedData('test', {
        id: 'test',
        filename: 'test.txt'
      });

      // Verify data exists
      let state = useTranscriptStore.getState();
      expect(state.rawTranscripts).toHaveLength(1);
      expect(state.processedData.size).toBe(1);

      // Reset
      store.reset();

      // Verify reset
      state = useTranscriptStore.getState();
      expect(state.rawTranscripts).toHaveLength(0);
      expect(state.processedData).toBeInstanceOf(Map);
      expect(state.processedData.size).toBe(0);
    });
  });

  describe('Selector Functions', () => {
    it('should find transcript by id', () => {
      const transcripts: RawTranscript[] = [
        { id: '1', name: 'first.txt', content: 'First', uploadedAt: 1 },
        { id: '2', name: 'second.txt', content: 'Second', uploadedAt: 2 },
        { id: '3', name: 'third.txt', content: 'Third', uploadedAt: 3 }
      ];

      const store = useTranscriptStore.getState();
      store.addTranscriptsSync(transcripts);

      expect(store.getTranscriptById('2')).toEqual(transcripts[1]);
      expect(store.getTranscriptById('999')).toBeUndefined();
    });

    it('should find processed data by id', () => {
      const store = useTranscriptStore.getState();
      
      store.updateProcessedData('test-id', {
        id: 'test-id',
        filename: 'test.txt',
        p1_1_output: { result: 'data' }
      });

      const found = store.getProcessedDataById('test-id');
      expect(found).toMatchObject({
        id: 'test-id',
        filename: 'test.txt',
        p1_1_output: { result: 'data' }
      });

      expect(store.getProcessedDataById('non-existent')).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      const file = new File(['content'], 'error.txt', { type: 'text/plain' });
      
      // Mock file.text() to throw an error
      const textMock = vi.fn().mockRejectedValue(new Error('File read error'));
      Object.defineProperty(file, 'text', {
        value: textMock,
        configurable: true
      });
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const store = useTranscriptStore.getState();
      
      // Should throw the error up to the caller
      await expect(store.addTranscripts([file])).rejects.toThrow('File read error');
      
      // State should remain unchanged
      const state = useTranscriptStore.getState();
      expect(state.rawTranscripts).toHaveLength(0);
      expect(state.processedData.size).toBe(0);

      consoleErrorSpy.mockRestore();
    });

    it('should handle removing non-existent transcript gracefully', () => {
      const store = useTranscriptStore.getState();
      
      // Should not throw
      expect(() => {
        store.removeTranscript('non-existent-id');
      }).not.toThrow();

      // State should remain empty
      const state = useTranscriptStore.getState();
      expect(state.rawTranscripts).toHaveLength(0);
      expect(state.processedData.size).toBe(0);
    });
  });
});