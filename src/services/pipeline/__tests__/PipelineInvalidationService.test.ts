import { describe, test, expect, vi } from 'vitest'
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

  describe('Special Cases', () => {
    test('should handle P1.4 invalidation with phase cleanup', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p1_4_output: { specificDiachronicStructure: {} },
          p1_4_mermaid_syntax: 'graph TD',
          isFullyProcessedSpecificDiachronic: true,
          phases_for_p2s_processing: ['phase1', 'phase2'],
          current_phase_for_p2s_processing: 'phase1',
          processed_phases_for_p2s: ['phase1'],
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { groups: [] },
              p2s_2_output: { sss: [] },
              p2s_3_output: { structure: {} },
              p2s_3_mermaid_syntax: 'graph TD'
            }
          },
          isFullyProcessedSpecificSynchronic: true
        }]
      ])
      
      const result = service.getInvalidatedStates(
        StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
        't1',
        processedData,
        {}
      )
      
      const updatedData = result.invalidatedProcessedData.get('t1')
      expect(updatedData?.p1_4_output).toBeUndefined()
      expect(updatedData?.p1_4_mermaid_syntax).toBeUndefined()
      expect(updatedData?.isFullyProcessedSpecificDiachronic).toBe(false)
      expect(updatedData?.phases_for_p2s_processing).toEqual([])
      expect(updatedData?.current_phase_for_p2s_processing).toBeUndefined()
      expect(updatedData?.processed_phases_for_p2s).toEqual([])
      expect(updatedData?.p2s_outputs_by_phase).toEqual({})
      expect(updatedData?.isFullyProcessedSpecificSynchronic).toBe(false)
    })

    test('should handle P3.3 invalidation with GDU cleanup', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        p3_3_output: { genericDiachronicStructure: {} },
        p3_3_mermaid_syntax: 'graph TD',
        isFullyProcessedGenericDiachronic: true,
        core_gdus_for_sync_analysis: ['gdu1', 'gdu2'],
        p4s_1_a_outputs_by_gdu: {
          gdu1: { nodes: [] },
          gdu2: { nodes: [] }
        },
        p4s_outputs_by_gdu: {
          gdu1: { p4s_1_b_output: { gss: [] } },
          gdu2: { p4s_1_b_output: { gss: [] } }
        },
        p4s_mermaid_syntax_by_gdu: {
          gdu1: 'graph TD',
          gdu2: 'graph TD'
        },
        current_gdu_for_p4s_processing: 'gdu1',
        processed_gdus_for_p4s: ['gdu1'],
        isFullyProcessedGenericSynchronic: true
      }
      
      const result = service.getInvalidatedStates(
        StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
        undefined,
        new Map(),
        genericState
      )
      
      expect(result.invalidatedGenericState.p3_3_output).toBeUndefined()
      expect(result.invalidatedGenericState.p3_3_mermaid_syntax).toBeUndefined()
      expect(result.invalidatedGenericState.isFullyProcessedGenericDiachronic).toBe(false)
      expect(result.invalidatedGenericState.core_gdus_for_sync_analysis).toEqual([])
      expect(result.invalidatedGenericState.p4s_1_a_outputs_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.p4s_1_a_error).toBeUndefined()
      expect(result.invalidatedGenericState.p4s_outputs_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.p4s_mermaid_syntax_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.p4s_1_b_error).toBeUndefined()
      expect(result.invalidatedGenericState.current_gdu_for_p4s_processing).toBeUndefined()
      expect(result.invalidatedGenericState.processed_gdus_for_p4s).toEqual([])
      expect(result.invalidatedGenericState.isFullyProcessedGenericSynchronic).toBe(false)
    })

    test('should handle P6.1 invalidation with report flag', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        p6_1_output: { report: 'Test report' },
        isReportGenerated: true,
        p7_1_output: { candidate_variables: [] }
      }
      
      const result = service.getInvalidatedStates(
        StepId.P6_1_GENERATE_MARKDOWN_REPORT,
        undefined,
        new Map(),
        genericState
      )
      
      expect(result.invalidatedGenericState.p6_1_output).toBeUndefined()
      expect(result.invalidatedGenericState.isReportGenerated).toBe(false)
      // P7.1 should remain intact (P6.1 is at the end, after P7 steps)
      expect(result.invalidatedGenericState.p7_1_output).toBeDefined()
    })

    test('should handle P7.3 invalidation with DAG mermaid cleanup', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        p7_3_output: { dag: {} },
        p7_3_mermaid_syntax_dag: 'graph TD\nA-->B',
        p7_3b_output: { cleanedDag: {} },
        p7_3b_mermaid_syntax_dag: 'graph TD\nA-->B\nB-->C'
      }
      
      const result = service.getInvalidatedStates(
        StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        undefined,
        new Map(),
        genericState
      )
      
      expect(result.invalidatedGenericState.p7_3_output).toBeUndefined()
      expect(result.invalidatedGenericState.p7_3_mermaid_syntax_dag).toBeUndefined()
      // P7.3B should also be invalidated (cascade effect)
      expect(result.invalidatedGenericState.p7_3b_output).toBeUndefined()
      expect(result.invalidatedGenericState.p7_3b_mermaid_syntax_dag).toBeUndefined()
    })

    test('should handle P7.3B invalidation with mermaid cleanup', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        p7_3_output: { dag: {} },
        p7_3_mermaid_syntax_dag: 'graph TD\nA-->B',
        p7_3b_output: { cleanedDag: {} },
        p7_3b_mermaid_syntax_dag: 'graph TD\nA-->B\nB-->C'
      }
      
      const result = service.getInvalidatedStates(
        StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        undefined,
        new Map(),
        genericState
      )
      
      // P7.3 should NOT be invalidated (no upstream cascade)
      expect(result.invalidatedGenericState.p7_3_output).toBeDefined()
      expect(result.invalidatedGenericState.p7_3_mermaid_syntax_dag).toBeDefined()
      // Only P7.3B should be invalidated
      expect(result.invalidatedGenericState.p7_3b_output).toBeUndefined()
      expect(result.invalidatedGenericState.p7_3b_mermaid_syntax_dag).toBeUndefined()
    })

    test('should handle P2S.3 invalidation with mermaid cleanup', () => {
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
              p2s_3_mermaid_syntax: 'graph TD\nSSS1-->SSS2'
            },
            phase2: {
              p2s_1_output: { groups: [] },
              p2s_2_output: { sss: [] },
              p2s_3_output: { structure: {} },
              p2s_3_mermaid_syntax: 'graph TD\nSSS3-->SSS4'
            }
          },
          processed_phases_for_p2s: ['phase2']
        }]
      ])
      
      const result = service.getInvalidatedStates(
        StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
        't1',
        processedData,
        {}
      )
      
      const updatedData = result.invalidatedProcessedData.get('t1')
      const phase1Data = updatedData?.p2s_outputs_by_phase?.['phase1']
      const phase2Data = updatedData?.p2s_outputs_by_phase?.['phase2']
      
      // Only phase1 (current phase) should be affected
      expect(phase1Data?.p2s_3_output).toBeUndefined()
      expect(phase1Data?.p2s_3_mermaid_syntax).toBeUndefined()
      // phase2 should remain intact
      expect(phase2Data?.p2s_3_output).toBeDefined()
      expect(phase2Data?.p2s_3_mermaid_syntax).toBeDefined()
      // phase1 should be removed from processed phases
      expect(updatedData?.processed_phases_for_p2s).not.toContain('phase1')
      expect(updatedData?.processed_phases_for_p2s).toContain('phase2')
    })

    test('should handle P4S.1B invalidation with error cleanup', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        p4s_1_a_outputs_by_gdu: {
          gdu1: { nodes: [] }
        },
        p4s_outputs_by_gdu: {
          gdu1: { p4s_1_b_output: { gss: [] } }
        },
        p4s_mermaid_syntax_by_gdu: {
          gdu1: 'graph TD'
        },
        p4s_1_b_error: 'Previous error',
        processed_gdus_for_p4s: ['gdu1'],
        isFullyProcessedGenericSynchronic: true
      }
      
      const result = service.getInvalidatedStates(
        StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        undefined,
        new Map(),
        genericState
      )
      
      // P4S_1_A outputs should remain intact
      expect(result.invalidatedGenericState.p4s_1_a_outputs_by_gdu).toBeDefined()
      // P4S_1_B outputs should be cleared
      expect(result.invalidatedGenericState.p4s_outputs_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.p4s_mermaid_syntax_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.p4s_1_b_error).toBeUndefined()
      expect(result.invalidatedGenericState.processed_gdus_for_p4s).toEqual([])
      expect(result.invalidatedGenericState.isFullyProcessedGenericSynchronic).toBe(false)
    })
  })

  describe('Cascade Logic', () => {
    test('should trigger global cascade when per-transcript step is invalidated', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true },
          p1_1_output: { periods: [] }
        }]
      ])
      
      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] },
        p3_2_output: { gdus: [] },
        p5_1_output: { analysis_summary: 'test' }
      }
      
      const result = service.getInvalidatedStates(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't1',
        processedData,
        genericState
      )
      
      // Per-transcript data should be invalidated
      const updatedData = result.invalidatedProcessedData.get('t1')
      expect(updatedData?.p0_1_output).toBeUndefined()
      expect(updatedData?.p1_1_output).toBeUndefined()
      
      // Global data should also be invalidated due to cascade
      expect(result.invalidatedGenericState.p3_1_output).toBeUndefined()
      expect(result.invalidatedGenericState.p3_2_output).toBeUndefined()
      expect(result.invalidatedGenericState.p5_1_output).toBeUndefined()
    })

    test('should not cascade upstream when invalidating downstream step', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] },
        p3_2_output: { gdus: [] },
        p3_3_output: { genericDiachronicStructure: {} },
        p5_1_output: { analysis_summary: 'test' }
      }
      
      const result = service.getInvalidatedStates(
        StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
        undefined,
        new Map(),
        genericState
      )
      
      // Upstream steps should remain intact
      expect(result.invalidatedGenericState.p3_1_output).toBeDefined()
      expect(result.invalidatedGenericState.p3_2_output).toBeDefined()
      expect(result.invalidatedGenericState.p3_3_output).toBeDefined()
      // Only P5.1 and downstream should be invalidated
      expect(result.invalidatedGenericState.p5_1_output).toBeUndefined()
    })

    test('should handle multiple transcript invalidation independently', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test1.txt',
          p0_1_output: { hasCleanSpeakerLabels: true },
          p0_2_output: { extractedFeatures: [] }
        }],
        ['t2', {
          id: 't2',
          filename: 'test2.txt',
          p0_1_output: { hasCleanSpeakerLabels: true },
          p0_2_output: { extractedFeatures: [] }
        }]
      ])
      
      const result = service.getInvalidatedStates(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't1',
        processedData,
        {}
      )
      
      // Only t1 should be affected
      const t1Data = result.invalidatedProcessedData.get('t1')
      expect(t1Data?.p0_1_output).toBeUndefined()
      expect(t1Data?.p0_2_output).toBeUndefined()
      
      // t2 should remain intact
      const t2Data = result.invalidatedProcessedData.get('t2')
      expect(t2Data?.p0_1_output).toBeDefined()
      expect(t2Data?.p0_2_output).toBeDefined()
    })

    test('should handle phase-specific P2S cascade correctly', () => {
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
              p2s_3_output: { structure: {} }
            },
            phase2: {
              p2s_1_output: { groups: [] },
              p2s_2_output: { sss: [] }
            }
          },
          processed_phases_for_p2s: ['phase2']
        }]
      ])
      
      // Invalidate P2S.1 which should cascade to P2S.2 and P2S.3 within the same phase
      const result = service.getInvalidatedStates(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        't1',
        processedData,
        {}
      )
      
      const updatedData = result.invalidatedProcessedData.get('t1')
      const phase1Data = updatedData?.p2s_outputs_by_phase?.['phase1']
      const phase2Data = updatedData?.p2s_outputs_by_phase?.['phase2']
      
      // phase1 should have all steps invalidated
      expect(phase1Data?.p2s_1_output).toBeUndefined()
      expect(phase1Data?.p2s_2_output).toBeUndefined()
      expect(phase1Data?.p2s_3_output).toBeUndefined()
      
      // phase2 should remain intact
      expect(phase2Data?.p2s_1_output).toBeDefined()
      expect(phase2Data?.p2s_2_output).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    test('should handle invalid step ID gracefully', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true }
        }]
      ])
      
      const result = service.getInvalidatedStates(
        'INVALID_STEP_ID' as StepId,
        't1',
        processedData,
        {}
      )
      
      // Should return unchanged data
      expect(result.invalidatedProcessedData).toEqual(processedData)
      expect(result.invalidatedGenericState).toEqual({})
    })

    test('should handle missing transcript gracefully', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true }
        }]
      ])
      
      const result = service.invalidateStep(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't2', // Non-existent transcript
        processedData,
        {}
      )
      
      // Should return unchanged data
      expect(result.processedData.get('t1')?.p0_1_output).toBeDefined()
      expect(result.processedData.has('t2')).toBe(false)
    })

    test('should handle empty processed data', () => {
      const service = new PipelineInvalidationService()
      
      const result = service.getInvalidatedStates(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't1',
        new Map(),
        {}
      )
      
      expect(result.invalidatedProcessedData.size).toBe(0)
      // The service adds side effects for certain steps even with empty data
      // Check that at least the basic structure is returned
      expect(result.invalidatedGenericState).toBeDefined()
    })

    test('should handle missing current phase for P2S steps', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          // No current_phase_for_p2s_processing
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { groups: [] }
            }
          }
        }]
      ])
      
      const result = service.getInvalidatedStates(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        't1',
        processedData,
        {}
      )
      
      // Should handle gracefully without errors
      const updatedData = result.invalidatedProcessedData.get('t1')
      expect(updatedData?.p2s_outputs_by_phase?.['phase1']?.p2s_1_output).toBeDefined()
    })

    test('should handle step with no data key prefix', () => {
      const service = new PipelineInvalidationService()
      
      const result = service.invalidateStep(
        StepId.IDLE, // Step with no data key prefix
        undefined,
        new Map(),
        {}
      )
      
      expect(result.processedData.size).toBe(0)
      expect(result.genericState).toEqual({})
    })

    test('should handle error key invalidation', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true },
          p0_1_error: 'Previous error',
          p0_2_output: { extractedFeatures: [] },
          p0_2_error: 'Another error'
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
      // Other step's data should remain
      expect(updatedData?.p0_2_output).toBeDefined()
      expect(updatedData?.p0_2_error).toBeDefined()
    })

    test('should preserve unrelated data during invalidation', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          content: 'Test content',
          p0_1_output: { hasCleanSpeakerLabels: true },
          p1_1_output: { periods: [] },
          // Custom fields that should be preserved
          customField: 'custom value'
        } as any]
      ])
      
      const result = service.getInvalidatedStates(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't1',
        processedData,
        {}
      )
      
      const updatedData = result.invalidatedProcessedData.get('t1')
      expect(updatedData?.p0_1_output).toBeUndefined()
      expect(updatedData?.p1_1_output).toBeUndefined()
      // Core fields should be preserved
      expect(updatedData?.id).toBe('t1')
      expect(updatedData?.filename).toBe('test.txt')
      expect(updatedData?.content).toBe('Test content')
      expect((updatedData as any)?.customField).toBe('custom value')
    })

    test('should handle complex nested phase data structures', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          current_phase_for_p2s_processing: 'phase1',
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { groups: ['g1', 'g2'] },
              p2s_1_error: 'Error 1',
              p2s_2_output: { sss: ['sss1', 'sss2'] },
              p2s_2_error: 'Error 2',
              p2s_3_output: { structure: { nodes: [], edges: [] } },
              p2s_3_error: 'Error 3',
              p2s_3_mermaid_syntax: 'graph TD\nA-->B'
            }
          },
          processed_phases_for_p2s: ['phase1']
        }]
      ])
      
      const result = service.getInvalidatedStates(
        StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS, // Fixed step ID
        't1',
        processedData,
        {}
      )
      
      const updatedData = result.invalidatedProcessedData.get('t1')
      const phase1Data = updatedData?.p2s_outputs_by_phase?.['phase1']
      
      // P2S.1 should remain intact
      expect(phase1Data?.p2s_1_output).toBeDefined()
      expect(phase1Data?.p2s_1_error).toBeDefined()
      // P2S.2 and downstream P2S.3 should be invalidated (cascade happens)
      expect(phase1Data?.p2s_2_output).toBeUndefined()
      expect(phase1Data?.p2s_2_error).toBeUndefined()
      expect(phase1Data?.p2s_3_output).toBeUndefined()
      expect(phase1Data?.p2s_3_error).toBeUndefined()
      expect(phase1Data?.p2s_3_mermaid_syntax).toBeUndefined()
      // Phase should be removed from processed phases
      expect(updatedData?.processed_phases_for_p2s).not.toContain('phase1')
    })
  })

  describe('Upstream Non-Invalidation', () => {
    test('should not invalidate upstream steps when invalidating P3.2', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] },
        p3_2_output: { gdus: [] },
        p3_3_output: { genericDiachronicStructure: {} }
      }
      
      const result = service.getInvalidatedStates(
        StepId.P3_2_IDENTIFY_GDUS,
        undefined,
        new Map(),
        genericState
      )
      
      // P3.1 should remain intact (upstream)
      expect(result.invalidatedGenericState.p3_1_output).toBeDefined()
      // P3.2 and P3.3 should be invalidated (cascade happens)
      expect(result.invalidatedGenericState.p3_2_output).toBeUndefined()
      expect(result.invalidatedGenericState.p3_3_output).toBeUndefined()
    })

    test('should not invalidate P1.4 when invalidating P2S steps', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p1_4_output: { specificDiachronicStructure: {} },
          p1_4_mermaid_syntax: 'graph TD',
          current_phase_for_p2s_processing: 'phase1',
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { groups: [] }
            }
          }
        }]
      ])
      
      const result = service.getInvalidatedStates(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        't1',
        processedData,
        {}
      )
      
      const updatedData = result.invalidatedProcessedData.get('t1')
      // P1.4 should remain intact
      expect(updatedData?.p1_4_output).toBeDefined()
      expect(updatedData?.p1_4_mermaid_syntax).toBeDefined()
      // P2S.1 should be invalidated
      expect(updatedData?.p2s_outputs_by_phase?.['phase1']?.p2s_1_output).toBeUndefined()
    })

    test('should not invalidate P3.3 when invalidating P4S steps', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        p3_3_output: { genericDiachronicStructure: {} },
        p3_3_mermaid_syntax: 'graph TD',
        p4s_1_a_outputs_by_gdu: {
          gdu1: { nodes: [] }
        },
        p4s_outputs_by_gdu: {
          gdu1: { p4s_1_b_output: { gss: [] } }
        }
      }
      
      const result = service.getInvalidatedStates(
        StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        new Map(),
        genericState
      )
      
      // P3.3 should remain intact
      expect(result.invalidatedGenericState.p3_3_output).toBeDefined()
      expect(result.invalidatedGenericState.p3_3_mermaid_syntax).toBeDefined()
      // P4S data should be invalidated
      expect(result.invalidatedGenericState.p4s_1_a_outputs_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.p4s_outputs_by_gdu).toEqual({})
    })
  })

  describe('Additional Comprehensive Tests', () => {
    test('should handle cascading through multiple transcript phases', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p1_1_output: { periods: [] },
          p1_2_output: { diachronicUnits: [] },
          p1_3_output: { refinedDiachronicUnits: [] },
          p1_4_output: { specificDiachronicStructure: {} },
          phases_for_p2s_processing: ['phase1', 'phase2'],
          current_phase_for_p2s_processing: 'phase1',
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { groups: [] }
            }
          }
        }]
      ])
      
      // Invalidating P1.2 should cascade through P1.3, P1.4, and clear P2S data
      const result = service.getInvalidatedStates(
        StepId.P1_2_DIACHRONIC_UNIT_ID,
        't1',
        processedData,
        {}
      )
      
      const updatedData = result.invalidatedProcessedData.get('t1')
      expect(updatedData?.p1_1_output).toBeDefined() // Upstream intact
      expect(updatedData?.p1_2_output).toBeUndefined()
      expect(updatedData?.p1_3_output).toBeUndefined()
      expect(updatedData?.p1_4_output).toBeUndefined()
      expect(updatedData?.phases_for_p2s_processing).toEqual([])
      expect(updatedData?.p2s_outputs_by_phase).toEqual({})
    })

    test('should handle mixed per-transcript and global invalidation', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test1.txt',
          p0_1_output: { hasCleanSpeakerLabels: true }
        }],
        ['t2', {
          id: 't2',
          filename: 'test2.txt',
          p0_1_output: { hasCleanSpeakerLabels: true }
        }]
      ])
      
      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] },
        p4s_1_a_outputs_by_gdu: { gdu1: { nodes: [] } },
        p5_1_output: { analysis_summary: 'test' },
        p7_1_output: { candidate_variables: [] }
      }
      
      // Invalidating a per-transcript step should trigger global cascade
      const result = service.getInvalidatedStates(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't1',
        processedData,
        genericState
      )
      
      // Only t1 should be affected at transcript level
      expect(result.invalidatedProcessedData.get('t1')?.p0_1_output).toBeUndefined()
      expect(result.invalidatedProcessedData.get('t2')?.p0_1_output).toBeDefined()
      
      // But all global steps should be invalidated
      expect(result.invalidatedGenericState.p3_1_output).toBeUndefined()
      expect(result.invalidatedGenericState.p4s_1_a_outputs_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.p5_1_output).toBeUndefined()
      expect(result.invalidatedGenericState.p7_1_output).toBeUndefined()
    })

    test('should handle P7 steps with proper cleanup', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        p7_1_output: { candidate_variables: [] },
        p7_2_output: { proposed_links: [] },
        p7_3_output: { dag: {} },
        p7_3_mermaid_syntax_dag: 'graph TD\nA-->B',
        p7_3b_output: { cleanedDag: {} },
        p7_3b_mermaid_syntax_dag: 'graph TD\nA-->B\nB-->C',
        p7_4_output: { paths: [] },
        p7_5_output: { hypotheses: [] }
      }
      
      // Invalidating P7.2 should cascade through remaining P7 steps
      const result = service.getInvalidatedStates(
        StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
        undefined,
        new Map(),
        genericState
      )
      
      expect(result.invalidatedGenericState.p7_1_output).toBeDefined() // Upstream intact
      expect(result.invalidatedGenericState.p7_2_output).toBeUndefined()
      expect(result.invalidatedGenericState.p7_3_output).toBeUndefined()
      expect(result.invalidatedGenericState.p7_3_mermaid_syntax_dag).toBeUndefined()
      expect(result.invalidatedGenericState.p7_3b_output).toBeUndefined()
      expect(result.invalidatedGenericState.p7_3b_mermaid_syntax_dag).toBeUndefined()
      expect(result.invalidatedGenericState.p7_4_output).toBeUndefined()
      expect(result.invalidatedGenericState.p7_5_output).toBeUndefined()
    })

    test('should handle multiple GDUs in P4S invalidation', () => {
      const service = new PipelineInvalidationService()
      
      const genericState: GenericAnalysisState = {
        core_gdus_for_sync_analysis: ['gdu1', 'gdu2', 'gdu3'],
        p4s_1_a_outputs_by_gdu: {
          gdu1: { nodes: ['n1'] },
          gdu2: { nodes: ['n2'] },
          gdu3: { nodes: ['n3'] }
        },
        p4s_outputs_by_gdu: {
          gdu1: { p4s_1_b_output: { gss: ['gss1'] } },
          gdu2: { p4s_1_b_output: { gss: ['gss2'] } },
          gdu3: { p4s_1_b_output: { gss: ['gss3'] } }
        },
        p4s_mermaid_syntax_by_gdu: {
          gdu1: 'graph TD\nGSS1',
          gdu2: 'graph TD\nGSS2',
          gdu3: 'graph TD\nGSS3'
        },
        processed_gdus_for_p4s: ['gdu1', 'gdu2', 'gdu3']
      }
      
      // Invalidating P4S_1_A should clear all GDU data
      const result = service.getInvalidatedStates(
        StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        new Map(),
        genericState
      )
      
      expect(result.invalidatedGenericState.core_gdus_for_sync_analysis).toBeDefined() // This comes from P3.3
      expect(result.invalidatedGenericState.p4s_1_a_outputs_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.p4s_outputs_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.p4s_mermaid_syntax_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.processed_gdus_for_p4s).toEqual([])
    })

    test('should handle IDLE and COMPLETE steps gracefully', () => {
      const service = new PipelineInvalidationService()
      
      // These steps should be skipped in invalidation
      const result1 = service.getInvalidatedStates(
        StepId.IDLE,
        undefined,
        new Map(),
        {}
      )
      
      expect(result1.invalidatedProcessedData.size).toBe(0)
      expect(result1.invalidatedGenericState).toEqual({})
      
      const result2 = service.getInvalidatedStates(
        StepId.COMPLETE,
        undefined,
        new Map(),
        {}
      )
      
      expect(result2.invalidatedProcessedData.size).toBe(0)
      expect(result2.invalidatedGenericState).toEqual({})
    })

    test('should handle invalidateStep method correctly', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true },
          p0_1_error: 'Previous error',
          p0_2_output: { extractedFeatures: [] }
        }]
      ])
      
      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] },
        p3_1_error: 'Global error'
      }
      
      // Test per-transcript invalidation
      const result1 = service.invalidateStep(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't1',
        processedData,
        genericState
      )
      
      const t1Data = result1.processedData.get('t1')
      expect(t1Data?.p0_1_output).toBeUndefined()
      expect(t1Data?.p0_1_error).toBeUndefined()
      expect(t1Data?.p0_2_output).toBeDefined() // Not cascaded
      expect(result1.genericState.p3_1_output).toBeDefined() // Not affected
      
      // Test global invalidation
      const result2 = service.invalidateStep(
        StepId.P3_1_ALIGN_STRUCTURES,
        undefined,
        processedData,
        genericState
      )
      
      expect(result2.genericState.p3_1_output).toBeUndefined()
      expect(result2.genericState.p3_1_error).toBeUndefined()
      expect(result2.processedData.get('t1')?.p0_1_output).toBeDefined() // Not affected
    })

    test('should handle concurrent phase and GDU processing state', () => {
      const service = new PipelineInvalidationService()
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          current_phase_for_p2s_processing: 'phase1',
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { groups: [] },
              p2s_2_output: { sss: [] }
            },
            phase2: {
              p2s_1_output: { groups: [] },
              p2s_2_output: { sss: [] },
              p2s_3_output: { structure: {} }
            }
          },
          processed_phases_for_p2s: ['phase2']
        }]
      ])
      
      const genericState: GenericAnalysisState = {
        current_gdu_for_p4s_processing: 'gdu1',
        p4s_outputs_by_gdu: {
          gdu1: { p4s_1_b_output: { gss: [] } },
          gdu2: { p4s_1_b_output: { gss: [] } }
        },
        processed_gdus_for_p4s: ['gdu2']
      }
      
      // Invalidating P2S should not affect P4S processing state
      const result = service.getInvalidatedStates(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        't1',
        processedData,
        genericState
      )
      
      // Current phase (phase1) should be invalidated
      const updatedData = result.invalidatedProcessedData.get('t1')
      expect(updatedData?.p2s_outputs_by_phase?.['phase1']?.p2s_1_output).toBeUndefined()
      expect(updatedData?.p2s_outputs_by_phase?.['phase1']?.p2s_2_output).toBeUndefined()
      
      // phase2 should remain intact
      expect(updatedData?.p2s_outputs_by_phase?.['phase2']?.p2s_1_output).toBeDefined()
      expect(updatedData?.p2s_outputs_by_phase?.['phase2']?.p2s_3_output).toBeDefined()
      expect(updatedData?.processed_phases_for_p2s).toEqual(['phase2'])
      
      // But global cascade should clear P4S data
      expect(result.invalidatedGenericState.current_gdu_for_p4s_processing).toBeUndefined()
      expect(result.invalidatedGenericState.p4s_outputs_by_gdu).toEqual({})
      expect(result.invalidatedGenericState.processed_gdus_for_p4s).toEqual([])
    })
  })
})