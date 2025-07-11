import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { localForageStorage } from '../storage';
import { 
  runStorageMigration, 
  transformV1ToV2, 
  STORAGE_VERSION, 
  MIGRATION_VERSION_KEY 
} from '../storeMigration';

// Mock localForageStorage
vi.mock('../storage', () => ({
  localForageStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  }
}));

describe('Storage Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Version Detection', () => {
    test('should detect no migration needed when version is current', async () => {
      // Red: Test should fail because runStorageMigration doesn't exist yet
      const mockGetItem = vi.mocked(localForageStorage.getItem);
      mockGetItem.mockResolvedValue(STORAGE_VERSION);

      const result = await runStorageMigration();

      expect(result).toBe(false); // false = no migration needed
      expect(mockGetItem).toHaveBeenCalledWith(MIGRATION_VERSION_KEY);
    });

    test('should detect migration needed when version is missing', async () => {
      // Red: Test should fail because runStorageMigration doesn't exist yet
      const mockGetItem = vi.mocked(localForageStorage.getItem);
      mockGetItem.mockResolvedValue(null);

      const result = await runStorageMigration();

      expect(result).toBe(true); // true = migration performed
    });

    test('should detect migration needed when version is outdated', async () => {
      // Red: Test should fail because runStorageMigration doesn't exist yet
      const mockGetItem = vi.mocked(localForageStorage.getItem);
      mockGetItem.mockResolvedValue(1); // Old version

      const result = await runStorageMigration();

      expect(result).toBe(true); // true = migration performed
    });
  });

  describe('V1 to V2 Data Transformation', () => {
    test('should transform empty V1 state to V2 format', () => {
      // Red: Test should fail because transformV1ToV2 doesn't exist yet
      const v1State = {
        rawTranscripts: [],
        processedData: new Map(),
        genericAnalysisState: {},
        promptHistory: [],
        totalInputTokens: 0,
        totalOutputTokens: 0
      };

      const result = transformV1ToV2(v1State);

      expect(result).toEqual({
        transcript: {
          rawTranscripts: [],
          processedData: new Map()
        },
        analysis: {
          genericAnalysisState: {}
        },
        prompt: {
          promptHistory: [],
          totalInputTokens: 0,
          totalOutputTokens: 0
        }
      });
    });

    test('should transform V1 state with data to V2 format', () => {
      // Red: Test should fail because transformV1ToV2 doesn't exist yet
      const mockProcessedData = new Map([
        ['transcript1', { id: 'transcript1', text: 'Hello world' }]
      ]);

      const v1State = {
        rawTranscripts: [{ id: 'transcript1', name: 'test.txt', content: 'Hello world' }],
        processedData: mockProcessedData,
        genericAnalysisState: { currentStep: 'P3_1' },
        promptHistory: [{ id: '1', timestamp: Date.now(), prompt: 'test' }],
        totalInputTokens: 100,
        totalOutputTokens: 50
      };

      const result = transformV1ToV2(v1State);

      expect(result.transcript.rawTranscripts).toHaveLength(1);
      expect(result.transcript.processedData).toEqual(mockProcessedData);
      expect(result.analysis.genericAnalysisState).toEqual({ currentStep: 'P3_1' });
      expect(result.prompt.promptHistory).toHaveLength(1);
      expect(result.prompt.totalInputTokens).toBe(100);
      expect(result.prompt.totalOutputTokens).toBe(50);
    });

    test('should handle missing fields in V1 state gracefully', () => {
      // Red: Test should fail because transformV1ToV2 doesn't exist yet
      const v1State = {
        rawTranscripts: [{ id: 'test', name: 'test.txt', content: 'test' }]
        // Missing other fields
      };

      const result = transformV1ToV2(v1State);

      expect(result.transcript.rawTranscripts).toHaveLength(1);
      expect(result.transcript.processedData).toBeInstanceOf(Map);
      expect(result.analysis.genericAnalysisState).toEqual({});
      expect(result.prompt.promptHistory).toEqual([]);
      expect(result.prompt.totalInputTokens).toBe(0);
      expect(result.prompt.totalOutputTokens).toBe(0);
    });
  });

  describe('Migration Execution', () => {
    test('should perform full migration when V1 data exists', async () => {
      // Red: Test should fail because runStorageMigration doesn't exist yet
      const mockGetItem = vi.mocked(localForageStorage.getItem);
      const mockSetItem = vi.mocked(localForageStorage.setItem);

      // Mock version check (no current version)
      mockGetItem.mockImplementation((key) => {
        if (key === MIGRATION_VERSION_KEY) return Promise.resolve(null);
        if (key === 'pipeline-storage') return Promise.resolve({
          version: 0,
          state: {
            rawTranscripts: [],
            processedData: new Map(),
            genericAnalysisState: {},
            promptHistory: [],
            totalInputTokens: 0,
            totalOutputTokens: 0
          }
        });
        return Promise.resolve(null);
      });

      const result = await runStorageMigration();

      expect(result).toBe(true);
      expect(mockSetItem).toHaveBeenCalledWith('transcript-storage', expect.any(Object));
      expect(mockSetItem).toHaveBeenCalledWith('analysis-storage', expect.any(Object));
      expect(mockSetItem).toHaveBeenCalledWith('prompt-history-storage', expect.any(Object));
      expect(mockSetItem).toHaveBeenCalledWith(MIGRATION_VERSION_KEY, STORAGE_VERSION);
    });

    test('should handle migration when V1 data is missing', async () => {
      // Red: Test should fail because runStorageMigration doesn't exist yet
      const mockGetItem = vi.mocked(localForageStorage.getItem);
      const mockSetItem = vi.mocked(localForageStorage.setItem);

      // Mock version check (no current version) and no V1 data
      mockGetItem.mockImplementation((key) => {
        if (key === MIGRATION_VERSION_KEY) return Promise.resolve(null);
        return Promise.resolve(null);
      });

      const result = await runStorageMigration();

      expect(result).toBe(true);
      expect(mockSetItem).toHaveBeenCalledWith(MIGRATION_VERSION_KEY, STORAGE_VERSION);
    });

    test('should be idempotent - multiple calls should not cause issues', async () => {
      // Red: Test should fail because runStorageMigration doesn't exist yet
      const mockGetItem = vi.mocked(localForageStorage.getItem);
      const mockSetItem = vi.mocked(localForageStorage.setItem);

      // First call - migration needed
      mockGetItem.mockResolvedValue(null);
      
      await runStorageMigration();
      await runStorageMigration();

      // Version should be set on first call, then migration skipped
      expect(mockSetItem).toHaveBeenCalledWith(MIGRATION_VERSION_KEY, STORAGE_VERSION);
    });
  });
});