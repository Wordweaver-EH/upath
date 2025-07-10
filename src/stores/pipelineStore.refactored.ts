// Temporary file to show the refactored processSingleStep method
// This will be merged into pipelineStore.ts

import { PipelineOrchestrator } from '../services/pipeline'
import {
  StepParameterValidationService,
  StepContextPreparationService,
  StepInputPreparationService,
  StepExecutionService,
  PromptHistoryService,
  StepErrorHandlingService,
  StepSuccessHandlingService
} from '../services/pipeline'
import { usePromptHistoryStore } from './promptHistoryStore'
import { useTranscriptStore } from './transcriptStore'

// Main pipeline orchestrator - refactored to use PipelineOrchestrator
processSingleStep: async (params) => {
  const { genericAnalysisState } = get()
  
  console.groupCollapsed(`🚀 [pipelineStore] processSingleStep: ${params.stepId}`);
  console.log(`- Transcript ID: ${params.transcriptIdToProcess || 'N/A (Global Step)'}`);
  console.log(`- Override Seed: ${params.overrideSeed || 'Default'}`);
  console.log(`- HIL Prompt: ${params.hilMetaPrompt ? 'Yes' : 'No'}`);
  console.log(`- Raw Transcripts Count: ${params.transcriptData?.rawTranscripts?.length || 0}`);

  try {
    // Initialize all services
    const validationService = new StepParameterValidationService()
    const contextService = new StepContextPreparationService()
    const inputService = new StepInputPreparationService()
    const executionService = new StepExecutionService()
    const historyService = new PromptHistoryService()
    const errorService = new StepErrorHandlingService()
    const successService = new StepSuccessHandlingService()
    
    // Create update callbacks
    const updateStores = (updates: any) => {
      set(state => {
        // Update lastStepInfo based on the updates
        if (updates.stepId && updates.status) {
          state.lastStepInfo = {
            stepId: updates.stepId,
            status: updates.status,
            transcriptId: updates.transcriptId,
            error: updates.error
          }
        }
        
        // Handle shouldStopAutorun
        if (updates.status === StepStatus.Error) {
          state.shouldStopAutorun = true
        }
        
        // Handle generic state updates for specific steps
        if (updates.output && !updates.transcriptId) {
          const key = stepIdToDataKeyPrefix[updates.stepId]
          if (key && typeof key === 'string') {
            state.genericAnalysisState[key as keyof GenericAnalysisState] = updates.output
            state.genericAnalysisState[`${key.replace('_output','_error')}` as keyof GenericAnalysisState] = undefined
          }
        }
        
        // Handle special cases like P3.3
        if (updates.stepId === StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE && updates.output) {
          const p3_3 = updates.output as P3_3_Output
          const core = p3_3?.generic_diachronic_structure_definition?.core_gdus || []
          const mermaid = p3_3 ? transformGenericDiachronicToMermaid(p3_3.generic_diachronic_structure_definition) : undefined
          
          state.genericAnalysisState.p3_3_output = p3_3
          state.genericAnalysisState.p3_3_mermaid_syntax = mermaid
          state.genericAnalysisState.p3_3_error = undefined
          state.genericAnalysisState.isFullyProcessedGenericDiachronic = true
          state.genericAnalysisState.core_gdus_for_sync_analysis = core
          state.genericAnalysisState.processed_gdus_for_p4s = []
          state.genericAnalysisState.current_gdu_for_p4s_processing = core[0] || undefined
          state.genericAnalysisState.p4s_outputs_by_gdu = {}
          state.genericAnalysisState.p4s_mermaid_syntax_by_gdu = {}
          state.genericAnalysisState.p4s_1_a_error = undefined
          state.genericAnalysisState.p4s_1_b_error = undefined
          state.genericAnalysisState.isFullyProcessedGenericSynchronic = (core.length === 0)
        }
        
        // Handle transcript-specific updates
        if (updates.transcriptId && updates.output) {
          const transcriptStore = useTranscriptStore.getState()
          const processedData = new Map(transcriptStore.processedData)
          const tData = processedData.get(updates.transcriptId)
          
          if (tData) {
            const key = stepIdToDataKeyPrefix[updates.stepId]
            if (key && typeof key === 'string') {
              const updatedData = {
                ...tData,
                [key as keyof TranscriptProcessedData]: updates.output,
                [`${key.replace('_output','_error')}` as keyof TranscriptProcessedData]: undefined
              } as TranscriptProcessedData
              
              // Special handling for P1.4
              if (updates.stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE && updates.output) {
                updatedData.isFullyProcessedSpecificDiachronic = true
                updatedData.p1_4_mermaid_syntax = transformDiachronicToMermaid((updates.output as P1_4_Output).specific_diachronic_structure)
                const phases = (updates.output as P1_4_Output)?.specific_diachronic_structure?.phases.map(p => p.phase_name) || []
                updatedData.phases_for_p2s_processing = phases
                updatedData.current_phase_for_p2s_processing = phases[0] || undefined
                updatedData.processed_phases_for_p2s = []
                updatedData.p2s_outputs_by_phase = {}
                updatedData.isFullyProcessedSpecificSynchronic = phases.length === 0
              }
              
              processedData.set(updates.transcriptId, updatedData)
              transcriptStore.setProcessedData(processedData)
            }
          }
        }
      })
    }
    
    const addPromptEntry = (entry: PromptHistoryEntry) => {
      const promptHistoryStore = usePromptHistoryStore.getState()
      promptHistoryStore.addEntry(entry)
    }
    
    // Create orchestrator instance
    const orchestrator = new PipelineOrchestrator(
      validationService,
      contextService,
      inputService,
      executionService,
      historyService,
      errorService,
      successService,
      updateStores,
      addPromptEntry
    )
    
    // Execute the step
    await orchestrator.processSingleStep(params)
    
  } catch (error) {
    console.error(`❌ [pipelineStore] Unexpected error in processSingleStep:`, error)
    set(state => ({
      ...state,
      lastStepInfo: { 
        stepId: params.stepId, 
        status: StepStatus.Error, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      shouldStopAutorun: true
    }))
  } finally {
    console.groupEnd()
  }
},