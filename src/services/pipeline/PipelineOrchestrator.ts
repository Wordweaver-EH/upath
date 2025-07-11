import { stepIdToDataKeyPrefix } from '../../utils/stepIdToDataKeyPrefix'
import { 
  IPipelineOrchestrator,
  IStepParameterValidationService,
  IStepContextPreparationService,
  IStepInputPreparationService,
  IStepExecutionService,
  IPromptHistoryService,
  IStepErrorHandlingService,
  IStepSuccessHandlingService,
  StepExecutionParams,
  PromptHistoryEntry,
  StoreOperations
} from './types'
import { StepStatus } from '../../../types'
import { StoreTransactionService } from './StoreTransactionService'

/**
 * Orchestrates the execution of pipeline steps by coordinating all services
 * 
 * This class implements the main processSingleStep logic, delegating to
 * specialized services for each aspect of step execution. It follows
 * a clear pipeline pattern:
 * 
 * 1. Validation → 2. Context → 3. Input → 4. Execution → 5. History → 6. Success/Error
 * 
 * @implements IPipelineOrchestrator
 */
export class PipelineOrchestrator implements IPipelineOrchestrator {
  private transactionService: StoreTransactionService

  constructor(
    private validationService: IStepParameterValidationService,
    private contextService: IStepContextPreparationService,
    private inputService: IStepInputPreparationService,
    private executionService: IStepExecutionService,
    private historyService: IPromptHistoryService,
    private errorService: IStepErrorHandlingService,
    private successService: IStepSuccessHandlingService,
    private updateStores: (updates: any) => void,
    private addPromptEntry: (entry: PromptHistoryEntry) => void,
    private storeOperations: StoreOperations,
    transactionService?: StoreTransactionService
  ) {
    this.transactionService = transactionService || new StoreTransactionService()
  }

