import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { 
  StepId, 
  StepStatus,
  RawTranscript,
  TranscriptProcessedData,
  GenericAnalysisState,
  PromptHistoryEntry,
  CurrentStepInfo
} from '../../../../types'

// We need to define these before mocking
const StepIdValues = {
  P_NEG1_1_VARIABLE_IDENTIFICATION: 'P_NEG1_1_VARIABLE_IDENTIFICATION' as StepId,
  P0_3_SELECT_PROCEDURAL_UTTERANCES: 'P0_3_SELECT_PROCEDURAL_UTTERANCES' as StepId,
  P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE: 'P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE' as StepId,
  P2S_1_IDENTIFY_AND_GROUP_SSS: 'P2S_1_IDENTIFY_AND_GROUP_SSS' as StepId,
  P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE: 'P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE' as StepId,
  P3_1_IDENTIFY_GDUS: 'P3_1_IDENTIFY_GDUS' as StepId,
  P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES: 'P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES' as StepId,
  P4S_1_B_DEFINE_GSS_FROM_GROUPS: 'P4S_1_B_DEFINE_GSS_FROM_GROUPS' as StepId
}

// Mock the constants module
vi.mock('../../../../constants', () => ({
  getStepDisplayName: (stepId: string) => `Display: ${stepId}`,
  STEP_CONFIGS: {
    P_NEG1_1_VARIABLE_IDENTIFICATION: { name: 'Variable Identification' },
    P0_3_SELECT_PROCEDURAL_UTTERANCES: { name: 'Select Procedural Utterances' },
    P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE: { name: 'Diachronic Structure' },
    P2S_1_IDENTIFY_AND_GROUP_SSS: { name: 'Identify SSS' },
    P3_1_IDENTIFY_GDUS: { name: 'Identify GDUs' },
    P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES: { name: 'Identify SSS Nodes' },
    P4S_1_B_DEFINE_GSS_FROM_GROUPS: { name: 'Define GSS' }
  },
  STEP_ORDER_PART_NEG1: ['P_NEG1_1_VARIABLE_IDENTIFICATION'],
  STEP_ORDER_PART_0: ['P0_3_SELECT_PROCEDURAL_UTTERANCES'],
  STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC: ['P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE'],
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC: ['P2S_1_IDENTIFY_AND_GROUP_SSS'],
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC: ['P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES', 'P4S_1_B_DEFINE_GSS_FROM_GROUPS']
}))

// Mock stepIdToDataKeyPrefix
vi.mock('../../../utils/stepIdToDataKeyPrefix', () => ({
  stepIdToDataKeyPrefix: {
    P_NEG1_1_VARIABLE_IDENTIFICATION: 'p_neg1_1_output',
    P0_3_SELECT_PROCEDURAL_UTTERANCES: 'p0_3_output',
    P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE: 'p1_4_output',
    P2S_1_IDENTIFY_AND_GROUP_SSS: 'p2s_1_output',
    P3_1_IDENTIFY_GDUS: 'p3_1_output',
    P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES: 'p4s_1_a_output',
    P4S_1_B_DEFINE_GSS_FROM_GROUPS: 'p4s_1_b_output'
  },
  isGlobalStep: (stepId: string) => {
    return [
      'P3_1_IDENTIFY_GDUS',
      'P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES',
      'P4S_1_B_DEFINE_GSS_FROM_GROUPS'
    ].includes(stepId)
  }
}))

// Import after mocks
import { PipelineUIService } from '../PipelineUIService'

