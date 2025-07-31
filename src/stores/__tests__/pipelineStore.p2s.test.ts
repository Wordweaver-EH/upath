import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { enableMapSet } from 'immer'
import { usePipelineStore } from '../pipelineStore'
import { useUIStore } from '../uiStore'
import type { 
  RawTranscript, 
  TranscriptProcessedData,
  P2SDuData,
  P1_4_Output,
  P2S_1_Output,
  P2S_2_Output,
  P2S_3_Output
} from '../../../types'
import { StepId } from '../../../types'
import { STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC } from '../../config/pipelineDefinition'

// Enable Immer to work with Map/Set
enableMapSet()

describe('PipelineStore - P2S State Management Fix', () => {

  const createMockTranscript = (id: string): RawTranscript => ({
    id,
    filename: `${id}.txt`,
    content: 'Test content',
    name: `${id}.txt`
  })

  // Helper function to add transcript and initialize processedData
  const addTranscriptWithProcessedData = (transcript: RawTranscript) => {
    usePipelineStore.setState({
      rawTranscripts: [transcript]
    })
    
    const processedDataMap = new Map<string, TranscriptProcessedData>()
    processedDataMap.set(transcript.id, {
      id: transcript.id,
      p2s_outputs_by_du: {}
    } as TranscriptProcessedData)
    usePipelineStore.setState({
      processedData: processedDataMap
    })
    
    return processedDataMap
  }

  // Helper function to simulate P1.4 completion
  const completeP1_4Step = (transcriptId: string, p14Output: P1_4_Output) => {
    const processedData = usePipelineStore.getState().processedData
    usePipelineStore.getState().handleSuccessfulStep(
      StepId.P1_4_DIACHRONIC_UNIT_GROUPING,
      transcriptId,
      p14Output,
      {}, // inputData
      [], // groundingSources
      undefined, // currentGDU
      undefined, // currentDu
      processedData
    )
  }

  // Helper function to complete a P2S step
  const completeP2SStep = (
    stepId: StepId,
    transcriptId: string,
    output: any,
    duId: string
  ) => {
    const processedData = usePipelineStore.getState().processedData
    usePipelineStore.getState().handleSuccessfulStep(
      stepId,
      transcriptId,
      output,
      {}, // inputData
      [], // groundingSources
      undefined, // currentGDU
      duId, // currentDu
      processedData
    )
  }

  const createMockP1_4Output = (duIds: string[]): P1_4_Output => ({
    transcript_id: 'test-transcript-1',
    diachronic_units: duIds.map(id => ({
      unit_id: id,
      description: `Diachronic unit ${id}`,
      source_segment_ids: []
    })),
    excluded_segment_ids: [],
    independent_variable_details: 'test IV',
    dependent_variable_focus: ['test DV']
  })

  const createMockP2S_1Output = (duId: string): P2S_1_Output => ({
    transcript_id: 'test-transcript-1',
    analyzed_du_id: duId,
    synchronic_thematic_groups: [{
      theme_label: 'Test Theme',
      constituent_utterance_ids: []
    }],
    independent_variable_details: 'test IV',
    dependent_variable_focus: ['test DV']
  })

  const createMockP2S_2Output = (duId: string): P2S_2_Output => ({
    transcript_id: 'test-transcript-1',
    analyzed_du_id: duId,
    specific_synchronic_units_hierarchy: [{
      unit_name: 'ssu1',
      level: 1,
      constituent_utterance_ids: []
    }],
    independent_variable_details: 'test IV',
    dependent_variable_focus: ['test DV']
  })

  const createMockP2S_3Output = (duId: string): P2S_3_Output => ({
    transcript_id: 'test-transcript-1',
    analyzed_du_id: duId,
    specific_synchronic_structure: {
      representation_type: 'Semantic Network',
      description: 'Test network',
      network_nodes: [{
        id: 'node1',
        label: 'Test Node',
        description: 'Test description',
        utterance_ids: []
      }],
      network_links: []
    },
    independent_variable_details: 'test IV',
    dependent_variable_focus: ['test DV']
  })

  beforeEach(() => {
    // Reset store to initial state
    usePipelineStore.setState({
      rawTranscripts: [],
      processedData: new Map(),
      genericAnalysisState: {},
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0
    })
    
    // Reset UI store
    useUIStore.setState({
      activeTranscriptIndex: 0
    })
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('P2S Data Accumulation', () => {
    it('should correctly accumulate p2s_outputs_by_du for multiple DUs without overwriting', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      const duIds = ['du_1', 'du_2', 'du_3']
      
      // Add transcript and initialize processedData
      const processedDataMap = addTranscriptWithProcessedData(transcript)
      
      const p14Output = createMockP1_4Output(duIds)
      
      // Simulate P1.4 completion
      completeP1_4Step(transcriptId, p14Output)

      // Process each DU through P2S steps
      for (const duId of duIds) {
        // Set current DU
        usePipelineStore.setState(state => {
          const tData = state.processedData.get(transcriptId)
          if (tData) {
            state.processedData.set(transcriptId, {
              ...tData,
              current_du_for_p2s_processing: duId
            })
          }
        })

        // Process P2S.1 for this DU
        const p2s1Output = createMockP2S_1Output(duId)
        completeP2SStep(StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC, transcriptId, p2s1Output, duId)

        // Process P2S.2 for this DU
        const p2s2Output = createMockP2S_2Output(duId)
        completeP2SStep(StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS, transcriptId, p2s2Output, duId)

        // Process P2S.3 for this DU
        const p2s3Output = createMockP2S_3Output(duId)
        completeP2SStep(StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE, transcriptId, p2s3Output, duId)
      }

      // Verify all DUs have their data and none were overwritten
      const transcriptData = usePipelineStore.getState().processedData.get(transcriptId)
      expect(transcriptData?.p2s_outputs_by_du).toBeDefined()
      
      // Check each DU has all P2S outputs
      for (const duId of duIds) {
        const duData = transcriptData?.p2s_outputs_by_du?.[duId]
        expect(duData).toBeDefined()
        expect(duData?.p2s_1_output).toBeDefined()
        expect(duData?.p2s_2_output).toBeDefined()
        expect(duData?.p2s_3_output).toBeDefined()
        expect(duData?.p2s_3_mermaid_syntax).toBeDefined()
      }

      // Verify processed_dus_for_p2s contains all DUs
      expect(transcriptData?.processed_dus_for_p2s).toHaveLength(3)
      expect(transcriptData?.processed_dus_for_p2s).toEqual(expect.arrayContaining(duIds))
      expect(transcriptData?.isFullyProcessedSpecificSynchronic).toBe(true)
    })

    it('should handle partial DU processing without affecting other DUs', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      const duIds = ['du_1', 'du_2']
      
      // Add transcript and initialize processedData
      const processedDataMap = addTranscriptWithProcessedData(transcript)
      
      const p14Output = createMockP1_4Output(duIds)
      
      // Simulate P1.4 completion
      completeP1_4Step(transcriptId, p14Output)

      // Fully process du_1
      usePipelineStore.setState(state => {
        const tData = state.processedData.get(transcriptId)
        if (tData) {
          state.processedData.set(transcriptId, {
            ...tData,
            current_du_for_p2s_processing: 'du_1'
          })
        }
      })

      completeP2SStep(StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC, transcriptId, createMockP2S_1Output('du_1'), 'du_1')
      completeP2SStep(StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS, transcriptId, createMockP2S_2Output('du_1'), 'du_1')
      completeP2SStep(StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE, transcriptId, createMockP2S_3Output('du_1'), 'du_1')

      // Partially process du_2 (only P2S.1)
      usePipelineStore.setState(state => {
        const tData = state.processedData.get(transcriptId)
        if (tData) {
          state.processedData.set(transcriptId, {
            ...tData,
            current_du_for_p2s_processing: 'du_2'
          })
        }
      })

      completeP2SStep(StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC, transcriptId, createMockP2S_1Output('du_2'), 'du_2')

      // Verify du_1 still has all its data
      const transcriptData = usePipelineStore.getState().processedData.get(transcriptId)
      const du1Data = transcriptData?.p2s_outputs_by_du?.['du_1']
      expect(du1Data?.p2s_1_output).toBeDefined()
      expect(du1Data?.p2s_2_output).toBeDefined()
      expect(du1Data?.p2s_3_output).toBeDefined()

      // Verify du_2 has only P2S.1 data
      const du2Data = transcriptData?.p2s_outputs_by_du?.['du_2']
      expect(du2Data?.p2s_1_output).toBeDefined()
      expect(du2Data?.p2s_2_output).toBeUndefined()
      expect(du2Data?.p2s_3_output).toBeUndefined()

      // Verify not fully processed since du_2 is incomplete
      expect(transcriptData?.processed_dus_for_p2s).toHaveLength(1)
      expect(transcriptData?.processed_dus_for_p2s).toContain('du_1')
      expect(transcriptData?.isFullyProcessedSpecificSynchronic).toBe(false)
    })
  })

  describe('P0/P1 Step Isolation', () => {
    it('should not allow P0/P1 steps to modify P2S data', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      
      addTranscriptWithProcessedData(transcript)
      
      // Set up P2S data
      const duIds = ['du_1', 'du_2']
      const p14Output = createMockP1_4Output(duIds)
      completeP1_4Step(transcriptId, p14Output)

      // Add some P2S data for du_1
      usePipelineStore.setState(state => {
        const tData = state.processedData.get(transcriptId)
        if (tData) {
          state.processedData.set(transcriptId, {
            ...tData,
            current_du_for_p2s_processing: 'du_1',
            p2s_outputs_by_du: {
              du_1: {
                p2s_1_output: createMockP2S_1Output('du_1')
              }
            }
          })
        }
      })

      const p2sDataBefore = usePipelineStore.getState().processedData.get(transcriptId)?.p2s_outputs_by_du

      // Try to complete a P1 step with a DU context (should not affect P2S data)
      const processedData = usePipelineStore.getState().processedData
      usePipelineStore.getState().handleSuccessfulStep(
        StepId.P1_2_COARSE_PHASE_TAGGING,
        transcriptId,
        { phases: [] },
        {}, // inputData
        [], // groundingSources
        undefined, // currentGDU
        'du_1', // Even with DU context, P1 steps should not touch P2S data
        processedData
      )

      const p2sDataAfter = usePipelineStore.getState().processedData.get(transcriptId)?.p2s_outputs_by_du

      // P2S data should remain unchanged
      expect(p2sDataAfter).toEqual(p2sDataBefore)
    })

    it('should only allow P2S steps to be handled by P2S-specific block', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      
      addTranscriptWithProcessedData(transcript)
      
      // Set up for P2S
      const p14Output = createMockP1_4Output(['du_1'])
      completeP1_4Step(transcriptId, p14Output)

      usePipelineStore.setState(state => {
        const tData = state.processedData.get(transcriptId)
        if (tData) {
          state.processedData.set(transcriptId, {
            ...tData,
            current_du_for_p2s_processing: 'du_1'
          })
        }
      })

      // Complete a P2S step
      const p2s1Output = createMockP2S_1Output('du_1')
      completeP2SStep(StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC, transcriptId, p2s1Output, 'du_1')

      // Verify the data was stored in p2s_outputs_by_du
      const transcriptData = usePipelineStore.getState().processedData.get(transcriptId)
      expect(transcriptData?.p2s_outputs_by_du?.['du_1']?.p2s_1_output).toEqual(p2s1Output)
      
      // Verify it wasn't stored at the transcript level
      expect(transcriptData?.['p2s_1_output' as keyof TranscriptProcessedData]).toBeUndefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing currentDu gracefully', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      
      addTranscriptWithProcessedData(transcript)
      
      // Set up DUs but don't set current_du_for_p2s_processing
      const p14Output = createMockP1_4Output(['du_1'])
      completeP1_4Step(transcriptId, p14Output)

      // Try to complete P2S step without currentDu
      const p2s1Output = createMockP2S_1Output('du_1')
      const processedData = usePipelineStore.getState().processedData
      usePipelineStore.getState().handleSuccessfulStep(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        transcriptId,
        p2s1Output,
        {}, // inputData
        [], // groundingSources
        undefined, // currentGDU
        undefined, // No DU provided
        processedData
      )

      // Should not crash and should not store data
      const transcriptData = usePipelineStore.getState().processedData.get(transcriptId)
      expect(transcriptData?.p2s_outputs_by_du).toEqual({})
    })

    it('should handle missing transcriptIdToProcess gracefully', async () => {
      // Try to complete P2S step without transcript ID
      const p2s1Output = createMockP2S_1Output('du_1')
      
      // Should not throw
      const processedDataForNoTranscript = usePipelineStore.getState().processedData
      expect(() => {
        usePipelineStore.getState().handleSuccessfulStep(
          StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
          undefined as any, // No transcript ID
          p2s1Output,
          {}, // inputData
          [], // groundingSources
          undefined, // currentGDU
          'du_1', // currentDu
          processedDataForNoTranscript
        )
      }).not.toThrow()
    })

    it('should handle empty DU list from P1.4', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      
      addTranscriptWithProcessedData(transcript)
      
      // P1.4 returns empty DU list
      const p14Output = createMockP1_4Output([])
      completeP1_4Step(transcriptId, p14Output)

      const transcriptData = usePipelineStore.getState().processedData.get(transcriptId)
      expect(transcriptData?.dus_for_p2s_processing).toEqual([])
      expect(transcriptData?.current_du_for_p2s_processing).toBeUndefined()
      expect(transcriptData?.isFullyProcessedSpecificSynchronic).toBe(true) // No DUs to process
    })

    it('should handle error outputs for P2S steps', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      
      addTranscriptWithProcessedData(transcript)
      
      const p14Output = createMockP1_4Output(['du_1'])
      completeP1_4Step(transcriptId, p14Output)

      usePipelineStore.setState(state => {
        const tData = state.processedData.get(transcriptId)
        if (tData) {
          state.processedData.set(transcriptId, {
            ...tData,
            current_du_for_p2s_processing: 'du_1'
          })
        }
      })

      // Simulate error for P2S.1
      const errorMessage = 'API Error: Invalid input'
      // Call handleStepError directly to simulate error handling
      usePipelineStore.getState().handleStepError(
        StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
        transcriptId,
        errorMessage,
        {},  // inputData
        null, // output
        null, // groundingSources
        undefined, // currentGDU
        'du_1', // currentDu
        false // isReportStepForThisCall
      )

      const transcriptData = usePipelineStore.getState().processedData.get(transcriptId)
      const duData = transcriptData?.p2s_outputs_by_du?.['du_1']
      expect(duData?.p2s_1_output).toBeUndefined()
      expect(duData?.p2s_1_error).toBe(errorMessage)
    })
  })

  describe('Full Autorun Sequence', () => {
    it('should maintain data integrity during complete P2S autorun', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      const duIds = Array.from({ length: 11 }, (_, i) => `du_${i + 1}`)
      
      addTranscriptWithProcessedData(transcript)
      
      // Complete P1.4 to set up DUs
      const p14Output = createMockP1_4Output(duIds)
      completeP1_4Step(transcriptId, p14Output)

      // Simulate autorun through all DUs
      for (let i = 0; i < duIds.length; i++) {
        const duId = duIds[i]
        
        // Update current DU
        usePipelineStore.setState(state => {
          const tData = state.processedData.get(transcriptId)
          if (tData) {
            state.processedData.set(transcriptId, {
              ...tData,
              current_du_for_p2s_processing: duId
            })
          }
        })

        // Run through all P2S steps for this DU
        for (const stepId of STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC) {
          let output: any
          let key: string
          
          switch (stepId) {
            case StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC:
              output = createMockP2S_1Output(duId)
              key = 'p2s_1_output'
              break
            case StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS:
              output = createMockP2S_2Output(duId)
              key = 'p2s_2_output'
              break
            case StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE:
              output = createMockP2S_3Output(duId)
              key = 'p2s_3_output'
              break
            default:
              continue
          }

          completeP2SStep(stepId, transcriptId, output, duId)

          // Verify data integrity after each step
          const transcriptData = usePipelineStore.getState().processedData.get(transcriptId)
          
          // Check that all previously processed DUs still have their data
          for (let j = 0; j < i; j++) {
            const prevDuId = duIds[j]
            const prevDuData = transcriptData?.p2s_outputs_by_du?.[prevDuId]
            expect(prevDuData?.p2s_1_output).toBeDefined()
            expect(prevDuData?.p2s_2_output).toBeDefined()
            expect(prevDuData?.p2s_3_output).toBeDefined()
          }
        }
      }

      // Final verification
      const finalData = usePipelineStore.getState().processedData.get(transcriptId)
      
      // All DUs should have complete data
      expect(Object.keys(finalData?.p2s_outputs_by_du || {})).toHaveLength(11)
      
      for (const duId of duIds) {
        const duData = finalData?.p2s_outputs_by_du?.[duId]
        expect(duData?.p2s_1_output).toBeDefined()
        expect(duData?.p2s_2_output).toBeDefined()
        expect(duData?.p2s_3_output).toBeDefined()
        expect(duData?.p2s_3_mermaid_syntax).toBeDefined()
      }

      // Should be fully processed
      expect(finalData?.processed_dus_for_p2s).toHaveLength(11)
      expect(finalData?.isFullyProcessedSpecificSynchronic).toBe(true)
    })

    it('should handle invalidation during autorun correctly', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      const duIds = ['du_1', 'du_2', 'du_3']
      
      addTranscriptWithProcessedData(transcript)
      
      const p14Output = createMockP1_4Output(duIds)
      completeP1_4Step(transcriptId, p14Output)

      // Process du_1 and du_2 completely
      for (const duId of ['du_1', 'du_2']) {
        usePipelineStore.setState(state => {
          const tData = state.processedData.get(transcriptId)
          if (tData) {
            state.processedData.set(transcriptId, {
              ...tData,
              current_du_for_p2s_processing: duId
            })
          }
        })

        completeP2SStep(StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC, transcriptId, createMockP2S_1Output(duId), duId)
        completeP2SStep(StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS, transcriptId, createMockP2S_2Output(duId), duId)
        completeP2SStep(StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE, transcriptId, createMockP2S_3Output(duId), duId)
      }

      // Now invalidate P2S.2 - should clear P2S.2 and P2S.3 for ALL DUs
      usePipelineStore.getState().invalidateStateFromStep(StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS, transcriptId)

      const transcriptData = usePipelineStore.getState().processedData.get(transcriptId)
      
      // Check that P2S.1 data is preserved but P2S.2 and P2S.3 are cleared for all DUs
      for (const duId of ['du_1', 'du_2']) {
        const duData = transcriptData?.p2s_outputs_by_du?.[duId]
        expect(duData?.p2s_1_output).toBeDefined() // Should be preserved
        expect(duData?.p2s_2_output).toBeUndefined() // Should be cleared
        expect(duData?.p2s_3_output).toBeUndefined() // Should be cleared
        expect(duData?.p2s_3_mermaid_syntax).toBeUndefined() // Should be cleared
      }

      // processed_dus_for_p2s should be reset
      expect(transcriptData?.processed_dus_for_p2s).toEqual([])
      expect(transcriptData?.isFullyProcessedSpecificSynchronic).toBe(false)
    })
  })

  describe('Step Status Resolution', () => {
    it('should correctly track P2S step data across multiple DUs', async () => {
      const transcriptId = 'test-transcript-1'
      const transcript = createMockTranscript(transcriptId)
      
      addTranscriptWithProcessedData(transcript)
      useUIStore.getState().setActiveTranscript(0)
      
      const p14Output = createMockP1_4Output(['du_1', 'du_2'])
      completeP1_4Step(transcriptId, p14Output)

      // Process only du_2 (not du_1)
      const currentProcessedData = usePipelineStore.getState().processedData
      const tData = currentProcessedData.get(transcriptId)
      if (tData) {
        const updatedProcessedData = new Map(currentProcessedData)
        updatedProcessedData.set(transcriptId, {
          ...tData,
          current_du_for_p2s_processing: 'du_2',
          p2s_outputs_by_du: {
            du_2: {
              p2s_1_output: createMockP2S_1Output('du_2')
            }
          }
        })
        usePipelineStore.setState({ processedData: updatedProcessedData })
      }

      // Verify that P2S data exists for du_2 even though current_du might be different
      const finalData = usePipelineStore.getState().processedData.get(transcriptId)
      expect(finalData?.p2s_outputs_by_du?.['du_2']?.p2s_1_output).toBeDefined()
      expect(finalData?.p2s_outputs_by_du?.['du_2']?.p2s_1_output?.analyzed_du_id).toBe('du_2')
      
      // Verify du_1 has no data (wasn't processed)
      expect(finalData?.p2s_outputs_by_du?.['du_1']).toBeUndefined()
    })
  })
})