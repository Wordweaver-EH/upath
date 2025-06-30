import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { IrrWorkflowState, SavedState, P9_1_SemanticGduMapping } from '../../types'
import { calculateKrippendorffsAlpha } from '../../utils/statisticsHelper'
import { callGeminiAPI } from '../../services/geminiService'
import { GEMINI_MODEL_TEXT } from '../../constants'

interface IRRState {
  irrWorkflowState: IrrWorkflowState
}

interface IRRActions {
  // Workflow Control
  openIrrModal: () => void
  startComparison: (runA: SavedState, runB: SavedState) => void
  closeIrrModal: () => void
  setRunA: (runA: SavedState) => void
  setRunB: (runB: SavedState) => void
  setErrorMessage: (message: string) => void
  
  // Mapping Modal
  openMappingModal: () => void
  closeMappingModal: () => void
  
  // Semantic Mapping
  generateSemanticMapping: () => Promise<void>
  confirmMapping: (mapping: P9_1_SemanticGduMapping) => void
  
  // Results
  calculateResults: () => void
  closeResults: () => void
  
  // Utils
  resetIrrWorkflow: () => void
  setLoadingState: (state: 'idle' | 'loading-files' | 'calling-llm' | 'calculating' | 'complete' | 'error') => void
}

type IRRStore = IRRState & IRRActions

const initialIrrState: IrrWorkflowState = {
  isIrrModalOpen: false,
  runA: null,
  runB: null,
  isMappingModalOpen: false,
  mappingProposal: null,
  confirmedMapping: null,
  results: null,
  loadingState: 'idle'
}

export const useIRRStore = create<IRRStore>()(
  immer((set, get) => ({
    // Initial State
    irrWorkflowState: initialIrrState,
    
    // Actions
    openIrrModal: () => {
      set((state) => {
        state.irrWorkflowState.isIrrModalOpen = true
      })
    },
    
    startComparison: (runA: SavedState, runB: SavedState) => {
      set((state) => {
        state.irrWorkflowState = {
          ...initialIrrState,
          isIrrModalOpen: true,
          runA,
          runB
        }
      })
    },
    
    closeIrrModal: () => {
      set((state) => {
        state.irrWorkflowState.isIrrModalOpen = false
      })
    },
    
    setRunA: (runA: SavedState) => {
      set((state) => {
        state.irrWorkflowState.runA = runA
      })
    },
    
    setRunB: (runB: SavedState) => {
      set((state) => {
        state.irrWorkflowState.runB = runB
      })
    },
    
    setErrorMessage: (message: string) => {
      set((state) => {
        state.irrWorkflowState.errorMessage = message
        state.irrWorkflowState.loadingState = 'error'
      })
    },
    
    openMappingModal: () => {
      set((state) => {
        state.irrWorkflowState.isMappingModalOpen = true
      })
    },
    
    closeMappingModal: () => {
      set((state) => {
        state.irrWorkflowState.isMappingModalOpen = false
        state.irrWorkflowState.mappingProposal = null
      })
    },
    
    generateSemanticMapping: async () => {
      const { runA, runB } = get().irrWorkflowState
      
      if (!runA || !runB) {
        console.error('Cannot generate mapping without both runs')
        return
      }
      
      set((state) => {
        state.irrWorkflowState.loadingState = 'calling-llm'
      })
      
      try {
        // Extract GDUs from both runs
        const gdusA = runA.genericAnalysisState.p3_2_output?.identified_gdus || []
        const gdusB = runB.genericAnalysisState.p3_2_output?.identified_gdus || []
        
        // Get settings from settingsStore
        const { temperature, seed } = (await import('./settingsStore')).useSettingsStore.getState()
        
        const prompt = `You are tasked with creating a semantic mapping between Generic Diachronic Units (GDUs) from two different analysis runs of micro-phenomenological data.

## Run A GDUs:
${gdusA.map((gdu, idx) => `${idx + 1}. ${gdu.gdu_id}: ${gdu.definition}`).join('\n')}

## Run B GDUs:
${gdusB.map((gdu, idx) => `${idx + 1}. ${gdu.gdu_id}: ${gdu.definition}`).join('\n')}

## Task:
Create a mapping between semantically similar GDUs across the two runs. Some GDUs may have no match in the other run.

Provide your response as a JSON object with this structure:
{
  "gdu_mappings": [
    {
      "run_a_gdu": "GDU name from Run A or null",
      "run_b_gdu": "GDU name from Run B or null",
      "semantic_similarity": number between 0 and 1,
      "mapping_justification": "Brief explanation"
    }
  ]
}

## Guidelines:
- Include all GDUs from both runs in the mapping
- Use null for unmatched GDUs
- semantic_similarity: 1.0 = identical, 0.0 = completely different
- Consider conceptual similarity, not just word matching
- Prioritize definitional similarity over statistical similarity
- mapping_justification: Brief explanation of why these GDUs are semantically similar or why no match exists`

        const response = await callGeminiAPI(
          prompt,
          1,  // maxRetries
          true, // isJsonOutput
          false, // useGrounding
          temperature,
          seed
        )
        
        if (response.error) {
          throw new Error(response.error || 'Failed to generate semantic mapping')
        }
        
        // Parse and validate the mapping response
        let mappingProposal: P9_1_SemanticGduMapping
        try {
          mappingProposal = response.parsedJson
          if (!mappingProposal.gdu_mappings || !Array.isArray(mappingProposal.gdu_mappings)) {
            throw new Error('Invalid mapping structure')
          }
        } catch (parseError) {
          throw new Error(`Failed to parse mapping response: ${parseError instanceof Error ? parseError.message : 'Invalid JSON'}`)
        }
        
        set((state) => {
          state.irrWorkflowState.mappingProposal = mappingProposal
          state.irrWorkflowState.loadingState = 'idle'
          state.irrWorkflowState.isMappingModalOpen = true
        })
      } catch (error) {
        console.error('Failed to generate semantic mapping:', error)
        set((state) => {
          state.irrWorkflowState.loadingState = 'idle'
        })
      }
    },
    
    confirmMapping: (mapping: P9_1_SemanticGduMapping) => {
      set((state) => {
        state.irrWorkflowState.confirmedMapping = mapping
        state.irrWorkflowState.isMappingModalOpen = false
        state.irrWorkflowState.mappingProposal = null
      })
    },
    
    calculateResults: () => {
      const { runA, runB, confirmedMapping } = get().irrWorkflowState
      
      if (!runA || !runB || !confirmedMapping) {
        console.error('Cannot calculate results without runs and mapping')
        return
      }
      
      set((state) => {
        state.irrWorkflowState.loadingState = 'calculating'
      })
      
      try {
        const results = calculateKrippendorffsAlpha(runA, runB, confirmedMapping)
        
        set((state) => {
          state.irrWorkflowState.results = results
          state.irrWorkflowState.loadingState = 'idle'
        })
      } catch (error) {
        console.error('Failed to calculate results:', error)
        set((state) => {
          state.irrWorkflowState.loadingState = 'idle'
        })
      }
    },
    
    closeResults: () => {
      set((state) => {
        state.irrWorkflowState = initialIrrState
      })
    },
    
    resetIrrWorkflow: () => {
      set((state) => {
        state.irrWorkflowState = initialIrrState
      })
    },
    
    setLoadingState: (loadingState: 'idle' | 'loading-files' | 'calling-llm' | 'calculating' | 'complete' | 'error') => {
      set((state) => {
        state.irrWorkflowState.loadingState = loadingState
      })
    }
  }))
)