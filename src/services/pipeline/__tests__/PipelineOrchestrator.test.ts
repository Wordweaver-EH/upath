import { describe, test, expect, vi, beforeEach, Mock } from 'vitest'
import { PipelineOrchestrator } from '../PipelineOrchestrator'
import { 
  IStepParameterValidationService,
  IStepContextPreparationService,
  IStepInputPreparationService,
  IStepExecutionService,
  IPromptHistoryService,
  IStepErrorHandlingService,
  IStepSuccessHandlingService,
  StepExecutionParams,
  ValidationResult,
  ExecutionContext,
  StepInput,
  StepOutput,
  ServiceResult,
  PromptHistoryEntry
} from '../types'
import { StepId } from '../../../../types'

// Mock all services
const mockValidationService: IStepParameterValidationService = {
  validate: vi.fn()
}

const mockContextService: IStepContextPreparationService = {
  prepareContext: vi.fn()
}

const mockInputService: IStepInputPreparationService = {
  prepareInput: vi.fn()
}

const mockExecutionService: IStepExecutionService = {
  executeStep: vi.fn()
}

const mockHistoryService: IPromptHistoryService = {
  createHistoryEntry: vi.fn()
}

const mockErrorService: IStepErrorHandlingService = {
  handleError: vi.fn()
}

const mockSuccessService: IStepSuccessHandlingService = {
  handleSuccess: vi.fn()
}

// Mock store updates
const mockUpdateStores = vi.fn()
const mockAddPromptEntry = vi.fn()

