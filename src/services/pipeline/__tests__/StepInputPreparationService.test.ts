import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StepId } from '../../../../types'
import type { ExecutionContext, StoreState, SettingsData } from '../types'

// Mock STEP_CONFIGS
vi.mock('../../../../constants', () => ({
  STEP_CONFIGS: {
    [StepId.P1_1_INITIAL_SEGMENTATION]: {
      getInput: vi.fn()
    },
    [StepId.P6_1_GENERATE_MARKDOWN_REPORT]: {
      getInput: vi.fn()
    }
  }
}))

// Import after mocking
import { StepInputPreparationService } from '../StepInputPreparationService'
import { STEP_CONFIGS } from '../../../../constants'

describe('StepInputPreparationService', () => {
  let service: StepInputPreparationService
  let mockContext: ExecutionContext
  let mockStoreState: StoreState
  let mockSettings: SettingsData

  beforeEach(() => {
    service = new StepInputPreparationService()
    vi.clearAllMocks()
    
    mockContext = {
      currentTranscript: {
        id: 'transcript-123',
        filename: 'test.txt',
        content: 'test content'
      },
      currentPhase: 'phase1',
      currentGDU: 'gdu1',
      tempGenericState: {
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false,
        isRefinementDone: false,
        isCausalModelingDone: false,
        isReportGenerated: false
      },
      isReportStep: false
    }

    mockStoreState = {
      rawTranscripts: [],
      processedData: new Map(),
      genericAnalysisState: {
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false,
        isRefinementDone: false,
        isCausalModelingDone: false,
        isReportGenerated: false
      }
    }

    mockSettings = {
      apiKey: 'test-key',
      temperature: 0.7,
      userDvFocus: { dv_focus: ['test'] }
    }
  })

  describe('prepareInput', () => {
    it('should return error when step config is not found', () => {
      const result = service.prepareInput(
        'INVALID_STEP' as StepId,
        mockContext,
        mockStoreState,
        mockSettings
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('No configuration found for stepId: INVALID_STEP')
    })

    it('should return error when getInput returns null', () => {
      ;(STEP_CONFIGS[StepId.P1_1_INITIAL_SEGMENTATION].getInput as any).mockReturnValue(null)

      const result = service.prepareInput(
        StepId.P1_1_INITIAL_SEGMENTATION,
        mockContext,
        mockStoreState,
        mockSettings
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Input error for P1_1_INITIAL_SEGMENTATION: Input null')
    })

    it('should return error when getInput returns error', () => {
      ;(STEP_CONFIGS[StepId.P1_1_INITIAL_SEGMENTATION].getInput as any).mockReturnValue({
        error: 'Test input error'
      })

      const result = service.prepareInput(
        StepId.P1_1_INITIAL_SEGMENTATION,
        mockContext,
        mockStoreState,
        mockSettings
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Input error for P1_1_INITIAL_SEGMENTATION: Test input error')
    })

    it('should return successful input data', () => {
      const mockInputData = { test: 'data' }
      ;(STEP_CONFIGS[StepId.P1_1_INITIAL_SEGMENTATION].getInput as any).mockReturnValue({
        data: mockInputData
      })

      const result = service.prepareInput(
        StepId.P1_1_INITIAL_SEGMENTATION,
        mockContext,
        mockStoreState,
        mockSettings
      )

      expect(result.success).toBe(true)
      expect(result.data).toBeDefined()
      expect(result.data?.data).toEqual(mockInputData)
      expect(result.data?.error).toBeUndefined()
    })

    it('should call getInput with correct parameters', () => {
      const mockInputData = { test: 'data' }
      ;(STEP_CONFIGS[StepId.P1_1_INITIAL_SEGMENTATION].getInput as any).mockReturnValue({
        data: mockInputData
      })

      service.prepareInput(
        StepId.P1_1_INITIAL_SEGMENTATION,
        mockContext,
        mockStoreState,
        mockSettings
      )

      expect(STEP_CONFIGS[StepId.P1_1_INITIAL_SEGMENTATION].getInput).toHaveBeenCalledWith(
        mockContext.currentTranscript,
        mockStoreState.processedData,
        mockContext.tempGenericState,
        true, // apiKeyPresent
        mockSettings.userDvFocus,
        mockStoreState.rawTranscripts,
        mockContext.currentPhase,
        mockContext.currentGDU
      )
    })

    it('should handle undefined current transcript', () => {
      const mockInputData = { test: 'data' }
      ;(STEP_CONFIGS[StepId.P1_1_INITIAL_SEGMENTATION].getInput as any).mockReturnValue({
        data: mockInputData
      })

      const contextWithoutTranscript = {
        ...mockContext,
        currentTranscript: undefined
      }

      const result = service.prepareInput(
        StepId.P1_1_INITIAL_SEGMENTATION,
        contextWithoutTranscript,
        mockStoreState,
        mockSettings
      )

      expect(result.success).toBe(true)
      expect(STEP_CONFIGS[StepId.P1_1_INITIAL_SEGMENTATION].getInput).toHaveBeenCalledWith(
        undefined,
        mockStoreState.processedData,
        contextWithoutTranscript.tempGenericState,
        true, // apiKeyPresent
        mockSettings.userDvFocus,
        mockStoreState.rawTranscripts,
        contextWithoutTranscript.currentPhase,
        contextWithoutTranscript.currentGDU
      )
    })

    it('should handle missing API key', () => {
      const mockInputData = { test: 'data' }
      ;(STEP_CONFIGS[StepId.P1_1_INITIAL_SEGMENTATION].getInput as any).mockReturnValue({
        data: mockInputData
      })

      const settingsWithoutApiKey = {
        ...mockSettings,
        apiKey: ''
      }

      service.prepareInput(
        StepId.P1_1_INITIAL_SEGMENTATION,
        mockContext,
        mockStoreState,
        settingsWithoutApiKey
      )

      expect(STEP_CONFIGS[StepId.P1_1_INITIAL_SEGMENTATION].getInput).toHaveBeenCalledWith(
        mockContext.currentTranscript,
        mockStoreState.processedData,
        mockContext.tempGenericState,
        false, // apiKeyPresent
        settingsWithoutApiKey.userDvFocus,
        mockStoreState.rawTranscripts,
        mockContext.currentPhase,
        mockContext.currentGDU
      )
    })
  })
})