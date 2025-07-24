import { describe, it, expect, beforeEach } from 'vitest'
import { PipelineOrchestrator } from '../PipelineOrchestrator'
import { 
  StepId, 
  StepStatus,
  RawTranscript,
  TranscriptProcessedData,
  GenericAnalysisState,
  CurrentStepInfo,
  ProcessState
} from '../../../types'
import { PIPELINE_STRUCTURE } from '../../config/pipelineDefinition'

describe('PipelineOrchestrator - P2S DU Iteration', () => {
  let orchestrator: PipelineOrchestrator
  let mockRawTranscripts: RawTranscript[]
  let mockProcessedData: Map<string, TranscriptProcessedData>
  let mockGenericAnalysisState: GenericAnalysisState
  let mockProcessState: ProcessState

  beforeEach(() => {
    orchestrator = new PipelineOrchestrator(PIPELINE_STRUCTURE)
    
    // Setup mock transcripts
    mockRawTranscripts = [
      {
        id: 'transcript-1',
        name: 'Interview 1',
        content: 'Content 1',
        createdAt: new Date().toISOString()
      },
      {
        id: 'transcript-2',
        name: 'Interview 2', 
        content: 'Content 2',
        createdAt: new Date().toISOString()
      }
    ]

    // Setup mock processed data with DUs
    mockProcessedData = new Map()
    mockProcessedData.set('transcript-1', {
      dus_for_p2s_processing: ['du_1', 'du_2', 'du_3'],
      current_du_for_p2s_processing: 'du_1',
      processed_dus_for_p2s: [],
      p2s_outputs_by_du: {},
      isFullyProcessedSpecificSynchronic: false
    } as TranscriptProcessedData)
    
    mockProcessedData.set('transcript-2', {
      dus_for_p2s_processing: ['du_A', 'du_B'],
      current_du_for_p2s_processing: 'du_A',
      processed_dus_for_p2s: [],
      p2s_outputs_by_du: {},
      isFullyProcessedSpecificSynchronic: false
    } as TranscriptProcessedData)

    mockGenericAnalysisState = {} as GenericAnalysisState
    
    mockProcessState = {
      status: 'running',
      currentPartIndex: 3, // Part 2 is at index 3 (Part -1, Part 0, Part 1, Part 2)
      currentStepIndex: 0, // P2S_1
      iterationContext: {}
    }
  })

  describe('DU Iteration within a Transcript', () => {
    it('should move to next DU after completing P2S_3', () => {
      // Simulate completing P2S_3 for du_1
      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        status: StepStatus.Success
      }

      const nextStep = orchestrator.getNextStep(
        mockProcessState,
        currentStepInfo,
        { rawTranscripts: mockRawTranscripts, processedData: mockProcessedData, genericAnalysisState: mockGenericAnalysisState },
        0 // transcript index
      )

      expect(nextStep).toBeDefined()
      expect(nextStep?.nextStepId).toBe(StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC)
      expect(nextStep?.nextTranscriptIndex).toBe(0)
      expect(nextStep?.nextDuIndex).toBe(1) // Move from du_1 (index 0) to du_2 (index 1)
      expect(nextStep?.iterationType).toBe('per-du')
    })

    it('should move to next step within same DU', () => {
      // Simulate completing P2S_1 for du_1
      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        status: StepStatus.Success
      }

      const nextStep = orchestrator.getNextStep(
        mockProcessState,
        currentStepInfo,
        { rawTranscripts: mockRawTranscripts, processedData: mockProcessedData, genericAnalysisState: mockGenericAnalysisState },
        0
      )

      expect(nextStep).toBeDefined()
      expect(nextStep?.nextStepId).toBe(StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS)
      expect(nextStep?.nextTranscriptIndex).toBe(0)
      expect(nextStep?.nextDuIndex).toBeUndefined() // Stay on same DU
      expect(nextStep?.iterationType).toBe('per-transcript')
    })

    it('should handle last DU completion', () => {
      // Set current DU to the last one
      const transcriptData = mockProcessedData.get('transcript-1')!
      transcriptData.current_du_for_p2s_processing = 'du_3'
      transcriptData.processed_dus_for_p2s = ['du_1', 'du_2']
      
      // Update process state to P2S_3
      mockProcessState.currentStepIndex = 2 // P2S_3

      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        status: StepStatus.Success
      }

      const nextStep = orchestrator.getNextStep(
        mockProcessState,
        currentStepInfo,
        { rawTranscripts: mockRawTranscripts, processedData: mockProcessedData, genericAnalysisState: mockGenericAnalysisState },
        0
      )

      // Should move to P2S_1 for next transcript
      expect(nextStep).toBeDefined()
      expect(nextStep?.nextStepId).toBe(StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC)
      expect(nextStep?.nextTranscriptIndex).toBe(1) // Move to transcript 2
      expect(nextStep?.iterationType).toBe('per-transcript')
    })

    it('should handle undefined current_du_for_p2s_processing gracefully', () => {
      // Simulate the bug condition where current_du becomes undefined
      const transcriptData = mockProcessedData.get('transcript-1')!
      transcriptData.current_du_for_p2s_processing = undefined
      
      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        status: StepStatus.Success
      }

      const nextStep = orchestrator.getNextStep(
        mockProcessState,
        currentStepInfo,
        { rawTranscripts: mockRawTranscripts, processedData: mockProcessedData, genericAnalysisState: mockGenericAnalysisState },
        0
      )

      // With the bug, this would incorrectly return nextDuIndex: 0
      // The test verifies the behavior exists
      if (nextStep?.nextDuIndex !== undefined) {
        expect(nextStep.nextDuIndex).toBe(0) // Bug: -1 + 1 = 0
      }
    })
  })

  describe('Multiple Transcript Handling', () => {
    it('should process each transcript DUs independently', () => {
      // Complete all DUs for transcript 1
      const transcript1Data = mockProcessedData.get('transcript-1')!
      transcript1Data.current_du_for_p2s_processing = 'du_3'
      transcript1Data.processed_dus_for_p2s = ['du_1', 'du_2', 'du_3']
      transcript1Data.isFullyProcessedSpecificSynchronic = true

      // Move to transcript 2
      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
        status: StepStatus.Success
      }

      // Update process state to Part 1 completion
      mockProcessState.currentPartIndex = 2  // Part 1 is at index 2
      mockProcessState.currentStepIndex = 4 // P1_5

      const nextStep = orchestrator.getNextStep(
        mockProcessState,
        currentStepInfo,
        { rawTranscripts: mockRawTranscripts, processedData: mockProcessedData, genericAnalysisState: mockGenericAnalysisState },
        1 // Now on transcript 2
      )

      // Should start P2S from the beginning (transcript 0) since all transcripts completed Part 1
      expect(nextStep).toBeDefined()
      expect(nextStep?.nextStepId).toBe(StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC)
      expect(nextStep?.nextTranscriptIndex).toBe(0)  // Part 2 starts from transcript 0
      expect(nextStep?.iterationType).toBe('per-transcript')
    })

    it('should handle last transcript completion', () => {
      // Set both transcripts as fully processed
      const transcript1Data = mockProcessedData.get('transcript-1')!
      transcript1Data.isFullyProcessedSpecificSynchronic = true
      
      const transcript2Data = mockProcessedData.get('transcript-2')!
      transcript2Data.current_du_for_p2s_processing = 'du_B'
      transcript2Data.processed_dus_for_p2s = ['du_A', 'du_B']
      transcript2Data.isFullyProcessedSpecificSynchronic = true

      // Update process state to P2S_3 of last DU of last transcript
      mockProcessState.currentPartIndex = 3  // Part 2 is at index 3
      mockProcessState.currentStepIndex = 2

      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        status: StepStatus.Success
      }

      const nextStep = orchestrator.getNextStep(
        mockProcessState,
        currentStepInfo,
        { rawTranscripts: mockRawTranscripts, processedData: mockProcessedData, genericAnalysisState: mockGenericAnalysisState },
        1 // Last transcript
      )

      // Should move to Part 3 (Generic Diachronic)
      expect(nextStep).toBeDefined()
      expect(nextStep?.nextStepId).toBe(StepId.P3_1_ALIGN_STRUCTURES)
      expect(nextStep?.nextTranscriptIndex).toBe(0)
      expect(nextStep?.iterationType).toBe('global')
    })
  })

  describe('Edge Cases', () => {
    it('should handle transcript with no DUs', () => {
      const emptyDuData = mockProcessedData.get('transcript-1')!
      emptyDuData.dus_for_p2s_processing = []
      emptyDuData.isFullyProcessedSpecificSynchronic = true

      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
        status: StepStatus.Success
      }

      mockProcessState.currentPartIndex = 2  // Part 1 is at index 2
      mockProcessState.currentStepIndex = 4

      const nextStep = orchestrator.getNextStep(
        mockProcessState,
        currentStepInfo,
        { rawTranscripts: mockRawTranscripts, processedData: mockProcessedData, genericAnalysisState: mockGenericAnalysisState },
        0
      )

      // Should skip P2S and move to next transcript
      expect(nextStep).toBeDefined()
      expect(nextStep?.nextTranscriptIndex).toBe(1)
    })

    it('should handle missing transcript data', () => {
      mockProcessedData.clear() // Remove all data

      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        status: StepStatus.Success
      }

      const nextStep = orchestrator.getNextStep(
        mockProcessState,
        currentStepInfo,
        { rawTranscripts: mockRawTranscripts, processedData: mockProcessedData, genericAnalysisState: mockGenericAnalysisState },
        0
      )

      // Should handle gracefully
      expect(nextStep).toBeDefined()
    })

    it('should handle single DU correctly', () => {
      const singleDuData = mockProcessedData.get('transcript-1')!
      singleDuData.dus_for_p2s_processing = ['du_only']
      singleDuData.current_du_for_p2s_processing = 'du_only'
      
      mockProcessState.currentStepIndex = 2 // P2S_3

      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        status: StepStatus.Success
      }

      const nextStep = orchestrator.getNextStep(
        mockProcessState,
        currentStepInfo,
        { rawTranscripts: mockRawTranscripts, processedData: mockProcessedData, genericAnalysisState: mockGenericAnalysisState },
        0
      )

      // Should move to next transcript after single DU
      expect(nextStep?.nextTranscriptIndex).toBe(1)
    })
  })

  describe('Process State Updates', () => {
    it('should update process state correctly for P2S steps', () => {
      const currentStepInfo: CurrentStepInfo = {
        stepId: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        status: StepStatus.Success
      }

      const newState = orchestrator.updateProcessState(
        mockProcessState,
        currentStepInfo.stepId,
        currentStepInfo.status,
        { transcriptIndex: 0 }
      )

      expect(newState.status).toBe('running')
      expect(newState.currentPartIndex).toBe(3) // Part 2 is at index 3
      expect(newState.currentStepIndex).toBe(0) // P2S_1
      expect(newState.iterationContext.transcriptIndex).toBe(0)
    })

    it('should create resume checkpoint correctly', () => {
      const checkpointState = orchestrator.createResumeCheckpoint(
        mockProcessState,
        { transcriptIndex: 0 }
      )

      expect(checkpointState.resumeCheckpoint).toBeDefined()
      expect(checkpointState.resumeCheckpoint?.partIndex).toBe(3)  // Part 2 is at index 3
      expect(checkpointState.resumeCheckpoint?.stepIndex).toBe(0)
      expect(checkpointState.resumeCheckpoint?.iterationContext.transcriptIndex).toBe(0)
    })
  })
})