describe('PipelineOrchestrator', () => {
  let orchestrator: PipelineOrchestrator
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    orchestrator = new PipelineOrchestrator(
      mockValidationService,
      mockContextService,
      mockInputService,
      mockExecutionService,
      mockHistoryService,
      mockErrorService,
      mockSuccessService,
      mockUpdateStores,
      mockAddPromptEntry
    )
  })

  describe('processSingleStep', () => {
    const mockParams: StepExecutionParams = {
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      transcriptIdToProcess: 'transcript-1',
      settings: {
        apiKey: 'test-key',
        temperature: 0.7,
        seed: 123,
        userDvFocus: { dv_focus: ['test'] }
      }
    }

    describe('successful execution flow', () => {
      test('should execute all services in correct order', async () => {
        // Setup successful responses for all services
        const mockValidationResult: ValidationResult = {
          isValid: true,
          stepId: mockParams.stepId,
          transcriptIdToProcess: mockParams.transcriptIdToProcess,
          settings: mockParams.settings!
        }
        
        const mockContext: ExecutionContext = {
          currentTranscript: {
            id: 'transcript-1',
            name: 'test.txt',
            content: 'Test content',
            uploadedAt: Date.now()
          },
          tempGenericState: {},
          isReportStep: false
        }
        
        const mockInput: StepInput = {
          data: { test: 'input' }
        }
        
        const mockOutput: StepOutput = {
          output: { result: 'success' },
          promptForHistory: 'Test prompt',
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50
        }
        
        const mockHistoryEntry: PromptHistoryEntry = {
          stepId: mockParams.stepId,
          transcriptId: mockParams.transcriptIdToProcess,
          timestamp: new Date().toISOString(),
          prompt: 'Test prompt',
          requestPayload: mockInput.data,
          responseRaw: JSON.stringify(mockOutput.output),
          estimatedInputTokens: 100,
          estimatedOutputTokens: 50
        }

        // Mock service responses
        ;(mockValidationService.validate as Mock).mockReturnValueOnce({
          success: true,
          data: mockValidationResult
        })
        
        ;(mockContextService.prepareContext as Mock).mockReturnValueOnce({
          success: true,
          data: mockContext
        })
        
        ;(mockInputService.prepareInput as Mock).mockReturnValueOnce({
          success: true,
          data: mockInput
        })
        
        ;(mockExecutionService.executeStep as Mock).mockResolvedValueOnce({
          success: true,
          data: mockOutput
        })
        
        ;(mockHistoryService.createHistoryEntry as Mock).mockReturnValueOnce(mockHistoryEntry)
        
        ;(mockSuccessService.handleSuccess as Mock).mockReturnValueOnce({
          success: true
        })

        // Execute
        await orchestrator.processSingleStep(mockParams)

        // Verify service calls in order
        expect(mockValidationService.validate).toHaveBeenCalledWith(mockParams)
        expect(mockValidationService.validate).toHaveBeenCalledTimes(1)
        
        expect(mockContextService.prepareContext).toHaveBeenCalledWith(
          mockParams.stepId,
          mockParams.transcriptIdToProcess,
          expect.any(Object)
        )
        
        expect(mockInputService.prepareInput).toHaveBeenCalledWith(
          mockParams.stepId,
          mockContext,
          expect.any(Object),
          mockParams.settings!
        )
        
        expect(mockExecutionService.executeStep).toHaveBeenCalledWith(
          mockParams.stepId,
          mockInput,
          mockContext,
          mockParams.settings!
        )
        
        expect(mockHistoryService.createHistoryEntry).toHaveBeenCalledWith(
          mockParams.stepId,
          mockParams.transcriptIdToProcess,
          mockOutput,
          mockContext
        )
        
        expect(mockAddPromptEntry).toHaveBeenCalledWith(mockHistoryEntry)
        
        expect(mockSuccessService.handleSuccess).toHaveBeenCalled()
        expect(mockErrorService.handleError).not.toHaveBeenCalled()
      })

      test('should handle report generation steps', async () => {
        const reportParams = {
          ...mockParams,
          stepId: StepId.P6_1_REPORT
        }

        const reportContext: ExecutionContext = {
          tempGenericState: { p3_1_output: { data: 'test' } },
          isReportStep: true
        }

        ;(mockValidationService.validate as Mock).mockReturnValueOnce({
          success: true,
          data: { ...mockParams, stepId: StepId.P6_1_REPORT }
        })
        
        ;(mockContextService.prepareContext as Mock).mockReturnValueOnce({
          success: true,
          data: reportContext
        })
        
        ;(mockInputService.prepareInput as Mock).mockReturnValueOnce({
          success: true,
          data: { data: { reportData: 'test' } }
        })
        
        ;(mockExecutionService.executeStep as Mock).mockResolvedValueOnce({
          success: true,
          data: { output: '# Report\nContent...' }
        })
        
        ;(mockHistoryService.createHistoryEntry as Mock).mockReturnValueOnce({} as PromptHistoryEntry)
        
        ;(mockSuccessService.handleSuccess as Mock).mockReturnValueOnce({
          success: true
        })

        await orchestrator.processSingleStep(reportParams)

        expect(mockContextService.prepareContext).toHaveBeenCalled()
        const contextCall = (mockContextService.prepareContext as Mock).mock.calls[0]
        expect(contextCall[0]).toBe(StepId.P6_1_REPORT)
      })
    })

    describe('error handling', () => {
      test('should handle validation errors', async () => {
        ;(mockValidationService.validate as Mock).mockReturnValueOnce({
          success: false,
          error: 'Invalid parameters'
        })

        await orchestrator.processSingleStep(mockParams)

        expect(mockContextService.prepareContext).not.toHaveBeenCalled()
        expect(mockUpdateStores).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Invalid parameters'
        }))
      })

      test('should handle context preparation errors', async () => {
        ;(mockValidationService.validate as Mock).mockReturnValueOnce({
          success: true,
          data: mockParams
        })
        
        ;(mockContextService.prepareContext as Mock).mockReturnValueOnce({
          success: false,
          error: 'Context preparation failed'
        })

        await orchestrator.processSingleStep(mockParams)

        expect(mockInputService.prepareInput).not.toHaveBeenCalled()
        expect(mockUpdateStores).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Context preparation failed'
        }))
      })

      test('should handle input preparation errors', async () => {
        ;(mockValidationService.validate as Mock).mockReturnValueOnce({
          success: true,
          data: mockParams
        })
        
        ;(mockContextService.prepareContext as Mock).mockReturnValueOnce({
          success: true,
          data: {}
        })
        
        ;(mockInputService.prepareInput as Mock).mockReturnValueOnce({
          success: false,
          error: 'Input preparation failed'
        })

        await orchestrator.processSingleStep(mockParams)

        expect(mockExecutionService.executeStep).not.toHaveBeenCalled()
        expect(mockUpdateStores).toHaveBeenCalledWith(expect.objectContaining({
          error: 'Input preparation failed'
        }))
      })

      test('should handle execution errors', async () => {
        const mockContext: ExecutionContext = {
          tempGenericState: {},
          isReportStep: false
        }
        
        const mockInput: StepInput = {
          data: { test: 'input' }
        }

        ;(mockValidationService.validate as Mock).mockReturnValueOnce({
          success: true,
          data: mockParams
        })
        
        ;(mockContextService.prepareContext as Mock).mockReturnValueOnce({
          success: true,
          data: mockContext
        })
        
        ;(mockInputService.prepareInput as Mock).mockReturnValueOnce({
          success: true,
          data: mockInput
        })
        
        ;(mockExecutionService.executeStep as Mock).mockResolvedValueOnce({
          success: false,
          error: 'Execution failed'
        })

        await orchestrator.processSingleStep(mockParams)

        expect(mockHistoryService.createHistoryEntry).not.toHaveBeenCalled()
        expect(mockSuccessService.handleSuccess).not.toHaveBeenCalled()
        expect(mockErrorService.handleError).toHaveBeenCalled()
      })

      test('should handle API errors from execution', async () => {
        const mockContext: ExecutionContext = {
          tempGenericState: {},
          isReportStep: false
        }
        
        const mockInput: StepInput = {
          data: { test: 'input' }
        }
        
        const mockOutput: StepOutput = {
          output: null,
          apiError: 'API rate limit exceeded',
          promptForHistory: 'Test prompt'
        }

        ;(mockValidationService.validate as Mock).mockReturnValueOnce({
          success: true,
          data: mockParams
        })
        
        ;(mockContextService.prepareContext as Mock).mockReturnValueOnce({
          success: true,
          data: mockContext
        })
        
        ;(mockInputService.prepareInput as Mock).mockReturnValueOnce({
          success: true,
          data: mockInput
        })
        
        ;(mockExecutionService.executeStep as Mock).mockResolvedValueOnce({
          success: true,
          data: mockOutput
        })

        await orchestrator.processSingleStep(mockParams)

        expect(mockErrorService.handleError).toHaveBeenCalledWith(
          expect.objectContaining({
            apiError: 'API rate limit exceeded'
          })
        )
        expect(mockSuccessService.handleSuccess).not.toHaveBeenCalled()
      })
    })

    describe('store updates', () => {
      test('should update stores at each stage', async () => {
        ;(mockValidationService.validate as Mock).mockReturnValueOnce({
          success: true,
          data: mockParams
        })
        
        ;(mockContextService.prepareContext as Mock).mockReturnValueOnce({
          success: true,
          data: {}
        })
        
        ;(mockInputService.prepareInput as Mock).mockReturnValueOnce({
          success: true,
          data: { data: {} }
        })
        
        ;(mockExecutionService.executeStep as Mock).mockResolvedValueOnce({
          success: true,
          data: { output: {} }
        })
        
        ;(mockHistoryService.createHistoryEntry as Mock).mockReturnValueOnce({} as PromptHistoryEntry)
        
        ;(mockSuccessService.handleSuccess as Mock).mockReturnValueOnce({
          success: true
        })

        await orchestrator.processSingleStep(mockParams)

        // Should update stores for: start, execution complete, success
        expect(mockUpdateStores).toHaveBeenCalledTimes(3)
        
        // First call: Start of processing
        expect(mockUpdateStores).toHaveBeenNthCalledWith(1, expect.objectContaining({
          stepId: mockParams.stepId,
          status: 'loading'
        }))
        
        // Second call: After execution
        expect(mockUpdateStores).toHaveBeenNthCalledWith(2, expect.objectContaining({
          stepId: mockParams.stepId
        }))
        
        // Third call: Success
        expect(mockUpdateStores).toHaveBeenNthCalledWith(3, expect.objectContaining({
          status: 'success'
        }))
      })
    })
  })
})