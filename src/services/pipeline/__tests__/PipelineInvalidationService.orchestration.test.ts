import { describe, test, expect, vi, beforeEach } from 'vitest'
import { PipelineInvalidationService, InvalidationDependencies } from '../PipelineInvalidationService'
import { StepId, TranscriptProcessedData, GenericAnalysisState, RawTranscript } from '../../../../types'

describe('PipelineInvalidationService - Orchestration', () => {
  let service: PipelineInvalidationService
  let mockDependencies: InvalidationDependencies

  beforeEach(() => {
    mockDependencies = {
      getTranscriptData: vi.fn(),
      updateGenericState: vi.fn(),
      updateProcessedData: vi.fn()
    }
    service = new PipelineInvalidationService(mockDependencies)
  })

  describe('orchestrateInvalidation', () => {
    test('should orchestrate per-transcript step invalidation', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true },
          p0_2_output: { extractedFeatures: [] },
          p1_1_output: { periods: [] }
        }]
      ])

      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] },
        p3_2_output: { gdus: [] }
      }

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [{ id: 't1', filename: 'test.txt', content: 'content' }],
        processedData
      })

      service.orchestrateInvalidation(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't1',
        genericState
      )

      // Should fetch transcript data
      expect(mockDependencies.getTranscriptData).toHaveBeenCalled()

      // Should update generic state (cascade effect)
      const genericStateUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericStateUpdate.p3_1_output).toBeUndefined()
      expect(genericStateUpdate.p3_2_output).toBeUndefined()

      // Should update processed data for the transcript
      expect(mockDependencies.updateProcessedData).toHaveBeenCalledWith('t1', expect.any(Object))
      const processedDataUpdate = mockDependencies.updateProcessedData.mock.calls[0][1]
      expect(processedDataUpdate.id).toBe('t1')
      expect(processedDataUpdate.filename).toBe('test.txt')
      expect(processedDataUpdate.p0_1_output).toBeUndefined()
      expect(processedDataUpdate.p0_2_output).toBeUndefined()
      expect(processedDataUpdate.p1_1_output).toBeUndefined()
    })

    test('should orchestrate global step invalidation', () => {
      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] },
        p3_1_error: 'Previous error',
        p3_2_output: { gdus: [] },
        p3_3_output: { genericDiachronicStructure: {} }
      }

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [],
        processedData: new Map()
      })

      service.orchestrateInvalidation(
        StepId.P3_1_ALIGN_STRUCTURES,
        undefined,
        genericState
      )

      // Should still fetch transcript data
      expect(mockDependencies.getTranscriptData).toHaveBeenCalled()

      // Should update generic state
      const genericStateUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericStateUpdate.p3_1_output).toBeUndefined()
      expect(genericStateUpdate.p3_1_error).toBeUndefined()
      expect(genericStateUpdate.p3_2_output).toBeUndefined()
      expect(genericStateUpdate.p3_3_output).toBeUndefined()

      // Should NOT update processed data for global steps
      expect(mockDependencies.updateProcessedData).not.toHaveBeenCalled()
    })

    test('should handle P2S phase orchestration', () => {
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
              p2s_1_output: { groups: [] }
            }
          },
          processed_phases_for_p2s: ['phase1']
        }]
      ])

      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] }
      }

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [{ id: 't1', filename: 'test.txt', content: 'content' }],
        processedData
      })

      service.orchestrateInvalidation(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        't1',
        genericState
      )

      // Should update processed data with phase invalidation
      expect(mockDependencies.updateProcessedData).toHaveBeenCalledWith('t1', expect.any(Object))
      const processedDataUpdate = mockDependencies.updateProcessedData.mock.calls[0][1]
      expect(processedDataUpdate.p2s_outputs_by_phase.phase1.p2s_1_output).toBeUndefined()
      expect(processedDataUpdate.p2s_outputs_by_phase.phase1.p2s_2_output).toBeUndefined()
      expect(processedDataUpdate.p2s_outputs_by_phase.phase1.p2s_3_output).toBeUndefined()
      expect(processedDataUpdate.p2s_outputs_by_phase.phase2.p2s_1_output).toBeDefined()
      expect(processedDataUpdate.processed_phases_for_p2s).toEqual([])

      // Should trigger global cascade
      const genericStateUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericStateUpdate.p3_1_output).toBeUndefined()
    })

    test('should handle P4S GDU orchestration', () => {
      const genericState: GenericAnalysisState = {
        current_gdu_for_p4s_processing: 'gdu1',
        p4s_1_a_outputs_by_gdu: {
          gdu1: { nodes: [] },
          gdu2: { nodes: [] }
        },
        p4s_outputs_by_gdu: {
          gdu1: { p4s_1_b_output: { gss: [] } }
        },
        p4s_mermaid_syntax_by_gdu: {
          gdu1: 'graph TD'
        },
        processed_gdus_for_p4s: ['gdu1']
      }

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [],
        processedData: new Map()
      })

      service.orchestrateInvalidation(
        StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
        undefined,
        genericState
      )

      // Should clear all P4S data
      const genericStateUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericStateUpdate.p4s_1_a_outputs_by_gdu).toEqual({})
      expect(genericStateUpdate.p4s_outputs_by_gdu).toEqual({})
      expect(genericStateUpdate.p4s_mermaid_syntax_by_gdu).toEqual({})
      expect(genericStateUpdate.processed_gdus_for_p4s).toEqual([])
      expect(genericStateUpdate.isFullyProcessedGenericSynchronic).toBe(false)
    })

    test('should throw error when dependencies not provided', () => {
      const serviceWithoutDeps = new PipelineInvalidationService()

      expect(() => {
        serviceWithoutDeps.orchestrateInvalidation(
          StepId.P3_1_ALIGN_STRUCTURES,
          undefined,
          {}
        )
      }).toThrow('Dependencies required for orchestration')
    })

    test('should enforce constructor-only dependency injection', () => {
      // Service with constructor dependencies should work
      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [],
        processedData: new Map()
      })
      
      const result = service.orchestrateInvalidation(
        StepId.P3_1_ALIGN_STRUCTURES,
        undefined,
        {}
      )
      
      expect(result).toBeDefined()
      expect(mockDependencies.getTranscriptData).toHaveBeenCalled()
      
      // Method-level dependencies are no longer supported
      // This ensures clean architecture with constructor-only DI
    })

    test('should handle complex cascade scenario', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test1.txt',
          p1_1_output: { periods: [] },
          p1_2_output: { diachronicUnits: [] },
          p1_3_output: { refinedDiachronicUnits: [] },
          p1_4_output: { specificDiachronicStructure: {} },
          phases_for_p2s_processing: ['phase1'],
          current_phase_for_p2s_processing: 'phase1',
          p2s_outputs_by_phase: {
            phase1: {
              p2s_1_output: { groups: [] }
            }
          }
        }],
        ['t2', {
          id: 't2',
          filename: 'test2.txt',
          p1_1_output: { periods: [] }
        }]
      ])

      const genericState: GenericAnalysisState = {
        p3_1_output: { alignments: [] },
        p3_2_output: { gdus: [] },
        p3_3_output: { genericDiachronicStructure: {} },
        p4s_outputs_by_gdu: {
          gdu1: { p4s_1_b_output: { gss: [] } }
        },
        p5_1_output: { analysis_summary: 'test' }
      }

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [
          { id: 't1', filename: 'test1.txt', content: 'content1' },
          { id: 't2', filename: 'test2.txt', content: 'content2' }
        ],
        processedData
      })

      service.orchestrateInvalidation(
        StepId.P1_2_DIACHRONIC_UNIT_ID,
        't1',
        genericState
      )

      // Should update t1 processed data
      expect(mockDependencies.updateProcessedData).toHaveBeenCalledWith('t1', expect.any(Object))
      const processedDataUpdate = mockDependencies.updateProcessedData.mock.calls[0][1]
      expect(processedDataUpdate.p1_1_output).toEqual({ periods: [] }) // Upstream preserved
      expect(processedDataUpdate.p1_2_output).toBeUndefined()
      expect(processedDataUpdate.p1_3_output).toBeUndefined()
      expect(processedDataUpdate.p1_4_output).toBeUndefined()
      expect(processedDataUpdate.phases_for_p2s_processing).toEqual([])
      expect(processedDataUpdate.p2s_outputs_by_phase).toEqual({})

      // Should cascade to global state
      const genericStateUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericStateUpdate.p3_1_output).toBeUndefined()
      expect(genericStateUpdate.p3_2_output).toBeUndefined()
      expect(genericStateUpdate.p3_3_output).toBeUndefined()
      expect(genericStateUpdate.p4s_outputs_by_gdu).toEqual({})
      expect(genericStateUpdate.p5_1_output).toBeUndefined()
    })

    test('should handle P7 step orchestration with mermaid cleanup', () => {
      const genericState: GenericAnalysisState = {
        p7_1_output: { candidate_variables: [] },
        p7_2_output: { proposed_links: [] },
        p7_3_output: { dag: {} },
        p7_3_mermaid_syntax_dag: 'graph TD\nA-->B',
        p7_3b_output: { cleanedDag: {} },
        p7_3b_mermaid_syntax_dag: 'graph TD\nA-->B\nB-->C',
        p7_4_output: { paths: [] }
      }

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [],
        processedData: new Map()
      })

      service.orchestrateInvalidation(
        StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
        undefined,
        genericState
      )

      const genericStateUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericStateUpdate.p7_1_output).toEqual({ candidate_variables: [] }) // Upstream preserved
      expect(genericStateUpdate.p7_2_output).toEqual({ proposed_links: [] }) // Upstream preserved
      expect(genericStateUpdate.p7_3_output).toBeUndefined()
      expect(genericStateUpdate.p7_3_mermaid_syntax_dag).toBeUndefined()
      expect(genericStateUpdate.p7_3b_output).toBeUndefined()
      expect(genericStateUpdate.p7_3b_mermaid_syntax_dag).toBeUndefined()
      expect(genericStateUpdate.p7_4_output).toBeUndefined()
    })

    test('should not call updateProcessedData when transcript not found', () => {
      const processedData = new Map<string, TranscriptProcessedData>([
        ['t1', {
          id: 't1',
          filename: 'test.txt',
          p0_1_output: { hasCleanSpeakerLabels: true }
        }]
      ])

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [{ id: 't1', filename: 'test.txt', content: 'content' }],
        processedData
      })

      service.orchestrateInvalidation(
        StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        't2', // Non-existent transcript
        {}
      )

      // Should NOT call updateProcessedData for non-existent transcript
      expect(mockDependencies.updateProcessedData).not.toHaveBeenCalled()

      // Should still update generic state due to cascade
      expect(mockDependencies.updateGenericState).toHaveBeenCalled()
    })

    test('should handle P6.1 report generation orchestration', () => {
      const genericState: GenericAnalysisState = {
        p6_1_output: { report: 'Test report' },
        isReportGenerated: true,
        p7_1_output: { candidate_variables: [] }
      }

      mockDependencies.getTranscriptData.mockReturnValue({
        rawTranscripts: [],
        processedData: new Map()
      })

      service.orchestrateInvalidation(
        StepId.P6_1_GENERATE_MARKDOWN_REPORT,
        undefined,
        genericState
      )

      const genericStateUpdate = mockDependencies.updateGenericState.mock.calls[0][0]
      expect(genericStateUpdate.p6_1_output).toBeUndefined()
      expect(genericStateUpdate.isReportGenerated).toBe(false)
      expect(genericStateUpdate.p7_1_output).toEqual({ candidate_variables: [] }) // P7 not affected
    })
  })
})