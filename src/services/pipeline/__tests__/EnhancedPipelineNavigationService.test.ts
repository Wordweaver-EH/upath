import { describe, it, expect, beforeEach } from 'vitest'
import { EnhancedPipelineNavigationService } from '../EnhancedPipelineNavigationService'
import { 
  StepId, 
  StepStatus, 
  CurrentStepInfo, 
  RawTranscript,
  TranscriptProcessedData,
  GenericAnalysisState
} from '../../../../types'
import {
  STEP_ORDER_PART_NEG1,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
  STEP_ORDER_PART_5_REFINEMENT,
  STEP_ORDER_PART_6_REPORT,
  STEP_ORDER_PART_7_CAUSAL_MODELING
} from '../../../../constants'

describe('EnhancedPipelineNavigationService', () => {
  let service: EnhancedPipelineNavigationService
  let mockTranscriptData: {
    rawTranscripts: RawTranscript[]
    processedData: Map<string, TranscriptProcessedData>
  }
  let mockGenericState: GenericAnalysisState

  beforeEach(() => {
    service = new EnhancedPipelineNavigationService()
    mockTranscriptData = {
      rawTranscripts: [],
      processedData: new Map()
    }
    mockGenericState = {
      isFullyProcessedGenericDiachronic: false,
      isFullyProcessedGenericSynchronic: false,
      isRefinementDone: false,
      isCausalModelingDone: false,
      isReportGenerated: false,
      core_gdus_for_sync_analysis: [],
      p1_4_outputs_by_transcript: {},
      p3_1_output: null,
      p3_2_output: null,
      p3_3_output: null,
      p4s_1_a_outputs_by_gdu: {},
      p4s_1_a_error: null,
      p4s_1_b_error: null,
      processed_gdus_for_p4s: [],
      p5_1_output: null,
      p5_1_error: null,
      p6_1_output: null,
      p6_1_error: null,
      p7_1_output: null,
      p7_1_error: null
    }
  })

  describe('getNextStepDetails', () => {
    it('should return first Part -1 step from IDLE when transcripts exist', () => {
      mockTranscriptData.rawTranscripts = [{ id: 'tx1', name: 'test.txt', content: 'content' }]
      const currentStepInfo: CurrentStepInfo = { stepId: StepId.IDLE, status: StepStatus.Success }
      
      const result = service.getNextStepDetails(
        currentStepInfo,
        0,
        mockTranscriptData,
        mockGenericState
      )

      expect(result).toEqual({
        nextStepId: STEP_ORDER_PART_NEG1[0],
        nextTranscriptIndex: 0
      })
    })

    it('should return null when no transcripts exist', () => {
      const currentStepInfo: CurrentStepInfo = { stepId: StepId.IDLE, status: StepStatus.Success }
      
      const result = service.getNextStepDetails(
        currentStepInfo,
        0,
        mockTranscriptData,
        mockGenericState
      )

      expect(result).toBeNull()
    })

    describe('Part -1 Navigation', () => {
      it('should process next transcript when Part -1 completes for current transcript', () => {
        mockTranscriptData.rawTranscripts = [
          { id: 'tx1', name: 'test1.txt', content: 'content1' },
          { id: 'tx2', name: 'test2.txt', content: 'content2' }
        ]
        mockTranscriptData.processedData.set('tx1', {
          id: 'tx1',
          p_neg1_1_output: 'output',
          processedLines: []
        } as TranscriptProcessedData)

        const currentStepInfo: CurrentStepInfo = { 
          stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_NEG1[0],
          nextTranscriptIndex: 1
        })
      })

      it('should move to Part 0 when all transcripts have Part -1 output', () => {
        mockTranscriptData.rawTranscripts = [
          { id: 'tx1', name: 'test1.txt', content: 'content1' },
          { id: 'tx2', name: 'test2.txt', content: 'content2' }
        ]
        mockTranscriptData.processedData.set('tx1', {
          id: 'tx1',
          p_neg1_1_output: 'output1',
          processedLines: []
        } as TranscriptProcessedData)
        mockTranscriptData.processedData.set('tx2', {
          id: 'tx2',
          p_neg1_1_output: 'output2',
          processedLines: []
        } as TranscriptProcessedData)

        const currentStepInfo: CurrentStepInfo = { 
          stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          1,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_0[0],
          nextTranscriptIndex: 0
        })
      })
    })

    describe('Part 0 Navigation', () => {
      it('should move to next Part 0 step for same transcript', () => {
        mockTranscriptData.rawTranscripts = [
          { id: 'tx1', name: 'test1.txt', content: 'content1' }
        ]
        mockTranscriptData.processedData.set('tx1', {
          id: 'tx1',
          p0_1_output: 'output',
          processedLines: []
        } as TranscriptProcessedData)

        const currentStepInfo: CurrentStepInfo = { 
          stepId: StepId.P0_1_EXTRACT_HIGH_LEVEL_THEMES, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_0[1],
          nextTranscriptIndex: 0
        })
      })

      it('should move to next transcript for Part 0 when all steps complete', () => {
        mockTranscriptData.rawTranscripts = [
          { id: 'tx1', name: 'test1.txt', content: 'content1' },
          { id: 'tx2', name: 'test2.txt', content: 'content2' }
        ]
        // Mark all Part 0 steps complete for tx1
        const tx1Data = {
          id: 'tx1',
          p0_1_output: 'output',
          p0_2_output: 'output',
          p0_3_output: 'output',
          p0_4_output: 'output',
          processedLines: []
        } as TranscriptProcessedData
        mockTranscriptData.processedData.set('tx1', tx1Data)

        const lastPart0Step = STEP_ORDER_PART_0[STEP_ORDER_PART_0.length - 1]
        const currentStepInfo: CurrentStepInfo = { 
          stepId: lastPart0Step, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_0[0],
          nextTranscriptIndex: 1
        })
      })

      it('should move to Part 1 when all transcripts complete Part 0', () => {
        mockTranscriptData.rawTranscripts = [
          { id: 'tx1', name: 'test1.txt', content: 'content1' },
          { id: 'tx2', name: 'test2.txt', content: 'content2' }
        ]
        // Mark all Part 0 steps complete for both transcripts
        const completePart0Data = {
          p0_1_output: 'output',
          p0_2_output: 'output',
          p0_3_output: 'output',
          p0_4_output: 'output',
          processedLines: []
        }
        mockTranscriptData.processedData.set('tx1', {
          id: 'tx1',
          ...completePart0Data
        } as TranscriptProcessedData)
        mockTranscriptData.processedData.set('tx2', {
          id: 'tx2',
          ...completePart0Data
        } as TranscriptProcessedData)

        const lastPart0Step = STEP_ORDER_PART_0[STEP_ORDER_PART_0.length - 1]
        const currentStepInfo: CurrentStepInfo = { 
          stepId: lastPart0Step, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          1,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC[0],
          nextTranscriptIndex: 0
        })
      })
    })

    describe('Part 2S Navigation', () => {
      it('should move to Part 2S when phases exist for transcript', () => {
        mockTranscriptData.rawTranscripts = [
          { id: 'tx1', name: 'test1.txt', content: 'content1' }
        ]
        mockTranscriptData.processedData.set('tx1', {
          id: 'tx1',
          isFullyProcessedSpecificDiachronic: true,
          phases_for_p2s_processing: ['phase1', 'phase2'],
          isFullyProcessedSpecificSynchronic: false,
          processedLines: []
        } as TranscriptProcessedData)

        const currentStepInfo: CurrentStepInfo = { 
          stepId: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0],
          nextTranscriptIndex: 0
        })
      })

      it('should continue Part 2S until all phases processed', () => {
        mockTranscriptData.rawTranscripts = [
          { id: 'tx1', name: 'test1.txt', content: 'content1' }
        ]
        mockTranscriptData.processedData.set('tx1', {
          id: 'tx1',
          phases_for_p2s_processing: ['phase1', 'phase2'],
          processed_phases_for_p2s: ['phase1'],
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: 'output',
              p2s_2_output: 'output',
              p2s_3_output: 'output'
            }
          },
          processedLines: []
        } as TranscriptProcessedData)

        const lastP2SStep = STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.length - 1]
        const currentStepInfo: CurrentStepInfo = { 
          stepId: lastP2SStep, 
          status: StepStatus.Success,
          currentPhaseForP2S: 'phase1'
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC[0],
          nextTranscriptIndex: 0
        })
      })
    })

    describe('Part 3 Navigation', () => {
      it('should move to Part 3 when all transcript processing complete', () => {
        mockTranscriptData.rawTranscripts = [
          { id: 'tx1', name: 'test1.txt', content: 'content1' }
        ]
        mockTranscriptData.processedData.set('tx1', {
          id: 'tx1',
          isFullyProcessedSpecificDiachronic: true,
          isFullyProcessedSpecificSynchronic: true,
          processedLines: []
        } as TranscriptProcessedData)

        const currentStepInfo: CurrentStepInfo = { 
          stepId: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[0],
          nextTranscriptIndex: 0
        })
      })

      it('should move to Part 4S when Part 3 complete and GDUs exist', () => {
        mockGenericState.isFullyProcessedGenericDiachronic = true
        mockGenericState.core_gdus_for_sync_analysis = ['gdu1', 'gdu2']
        mockGenericState.isFullyProcessedGenericSynchronic = false

        const lastPart3Step = STEP_ORDER_PART_3_GENERIC_DIACHRONIC[STEP_ORDER_PART_3_GENERIC_DIACHRONIC.length - 1]
        const currentStepInfo: CurrentStepInfo = { 
          stepId: lastPart3Step, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
          nextTranscriptIndex: 0
        })
      })
    })

    describe('Part 4S Navigation', () => {
      it('should move from P4S_1_A to P4S_1_B', () => {
        mockGenericState.p4s_1_a_outputs_by_gdu = { 'gdu1': {} }

        const currentStepInfo: CurrentStepInfo = { 
          stepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, 
          status: StepStatus.Success,
          currentGduForP4S: 'gdu1'
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
          nextTranscriptIndex: 0
        })
      })

      it('should return to P4S_1_A for next GDU', () => {
        mockGenericState.core_gdus_for_sync_analysis = ['gdu1', 'gdu2']
        mockGenericState.processed_gdus_for_p4s = ['gdu1']
        mockGenericState.isFullyProcessedGenericSynchronic = false

        const currentStepInfo: CurrentStepInfo = { 
          stepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS, 
          status: StepStatus.Success,
          currentGduForP4S: 'gdu1'
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
          nextTranscriptIndex: 0
        })
      })
    })

    describe('Part 5 Navigation', () => {
      it('should move to Part 5 when Part 4S complete', () => {
        mockGenericState.isFullyProcessedGenericSynchronic = true

        const currentStepInfo: CurrentStepInfo = { 
          stepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_5_REFINEMENT[0],
          nextTranscriptIndex: 0
        })
      })
    })

    describe('Part 7 Navigation', () => {
      it('should move to Part 7 when Part 5 complete', () => {
        mockGenericState.isRefinementDone = true
        mockGenericState.isCausalModelingDone = false

        const lastPart5Step = STEP_ORDER_PART_5_REFINEMENT[STEP_ORDER_PART_5_REFINEMENT.length - 1]
        const currentStepInfo: CurrentStepInfo = { 
          stepId: lastPart5Step, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_7_CAUSAL_MODELING[0],
          nextTranscriptIndex: 0
        })
      })
    })

    describe('Part 6 Navigation', () => {
      it('should move to Part 6 when Part 7 complete', () => {
        mockGenericState.isCausalModelingDone = true
        mockGenericState.isReportGenerated = false

        const lastPart7Step = STEP_ORDER_PART_7_CAUSAL_MODELING[STEP_ORDER_PART_7_CAUSAL_MODELING.length - 1]
        const currentStepInfo: CurrentStepInfo = { 
          stepId: lastPart7Step, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: STEP_ORDER_PART_6_REPORT[0],
          nextTranscriptIndex: 0
        })
      })

      it('should move to COMPLETE when report generated', () => {
        mockGenericState.isReportGenerated = true

        const currentStepInfo: CurrentStepInfo = { 
          stepId: StepId.P6_1_REPORT, 
          status: StepStatus.Success 
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          mockTranscriptData,
          mockGenericState
        )

        expect(result).toEqual({
          nextStepId: StepId.COMPLETE,
          nextTranscriptIndex: 0
        })
      })
    })

    it('should return null for COMPLETE step', () => {
      const currentStepInfo: CurrentStepInfo = { 
        stepId: StepId.COMPLETE, 
        status: StepStatus.Success 
      }
      
      const result = service.getNextStepDetails(
        currentStepInfo,
        0,
        mockTranscriptData,
        mockGenericState
      )

      expect(result).toBeNull()
    })
  })

  describe('processNextStep', () => {
    it('should return null when no next step', () => {
      const currentStepInfo: CurrentStepInfo = { 
        stepId: StepId.COMPLETE, 
        status: StepStatus.Success 
      }
      
      const result = service.processNextStep(
        currentStepInfo,
        0,
        mockTranscriptData,
        mockGenericState
      )

      expect(result).toBeNull()
    })

    it('should return completion details when moving to COMPLETE', () => {
      mockGenericState.isReportGenerated = true
      mockGenericState.p6_1_output = 'Final report content'

      const currentStepInfo: CurrentStepInfo = { 
        stepId: StepId.P6_1_REPORT, 
        status: StepStatus.Success 
      }
      
      const result = service.processNextStep(
        currentStepInfo,
        0,
        mockTranscriptData,
        mockGenericState
      )

      expect(result).toEqual({
        stepId: StepId.COMPLETE,
        transcriptIndex: 0,
        isComplete: true,
        report: 'Final report content'
      })
    })

    it('should return next step details for normal progression', () => {
      mockTranscriptData.rawTranscripts = [
        { id: 'tx1', name: 'test1.txt', content: 'content1' }
      ]

      const currentStepInfo: CurrentStepInfo = { 
        stepId: StepId.IDLE, 
        status: StepStatus.Success 
      }
      
      const result = service.processNextStep(
        currentStepInfo,
        0,
        mockTranscriptData,
        mockGenericState
      )

      expect(result).toEqual({
        stepId: STEP_ORDER_PART_NEG1[0],
        transcriptIndex: 0,
        transcriptId: 'tx1',
        isComplete: false
      })
    })

    it('should handle global steps without transcript ID', () => {
      mockGenericState.isFullyProcessedGenericDiachronic = true

      const currentStepInfo: CurrentStepInfo = { 
        stepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[0], 
        status: StepStatus.Success 
      }
      
      const result = service.processNextStep(
        currentStepInfo,
        0,
        mockTranscriptData,
        mockGenericState
      )

      expect(result).toEqual({
        stepId: STEP_ORDER_PART_3_GENERIC_DIACHRONIC[1],
        transcriptIndex: 0,
        transcriptId: undefined,
        isComplete: false
      })
    })
  })
})