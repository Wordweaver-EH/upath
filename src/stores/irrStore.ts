import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { IrrWorkflowState, SavedState, SemanticGduMapping, IrrResultsSection, P9_1_SemanticGduMapping } from '../../types'
import { calculateKrippendorffsAlpha } from '../../utils/statisticsHelper'
import { callGeminiAPI } from '../../services/geminiService'
import { GEMINI_MODEL_TEXT } from '../../constants'

interface IRRState {
  irrWorkflowState: IrrWorkflowState
}

interface IRRActions {
  // Workflow Control
  startComparison: (runA: SavedState, runB: SavedState) => void
  closeIrrModal: () => void
  
  // Mapping Modal
  openMappingModal: () => void
  closeMappingModal: () => void
  
  // Semantic Mapping
  generateSemanticMapping: () => Promise<void>
  confirmMapping: (mapping: SemanticGduMapping) => void
  
  // Results
  calculateResults: () => void
  closeResults: () => void
  
  // Utils
  resetIrrWorkflow: () => void
  setLoadingState: (state: 'idle' | 'generating' | 'calculating') => void
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
        state.irrWorkflowState.loadingState = 'generating'
      })
      
      try {
        // Extract GDUs from both runs
        const gdusA = runA.genericAnalysisState.p3_2_output?.gdus || []
        const gdusB = runB.genericAnalysisState.p3_2_output?.gdus || []
        
        // Get settings from settingsStore
        const { temperature, seed } = (await import('./settingsStore')).useSettingsStore.getState()
        
        const prompt = `You are tasked with creating a semantic mapping between Generic Diachronic Units (GDUs) from two different analysis runs of micro-phenomenological data.

## Run A GDUs:
${gdusA.map((gdu, idx) => `${idx + 1}. ${gdu.gdu_name}: ${gdu.gdu_description}`).join('\n')}

## Run B GDUs:
${gdusB.map((gdu, idx) => `${idx + 1}. ${gdu.gdu_name}: ${gdu.gdu_description}`).join('\n')}

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
    
    confirmMapping: (mapping: SemanticGduMapping) => {
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
    
    setLoadingState: (loadingState: 'idle' | 'generating' | 'calculating') => {
      set((state) => {
        state.irrWorkflowState.loadingState = loadingState
      })
    }
  }))
)