import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { IrrWorkflowState, SavedState, P9_1_SemanticGduMapping, IrrResults } from '../../types'
import { generateIrrSemanticMapping } from '../../services/geminiService'
import { calculateKrippendorffsAlpha, calculateCohensKappa, buildReliabilityMatrix } from '../utils/statisticsHelper'
import { buildCompleteUtteranceToGduMapping } from '../utils/traceabilityHelper'
import { generateDisagreementReport, disagreementReportToCsv, disagreementReportToMarkdown, normalizeRunBData } from '../utils/irrReportHelper'
import { downloadFile } from '../utils/tsvHelper'
import { STEP_CONFIGS, STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC, STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC, STEP_ORDER_PART_3_GENERIC_DIACHRONIC, STEP_ORDER_PART_4_GENERIC_SYNCHRONIC, GEMINI_MODEL_TEXT } from '../../constants'

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
  generateSemanticMapping: (settings: { temperature: number; seed?: number }) => Promise<void>
  confirmMapping: (mapping: P9_1_SemanticGduMapping) => void
  
  // Results
  calculateResults: (mappingOverride?: Record<string, string | null>) => void
  closeResults: () => void
  
  // Utils
  resetIrrWorkflow: () => void
  setLoadingState: (state: 'idle' | 'loading-files' | 'calling-llm' | 'calculating' | 'complete' | 'error') => void
  
  // Handler methods
  handleStateUpdate: (updates: Partial<IrrWorkflowState>) => void
  handleStartComparison: () => Promise<void>
  handleConfirmMapping: (confirmedMapping: Record<string, string | null>) => Promise<void>
  handleDownloadDisagreementReport: () => void
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
  kappaResults: undefined,
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
    
    generateSemanticMapping: async (settings: { temperature: number; seed?: number }) => {
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
        
        // Use passed settings (backend handles API key)
        const { temperature, seed } = settings
        
        // BACKEND CALL: Use new IRR service instead of direct Gemini API
        const response = await generateIrrSemanticMapping(
          gdusA,
          gdusB,
          {
            temperature,
            seed
          }
        )
        
        if (response.error) {
          throw new Error(response.error)
        }
        
        if (!response.mapping) {
          throw new Error('No mapping data received from backend')
        }
        
        // The backend already returns the properly structured mapping
        const mappingProposal: P9_1_SemanticGduMapping = response.mapping
        
        set((state) => {
          state.irrWorkflowState.mappingProposal = mappingProposal
          state.irrWorkflowState.loadingState = 'idle'
          state.irrWorkflowState.isMappingModalOpen = true
        })
      } catch (error) {
        console.error('Failed to generate semantic mapping:', error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        set((state) => {
          state.irrWorkflowState.loadingState = 'idle'
          state.irrWorkflowState.errorMessage = `Failed to generate semantic mapping: ${errorMessage}`
        })
      }
    },
    
    confirmMapping: (mapping: P9_1_SemanticGduMapping) => {
      console.log('confirmMapping called with:', mapping)
      
      // Convert P9_1_SemanticGduMapping to simple Record<string, string | null>
      const simpleMappingDict: Record<string, string | null> = {}
      mapping.gdu_mappings.forEach(m => {
        if (m.run_a_gdu_id) {
          simpleMappingDict[m.run_a_gdu_id] = m.run_b_gdu_id || null
        }
      })
      
      console.log('Converted to simple mapping:', simpleMappingDict)
      
      set((state) => {
        state.irrWorkflowState.confirmedMapping = simpleMappingDict
        state.irrWorkflowState.isMappingModalOpen = false
        state.irrWorkflowState.mappingProposal = null
      })
      
      console.log('State after confirmMapping:', get().irrWorkflowState)
      
      // Immediately trigger the IRR calculation with the confirmed mapping
      console.log('Triggering calculateResults with mapping data...')
      get().calculateResults(simpleMappingDict)
    },
    
    calculateResults: (mappingOverride?: Record<string, string | null>) => {
      console.log('calculateResults called', mappingOverride ? 'with override' : 'from state')
      const { runA, runB, confirmedMapping: stateMapping } = get().irrWorkflowState
      const confirmedMapping = mappingOverride || stateMapping
      
      console.log('calculateResults - runA exists:', !!runA)
      console.log('calculateResults - runB exists:', !!runB)
      console.log('calculateResults - confirmedMapping exists:', !!confirmedMapping)
      
      if (!runA || !runB || !confirmedMapping) {
        console.error('Cannot calculate results without runs and mapping', { runA: !!runA, runB: !!runB, confirmedMapping: !!confirmedMapping })
        set((state) => {
          state.irrWorkflowState.errorMessage = 'Cannot calculate results: missing required data'
          state.irrWorkflowState.loadingState = 'error'
        })
        return
      }
      
      set((state) => {
        state.irrWorkflowState.loadingState = 'calculating'
      })
      
      try {
        // Build the utterance-to-GDU mappings for both runs
        const runAProcessedDataMap = new Map(runA.processedDataArray)
        const runBProcessedDataMapOriginal = new Map(runB.processedDataArray)
        
        // Normalize Run B data to match Run A's transcript IDs
        const { normalizedProcessedData: runBProcessedDataMap, normalizedGenericState } = normalizeRunBData(
          runAProcessedDataMap,
          runBProcessedDataMapOriginal,
          runB.genericAnalysisState
        )
        
        const runAMappings = buildCompleteUtteranceToGduMapping(
          runAProcessedDataMap,
          runA.genericAnalysisState.p3_2_output
        )
        
        const runBMappings = buildCompleteUtteranceToGduMapping(
          runBProcessedDataMap,
          normalizedGenericState.p3_2_output
        )
        
        // Convert confirmedMapping to Map format for buildReliabilityMatrix
        const gduMappingMap = new Map<string, string | null>(Object.entries(confirmedMapping))
        
        // Build the reliability matrix
        const reliabilityMatrix = buildReliabilityMatrix(runAMappings, runBMappings, gduMappingMap)
        
        console.log('Reliability matrix built:', {
          matrixLength: reliabilityMatrix.length,
          runAMappingsSize: runAMappings.size,
          runBMappingsSize: runBMappings.size,
          sample: reliabilityMatrix.slice(0, 5)
        })
        
        // Calculate Krippendorff's Alpha
        const alphaResults = calculateKrippendorffsAlpha(reliabilityMatrix)
        
        // Calculate Cohen's Kappa  
        const kappaResults = calculateCohensKappa(reliabilityMatrix)
        
        // Calculate unique utterances count (not matrix rows)
        const allUtteranceIds = new Set<string>()
        runAMappings.forEach((_, id) => allUtteranceIds.add(id))
        runBMappings.forEach((_, id) => allUtteranceIds.add(id))
        
        // Calculate unmapped GDUs
        const runAAllGdus = runA.genericAnalysisState.p3_2_output?.identified_gdus || []
        const runBAllGdus = runB.genericAnalysisState.p3_2_output?.identified_gdus || []
        const runAGduIds = new Set(runAAllGdus.map(g => g.gdu_id))
        const runBGduIds = new Set(runBAllGdus.map(g => g.gdu_id))
        const mappedRunAGdus = new Set(Object.keys(confirmedMapping))
        const mappedRunBGdus = new Set(Object.values(confirmedMapping).filter(v => v !== null) as string[])
        
        // Transform results to IrrResults format
        const irrResults: IrrResults = {
          alpha_score: alphaResults.alpha,
          interpretation: alphaResults.interpretation,
          total_utterances: allUtteranceIds.size,  // Use unique utterance count, not matrix rows
          mapped_gdus: gduMappingMap.size,
          unmapped_gdus_run_a: runAGduIds.size - mappedRunAGdus.size,
          unmapped_gdus_run_b: runBGduIds.size - mappedRunBGdus.size,
          observed_disagreement: alphaResults.observedDisagreement,
          expected_disagreement: alphaResults.expectedDisagreement,
          matrix_validation: {
            isValid: true,
            warnings: [],
            errors: []
          },
          // Cohen's Kappa statistics
          cohens_kappa: kappaResults.kappa,
          kappa_interpretation: kappaResults.interpretation,
          kappa_observed_agreement: kappaResults.observedAgreement,
          kappa_expected_agreement: kappaResults.expectedAgreement
        }
        
        // Store Kappa results including contingency table for report generation
        set((state) => {
          state.irrWorkflowState.results = irrResults
          state.irrWorkflowState.kappaResults = kappaResults
          state.irrWorkflowState.loadingState = 'idle'
        })
      } catch (error) {
        console.error('Failed to calculate results:', error)
        set((state) => {
          state.irrWorkflowState.loadingState = 'idle'
          state.irrWorkflowState.errorMessage = error instanceof Error ? error.message : 'Failed to calculate IRR results'
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
    },
    
    // Handler methods moved from App.tsx
    handleStateUpdate: (updates: Partial<IrrWorkflowState>) => {
      if (updates.loadingState) get().setLoadingState(updates.loadingState)
      if (updates.errorMessage) get().setErrorMessage(updates.errorMessage)
    },
    
    handleStartComparison: async () => {
      const state = get().irrWorkflowState
      if (!state.runA || !state.runB) {
        get().setLoadingState('error')
        get().setErrorMessage('Both Run A and Run B must be loaded')
        return
      }
      
      try {
        // Check if GDU sets are identical (skip mapping step)
        const runAGduIds = new Set(state.runA.genericAnalysisState.p3_2_output?.identified_gdus?.map(g => g.gdu_id) || [])
        const runBGduIds = new Set(state.runB.genericAnalysisState.p3_2_output?.identified_gdus?.map(g => g.gdu_id) || [])
        
        const areGduSetsIdentical = 
          runAGduIds.size === runBGduIds.size && 
          [...runAGduIds].every(id => runBGduIds.has(id))
        
        if (areGduSetsIdentical) {
          // Create automatic 1:1 mapping
          const autoMapping: P9_1_SemanticGduMapping = {
            gdu_mappings: [...runAGduIds].map(gduId => ({
              run_a_gdu: gduId,
              run_b_gdu: gduId,
              semantic_similarity: 1.0,
              mapping_justification: "Identical GDU IDs - automatic 1:1 mapping"
            }))
          }
          get().confirmMapping(autoMapping)
          get().setLoadingState('calculating')
        } else {
          // Need semantic mapping
          await get().generateSemanticMapping({
            temperature: 0.7
          })
        }
      } catch (error) {
        console.error('Error starting comparison:', error)
        get().setLoadingState('error')
        get().setErrorMessage('Failed to start comparison')
      }
    },
    
    handleConfirmMapping: async (userMappingDict: Record<string, string | null>) => {
      console.log('handleConfirmMapping called with:', userMappingDict)
      
      // Set the confirmed mapping in the state
      set((state) => {
        state.irrWorkflowState.confirmedMapping = userMappingDict
        state.irrWorkflowState.isMappingModalOpen = false
        state.irrWorkflowState.mappingProposal = null
      })
      
      console.log('State after confirmMapping:', get().irrWorkflowState)
      
      // Immediately trigger the IRR calculation with the confirmed mapping
      console.log('Triggering calculateResults with mapping data...')
      get().calculateResults(userMappingDict)
    },
    
    handleDownloadDisagreementReport: () => {
      const { results, runA, runB, confirmedMapping } = get().irrWorkflowState
      if (!results || !runA || !runB || !confirmedMapping) {
        alert('Cannot generate disagreement report: IRR analysis must be completed first')
        return
      }
      
      try {
        const disagreementReport = generateDisagreementReport(get().irrWorkflowState, results)
        
        // Generate both CSV and Markdown versions
        const csvContent = disagreementReportToCsv(disagreementReport)
        const markdownContent = disagreementReportToMarkdown(disagreementReport)
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        downloadFile(csvContent, `irr-full-coding-matrix-${timestamp}.csv`, 'text/csv')
        downloadFile(markdownContent, `irr-full-coding-matrix-${timestamp}.md`, 'text/markdown')
      } catch (error) {
        console.error('Failed to generate disagreement report:', error)
        alert('Failed to generate disagreement report')
      }
    }
  }))
)