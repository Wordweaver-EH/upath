import { describe, test, expect, beforeEach, vi } from 'vitest'
import { usePipelineStore } from '../pipelineStore'
import { useTranscriptStore } from '../transcriptStore'
import { StepId, TranscriptProcessedData, RawTranscript } from '../../../types'

// Note: This is an integration test that uses real stores and services
// The invalidation service is instantiated within pipelineStore.invalidateStateFromStep

describe('Cross-Store Invalidation Integration', () => {
  beforeEach(() => {
    // Reset stores to clean state
    usePipelineStore.setState({
      genericAnalysisState: {
        p3_1_output: 'initial output',
        isFullyProcessedGenericDiachronic: true
      }
    })
    
    useTranscriptStore.setState({
      rawTranscripts: [],
      processedData: new Map()
    })
  })

  test('should properly update transcript store when invalidating transcript steps', () => {
    // Setup initial transcript data
    const transcript: RawTranscript = {
      id: 't1',
      name: 'test.txt',
      content: 'Test content',
      uploadedAt: Date.now()
    }
    
    const processedData: TranscriptProcessedData = {
      id: 't1',
      filename: 'test.txt',
      p0_1_output: 'initial adherence',
      p0_2_output: 'initial extraction',
      p1_1_output: 'initial diachronic',
      isFullyProcessedSpecificDiachronic: true,
      isFullyProcessedSpecificSynchronic: false
    }
    
    // Add to transcript store
    useTranscriptStore.getState().addTranscriptsSync([transcript])
    useTranscriptStore.getState().updateProcessedData('t1', processedData)
    
    // Verify initial state
    const initialData = useTranscriptStore.getState().processedData.get('t1')
    expect(initialData?.p0_1_output).toBe('initial adherence')
    expect(initialData?.p0_2_output).toBe('initial extraction')
    expect(initialData?.p1_1_output).toBe('initial diachronic')
    
    // Invalidate from P0_2 step - this should trigger the invalidation service
    // Pass transcript data to ensure the service has access to it
    usePipelineStore.getState().invalidateStateFromStep(
      StepId.P0_2_REFINE_DATA_TYPES,
      't1',
      0,
      {
        rawTranscripts: [transcript],
        processedData: useTranscriptStore.getState().processedData
      }
    )
    
    // Verify invalidation cascaded properly
    const updatedData = useTranscriptStore.getState().processedData.get('t1')
    expect(updatedData?.p0_1_output).toBe('initial adherence') // Should remain
    expect(updatedData?.p0_2_output).toBeUndefined() // Should be cleared
    expect(updatedData?.p1_1_output).toBeUndefined() // Should be cleared (cascaded)
    expect(updatedData?.isFullyProcessedSpecificDiachronic).toBe(false) // Should be reset
  })

  test('should properly update generic state when invalidating global steps', () => {
    // Setup initial generic state
    usePipelineStore.setState({
      genericAnalysisState: {
        p3_1_output: 'core message',
        p3_2_output: 'GDUs identified',
        p3_3_output: 'diachronic structure',
        isFullyProcessedGenericDiachronic: true,
        p3_3_mermaid_syntax: 'graph TD...',
        core_gdus_for_sync_analysis: ['gdu1', 'gdu2']
      }
    })
    
    // Invalidate from P3_2
    usePipelineStore.getState().invalidateStateFromStep(
      StepId.P3_2_IDENTIFY_GDUS
    )
    
    // Verify invalidation
    const updatedState = usePipelineStore.getState().genericAnalysisState
    expect(updatedState.p3_1_output).toBe('core message') // Should remain
    expect(updatedState.p3_2_output).toBeUndefined() // Should be cleared
    expect(updatedState.p3_3_output).toBeUndefined() // Should be cleared (cascaded)
    expect(updatedState.isFullyProcessedGenericDiachronic).toBe(false) // Should be reset
    expect(updatedState.p3_3_mermaid_syntax).toBeUndefined() // Should be cleared
    expect(updatedState.core_gdus_for_sync_analysis).toEqual([]) // Should be reset
  })

  test('should handle mixed transcript and global invalidation', () => {
    // Setup transcript data
    const transcript: RawTranscript = {
      id: 't1',
      name: 'test.txt',
      content: 'Test content',
      uploadedAt: Date.now()
    }
    
    useTranscriptStore.getState().addTranscriptsSync([transcript])
    useTranscriptStore.getState().updateProcessedData('t1', {
      id: 't1',
      filename: 'test.txt',
      p1_1_output: 'diachronic output',
      p1_4_output: 'structure output',
      isFullyProcessedSpecificDiachronic: true,
      isFullyProcessedSpecificSynchronic: false
    })
    
    // Setup generic state
    usePipelineStore.setState({
      genericAnalysisState: {
        p3_1_output: 'core message',
        p3_3_output: 'generic structure',
        isFullyProcessedGenericDiachronic: true
      }
    })
    
    // Invalidate from a transcript step (should cascade to global)
    usePipelineStore.getState().invalidateStateFromStep(
      StepId.P1_1_INITIAL_SEGMENTATION,
      't1',
      0,
      {
        rawTranscripts: [transcript],
        processedData: useTranscriptStore.getState().processedData
      }
    )
    
    // Verify transcript invalidation
    const updatedTranscriptData = useTranscriptStore.getState().processedData.get('t1')
    expect(updatedTranscriptData?.p1_1_output).toBeUndefined()
    expect(updatedTranscriptData?.p1_4_output).toBeUndefined()
    expect(updatedTranscriptData?.isFullyProcessedSpecificDiachronic).toBe(false)
    
    // Verify global invalidation (should cascade from transcript changes)
    const updatedGenericState = usePipelineStore.getState().genericAnalysisState
    expect(updatedGenericState.p3_1_output).toBeUndefined()
    expect(updatedGenericState.p3_3_output).toBeUndefined()
    expect(updatedGenericState.isFullyProcessedGenericDiachronic).toBe(false)
  })
})