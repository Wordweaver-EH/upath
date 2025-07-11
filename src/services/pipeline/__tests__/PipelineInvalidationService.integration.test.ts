import { describe, test, expect, vi, beforeEach } from 'vitest'
import { PipelineInvalidationService, InvalidationDependencies } from '../PipelineInvalidationService'
import { StepId, TranscriptProcessedData, GenericAnalysisState, RawTranscript } from '../../../../types'
import { 
  ALL_PIPELINE_STEP_IDS_IN_ORDER,
  STEP_ORDER_PART_0,
  STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
  STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
  STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
  STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
  STEP_ORDER_PART_7_CAUSAL_MODELING
} from '../../../../constants'

describe('PipelineInvalidationService - Integration Tests', () => {
  let service: PipelineInvalidationService
  let mockDependencies: InvalidationDependencies
  let fullProcessedData: Map<string, TranscriptProcessedData>
  let fullGenericState: GenericAnalysisState

  beforeEach(() => {
    mockDependencies = {
      getTranscriptData: vi.fn(),
      updateGenericState: vi.fn(),
      updateProcessedData: vi.fn()
    }
    service = new PipelineInvalidationService(mockDependencies)

    // Setup full pipeline state
    fullProcessedData = new Map([
      ['t1', {
        id: 't1',
        filename: 'transcript1.txt',
        content: 'Transcript 1 content',
        p_neg1_1_output: { variables: ['var1', 'var2'] },
        p0_1_output: { hasCleanSpeakerLabels: true },
        p0_2_output: { extractedFeatures: ['f1', 'f2'] },
        p0_3_output: { speakerCount: 2 },
        p1_1_output: { periods: ['p1', 'p2'] },
        p1_2_output: { diachronicUnits: ['du1', 'du2'] },
        p1_3_output: { refinedDiachronicUnits: ['rdu1', 'rdu2'] },
        p1_4_output: { specificDiachronicStructure: { nodes: ['n1', 'n2'] } },
        p1_4_mermaid_syntax: 'graph TD\nN1-->N2',
        isFullyProcessedSpecificDiachronic: true,
        phases_for_p2s_processing: ['phase1', 'phase2'],
        current_phase_for_p2s_processing: 'phase2',
        processed_phases_for_p2s: ['phase1', 'phase2'],
        p2s_outputs_by_phase: {
          phase1: {
            p2s_1_output: { groups: ['g1', 'g2'] },
            p2s_2_output: { sss: ['sss1', 'sss2'] },
            p2s_3_output: { structure: { nodes: ['sss1', 'sss2'] } },
            p2s_3_mermaid_syntax: 'graph TD\nSSS1-->SSS2'
          },
          phase2: {
            p2s_1_output: { groups: ['g3', 'g4'] },
            p2s_2_output: { sss: ['sss3', 'sss4'] },
            p2s_3_output: { structure: { nodes: ['sss3', 'sss4'] } },
            p2s_3_mermaid_syntax: 'graph TD\nSSS3-->SSS4'
          }
        },
        isFullyProcessedSpecificSynchronic: true
      }],
      ['t2', {
        id: 't2',
        filename: 'transcript2.txt',
        content: 'Transcript 2 content',
        p_neg1_1_output: { variables: ['var3', 'var4'] },
        p0_1_output: { hasCleanSpeakerLabels: true },
        p0_2_output: { extractedFeatures: ['f3', 'f4'] },
        p0_3_output: { speakerCount: 3 },
        p1_1_output: { periods: ['p3', 'p4'] },
        p1_2_output: { diachronicUnits: ['du3', 'du4'] },
        p1_3_output: { refinedDiachronicUnits: ['rdu3', 'rdu4'] },
        p1_4_output: { specificDiachronicStructure: { nodes: ['n3', 'n4'] } },
        p1_4_mermaid_syntax: 'graph TD\nN3-->N4',
        isFullyProcessedSpecificDiachronic: true,
        phases_for_p2s_processing: [],
        isFullyProcessedSpecificSynchronic: true
      }]
    ])

    fullGenericState = {
      p3_1_output: { alignments: [['n1', 'n3'], ['n2', 'n4']] },
      p3_2_output: { gdus: ['gdu1', 'gdu2'] },
      p3_3_output: { genericDiachronicStructure: { nodes: ['gdu1', 'gdu2'] } },
      p3_3_mermaid_syntax: 'graph TD\nGDU1-->GDU2',
      isFullyProcessedGenericDiachronic: true,
      core_gdus_for_sync_analysis: ['gdu1', 'gdu2'],
      p4s_1_a_outputs_by_gdu: {
        gdu1: { nodes: ['sss1', 'sss2'] },
        gdu2: { nodes: ['sss3', 'sss4'] }
      },
      p4s_outputs_by_gdu: {
        gdu1: { p4s_1_b_output: { gss: ['gss1', 'gss2'] } },
        gdu2: { p4s_1_b_output: { gss: ['gss3', 'gss4'] } }
      },
      p4s_mermaid_syntax_by_gdu: {
        gdu1: 'graph TD\nGSS1-->GSS2',
        gdu2: 'graph TD\nGSS3-->GSS4'
      },
      current_gdu_for_p4s_processing: 'gdu2',
      processed_gdus_for_p4s: ['gdu1', 'gdu2'],
      isFullyProcessedGenericSynchronic: true,
      p5_1_output: { analysis_summary: 'Comprehensive analysis' },
      isRefinementDone: true,
      p7_1_output: { candidate_variables: ['cv1', 'cv2'] },
      p7_2_output: { proposed_links: [['cv1', 'cv2']] },
      p7_3_output: { dag: { nodes: ['cv1', 'cv2'] } },
      p7_3_mermaid_syntax_dag: 'graph TD\nCV1-->CV2',
      p7_3b_output: { cleanedDag: { nodes: ['cv1', 'cv2'] } },
      p7_3b_mermaid_syntax_dag: 'graph TD\nCV1-->CV2',
      p7_4_output: { paths: [['cv1', 'cv2']] },
      p7_5_output: { hypotheses: ['h1', 'h2'] },
      isCausalModelingDone: true,
      p6_1_output: { report: '# Final Analysis Report\n...' },
      isReportGenerated: true
    }

    mockDependencies.getTranscriptData.mockReturnValue({
      rawTranscripts: [
        { id: 't1', filename: 'transcript1.txt', content: 'Transcript 1 content' },
        { id: 't2', filename: 'transcript2.txt', content: 'Transcript 2 content' }
      ],
      processedData: fullProcessedData
    })
  })

  describe('Full Pipeline Cascade Tests', () => {
    test('should cascade from early transcript step through entire pipeline', () => {
      service.orchestrateInvalidation(
        StepId.P0_2_REFINE_DATA_TYPES,
        't1',
        fullGenericState
      )

      // Debug: Check if getTranscriptData was called
      expect(mockDependencies.getTranscriptData).toHaveBeenCalled()
      
      // Check transcript updates
      expect(mockDependencies.updateProcessedData).toHaveBeenCalled()
      const transcriptUpdate = mockDependencies.updateProcessedData.mock.calls[0]
      expect(transcriptUpdate[0]).toBe('t1')
      const t1Updates = transcriptUpdate[1]
      
      // Part 0 cascade
      expect(t1Updates.p0_1_output).toBeDefined() // Upstream preserved
      expect(t1Updates.p0_2_output).toBeUndefined()
      expect(t1Updates.p0_3_output).toBeUndefined()
      
      // Part 1 cascade
      expect(t1Updates.p1_1_output).toBeUndefined()
      expect(t1Updates.p1_4_output).toBeUndefined()
      expect(t1Updates.isFullyProcessedSpecificDiachronic).toBe(false)
      
      // Part 2S cascade
      expect(t1Updates.phases_for_p2s_processing).toEqual([])
      expect(t1Updates.p2s_outputs_by_phase).toEqual({})
      expect(t1Updates.isFullyProcessedSpecificSynchronic).toBe(false)

      // Check generic state updates
      const genericUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      
      // All global steps should be invalidated
      expect(genericUpdate.p3_1_output).toBeUndefined()
      expect(genericUpdate.p3_3_output).toBeUndefined()
      expect(genericUpdate.isFullyProcessedGenericDiachronic).toBe(false)
      
      // P4S cascade
      expect(genericUpdate.p4s_outputs_by_gdu).toEqual({})
      expect(genericUpdate.isFullyProcessedGenericSynchronic).toBe(false)
      
      // Later stages
      expect(genericUpdate.p5_1_output).toBeUndefined()
      expect(genericUpdate.p7_5_output).toBeUndefined()
      expect(genericUpdate.p6_1_output).toBeUndefined()
      expect(genericUpdate.isReportGenerated).toBe(false)
    })

    test('should cascade from P2S step affecting only downstream', () => {
      // Modify t1 to have current phase
      fullProcessedData.get('t1')!.current_phase_for_p2s_processing = 'phase1'
      
      service.orchestrateInvalidation(
        StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
        't1',
        fullGenericState
      )

      const t1Updates = mockDependencies.updateProcessedData.mock.calls[0][1]
      
      // Part 1 should be preserved
      expect(t1Updates.p1_4_output).toBeDefined()
      expect(t1Updates.isFullyProcessedSpecificDiachronic).toBe(true)
      
      // Only current phase affected
      const phase1Data = t1Updates.p2s_outputs_by_phase.phase1
      expect(phase1Data.p2s_1_output).toBeDefined() // Upstream in phase preserved
      expect(phase1Data.p2s_2_output).toBeUndefined()
      expect(phase1Data.p2s_3_output).toBeUndefined()
      
      // phase2 preserved
      const phase2Data = t1Updates.p2s_outputs_by_phase.phase2
      expect(phase2Data.p2s_3_output).toBeDefined()
      
      // Global cascade still happens
      const genericUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericUpdate.p3_1_output).toBeUndefined()
    })

    test('should handle P4S invalidation with partial GDU processing', () => {
      // Set up state where only gdu1 is processed
      fullGenericState.processed_gdus_for_p4s = ['gdu1']
      fullGenericState.current_gdu_for_p4s_processing = 'gdu2'
      fullGenericState.isFullyProcessedGenericSynchronic = false
      
      service.orchestrateInvalidation(
        StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
        undefined,
        fullGenericState
      )

      const genericUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      
      // P3 should be preserved
      expect(genericUpdate.p3_3_output).toBeDefined()
      expect(genericUpdate.isFullyProcessedGenericDiachronic).toBe(true)
      
      // P4S_1_A should be preserved
      expect(genericUpdate.p4s_1_a_outputs_by_gdu).toBeDefined()
      
      // P4S_1_B and outputs cleared
      expect(genericUpdate.p4s_outputs_by_gdu).toEqual({})
      expect(genericUpdate.p4s_mermaid_syntax_by_gdu).toEqual({})
      expect(genericUpdate.processed_gdus_for_p4s).toEqual([])
      
      // Downstream cleared
      expect(genericUpdate.p5_1_output).toBeUndefined()
    })

    test('should handle P7 partial invalidation', () => {
      service.orchestrateInvalidation(
        StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
        undefined,
        fullGenericState
      )

      const genericUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      
      // Earlier P7 steps preserved
      expect(genericUpdate.p7_1_output).toBeDefined()
      expect(genericUpdate.p7_2_output).toBeDefined()
      expect(genericUpdate.p7_3_output).toBeDefined()
      expect(genericUpdate.p7_3_mermaid_syntax_dag).toBeDefined()
      
      // P7.3B and downstream P7 steps cleared
      expect(genericUpdate.p7_3b_output).toBeUndefined()
      expect(genericUpdate.p7_3b_mermaid_syntax_dag).toBeUndefined()
      expect(genericUpdate.p7_4_output).toBeUndefined()
      expect(genericUpdate.p7_5_output).toBeUndefined()
      
      // P6 report also cleared since it comes after P7 in pipeline order
      expect(genericUpdate.p6_1_output).toBeUndefined()
      expect(genericUpdate.isReportGenerated).toBe(false)
    })
  })

  describe('Multi-Transcript Scenarios', () => {
    test('should handle invalidation affecting multiple transcripts differently', () => {
      // Add a third transcript
      fullProcessedData.set('t3', {
        id: 't3',
        filename: 'transcript3.txt',
        p0_1_output: { hasCleanSpeakerLabels: false }, // Different state
        p0_1_error: 'Failed validation'
      })

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [
          { id: 't1', filename: 'transcript1.txt', content: 'content1' },
          { id: 't2', filename: 'transcript2.txt', content: 'content2' },
          { id: 't3', filename: 'transcript3.txt', content: 'content3' }
        ],
        processedData: fullProcessedData
      })

      service.orchestrateInvalidation(
        StepId.P1_1_INITIAL_SEGMENTATION,
        't1',
        fullGenericState
      )

      // Only t1 should be updated
      expect(mockDependencies.updateProcessedData).toHaveBeenCalledTimes(1)
      expect(mockDependencies.updateProcessedData).toHaveBeenCalledWith('t1', expect.any(Object))
      
      // But global state should still cascade
      expect(mockDependencies.updateGenericState).toHaveBeenCalled()
    })

    test('should handle concurrent phase and transcript processing', () => {
      // Set up complex state
      fullProcessedData.get('t1')!.current_phase_for_p2s_processing = 'phase1'
      fullProcessedData.get('t1')!.processed_phases_for_p2s = ['phase2'] // phase1 in progress
      
      fullProcessedData.set('t3', {
        id: 't3',
        filename: 'transcript3.txt',
        p1_4_output: { specificDiachronicStructure: {} },
        isFullyProcessedSpecificDiachronic: true,
        phases_for_p2s_processing: ['phase1'],
        current_phase_for_p2s_processing: 'phase1',
        p2s_outputs_by_phase: {
          phase1: {
            p2s_1_output: { groups: [] },
            p2s_2_output: { sss: [] }
            // P2S.3 not done yet
          }
        },
        processed_phases_for_p2s: []
      })

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [
          { id: 't1', filename: 'transcript1.txt', content: 'content1' },
          { id: 't2', filename: 'transcript2.txt', content: 'content2' },
          { id: 't3', filename: 'transcript3.txt', content: 'content3' }
        ],
        processedData: fullProcessedData
      })

      service.orchestrateInvalidation(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        't1',
        fullGenericState
      )

      const t1Updates = mockDependencies.updateProcessedData.mock.calls[0][1]
      
      // t1 phase1 should be invalidated
      expect(t1Updates.p2s_outputs_by_phase.phase1.p2s_1_output).toBeUndefined()
      // t1 phase2 should be preserved
      expect(t1Updates.p2s_outputs_by_phase.phase2.p2s_3_output).toBeDefined()
      // processed_phases should now only contain phase2
      expect(t1Updates.processed_phases_for_p2s).toEqual(['phase2'])
    })
  })

  describe('Error State Handling', () => {
    test('should clear both output and error for invalidated steps', () => {
      // Add error states
      fullProcessedData.get('t1')!.p0_2_error = 'API failure'
      fullProcessedData.get('t1')!.p1_1_error = 'Processing error'
      fullGenericState.p3_1_error = 'Alignment error'
      fullGenericState.p4s_1_a_error = 'GDU error'
      fullGenericState.p4s_1_b_error = 'GSS error'

      service.orchestrateInvalidation(
        StepId.P0_2_REFINE_DATA_TYPES,
        't1',
        fullGenericState
      )

      const t1Updates = mockDependencies.updateProcessedData.mock.calls[0][1]
      expect(t1Updates.p0_2_error).toBeUndefined()
      expect(t1Updates.p1_1_error).toBeUndefined()

      const genericUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericUpdate.p3_1_error).toBeUndefined()
      expect(genericUpdate.p4s_1_a_error).toBeUndefined()
      expect(genericUpdate.p4s_1_b_error).toBeUndefined()
    })

    test('should preserve error states for non-invalidated steps', () => {
      fullProcessedData.get('t1')!.p0_1_error = 'Should preserve'
      fullProcessedData.get('t2')!.p0_2_error = 'Should preserve'
      fullGenericState.p7_1_error = 'Should clear'
      fullGenericState.p3_1_error = 'Should also preserve' // Add P3 error which comes before P7

      service.orchestrateInvalidation(
        StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
        undefined,
        fullGenericState
      )

      // Transcript errors should not be touched
      expect(mockDependencies.updateProcessedData).not.toHaveBeenCalled()

      const genericUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      // P7_1 error should be cleared along with all downstream P7 steps
      expect(genericUpdate.p7_1_error).toBeUndefined()
      expect(genericUpdate.p7_2_error).toBeUndefined()
      expect(genericUpdate.p7_3_error).toBeUndefined()
      expect(genericUpdate.p7_3b_error).toBeUndefined()
      expect(genericUpdate.p7_4_error).toBeUndefined()
      expect(genericUpdate.p7_5_error).toBeUndefined()
      
      // P3 error should be preserved since it comes before P7
      expect(genericUpdate.p3_1_error).toBe('Should also preserve')
      // P6 also comes after P7 in the pipeline order, so it should be cleared
      expect(genericUpdate.p6_1_error).toBeUndefined()
    })
  })

  describe('Special Flags and States', () => {
    test('should handle all completion flags correctly', () => {
      service.orchestrateInvalidation(
        StepId.P3_1_ALIGN_STRUCTURES,
        undefined,
        fullGenericState
      )

      const genericUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      
      // Check all flags are properly reset
      expect(genericUpdate.isFullyProcessedGenericDiachronic).toBe(false)
      expect(genericUpdate.isFullyProcessedGenericSynchronic).toBe(false)
      // These flags are not explicitly cleared by the service, they retain their original values
      expect(genericUpdate.isRefinementDone).toBe(true) // Original value preserved
      expect(genericUpdate.isCausalModelingDone).toBe(true) // Original value preserved  
      expect(genericUpdate.isReportGenerated).toBe(false)
    })

    test('should handle mermaid syntax cleanup', () => {
      service.orchestrateInvalidation(
        StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
        't1',
        fullGenericState
      )

      const t1Updates = mockDependencies.updateProcessedData.mock.calls[0][1]
      expect(t1Updates.p1_4_mermaid_syntax).toBeUndefined()

      // Check P2S mermaid cleanup
      expect(t1Updates.p2s_outputs_by_phase).toEqual({})

      const genericUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericUpdate.p3_3_mermaid_syntax).toBeUndefined()
      expect(genericUpdate.p4s_mermaid_syntax_by_gdu).toEqual({})
      expect(genericUpdate.p7_3_mermaid_syntax_dag).toBeUndefined()
      expect(genericUpdate.p7_3b_mermaid_syntax_dag).toBeUndefined()
    })
  })

  describe('Performance and Scale', () => {
    test('should handle large number of phases efficiently', () => {
      const manyPhases: any = {}
      for (let i = 0; i < 100; i++) {
        manyPhases[`phase${i}`] = {
          p2s_1_output: { groups: [] },
          p2s_2_output: { sss: [] },
          p2s_3_output: { structure: {} }
        }
      }

      fullProcessedData.get('t1')!.p2s_outputs_by_phase = manyPhases
      fullProcessedData.get('t1')!.current_phase_for_p2s_processing = 'phase50'

      const start = performance.now()
      service.orchestrateInvalidation(
        StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
        't1',
        fullGenericState
      )
      const end = performance.now()

      // Should complete quickly even with many phases
      expect(end - start).toBeLessThan(100) // 100ms threshold

      const t1Updates = mockDependencies.updateProcessedData.mock.calls[0][1]
      // Only phase50 should be affected
      expect(t1Updates.p2s_outputs_by_phase.phase50.p2s_2_output).toBeUndefined()
      expect(t1Updates.p2s_outputs_by_phase.phase49.p2s_2_output).toBeDefined()
      expect(t1Updates.p2s_outputs_by_phase.phase51.p2s_2_output).toBeDefined()
    })

    test('should handle large number of GDUs efficiently', () => {
      const manyGDUs: any = {
        p4s_1_a_outputs_by_gdu: {},
        p4s_outputs_by_gdu: {},
        p4s_mermaid_syntax_by_gdu: {}
      }

      for (let i = 0; i < 200; i++) {
        manyGDUs.p4s_1_a_outputs_by_gdu[`gdu${i}`] = { nodes: [`n${i}`] }
        manyGDUs.p4s_outputs_by_gdu[`gdu${i}`] = { p4s_1_b_output: { gss: [`gss${i}`] } }
        manyGDUs.p4s_mermaid_syntax_by_gdu[`gdu${i}`] = `graph TD\nGSS${i}`
      }

      Object.assign(fullGenericState, manyGDUs)

      const start = performance.now()
      service.orchestrateInvalidation(
        StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        fullGenericState
      )
      const end = performance.now()

      // Should complete quickly
      expect(end - start).toBeLessThan(100)

      const genericUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericUpdate.p4s_1_a_outputs_by_gdu).toEqual({})
      expect(genericUpdate.p4s_outputs_by_gdu).toEqual({})
      expect(genericUpdate.p4s_mermaid_syntax_by_gdu).toEqual({})
    })
  })
})