import { describe, test, expect, vi } from 'vitest'
import { PipelineInvalidationService } from '../PipelineInvalidationService'
import { StepId, TranscriptProcessedData, GenericAnalysisState, P2SPhaseData } from '../../../../types'

describe('PipelineInvalidationService - Edge Cases', () => {
  let service: PipelineInvalidationService

  beforeEach(() => {
    service = new PipelineInvalidationService()
  })

  describe('Invalid Step IDs', () => {
    test('should handle completely invalid step ID', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true }
        }]
      ])

      const result = service.getInvalidatedStates(
        'COMPLETELY_INVALID_STEP' as StepId,
        't1',
        processedData,
        {}
      )

      // Should return unchanged data
      expect(result.invalidatedProcessedData).toEqual(processedData)
      expect(result.invalidatedGenericState).toEqual({})
    })

    test('should handle null/undefined step ID', () => {
      const processedData = new Map<string, TranscriptProcessedData>()
      
      const result = service.getInvalidatedStates(
        null as any,
        't1',
        processedData,
        {}
      )

      expect(result.invalidatedProcessedData).toEqual(processedData)
      expect(result.invalidatedGenericState).toEqual({})
    })

    test('should handle step ID without data key prefix', () => {
      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] }
      }

      // IDLE and COMPLETE have no data key prefix
      const result = service.invalidateStep(
        StepId.IDLE,
        undefined,
        new Map(),
        genericState
      )

      expect(result.genericState).toEqual(genericState)
    })
  })

  describe('Missing Transcript Data', () => {
    test('should handle invalidation for non-existent transcript', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true }
        }]
      ])

      const result = service.invalidateStep(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        'non-existent-transcript',
        processedData,
        {}
      )

      // Should not crash, should return unchanged data
      expect(result.processedData.has('non-existent-transcript')).toBe(false)
      expect(result.processedData.get('t1')?.p0_1_output).toBeDefined()
    })

    test('should handle empty transcript ID for per-transcript step', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true }
        }]
      ])

      const result = service.invalidateStep(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        '', // Empty string
        processedData,
        {}
      )

      // Should not modify any transcript data
      expect(result.processedData.get('t1')?.p0_1_output).toBeDefined()
    })

    test('should handle null processedData map', () => {
      const result = service.getInvalidatedStates(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't1',
        null as any,
        {}
      )

      // Should handle gracefully
      expect(result.invalidatedProcessedData).toBeDefined()
      expect(result.invalidatedGenericState).toBeDefined()
    })
  })

  describe('P2S Phase Edge Cases', () => {
    test('should handle missing current_phase_for_p2s_processing', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { groups: [] },
              p2s_2_output: { sss: [] }
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

      // Should handle gracefully without current phase
      const updatedData = result.invalidatedProcessedData.get('t1')
      expect(updatedData?.p2s_outputs_by_phase?.['phase1']?.p2s_1_output).toBeDefined()
    })

    test('should handle null p2s_outputs_by_phase', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          current_phase_for_p2s_processing: 'phase1',
          p2s_outputs_by_phase: null as any
        }]
      ])

      const result = service.getInvalidatedStates(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        't1',
        processedData,
        {}
      )

      // Should not crash
      expect(result.invalidatedProcessedData.get('t1')).toBeDefined()
    })

    test('should handle empty phase name', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          current_phase_for_p2s_processing: '', // Empty phase
          p2s_outputs_by_phase: {
            '': {
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

      // Should handle empty phase name
      const updatedData = result.invalidatedProcessedData.get('t1')
      expect(updatedData?.p2s_outputs_by_phase?.['']).toBeDefined()
    })

    test('should handle phase not in p2s_outputs_by_phase', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          current_phase_for_p2s_processing: 'phase2',
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { groups: [] }
            }
            // phase2 doesn't exist
          }
        }]
      ])

      const result = service.getInvalidatedStates(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        't1',
        processedData,
        {}
      )

      // Should not affect phase1
      const updatedData = result.invalidatedProcessedData.get('t1')
      expect(updatedData?.p2s_outputs_by_phase?.['phase1']?.p2s_1_output).toBeDefined()
    })
  })

  describe('P4S GDU Edge Cases', () => {
    test('should handle empty core_gdus_for_sync_analysis', () => {
      const genericState: GenericAnalysisState = {
        core_gdus_for_sync_analysis: [],
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

      // Should clear all P4S data even with empty GDUs
      expect(result.invalidatedGenericState.p4s_outputs_by_gdu).toEqual({})
    })

    test('should handle null current_gdu_for_p4s_processing', () => {
      const genericState: GenericAnalysisState = {
        current_gdu_for_p4s_processing: null as any,
        p4s_outputs_by_gdu: {
          gdu1: { p4s_1_b_output: { gss: [] } }
        }
      }

      const result = service.getInvalidatedStates(
        StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        undefined,
        new Map(),
        genericState
      )

      // Should still clear P4S outputs
      expect(result.invalidatedGenericState.p4s_outputs_by_gdu).toEqual({})
    })

    test('should handle malformed p4s_outputs_by_gdu structure', () => {
      const genericState: GenericAnalysisState = {
        p4s_outputs_by_gdu: {
          gdu1: null as any,
          gdu2: { p4s_1_b_output: { gss: [] } }
        }
      }

      const result = service.getInvalidatedStates(
        StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        new Map(),
        genericState
      )

      // Should clear all regardless of malformed data
      expect(result.invalidatedGenericState.p4s_outputs_by_gdu).toEqual({})
    })
  })

  describe('Error Key Handling', () => {
    test('should handle error keys with various formats', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true },
          p0_1_error: 'Error 1',
          p0_2_output: { extractedFeatures: [] },
          p0_2_error: 'Error 2'
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
      expect(updatedData?.p0_2_output).toBeDefined()
      expect(updatedData?.p0_2_error).toBeDefined()
    })

    test('should handle steps without _output suffix', () => {
      const genericState: GenericAnalysisState = {
        p3_1: { alignments: [] } as any, // Wrong format
        p3_1_output: { alignments: [] },
        p3_1_error: 'Error'
      }

      const result = service.invalidateStep(
        StepId.P3_1_ALIGN_STRUCTURES,
        undefined,
        new Map(),
        genericState
      )

      // Should only clear the correct keys
      expect(result.genericState.p3_1).toBeDefined()
      expect(result.genericState.p3_1_output).toBeUndefined()
      expect(result.genericState.p3_1_error).toBeUndefined()
    })
  })

  describe('Complex Data Structures', () => {
    test('should preserve custom fields during invalidation', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          content: 'Test content',
          p0_1_output: { hasCleanSpeakerLabels: true },
          // Custom fields
          customField1: 'value1',
          customField2: { nested: 'data' },
          customArray: [1, 2, 3]
        } as any]
      ])

      const result = service.getInvalidatedStates(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't1',
        processedData,
        {}
      )

      const updatedData = result.invalidatedProcessedData.get('t1') as any
      expect(updatedData.p0_1_output).toBeUndefined()
      expect(updatedData.customField1).toBe('value1')
      expect(updatedData.customField2).toEqual({ nested: 'data' })
      expect(updatedData.customArray).toEqual([1, 2, 3])
    })

    test('should handle deeply nested phase data', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          current_phase_for_p2s_processing: 'phase1',
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { 
                groups: [
                  { id: 'g1', utterances: ['u1', 'u2'] },
                  { id: 'g2', utterances: ['u3', 'u4'] }
                ]
              },
              p2s_2_output: {
                sss: [
                  { id: 'sss1', groups: ['g1'] },
                  { id: 'sss2', groups: ['g2'] }
                ]
              },
              p2s_3_output: {
                structure: {
                  nodes: ['sss1', 'sss2'],
                  edges: [{ from: 'sss1', to: 'sss2' }]
                }
              },
              p2s_3_mermaid_syntax: 'graph TD\nSSS1-->SSS2'
            }
          },
          processed_phases_for_p2s: ['phase1']
        }]
      ])

      const result = service.getInvalidatedStates(
        StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
        't1',
        processedData,
        {}
      )

      const updatedData = result.invalidatedProcessedData.get('t1')
      const phase1Data = updatedData?.p2s_outputs_by_phase?.['phase1']
      
      // P2S.1 should be preserved with full structure
      expect(phase1Data?.p2s_1_output?.groups).toHaveLength(2)
      expect(phase1Data?.p2s_1_output?.groups[0].utterances).toEqual(['u1', 'u2'])
      
      // P2S.2 and downstream should be cleared
      expect(phase1Data?.p2s_2_output).toBeUndefined()
      expect(phase1Data?.p2s_3_output).toBeUndefined()
      expect(phase1Data?.p2s_3_mermaid_syntax).toBeUndefined()
    })
  })

  describe('Boundary Conditions', () => {
    test('should handle very large processedData map', () => {
      const processedData = new Map<string, TranscriptProcessedData>()
      
      // Create 1000 transcripts
      for (let i = 0; i < 1000; i++) {
        processedData.set(`t${i}`, {
          id: `t${i}`,
          filename: `test${i}.txt`,
          p0_1_output: { hasCleanSpeakerLabels: true }
        })
      }

      const result = service.getInvalidatedStates(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't500',
        processedData,
        {}
      )

      // Should only affect the specified transcript
      expect(result.invalidatedProcessedData.get('t500')?.p0_1_output).toBeUndefined()
      expect(result.invalidatedProcessedData.get('t499')?.p0_1_output).toBeDefined()
      expect(result.invalidatedProcessedData.get('t501')?.p0_1_output).toBeDefined()
    })

    test('should handle all steps being invalidated', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p_neg1_1_output: 'output',
          p0_1_output: { hasCleanSpeakerLabels: true },
          p0_2_output: { extractedFeatures: [] },
          p0_3_output: { speakerCount: 2 },
          p0_4_output: { cleanedTranscript: 'text' },
          p1_1_output: { periods: [] },
          p1_2_output: { diachronicUnits: [] },
          p1_3_output: { refinedDiachronicUnits: [] },
          p1_4_output: { specificDiachronicStructure: {} }
        }]
      ])

      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] },
        p3_2_output: { gdus: [] },
        p3_3_output: { genericDiachronicStructure: {} },
        p5_1_output: { analysis_summary: 'test' },
        p6_1_output: { report: 'report' },
        p7_1_output: { candidate_variables: [] }
      }

      // Start from the very first step
      const result = service.getInvalidatedStates(
        StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
        't1',
        processedData,
        genericState
      )

      const updatedData = result.invalidatedProcessedData.get('t1')
      
      // All transcript steps should be cleared
      expect(updatedData?.p_neg1_1_output).toBeUndefined()
      expect(updatedData?.p0_1_output).toBeUndefined()
      expect(updatedData?.p1_4_output).toBeUndefined()
      
      // All global steps should be cleared due to cascade
      expect(result.invalidatedGenericState.p3_1_output).toBeUndefined()
      expect(result.invalidatedGenericState.p7_1_output).toBeUndefined()
    })

    test('should handle circular references in data', () => {
      const circularData: any = { id: 't1', filename: 'test.txt' }
      circularData.circular = circularData // Create circular reference
      
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          ...circularData,
          p0_1_output: { hasCleanSpeakerLabels: true }
        }]
      ])

      // Should not crash with circular references
      expect(() => {
        service.getInvalidatedStates(
          StepId.P0_1_TRANSCRIPTION_ADHERENCE,
          't1',
          processedData,
          {}
        )
      }).not.toThrow()
    })
  })

  describe('Special Step Handling', () => {
    test('should handle P1.4 with all side effects', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p1_4_output: { specificDiachronicStructure: {} },
          p1_4_mermaid_syntax: 'graph TD',
          isFullyProcessedSpecificDiachronic: true,
          phases_for_p2s_processing: ['phase1', 'phase2', 'phase3'],
          current_phase_for_p2s_processing: 'phase2',
          processed_phases_for_p2s: ['phase1', 'phase2'],
          p2s_outputs_by_phase: {
            phase1: { p2s_3_output: { structure: {} } },
            phase2: { p2s_3_output: { structure: {} } },
            phase3: { p2s_1_output: { groups: [] } } // Partially processed
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

    test('should handle P3.3 with all GDU cleanup', () => {
      const genericState: GenericAnalysisState = {
        p3_3_output: { genericDiachronicStructure: {} },
        p3_3_mermaid_syntax: 'graph TD',
        isFullyProcessedGenericDiachronic: true,
        core_gdus_for_sync_analysis: ['gdu1', 'gdu2', 'gdu3'],
        p4s_1_a_outputs_by_gdu: {
          gdu1: { nodes: ['n1', 'n2'] },
          gdu2: { nodes: ['n3', 'n4'] },
          gdu3: { nodes: ['n5'] }
        },
        p4s_1_a_error: 'Previous error',
        p4s_outputs_by_gdu: {
          gdu1: { p4s_1_b_output: { gss: ['gss1'] } },
          gdu2: { p4s_1_b_output: { gss: ['gss2'] } }
        },
        p4s_mermaid_syntax_by_gdu: {
          gdu1: 'graph TD\nGSS1',
          gdu2: 'graph TD\nGSS2'
        },
        p4s_1_b_error: 'Another error',
        current_gdu_for_p4s_processing: 'gdu2',
        processed_gdus_for_p4s: ['gdu1', 'gdu2'],
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
  })
})