  /**
   * Main orchestration method that coordinates all services to execute a single pipeline step
   * 
   * @param params - The execution parameters including step ID, transcript, and settings
   */
  async processSingleStep(params: StepExecutionParams): Promise<void> {
    this.logStepStart(params)

    try {
      // Step 1: Validate parameters
      const validationResult = this.validationService.validate(params)
      if (!validationResult.success || !validationResult.data) {
        this.updateStores({
          stepId: params.stepId,
          status: StepStatus.Error,
          error: validationResult.error || 'Validation failed'
        })
        return
      }

      const { 
        stepId, 
        transcriptIdToProcess, 
        overrideSeed, 
        hilMetaPrompt, 
        settings 
      } = validationResult.data

      // Update store to indicate processing started
      this.updateStores({
        stepId,
        status: StepStatus.Loading,
        transcriptId: transcriptIdToProcess
      })

      // Step 2: Prepare execution context
      // Get store state using injected operations
      const transcriptState = this.storeOperations.getTranscriptState()
      const analysisState = this.storeOperations.getAnalysisState()
      const storeState = {
        rawTranscripts: transcriptState.rawTranscripts,
        processedData: transcriptState.processedData,
        genericAnalysisState: analysisState.genericAnalysisState || {}
      }

      const contextResult = this.contextService.prepareContext(
        stepId,
        transcriptIdToProcess,
        storeState
      )

      if (!contextResult.success || !contextResult.data) {
        this.updateStores({
          stepId,
          status: StepStatus.Error,
          error: contextResult.error || 'Context preparation failed'
        })
        return
      }

      const context = contextResult.data

      // Step 3: Prepare input
      console.log(`[Orchestrator] Preparing input for ${stepId}`)
      const inputResult = this.inputService.prepareInput(
        stepId,
        context,
        storeState,
        settings
      )

      if (!inputResult.success || !inputResult.data) {
        console.log(`[Orchestrator] Input preparation failed:`, inputResult.error)
        this.updateStores({
          stepId,
          status: StepStatus.Error,
          error: inputResult.error || 'Input preparation failed'
        })
        return
      }

      const input = inputResult.data

      // Step 4: Execute step
      console.log(`[Orchestrator] About to execute step ${stepId}`)
      const executionResult = await this.executionService.executeStep(
        stepId,
        input,
        context,
        {
          ...settings,
          seed: overrideSeed || settings.seed
        }
      )

      if (!executionResult.success || !executionResult.data) {
        const error = executionResult.error || 'Execution failed'
        
        console.log(`[Orchestrator] Execution failed for ${stepId}, error:`, error)
        
        // Use transaction for atomic error handling
        await this.transactionService.executeInTransaction(async (txContext) => {
          this.errorService.handleError({
            stepId,
            transcriptIdToProcess,
            apiError: error,
            storeState,
            setStoreState: (updater) => {
              // Update transcript store for transcript-specific steps
              if (transcriptIdToProcess) {
                const transcriptState = this.storeOperations.getTranscriptState()
                const processedData = new Map(transcriptState.processedData)
                const genericAnalysisState = { ...this.storeOperations.getAnalysisState().genericAnalysisState }
                
                // Create a mock state that matches what the error service expects
                const mockState = { 
                  processedData,
                  genericAnalysisState,
                  lastStepInfo: {},
                  lastError: undefined
                }
                
                // Call the updater function to apply mutations
                updater(mockState)
                
                // Apply changes back to the store - check if processedData was modified
                const updatedData = processedData.get(transcriptIdToProcess)
                if (updatedData) {
                  console.log(`[Orchestrator] Applying error update for ${transcriptIdToProcess}:`, updatedData)
                  this.storeOperations.replaceProcessedData(transcriptIdToProcess, updatedData)
                } else {
                  console.log(`[Orchestrator] No updated data found for ${transcriptIdToProcess}`)
                }
              } else {
                // Handle global steps
                const genericAnalysisState = { ...this.storeOperations.getAnalysisState().genericAnalysisState }
                const mockState = { 
                  processedData: new Map(),
                  genericAnalysisState,
                  lastStepInfo: {},
                  lastError: undefined
                }
                
                updater(mockState)
                
                // Apply generic state changes
                this.storeOperations.updateGenericState(mockState.genericAnalysisState)
              }
            }
          })
          this.updateStores({
            stepId,
            status: StepStatus.Error,
            error,
            transcriptId: transcriptIdToProcess
          })
          
          // Record mutations for debugging
          this.transactionService.recordMutation(txContext, 'transcript', 'handleError', [stepId, transcriptIdToProcess])
        })
        return
      }

      const output = executionResult.data

      // Update stores after execution
      this.updateStores({
        stepId,
        transcriptId: transcriptIdToProcess,
        output: output.output,
        groundingSources: output.groundingSources
      })

      // Step 5: Create and store prompt history entry (regardless of error)
      const historyEntry = this.historyService.createHistoryEntry(
        stepId,
        transcriptIdToProcess,
        output,
        context
      )
      this.addPromptEntry(historyEntry)

      // Step 6: Check for API errors in output
      if (output.apiError) {
        // Use transaction for atomic error handling
        await this.transactionService.executeInTransaction(async (txContext) => {
          this.errorService.handleError({
            stepId,
            transcriptIdToProcess,
            apiError: output.apiError,
            storeState,
            setStoreState: (updater) => {
              // Update transcript store for transcript-specific steps
              if (transcriptIdToProcess) {
                const transcriptState = this.storeOperations.getTranscriptState()
                const processedData = new Map(transcriptState.processedData)
                const genericAnalysisState = { ...this.storeOperations.getAnalysisState().genericAnalysisState }
                
                // Create a mock state that matches what the error service expects
                const mockState = { 
                  processedData,
                  genericAnalysisState,
                  lastStepInfo: {},
                  lastError: undefined
                }
                
                // Call the updater function to apply mutations
                updater(mockState)
                
                // Apply changes back to the store - check if processedData was modified
                const updatedData = processedData.get(transcriptIdToProcess)
                if (updatedData) {
                  console.log(`[Orchestrator] Applying error update for ${transcriptIdToProcess}:`, updatedData)
                  this.storeOperations.replaceProcessedData(transcriptIdToProcess, updatedData)
                } else {
                  console.log(`[Orchestrator] No updated data found for ${transcriptIdToProcess}`)
                }
              } else {
                // Handle global steps
                const genericAnalysisState = { ...this.storeOperations.getAnalysisState().genericAnalysisState }
                const mockState = { 
                  processedData: new Map(),
                  genericAnalysisState,
                  lastStepInfo: {},
                  lastError: undefined
                }
                
                updater(mockState)
                
                // Apply generic state changes
                this.storeOperations.updateGenericState(mockState.genericAnalysisState)
              }
            }
          })
          this.updateStores({
            stepId,
            status: StepStatus.Error,
            error: output.apiError,
            transcriptId: transcriptIdToProcess
          })
          
          // Record mutations for debugging
          this.transactionService.recordMutation(txContext, 'transcript', 'handleApiError', [stepId, output.apiError])
        })
        return
      }

      // Step 7: Handle success - use transaction for atomic updates
      await this.transactionService.executeInTransaction(async (txContext) => {
        this.successService.handleSuccess({
          stepId,
          transcriptIdToProcess,
          output: output.output,
          inputData: input.data,
          groundingSources: output.groundingSources,
          currentGDU: context.currentGDU,
          currentPhase: context.currentPhase,
          storeState,
          setStoreState: (updater) => {
            // Handle transcript-specific updates
            if (transcriptIdToProcess) {
              const transcriptState = this.storeOperations.getTranscriptState()
              const processedData = new Map(transcriptState.processedData)
              const genericAnalysisState = { ...this.storeOperations.getAnalysisState().genericAnalysisState }
              
              // Create a mock state that matches what the success service expects
              const mockState = { 
                processedData,
                genericAnalysisState,
                lastStepInfo: {},
                lastError: undefined
              }
              
              // Call the updater function to apply mutations
              updater(mockState)
              
              // Apply changes back to the store - check if processedData was modified
              const updatedData = processedData.get(transcriptIdToProcess)
              if (updatedData) {
                console.log(`[Orchestrator] Updating transcript data:`, {
                  transcriptId: transcriptIdToProcess,
                  updatedData
                })
                this.storeOperations.replaceProcessedData(transcriptIdToProcess, updatedData)
              }
            } else {
              // Handle global steps
              const genericAnalysisState = { ...this.storeOperations.getAnalysisState().genericAnalysisState }
              const mockState = { 
                processedData: new Map(),
                genericAnalysisState,
                lastStepInfo: {},
                lastError: undefined
              }
              
              updater(mockState)
              
              console.log(`[Orchestrator] Applying global state update for ${stepId}:`)
              console.log('  genericAnalysisState:', mockState.genericAnalysisState)
              
              // Apply generic state changes
              this.storeOperations.updateGenericState(mockState.genericAnalysisState)
            }
          }
        })

        // Final update
        this.updateStores({
          stepId,
          status: StepStatus.Success,
          transcriptId: transcriptIdToProcess
        })
        
        // Record mutations for debugging
        this.transactionService.recordMutation(txContext, 'transcript', 'handleSuccess', [stepId, transcriptIdToProcess])
        if (transcriptIdToProcess) {
          this.transactionService.recordMutation(txContext, 'transcript', 'updateProcessedData', [transcriptIdToProcess])
        } else {
          this.transactionService.recordMutation(txContext, 'analysisResult', 'updateGenericState', [stepId])
        }
      })

    } catch (error) {
      console.error(`❌ [PipelineOrchestrator] Unexpected error:`, error)
      this.updateStores({
        stepId: params.stepId,
        status: StepStatus.Error,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Logs the start of step processing
   */
  private logStepStart(params: StepExecutionParams): void {
    console.groupCollapsed(`🚀 [PipelineOrchestrator] processSingleStep: ${params.stepId}`)
    console.log(`- Transcript ID: ${params.transcriptIdToProcess || 'N/A (Global Step)'}`)
    console.log(`- Override Seed: ${params.overrideSeed || 'Default'}`)
    console.log(`- HIL Prompt: ${params.hilMetaPrompt ? 'Yes' : 'No'}`)
    console.groupEnd()
  }

  /**
   * Handles errors by updating stores and logging
   */
  private handleError(stepId: string, error: string, transcriptId?: string): void {
    console.error(`❌ [PipelineOrchestrator] ${error}`)
    this.updateStores({
      stepId,
      status: StepStatus.Error,
      error,
      transcriptId
    })
  }
}