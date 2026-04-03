import { describe, it, expect, beforeEach } from 'vitest'
import { enableMapSet } from 'immer'
import { usePipelineStore } from '../pipelineStore'
import type { TranscriptProcessedData } from '../../../types'
import { StepId } from '../../../types'

// Enable Immer to work with Map/Set
enableMapSet()

describe('PipelineStore - Minimal P2S Test', () => {
  beforeEach(() => {
    usePipelineStore.setState({
      rawTranscripts: [],
      processedData: new Map(),
      genericAnalysisState: {}
    })
  })

  it('should call handleSuccessfulStep directly', () => {
    const transcriptId = 'test-1'
    
    // Create initial processedData
    const processedDataMap = new Map<string, TranscriptProcessedData>()
    processedDataMap.set(transcriptId, {
      id: transcriptId,
      p2s_outputs_by_du: {}
    } as TranscriptProcessedData)
    
    // Call handleSuccessfulStep directly
    usePipelineStore.getState().handleSuccessfulStep(
      StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
      transcriptId,
      { thematic_groups: [] }, // minimal output
      {}, // inputData
      [], // groundingSources
      undefined, // currentGDU
      'du_1', // currentDu
      processedDataMap
    )
    
    // Verify the state was updated
    const updatedData = usePipelineStore.getState().processedData.get(transcriptId)
    expect(updatedData).toBeDefined()
    expect(updatedData?.p2s_outputs_by_du).toBeDefined()
    expect(updatedData?.p2s_outputs_by_du?.['du_1']).toBeDefined()
    expect(updatedData?.p2s_outputs_by_du?.['du_1']?.p2s_1_output).toEqual({ thematic_groups: [] })
  })
})