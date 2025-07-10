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
  PromptHistoryEntry
} from './types'
import { StepStatus } from '../../../types'

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
  constructor(
    private validationService: IStepParameterValidationService,
    private contextService: IStepContextPreparationService,
    private inputService: IStepInputPreparationService,
    private executionService: IStepExecutionService,
    private historyService: IPromptHistoryService,
    private errorService: IStepErrorHandlingService,
    private successService: IStepSuccessHandlingService,
    private updateStores: (updates: any) => void,
    private addPromptEntry: (entry: PromptHistoryEntry) => void
  ) {}

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
      // TODO: Get store state from somewhere - for now using empty state
      const storeState = {
        rawTranscripts: [],
        processedData: new Map(),
        genericAnalysisState: {}
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
      const inputResult = this.inputService.prepareInput(
        stepId,
        context,
        storeState,
        settings
      )

      if (!inputResult.success || !inputResult.data) {
        this.updateStores({
          stepId,
          status: StepStatus.Error,
          error: inputResult.error || 'Input preparation failed'
        })
        return
      }

      const input = inputResult.data

      // Step 4: Execute step
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
        this.errorService.handleError({
          stepId,
          transcriptIdToProcess,
          apiError: error,
          storeState,
          setStoreState: () => {} // TODO: Implement proper state update
        })
        this.updateStores({
          stepId,
          status: StepStatus.Error,
          error
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

      // Step 5: Check for API errors in output
      if (output.apiError) {
        this.errorService.handleError({
          stepId,
          transcriptIdToProcess,
          apiError: output.apiError,
          storeState,
          setStoreState: () => {} // TODO: Implement proper state update
        })
        this.updateStores({
          stepId,
          status: StepStatus.Error,
          error: output.apiError
        })
        return
      }

      // Step 6: Create and store prompt history entry
      const historyEntry = this.historyService.createHistoryEntry(
        stepId,
        transcriptIdToProcess,
        output,
        context
      )
      this.addPromptEntry(historyEntry)

      // Step 7: Handle success
      this.successService.handleSuccess({
        stepId,
        transcriptIdToProcess,
        output: output.output,
        inputData: input.data,
        groundingSources: output.groundingSources,
        currentGDU: context.currentGDU,
        currentPhase: context.currentPhase,
        storeState,
        setStoreState: () => {} // TODO: Implement proper state update
      })

      // Final update
      this.updateStores({
        stepId,
        status: StepStatus.Success,
        transcriptId: transcriptIdToProcess
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