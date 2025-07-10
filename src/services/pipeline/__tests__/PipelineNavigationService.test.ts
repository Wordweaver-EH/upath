import { describe, test, expect, beforeEach } from 'vitest'
import { PipelineNavigationService } from '../PipelineNavigationService'
import { IPipelineNavigationService } from '../types'
import { StepId, StepStatus, CurrentStepInfo, RawTranscript, TranscriptProcessedData } from '../../../../types'
import {
  ALL_PIPELINE_STEP_IDS_IN_ORDER,
  STEP_ORDER_PART_NEG1,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
  STEP_ORDER_PART_5_REFINEMENT,
  STEP_ORDER_PART_6_REPORT
} from '../../../../constants'

describe('PipelineNavigationService', () => {
  let service: IPipelineNavigationService
  
  beforeEach(() => {
    service = new PipelineNavigationService()
  })

  describe('getNextStepDetails', () => {
    const createMockTranscript = (id: string): RawTranscript => ({
      id,
      name: `transcript-${id}.txt`,
      content: 'Test content',
      uploadedAt: Date.now()
    })

    const createMockProcessedData = (id: string, options: {
      isFullyProcessedSpecificDiachronic?: boolean
      isFullyProcessedSpecificSynchronic?: boolean
      processed_phases_for_p2s?: string[]
    } = {}): TranscriptProcessedData => ({
      id,
      filename: `transcript-${id}.txt`,
      isFullyProcessedSpecificDiachronic: options.isFullyProcessedSpecificDiachronic || false,
      isFullyProcessedSpecificSynchronic: options.isFullyProcessedSpecificSynchronic || false,
      processed_phases_for_p2s: options.processed_phases_for_p2s || []
    } as TranscriptProcessedData)

    describe('initial state', () => {
      test('should return first step when at IDLE', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.IDLE,
          status: StepStatus.Idle
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData: new Map()
          },
          {}
        )

        expect(result).toEqual({
          nextStepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
          nextTranscriptIndex: 0
        })
      })

      test('should return null when no transcripts available', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.IDLE,
          status: StepStatus.Idle
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [],
            processedData: new Map()
          },
          {}
        )

        expect(result).toBeNull()
      })
    })

    describe('transcript-specific steps', () => {
      test('should advance to next transcript for same step when more transcripts exist', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          status: StepStatus.Success,
          transcriptId: 't1'
        }
        
        const transcripts = [
          createMockTranscript('t1'),
          createMockTranscript('t2'),
          createMockTranscript('t3')
        ]
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: transcripts,
            processedData: new Map()
          },
          {}
        )

        expect(result).toEqual({
          nextStepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          nextTranscriptIndex: 1
        })
      })

      test('should advance to next step when all transcripts processed', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          status: StepStatus.Success,
          transcriptId: 't2'
        }
        
        const transcripts = [
          createMockTranscript('t1'),
          createMockTranscript('t2')
        ]
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          1,
          {
            rawTranscripts: transcripts,
            processedData: new Map()
          },
          {}
        )

        expect(result).toEqual({
          nextStepId: StepId.P0_2_REFINE_DATA_TYPES,
          nextTranscriptIndex: 0
        })
      })
    })

    describe('global steps', () => {
      test('should advance to next step for global steps', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P3_1_ALIGN_STRUCTURES,
          status: StepStatus.Success
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData: new Map()
          },
          {}
        )

        expect(result).toEqual({
          nextStepId: StepId.P3_2_IDENTIFY_GDUS,
          nextTranscriptIndex: 0
        })
      })
    })

    describe('P2S phase navigation', () => {
      test('should handle P2S steps with phase navigation', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
          status: StepStatus.Success,
          transcriptId: 't1',
          p2sPhase: 'phase1'
        }
        
        const processedData = new Map([
          ['t1', createMockProcessedData('t1', {
            processed_phases_for_p2s: ['phase1']
          })]
        ])
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData
          },
          {
            p1_4_outputs_by_transcript: {
              t1: {
                phases_full_descriptions: {
                  phase1: {},
                  phase2: {}
                }
              }
            }
          }
        )

        // Should advance to next phase
        expect(result).toEqual({
          nextStepId: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
          nextTranscriptIndex: 0
        })
      })

      test('should advance to next P2S step when all phases processed', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
          status: StepStatus.Success,
          transcriptId: 't1',
          p2sPhase: 'phase2'
        }
        
        const processedData = new Map([
          ['t1', createMockProcessedData('t1', {
            processed_phases_for_p2s: ['phase1', 'phase2']
          })]
        ])
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData
          },
          {
            p1_4_outputs_by_transcript: {
              t1: {
                phases_full_descriptions: {
                  phase1: {},
                  phase2: {}
                }
              }
            }
          }
        )

        // Should advance to next P2S step
        expect(result).toEqual({
          nextStepId: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
          nextTranscriptIndex: 0
        })
      })
    })

    describe('P4S GDU navigation', () => {
      test('should handle P4S steps with GDU navigation', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
          status: StepStatus.Success
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData: new Map()
          },
          {
            processed_gdus_for_p4s: ['gdu1'],
            current_gdu_for_p4s_processing: 'gdu1',
            p3_1_output: {
              gdus: ['gdu1', 'gdu2', 'gdu3']
            }
          }
        )

        // Should continue with next GDU
        expect(result).toEqual({
          nextStepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
          nextTranscriptIndex: 0
        })
      })

      test('should advance to P4S_1_B when all GDUs processed for P4S_1_A', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
          status: StepStatus.Success
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData: new Map()
          },
          {
            processed_gdus_for_p4s: ['gdu1', 'gdu2', 'gdu3'],
            current_gdu_for_p4s_processing: 'gdu3',
            p3_1_output: {
              gdus: ['gdu1', 'gdu2', 'gdu3']
            }
          }
        )

        expect(result).toEqual({
          nextStepId: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
          nextTranscriptIndex: 0
        })
      })
    })

    describe('completion scenarios', () => {
      test('should advance to COMPLETE when all steps done and report generated', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P6_1_REPORT,
          status: StepStatus.Success
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData: new Map()
          },
          {
            isReportGenerated: true
          }
        )

        expect(result).toEqual({
          nextStepId: StepId.COMPLETE,
          nextTranscriptIndex: 0
        })
      })

      test('should return null when no next step available', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P7_1_USER_DEFINED_CAUSAL_MODEL,
          status: StepStatus.Success
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData: new Map()
          },
          {}
        )

        expect(result).toBeNull()
      })
    })

    describe('error state handling', () => {
      test('should return null when current step has error status', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          status: StepStatus.Error,
          error: 'Some error'
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData: new Map()
          },
          {}
        )

        expect(result).toBeNull()
      })

      test('should return null when current step is loading', () => {
        const currentStepInfo: CurrentStepInfo = {
          stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          status: StepStatus.Loading
        }
        
        const result = service.getNextStepDetails(
          currentStepInfo,
          0,
          {
            rawTranscripts: [createMockTranscript('t1')],
            processedData: new Map()
          },
          {}
        )

        expect(result).toBeNull()
      })
    })
  })
})