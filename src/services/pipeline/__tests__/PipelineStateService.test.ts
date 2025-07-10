import { describe, test, expect } from 'vitest'
import { PipelineStateService } from '../PipelineStateService'
import { StepId, StepStatus, TranscriptProcessedData, GenericAnalysisState } from '../../../../types'

describe('PipelineStateService', () => {
  test('should return idle status for unprocessed step', () => {
    const service = new PipelineStateService()
    const processedData = new Map<string, TranscriptProcessedData>()
    const genericState: GenericAnalysisState = {}
    
    const status = service.getStepStatus(
      StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      't1',
      processedData,
      genericState
    )
    
    expect(status).toBe(StepStatus.Idle)
  })

  test('should return success status for transcript step with output', () => {
    const service = new PipelineStateService()
    const processedData = new Map<string, TranscriptProcessedData>([
      ['t1', {
        id: 't1',
        filename: 'test.txt',
        p0_1_output: { hasCleanSpeakerLabels: true }
      }]
    ])
    const genericState: GenericAnalysisState = {}
    
    const status = service.getStepStatus(
      StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      't1',
      processedData,
      genericState
    )
    
    expect(status).toBe(StepStatus.Success)
  })

  test('should return error status for transcript step with error', () => {
    const service = new PipelineStateService()
    const processedData = new Map<string, TranscriptProcessedData>([
      ['t1', {
        id: 't1',
        filename: 'test.txt',
        p0_1_error: 'API failed'
      }]
    ])
    const genericState: GenericAnalysisState = {}
    
    const status = service.getStepStatus(
      StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      't1',
      processedData,
      genericState
    )
    
    expect(status).toBe(StepStatus.Error)
  })

  test('should return success status for global step with output', () => {
    const service = new PipelineStateService()
    const processedData = new Map<string, TranscriptProcessedData>()
    const genericState: GenericAnalysisState = {
      p3_1_output: { alignments: [] }
    }
    
    const status = service.getStepStatus(
      StepId.P3_1_ALIGN_STRUCTURES,
      undefined,
      processedData,
      genericState
    )
    
    expect(status).toBe(StepStatus.Success)
  })

  test('should return error status for global step with error', () => {
    const service = new PipelineStateService()
    const processedData = new Map<string, TranscriptProcessedData>()
    const genericState: GenericAnalysisState = {
      p3_1_error: 'Processing failed'
    }
    
    const status = service.getStepStatus(
      StepId.P3_1_ALIGN_STRUCTURES,
      undefined,
      processedData,
      genericState
    )
    
    expect(status).toBe(StepStatus.Error)
  })

  test('should handle P2S phase-specific steps', () => {
    const service = new PipelineStateService()
    const processedData = new Map<string, TranscriptProcessedData>([
      ['t1', {
        id: 't1',
        filename: 'test.txt',
        current_phase_for_p2s_processing: 'phase1',
        p2s_outputs_by_phase: {
          phase1: {
            p2s_1_output: { groups: [] }
          }
        }
      }]
    ])
    const genericState: GenericAnalysisState = {}
    
    const status = service.getStepStatus(
      StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
      't1',
      processedData,
      genericState,
      'phase1'
    )
    
    expect(status).toBe(StepStatus.Success)
  })

  test('should handle P4S GDU-specific steps', () => {
    const service = new PipelineStateService()
    const processedData = new Map<string, TranscriptProcessedData>()
    const genericState: GenericAnalysisState = {
      current_gdu_for_p4s_processing: 'gdu1',
      p4s_outputs_by_gdu: {
        gdu1: {
          p4s_1_b_output: { gss: [] }
        }
      }
    }
    
    const status = service.getStepStatus(
      StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
      undefined,
      processedData,
      genericState,
      undefined,
      'gdu1'
    )
    
    expect(status).toBe(StepStatus.Success)
  })
})