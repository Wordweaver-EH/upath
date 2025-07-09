import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StepId } from '../../../../types'
import type { StoreState } from '../types'

// Mock the constants
vi.mock('../../../../constants', () => ({
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC: ['P2S_1_GROUP_UTTERANCES_BY_TOPIC', 'P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS'],
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC: ['P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES', 'P4S_1_B_DEFINE_GSS_FROM_GROUPS']
}))

// Import after mocking
import { StepContextPreparationService } from '../StepContextPreparationService'

describe('StepContextPreparationService', () => {
  let service: StepContextPreparationService
  let mockStoreState: StoreState

  beforeEach(() => {
    service = new StepContextPreparationService()
    
    mockStoreState = {
      rawTranscripts: [
        {
          id: 'transcript-123',
          filename: 'test.txt',
          content: 'test content'
        }
      ],
      processedData: new Map([
        ['transcript-123', {
          id: 'transcript-123',
          filename: 'test.txt',
          phases_for_p2s_processing: ['phase1', 'phase2'],
          current_phase_for_p2s_processing: 'phase1',
          processed_phases_for_p2s: [],
          isFullyProcessedSpecificDiachronic: false,
          isFullyProcessedSpecificSynchronic: false
        } as any]
      ]),
      genericAnalysisState: {
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false,
        isRefinementDone: false,
        isCausalModelingDone: false,
        isReportGenerated: false,
        core_gdus_for_sync_analysis: ['gdu1', 'gdu2'],
        current_gdu_for_p4s_processing: 'gdu1',
        processed_gdus_for_p4s: []
      }
    }
  })

  describe('prepareContext', () => {
    it('should prepare context for regular step', () => {
      const result = service.prepareContext(
        StepId.P1_1_INITIAL_SEGMENTATION,
        'transcript-123',
        mockStoreState
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.currentTranscript).toEqual({
        id: 'transcript-123',
        filename: 'test.txt',
        content: 'test content'
      })
      expect(result.data?.currentPhase).toBeUndefined()
      expect(result.data?.currentGDU).toBeUndefined()
      expect(result.data?.isReportStep).toBe(false)
      expect(result.data?.tempGenericState).toEqual(mockStoreState.genericAnalysisState)
    })

    it('should prepare context for report step', () => {
      const result = service.prepareContext(
        StepId.P6_1_GENERATE_MARKDOWN_REPORT,
        undefined,
        mockStoreState
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.currentTranscript).toBeUndefined()
      expect(result.data?.isReportStep).toBe(true)
    })

    it('should prepare context for P2S step with existing phase', () => {
      const result = service.prepareContext(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        'transcript-123',
        mockStoreState
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.currentPhase).toBe('phase1')
      expect(result.data?.currentTranscript?.id).toBe('transcript-123')
    })

    it('should set first phase for P2S step when no current phase', () => {
      // Update mock to have no current phase
      const transcriptData = mockStoreState.processedData.get('transcript-123')!
      transcriptData.current_phase_for_p2s_processing = undefined
      
      const result = service.prepareContext(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        'transcript-123',
        mockStoreState
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.currentPhase).toBe('phase1')
      
      // Check that the store state was updated
      expect(mockStoreState.processedData.get('transcript-123')?.current_phase_for_p2s_processing).toBe('phase1')
    })

    it('should return error for P2S step with invalid phase requirements', () => {
      // Update mock to have empty phases but not fully processed
      const transcriptData = mockStoreState.processedData.get('transcript-123')!
      transcriptData.phases_for_p2s_processing = []
      transcriptData.current_phase_for_p2s_processing = undefined
      transcriptData.isFullyProcessedSpecificSynchronic = false
      
      const result = service.prepareContext(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        'transcript-123',
        mockStoreState
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Phase processing requirements not met')
    })

    it('should prepare context for P4S step with existing GDU', () => {
      const result = service.prepareContext(
        StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        mockStoreState
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.currentGDU).toBe('gdu1')
      expect(result.data?.currentTranscript).toBeUndefined()
    })

    it('should set first GDU for P4S step when no current GDU', () => {
      // Update mock to have no current GDU
      mockStoreState.genericAnalysisState.current_gdu_for_p4s_processing = undefined
      
      const result = service.prepareContext(
        StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        mockStoreState
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.currentGDU).toBe('gdu1')
      
      // Check that the store state was updated
      expect(mockStoreState.genericAnalysisState.current_gdu_for_p4s_processing).toBe('gdu1')
    })

    it('should return error for P4S step with invalid GDU requirements', () => {
      // Update mock to have empty GDUs but not fully processed
      mockStoreState.genericAnalysisState.core_gdus_for_sync_analysis = []
      mockStoreState.genericAnalysisState.current_gdu_for_p4s_processing = undefined
      mockStoreState.genericAnalysisState.isFullyProcessedGenericSynchronic = false
      
      const result = service.prepareContext(
        StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        mockStoreState
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('GDU processing requirements not met')
    })

    it('should handle missing transcript ID', () => {
      const result = service.prepareContext(
        StepId.P1_1_INITIAL_SEGMENTATION,
        'missing-transcript',
        mockStoreState
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.currentTranscript).toBeUndefined()
    })

    it('should handle missing transcript data for P2S step', () => {
      const result = service.prepareContext(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        'missing-transcript',
        mockStoreState
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.currentPhase).toBeUndefined()
      expect(result.data?.currentTranscript).toBeUndefined()
    })

    it('should handle P4S step with all GDUs processed', () => {
      // Update mock to have all GDUs processed
      mockStoreState.genericAnalysisState.processed_gdus_for_p4s = ['gdu1', 'gdu2']
      mockStoreState.genericAnalysisState.current_gdu_for_p4s_processing = undefined
      mockStoreState.genericAnalysisState.isFullyProcessedGenericSynchronic = true
      
      const result = service.prepareContext(
        StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        mockStoreState
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.currentGDU).toBeUndefined()
    })
  })
})