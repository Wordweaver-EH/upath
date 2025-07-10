import { describe, test, expect } from 'vitest'
import { PipelineInvalidationService } from '../PipelineInvalidationService'
import { StepId, TranscriptProcessedData, GenericAnalysisState } from '../../../../types'

describe('PipelineInvalidationService', () => {
  test('should invalidate single transcript step output', () => {
    const service = new PipelineInvalidationService()
    
    const processedData = new Map<string, TranscriptProcessedData>([
      ['t1', {
        id: 't1',
        filename: 'test.txt',
        p0_1_output: { hasCleanSpeakerLabels: true },
        p0_2_output: { extractedFeatures: [] }
      }]
    ])
    
    const result = service.invalidateStep(
      StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      't1',
      processedData,
      {}
    )
    
    const updatedData = result.processedData.get('t1')
    expect(updatedData?.p0_1_output).toBeUndefined()
    expect(updatedData?.p0_1_error).toBeUndefined()
    // Other data should remain
    expect(updatedData?.p0_2_output).toBeDefined()
  })

  test('should cascade invalidation to dependent steps', () => {
    const service = new PipelineInvalidationService()
    
    const processedData = new Map<string, TranscriptProcessedData>([
      ['t1', {
        id: 't1',
        filename: 'test.txt',
        p0_1_output: { hasCleanSpeakerLabels: true },
        p0_2_output: { extractedFeatures: [] },
        p0_3_output: { speakerCount: 2 },
        p1_1_output: { periods: [] }
      }]
    ])
    
    // Invalidating P0_1 should cascade to P0_2, P0_3, and beyond
    const result = service.getInvalidatedStates(
      StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      't1',
      processedData,
      {}
    )
    
    const updatedData = result.invalidatedProcessedData.get('t1')
    expect(updatedData?.p0_1_output).toBeUndefined()
    expect(updatedData?.p0_2_output).toBeUndefined()
    expect(updatedData?.p0_3_output).toBeUndefined()
    expect(updatedData?.p1_1_output).toBeUndefined()
  })

  test('should invalidate global step output', () => {
    const service = new PipelineInvalidationService()
    
    const genericState: GenericAnalysisState = {
      p3_1_output: { alignments: [] },
      p3_1_error: 'Previous error',
      p3_2_output: { gdus: [] }
    }
    
    const result = service.invalidateStep(
      StepId.P3_1_ALIGN_STRUCTURES,
      undefined,
      new Map(),
      genericState
    )
    
    expect(result.genericState.p3_1_output).toBeUndefined()
    expect(result.genericState.p3_1_error).toBeUndefined()
    // Other data should remain
    expect(result.genericState.p3_2_output).toBeDefined()
  })

  test('should handle P2S phase invalidation', () => {
    const service = new PipelineInvalidationService()
    
    const processedData = new Map<string, TranscriptProcessedData>([
      ['t1', {
        id: 't1',
        filename: 'test.txt',
        current_phase_for_p2s_processing: 'phase1',
        p2s_outputs_by_phase: {
          phase1: {
            p2s_1_output: { groups: [] },
            p2s_2_output: { sss: [] },
            p2s_3_output: { structure: {} },
            p2s_3_mermaid_syntax: 'graph TD'
          }
        },
        processed_phases_for_p2s: ['phase1']
      }]
    ])
    
    const result = service.getInvalidatedStates(
      StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
      't1',
      processedData,
      {}
    )
    
    const updatedData = result.invalidatedProcessedData.get('t1')
    const phaseData = updatedData?.p2s_outputs_by_phase?.['phase1']
    expect(phaseData?.p2s_1_output).toBeUndefined()
    expect(phaseData?.p2s_2_output).toBeUndefined()
    expect(phaseData?.p2s_3_output).toBeUndefined()
    expect(phaseData?.p2s_3_mermaid_syntax).toBeUndefined()
    // Phase should be removed from processed phases
    expect(updatedData?.processed_phases_for_p2s).not.toContain('phase1')
  })

  test('should handle P4S GDU invalidation', () => {
    const service = new PipelineInvalidationService()
    
    const genericState: GenericAnalysisState = {
      p4s_outputs_by_gdu: {
        gdu1: {
          p4s_1_b_output: { gss: [] }
        },
        gdu2: {
          p4s_1_b_output: { gss: [] }
        }
      },
      p4s_mermaid_syntax_by_gdu: {
        gdu1: 'graph TD',
        gdu2: 'graph TD'
      },
      processed_gdus_for_p4s: ['gdu1', 'gdu2']
    }
    
    const result = service.getInvalidatedStates(
      StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
      undefined,
      new Map(),
      genericState
    )
    
    // All P4S data should be cleared when P4S_1_A is invalidated
    expect(result.invalidatedGenericState.p4s_outputs_by_gdu).toEqual({})
    expect(result.invalidatedGenericState.p4s_mermaid_syntax_by_gdu).toEqual({})
    expect(result.invalidatedGenericState.processed_gdus_for_p4s).toEqual([])
  })
})