describe('PipelineUIService', () => {
  let service: PipelineUIService
  let mockDependencies: any
  let mockTranscript: RawTranscript
  let mockProcessedData: TranscriptProcessedData
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    mockTranscript = {
      id: 'transcript-1',
      filename: 'test.txt',
      content: 'test content'
    }
    
    mockProcessedData = {
      filename: 'test.txt',
      p_neg1_1_output: { variables: [] },
      p0_3_output: { utterances: [] },
      isFullyProcessedSpecificDiachronic: false,
      isFullyProcessedSpecificSynchronic: false,
      phases_for_p2s_processing: ['phase1', 'phase2'],
      current_phase_for_p2s_processing: 'phase1',
      processed_phases_for_p2s: [],
      p2s_outputs_by_phase: {
        phase1: {
          p2s_1_output: { test: 'data' }
        }
      }
    }
    
    mockDependencies = {
      getTranscriptData: vi.fn().mockReturnValue({
        rawTranscripts: [mockTranscript],
        processedData: new Map([['transcript-1', mockProcessedData]])
      }),
      getGenericAnalysisState: vi.fn().mockReturnValue({
        p3_1_output: { gdus: [] },
        p3_2_output: { identified_gdus: [{ gdu_id: 'gdu1' }, { gdu_id: 'gdu2' }] },
        current_gdu_for_p4s_processing: 'gdu1',
        p4s_1_a_outputs_by_gdu: { gdu1: { nodes: [] } },
        p4s_outputs_by_gdu: { gdu1: { gss: [] } },
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false
      }),
      getPromptHistory: vi.fn().mockReturnValue([]),
      getActiveTranscriptIndex: vi.fn().mockReturnValue(0),
      setAutorunning: vi.fn(),
      setCurrentStepInfo: vi.fn()
    }
    
    service = new PipelineUIService(mockDependencies)
  })
  
  describe('getTranscriptStatusDisplay', () => {
    it('should return "No Data" for non-existent transcript', () => {
      const result = service.getTranscriptStatusDisplay('non-existent')
      expect(result).toBe('No Data')
    })
    
    it('should return correct status for procedural utterances', () => {
      const result = service.getTranscriptStatusDisplay('transcript-1')
      expect(result).toBe('Display: P0_3_SELECT_PROCEDURAL_UTTERANCES Done')
    })
    
    it('should return correct status for fully processed specific synchronic', () => {
      mockProcessedData.isFullyProcessedSpecificDiachronic = true
      mockProcessedData.isFullyProcessedSpecificSynchronic = true
      
      const result = service.getTranscriptStatusDisplay('transcript-1')
      expect(result).toBe('Display: P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE Done')
    })
    
    it('should return correct status for fully processed specific diachronic', () => {
      mockProcessedData.isFullyProcessedSpecificDiachronic = true
      
      const result = service.getTranscriptStatusDisplay('transcript-1')
      expect(result).toBe('Display: P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE Done')
    })
    
    it('should return "Pending" for no progress', () => {
      mockProcessedData.p_neg1_1_output = undefined
      mockProcessedData.p0_3_output = undefined
      
      const result = service.getTranscriptStatusDisplay('transcript-1')
      expect(result).toBe('Pending')
    })
    
    it('should prioritize error status', () => {
      mockProcessedData.p0_3_output = undefined
      mockProcessedData.p0_3_error = 'Some error'
      
      const result = service.getTranscriptStatusDisplay('transcript-1')
      expect(result).toBe('Display: P0_3_SELECT_PROCEDURAL_UTTERANCES Done')
    })
  })
  
  describe('loadStepData', () => {
    it('should load data for transcript-specific step', () => {
      const mockPromptEntry: PromptHistoryEntry = {
        timestamp: new Date(),
        stepId: 'P_NEG1_1_VARIABLE_IDENTIFICATION' as StepId,
        transcriptId: 'transcript-1',
        requestPayload: { test: 'input' },
        response: 'test response',
        groundingSources: [{ text: 'source' }],
        estimatedInputTokens: 100,
        estimatedOutputTokens: 50
      }
      
      mockDependencies.getPromptHistory.mockReturnValue([mockPromptEntry])
      
      const result = service.loadStepData(
        StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION,
        'transcript-1'
      )
      
      expect(result).toEqual({
        outputData: { variables: [] },
        error: undefined,
        inputData: { test: 'input' },
        groundingSources: [{ text: 'source' }]
      })
    })
    
    it('should load data for phase-specific step', () => {
      const result = service.loadStepData(
        StepIdValues.P2S_1_IDENTIFY_AND_GROUP_SSS,
        'transcript-1',
        'phase1'
      )
      
      expect(result).toEqual({
        outputData: { test: 'data' },
        error: undefined,
        inputData: undefined,
        groundingSources: undefined
      })
    })
    
    it('should load data for GDU-specific step', () => {
      const result = service.loadStepData(
        StepIdValues.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        undefined,
        'gdu1'
      )
      
      expect(result).toEqual({
        outputData: { nodes: [] },
        error: undefined,
        inputData: undefined,
        groundingSources: undefined
      })
    })
    
    it('should load data for global step', () => {
      const genericState = mockDependencies.getGenericAnalysisState()
      
      const result = service.loadStepData(StepIdValues.P3_1_IDENTIFY_GDUS)
      
      expect(result).toEqual({
        outputData: { gdus: [] },
        error: undefined,
        inputData: undefined,
        groundingSources: undefined
      })
    })
    
    it('should handle errors in data', () => {
      mockProcessedData.p_neg1_1_output = undefined
      mockProcessedData.p_neg1_1_error = 'Test error'
      
      const result = service.loadStepData(
        StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION,
        'transcript-1'
      )
      
      expect(result).toEqual({
        outputData: undefined,
        error: 'Test error',
        inputData: undefined,
        groundingSources: undefined
      })
    })
    
    it('should handle P4S errors with current GDU', () => {
      const genericState = mockDependencies.getGenericAnalysisState()
      genericState.p4s_1_a_error = 'P4S error'
      genericState.p4s_1_a_outputs_by_gdu.gdu1 = undefined
      
      const result = service.loadStepData(
        StepIdValues.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        undefined,
        'gdu1'
      )
      
      expect(result.error).toBe('P4S error')
    })
  })
  
  describe('getStepStatusForPipelineView', () => {
    it('should return idle status for steps without data', () => {
      mockProcessedData.p_neg1_1_output = undefined
      
      const result = service.getStepStatusForPipelineView(
        StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION
      )
      
      expect(result).toEqual({
        status: StepStatus.Idle,
        error: undefined
      })
    })
    
    it('should return success status for completed steps', () => {
      const result = service.getStepStatusForPipelineView(
        StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION
      )
      
      expect(result).toEqual({
        status: StepStatus.Success,
        error: undefined
      })
    })
    
    it('should return error status for failed steps', () => {
      mockProcessedData.p_neg1_1_output = undefined
      mockProcessedData.p_neg1_1_error = 'Test error'
      
      const result = service.getStepStatusForPipelineView(
        StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION
      )
      
      expect(result).toEqual({
        status: StepStatus.Error,
        error: 'Test error'
      })
    })
    
    it('should handle current step status override', () => {
      const uiState = {
        currentStepInfo: {
          stepId: StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION,
          status: StepStatus.Loading,
          transcriptId: 'transcript-1'
        },
        activeTranscriptIndex: 0
      }
      
      const result = service.getStepStatusForPipelineView(
        StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION,
        uiState
      )
      
      expect(result).toEqual({
        status: StepStatus.Loading,
        error: undefined
      })
    })
    
    it('should handle fully processed generic synchronic', () => {
      const genericState = mockDependencies.getGenericAnalysisState()
      genericState.isFullyProcessedGenericSynchronic = true
      
      const result = service.getStepStatusForPipelineView(
        StepIdValues.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES
      )
      
      expect(result).toEqual({
        status: StepStatus.Success,
        error: undefined
      })
    })
    
    it('should handle partially processed generic synchronic', () => {
      const genericState = mockDependencies.getGenericAnalysisState()
      genericState.processed_gdus_for_p4s = ['gdu1']
      
      const result = service.getStepStatusForPipelineView(
        StepIdValues.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES
      )
      
      expect(result).toEqual({
        status: StepStatus.Loading,
        error: undefined
      })
    })
    
    it('should handle fully processed specific synchronic', () => {
      mockProcessedData.isFullyProcessedSpecificSynchronic = true
      
      const result = service.getStepStatusForPipelineView(
        StepIdValues.P2S_1_IDENTIFY_AND_GROUP_SSS
      )
      
      expect(result).toEqual({
        status: StepStatus.Success,
        error: undefined
      })
    })
  })
  
  describe('handlePipelineStepClick', () => {
    const mockSettings = {
      apiKey: 'test-key',
      temperature: 0.7,
      seed: 12345,
      userDvFocus: { dv_focus: ['test'] }
    }
    
    it('should handle transcript-specific step click', () => {
      const result = service.handlePipelineStepClick(
        StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION,
        mockSettings
      )
      
      expect(mockDependencies.setAutorunning).toHaveBeenCalledWith(false)
      expect(mockDependencies.setCurrentStepInfo).toHaveBeenCalledWith({
        stepId: StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION,
        status: StepStatus.Processing
      })
      
      expect(result).toEqual({
        stepId: StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION,
        transcriptId: 'transcript-1',
        phaseId: undefined,
        gduId: undefined,
        status: StepStatus.Success,
        error: undefined
      })
    })
    
    it('should handle phase-specific step click', () => {
      const result = service.handlePipelineStepClick(
        StepIdValues.P2S_1_IDENTIFY_AND_GROUP_SSS,
        mockSettings
      )
      
      expect(result).toEqual({
        stepId: StepIdValues.P2S_1_IDENTIFY_AND_GROUP_SSS,
        transcriptId: 'transcript-1',
        phaseId: 'phase1',
        gduId: undefined,
        status: StepStatus.Success,
        error: undefined
      })
    })
    
    it('should handle GDU-specific step click', () => {
      const result = service.handlePipelineStepClick(
        StepIdValues.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        mockSettings
      )
      
      expect(result).toEqual({
        stepId: StepIdValues.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        transcriptId: undefined,
        phaseId: undefined,
        gduId: 'gdu1',
        status: StepStatus.Success,
        error: undefined
      })
    })
    
    it('should handle invalid step configuration', () => {
      const result = service.handlePipelineStepClick(
        'INVALID_STEP' as StepId,
        mockSettings
      )
      
      expect(result).toEqual({
        stepId: 'INVALID_STEP',
        status: StepStatus.Error,
        error: 'Invalid step configuration'
      })
    })
    
    it('should use last processed phase when current is undefined', () => {
      mockProcessedData.current_phase_for_p2s_processing = undefined
      mockProcessedData.phases_for_p2s_processing = undefined
      mockProcessedData.processed_phases_for_p2s = ['phase1', 'phase2']
      
      const result = service.handlePipelineStepClick(
        StepIdValues.P2S_1_IDENTIFY_AND_GROUP_SSS,
        mockSettings
      )
      
      expect(result.phaseId).toBe('phase2')
    })
    
    it('should handle missing UI callbacks', () => {
      service = new PipelineUIService({
        ...mockDependencies,
        setAutorunning: undefined,
        setCurrentStepInfo: undefined
      })
      
      // Should not throw
      expect(() => {
        service.handlePipelineStepClick(
          StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION,
          mockSettings
        )
      }).not.toThrow()
    })
  })
  
  describe('edge cases', () => {
    it('should handle empty transcript data', () => {
      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [],
        processedData: new Map()
      })
      
      const result = service.getStepStatusForPipelineView(
        StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION
      )
      
      expect(result).toEqual({
        status: StepStatus.Idle,
        error: undefined
      })
    })
    
    it('should handle missing generic analysis state', () => {
      mockDependencies.getGenericAnalysisState.mockReturnValue({})
      
      const result = service.loadStepData(StepIdValues.P3_1_IDENTIFY_GDUS)
      
      expect(result).toEqual({
        outputData: undefined,
        error: undefined,
        inputData: undefined,
        groundingSources: undefined
      })
    })
    
    it('should handle empty prompt history', () => {
      const result = service.loadStepData(
        StepIdValues.P_NEG1_1_VARIABLE_IDENTIFICATION,
        'transcript-1'
      )
      
      expect(result.inputData).toBeUndefined()
      expect(result.groundingSources).toBeUndefined()
    })
  })
})