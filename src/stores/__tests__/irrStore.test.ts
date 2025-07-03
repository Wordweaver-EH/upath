import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useIRRStore } from '../irrStore';
import type { SavedState, P9_1_SemanticGduMapping } from '../../../types';

// Mock the geminiService
vi.mock('../../../services/geminiService', () => ({
  callGeminiAPI: vi.fn()
}));

describe('IRR Store', () => {
  beforeEach(() => {
    // Reset store before each test
    useIRRStore.setState({
      irrWorkflowState: {
        isIrrModalOpen: false,
        runA: null,
        runB: null,
        isMappingModalOpen: false,
        mappingProposal: null,
        confirmedMapping: null,
        results: null,
        kappaResults: undefined,
        loadingState: 'idle'
      }
    });
  });

  describe('Race Condition Fix', () => {
    it('should immediately pass mapping data to calculateResults without race condition', () => {
      const store = useIRRStore.getState();
      
      // Mock calculateResults to track if it's called with the correct data
      const calculateResultsSpy = vi.spyOn(store, 'calculateResults');
      
      // Create test mapping
      const testMapping: P9_1_SemanticGduMapping = {
        gdu_mappings: [
          {
            run_a_gdu_id: 'GDU_A',
            run_a_definition: 'Test A',
            run_a_contributing_rdu_count: 5,
            run_b_gdu_id: 'GDU_B',
            run_b_definition: 'Test B',
            run_b_contributing_rdu_count: 3,
            semantic_similarity_score: 0.9,
            mapping_justification: 'Test justification'
          }
        ]
      };
      
      // Call confirmMapping
      store.confirmMapping(testMapping);
      
      // Verify calculateResults was called immediately with the correct mapping
      expect(calculateResultsSpy).toHaveBeenCalledTimes(1);
      expect(calculateResultsSpy).toHaveBeenCalledWith({
        'GDU_A': 'GDU_B'
      });
      
      // Verify state was updated
      const state = useIRRStore.getState().irrWorkflowState;
      expect(state.confirmedMapping).toEqual({
        'GDU_A': 'GDU_B'
      });
      expect(state.isMappingModalOpen).toBe(false);
      expect(state.mappingProposal).toBe(null);
    });

    it('should handle null mappings correctly', () => {
      const store = useIRRStore.getState();
      const calculateResultsSpy = vi.spyOn(store, 'calculateResults');
      
      const testMapping: P9_1_SemanticGduMapping = {
        gdu_mappings: [
          {
            run_a_gdu_id: 'GDU_A',
            run_a_definition: 'Test A',
            run_a_contributing_rdu_count: 5,
            run_b_gdu_id: null,
            run_b_definition: null,
            run_b_contributing_rdu_count: 0,
            semantic_similarity_score: 0,
            mapping_justification: 'No match found'
          }
        ]
      };
      
      store.confirmMapping(testMapping);
      
      expect(calculateResultsSpy).toHaveBeenCalledWith({
        'GDU_A': null
      });
    });

    it('should show error when calculateResults is called without required data', () => {
      const store = useIRRStore.getState();
      
      // Call calculateResults without any data
      store.calculateResults();
      
      // Verify error state is set
      const state = useIRRStore.getState().irrWorkflowState;
      expect(state.errorMessage).toBe('Cannot calculate results: missing required data');
      expect(state.loadingState).toBe('error');
    });

    it('should use override mapping when provided to calculateResults', () => {
      const store = useIRRStore.getState();
      
      // Mock the buildCompleteUtteranceToGduMapping to prevent full execution
      vi.mock('../../../src/utils/traceabilityHelper', () => ({
        buildCompleteUtteranceToGduMapping: vi.fn(() => new Map())
      }));
      
      // Set up runs but no confirmed mapping in state
      const mockRunA: Partial<SavedState> = {
        genericAnalysisState: {
          p3_2_output: {
            identified_gdus: [{
              gdu_id: 'GDU_A',
              definition: 'Test',
              supporting_transcripts_count: 1,
              contributing_refined_du_ids: []
            }],
            criteria_for_gdu_identification: 'Test',
            dependent_variable_focus: []
          }
        } as any,
        processedDataArray: []
      };
      
      const mockRunB = { ...mockRunA };
      
      useIRRStore.setState({
        irrWorkflowState: {
          ...useIRRStore.getState().irrWorkflowState,
          runA: mockRunA as SavedState,
          runB: mockRunB as SavedState,
          confirmedMapping: null // No mapping in state
        }
      });
      
      // Spy on calculateResults to check it was called correctly
      const calculateResultsSpy = vi.spyOn(store, 'calculateResults');
      
      // Call calculateResults with override
      const overrideMapping = { 'GDU_A': 'GDU_A' };
      store.calculateResults(overrideMapping);
      
      // Verify it was called with the override
      expect(calculateResultsSpy).toHaveBeenCalledWith(overrideMapping);
      
      // Should not show error since override was provided
      const state = useIRRStore.getState().irrWorkflowState;
      expect(state.errorMessage).toBeUndefined();
      // The function will start processing with the override mapping
      expect(state.confirmedMapping).toBeNull(); // State mapping remains null, but override is used
    });
  });
});