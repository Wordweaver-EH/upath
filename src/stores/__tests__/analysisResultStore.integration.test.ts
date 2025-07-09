import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enableMapSet } from 'immer';
import { useAnalysisResultStore } from '../analysisResultStore';
import type { GenericAnalysisState, P3_1_Output, P3_2_Output } from '../../../types';

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

describe('AnalysisResultStore Integration Tests', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Reset store to initial state
    useAnalysisResultStore.setState({
      genericAnalysisState: {
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false,
        isRefinementDone: false,
        isCausalModelingDone: false,
        isReportGenerated: false
      }
    });
    
    // Clear any persisted state
    mockLocalForageStorage.getItem.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllTimers();
  });

  describe('Store Persistence', () => {
    it('should persist state changes to storage using the correct key', async () => {
      // Add analysis results to trigger persistence
      const analysisUpdate: Partial<GenericAnalysisState> = {
        p3_1_output: {
          transcript_id: 'test-123',
          raw_diachronic_units: [
            {
              unit_id: 'rdu_1',
              description: 'Test unit',
              source_segment_ids: ['seg_1']
            }
          ],
          independent_variable_details: 'Test IV',
          dependent_variable_focus: ['test_dv']
        } as P3_1_Output,
        isFullyProcessedGenericDiachronic: true
      };

      // Update state to trigger persistence
      useAnalysisResultStore.setState({
        genericAnalysisState: {
          ...useAnalysisResultStore.getState().genericAnalysisState,
          ...analysisUpdate
        }
      });

      // Advance timers to trigger debounced persist
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Verify data was persisted with correct key
      expect(mockLocalForageStorage.setItem).toHaveBeenCalledWith(
        'analysis-storage',
        expect.any(Object)
      );

      // Verify the persisted data structure
      const calls = mockLocalForageStorage.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall).toBeDefined();
      
      if (lastCall) {
        const [key, value] = lastCall;
        expect(key).toBe('analysis-storage');
        const data = typeof value === 'string' ? JSON.parse(value) : value;
        expect(data).toMatchObject({
          version: 1,
          state: {
            genericAnalysisState: expect.objectContaining({
              p3_1_output: expect.objectContaining({
                transcript_id: 'test-123'
              }),
              isFullyProcessedGenericDiachronic: true
            })
          }
        });
      }
    });

    it('should persist even empty state', async () => {
      // Clear any previous mock calls
      mockLocalForageStorage.setItem.mockClear();
      
      // Ensure store has initial state
      useAnalysisResultStore.setState({
        genericAnalysisState: {
          isFullyProcessedGenericDiachronic: false,
          isFullyProcessedGenericSynchronic: false,
          isRefinementDone: false,
          isCausalModelingDone: false,
          isReportGenerated: false
        }
      });

      // Advance timers
      vi.advanceTimersByTime(1000);
      await vi.runAllTimersAsync();

      // Store should persist even empty state
      expect(mockLocalForageStorage.setItem).toHaveBeenCalled();
      
      const calls = mockLocalForageStorage.setItem.mock.calls;
      const lastCall = calls[calls.length - 1];
      if (lastCall) {
        const [key, value] = lastCall;
        expect(key).toBe('analysis-storage');
        const data = typeof value === 'string' ? JSON.parse(value) : value;
        expect(data.state.genericAnalysisState).toMatchObject({
          isFullyProcessedGenericDiachronic: false,
          isFullyProcessedGenericSynchronic: false,
          isRefinementDone: false,
          isCausalModelingDone: false,
          isReportGenerated: false
        });
      }
    });
  });

  describe('State Management Actions', () => {
    it('should update generic analysis state correctly', () => {
      const store = useAnalysisResultStore.getState();
      
      // Initial update
      store.updateGenericState({
        p3_1_output: {
          transcript_id: 'test-123',
          raw_diachronic_units: [],
          independent_variable_details: 'Test IV',
          dependent_variable_focus: ['test_dv']
        } as P3_1_Output,
        isFullyProcessedGenericDiachronic: true
      });

      let state = useAnalysisResultStore.getState();
      expect(state.genericAnalysisState.p3_1_output?.transcript_id).toBe('test-123');
      expect(state.genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(true);

      // Merge update
      store.updateGenericState({
        p3_2_output: {
          transcript_id: 'test-123',
          identified_gdus: [],
          independent_variable_details: 'Test IV',
          dependent_variable_focus: ['test_dv']
        } as P3_2_Output,
        isFullyProcessedGenericSynchronic: true
      });

      state = useAnalysisResultStore.getState();
      expect(state.genericAnalysisState.p3_1_output?.transcript_id).toBe('test-123');
      expect(state.genericAnalysisState.p3_2_output?.transcript_id).toBe('test-123');
      expect(state.genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(true);
      expect(state.genericAnalysisState.isFullyProcessedGenericSynchronic).toBe(true);
    });

    it('should handle step output updates with error clearing', () => {
      const store = useAnalysisResultStore.getState();
      
      // Set an error first
      store.updateGenericState({
        p3_1_error: 'Test error'
      });

      let state = useAnalysisResultStore.getState();
      expect(state.genericAnalysisState.p3_1_error).toBe('Test error');

      // Update with successful output should clear error
      store.updateGenericState({
        p3_1_output: {
          transcript_id: 'test-123',
          raw_diachronic_units: [],
          independent_variable_details: 'Test IV',
          dependent_variable_focus: ['test_dv']
        } as P3_1_Output,
        p3_1_error: undefined
      });

      state = useAnalysisResultStore.getState();
      expect(state.genericAnalysisState.p3_1_output?.transcript_id).toBe('test-123');
      expect(state.genericAnalysisState.p3_1_error).toBeUndefined();
    });

    it('should reset store to initial state', () => {
      const store = useAnalysisResultStore.getState();
      
      // Add some data
      store.updateGenericState({
        p3_1_output: {
          transcript_id: 'test-123',
          raw_diachronic_units: [],
          independent_variable_details: 'Test IV',
          dependent_variable_focus: ['test_dv']
        } as P3_1_Output,
        isFullyProcessedGenericDiachronic: true
      });

      // Verify data exists
      let state = useAnalysisResultStore.getState();
      expect(state.genericAnalysisState.p3_1_output?.transcript_id).toBe('test-123');
      expect(state.genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(true);

      // Reset
      store.reset();

      // Verify reset
      state = useAnalysisResultStore.getState();
      expect(state.genericAnalysisState.p3_1_output).toBeUndefined();
      expect(state.genericAnalysisState.isFullyProcessedGenericDiachronic).toBe(false);
    });
  });

  describe('Selector Functions', () => {
    it('should check if step has output', () => {
      const store = useAnalysisResultStore.getState();
      
      // Initially no output
      expect(store.hasStepOutput('p3_1')).toBe(false);
      
      // Add output
      store.updateGenericState({
        p3_1_output: {
          transcript_id: 'test-123',
          raw_diachronic_units: [],
          independent_variable_details: 'Test IV',
          dependent_variable_focus: ['test_dv']
        } as P3_1_Output
      });

      expect(store.hasStepOutput('p3_1')).toBe(true);
    });

    it('should check if step has error', () => {
      const store = useAnalysisResultStore.getState();
      
      // Initially no error
      expect(store.hasStepError('p3_1')).toBe(false);
      
      // Add error
      store.updateGenericState({
        p3_1_error: 'Test error'
      });

      expect(store.hasStepError('p3_1')).toBe(true);
    });

    it('should get step output', () => {
      const store = useAnalysisResultStore.getState();
      const testOutput = {
        transcript_id: 'test-123',
        raw_diachronic_units: [],
        independent_variable_details: 'Test IV',
        dependent_variable_focus: ['test_dv']
      } as P3_1_Output;
      
      // Add output
      store.updateGenericState({
        p3_1_output: testOutput
      });

      expect(store.getStepOutput('p3_1')).toEqual(testOutput);
      expect(store.getStepOutput('p3_2')).toBeUndefined();
    });

    it('should get step error', () => {
      const store = useAnalysisResultStore.getState();
      
      // Add error
      store.updateGenericState({
        p3_1_error: 'Test error message'
      });

      expect(store.getStepError('p3_1')).toBe('Test error message');
      expect(store.getStepError('p3_2')).toBeUndefined();
    });
  });

  describe('Progress Tracking', () => {
    it('should track processing completion flags', () => {
      const store = useAnalysisResultStore.getState();
      
      // Initially not processed
      expect(store.isPhaseComplete('diachronic')).toBe(false);
      expect(store.isPhaseComplete('synchronic')).toBe(false);
      expect(store.isPhaseComplete('refinement')).toBe(false);
      
      // Mark diachronic as complete
      store.updateGenericState({
        isFullyProcessedGenericDiachronic: true
      });

      expect(store.isPhaseComplete('diachronic')).toBe(true);
      expect(store.isPhaseComplete('synchronic')).toBe(false);
      
      // Mark synchronic as complete
      store.updateGenericState({
        isFullyProcessedGenericSynchronic: true
      });

      expect(store.isPhaseComplete('synchronic')).toBe(true);
    });

    it('should calculate overall progress', () => {
      const store = useAnalysisResultStore.getState();
      
      // Initially 0% complete
      expect(store.getOverallProgress()).toBe(0);
      
      // Complete one phase
      store.updateGenericState({
        isFullyProcessedGenericDiachronic: true
      });

      expect(store.getOverallProgress()).toBe(0.2); // 1/5 phases complete
      
      // Complete another phase
      store.updateGenericState({
        isFullyProcessedGenericSynchronic: true
      });

      expect(store.getOverallProgress()).toBe(0.4); // 2/5 phases complete
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid step IDs gracefully', () => {
      const store = useAnalysisResultStore.getState();
      
      // Should not throw for invalid step IDs
      expect(() => {
        store.hasStepOutput('invalid_step' as any);
      }).not.toThrow();
      
      expect(() => {
        store.hasStepError('invalid_step' as any);
      }).not.toThrow();
      
      expect(store.getStepOutput('invalid_step' as any)).toBeUndefined();
      expect(store.getStepError('invalid_step' as any)).toBeUndefined();
    });

    it('should handle state update errors gracefully', () => {
      const store = useAnalysisResultStore.getState();
      
      // Should not throw for undefined updates
      expect(() => {
        store.updateGenericState({});
      }).not.toThrow();
      
      // Should handle partial updates
      expect(() => {
        store.updateGenericState({
          p3_1_error: 'Test error'
        });
      }).not.toThrow();
      
      const state = useAnalysisResultStore.getState();
      expect(state.genericAnalysisState.p3_1_error).toBe('Test error');
    });
  });
});