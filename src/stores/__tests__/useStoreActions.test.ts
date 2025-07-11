import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useStoreActions } from '../useStoreActions'
import { getPipelineService } from '../../services/pipeline/pipelineServiceFactory'
import { useUIStore } from '../uiStore'
import { useSettingsStore } from '../settingsStore'

// Mock the dependencies
vi.mock('../../services/pipeline/pipelineServiceFactory')
vi.mock('../uiStore')
vi.mock('../settingsStore')

describe('useStoreActions', () => {
  const mockService = {
    isPreviousStepDisabled: vi.fn(),
    isNextStepDisabled: vi.fn(),
    isRunStepDisabled: vi.fn(),
    isHilModalDisabled: vi.fn(),
    isDownloadOutputDisabled: vi.fn(),
    isDownloadHistoryDisabled: vi.fn(),
    isAppendixDataAvailable: vi.fn(),
    processSingleStep: vi.fn(),
    downloadOutput: vi.fn(),
    downloadPromptHistory: vi.fn(),
    generateAppendix: vi.fn(),
    retryWithUserSeed: vi.fn(),
    getTranscriptStatusDisplay: vi.fn(),
    loadStepData: vi.fn(),
    handlePipelineStepClick: vi.fn(),
    uploadTranscripts: vi.fn(),
    handleDroppedFiles: vi.fn(),
    getSaveState: vi.fn(),
    saveStateToFile: vi.fn(),
    loadStateFromFile: vi.fn(),
    loadState: vi.fn(),
    resetPipeline: vi.fn(),
    clearAutosaveData: vi.fn()
  }
  
  const mockUIState = {
    currentStepInfo: { stepId: 'IDLE', status: 'idle' },
    activeTranscriptIndex: 0,
    retrySeedInput: '12345'
  }
  
  const mockSettingsState = {
    apiKeyPresent: true,
    apiKey: 'test-key',
    dvFocusError: null,
    outputDirectory: '/tmp',
    temperature: 0.7,
    seed: undefined,
    userDvFocus: { dv_focus: [] }
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup mocks
    vi.mocked(getPipelineService).mockReturnValue(mockService as any)
    vi.mocked(useUIStore).getState.mockReturnValue(mockUIState as any)
    vi.mocked(useSettingsStore).getState.mockReturnValue(mockSettingsState as any)
  })
  
  describe('navigation selectors', () => {
    it('should delegate isPreviousStepDisabled to service', () => {
      mockService.isPreviousStepDisabled.mockReturnValue(true)
      
      const actions = useStoreActions()
      const isDisabled = actions.isPreviousStepDisabled()
      
      expect(mockService.isPreviousStepDisabled).toHaveBeenCalledWith(
        mockUIState.currentStepInfo,
        mockUIState.activeTranscriptIndex
      )
      expect(isDisabled).toBe(true)
    })
    
    it('should delegate isNextStepDisabled to service', () => {
      mockService.isNextStepDisabled.mockReturnValue(false)
      
      const actions = useStoreActions()
      const isDisabled = actions.isNextStepDisabled()
      
      expect(mockService.isNextStepDisabled).toHaveBeenCalledWith(
        mockUIState.currentStepInfo,
        mockUIState.activeTranscriptIndex
      )
      expect(isDisabled).toBe(false)
    })
    
    it('should delegate isRunStepDisabled to service with correct params', () => {
      mockService.isRunStepDisabled.mockReturnValue(true)
      
      const actions = useStoreActions()
      const isDisabled = actions.isRunStepDisabled()
      
      expect(mockService.isRunStepDisabled).toHaveBeenCalledWith(
        mockUIState.currentStepInfo,
        mockSettingsState.apiKeyPresent,
        mockSettingsState.dvFocusError
      )
      expect(isDisabled).toBe(true)
    })
  })
  
  describe('actions', () => {
    it('should call processSingleStep with settings from stores', async () => {
      const actions = useStoreActions()
      
      await actions.processSingleStep({ stepId: 'P0_1_TRANSCRIPTION_ADHERENCE' as any })
      
      expect(mockService.processSingleStep).toHaveBeenCalledWith({
        stepId: 'P0_1_TRANSCRIPTION_ADHERENCE',
        settings: {
          apiKey: mockSettingsState.apiKey,
          temperature: mockSettingsState.temperature,
          seed: mockSettingsState.seed,
          userDvFocus: mockSettingsState.userDvFocus
        }
      })
    })
    
    it('should call downloadOutput with correct parameters', () => {
      const actions = useStoreActions()
      
      actions.downloadOutput('P0_1_TRANSCRIPTION_ADHERENCE' as any, 'transcript-1')
      
      expect(mockService.downloadOutput).toHaveBeenCalledWith(
        'P0_1_TRANSCRIPTION_ADHERENCE',
        'transcript-1',
        undefined,
        mockUIState.currentStepInfo,
        mockSettingsState.outputDirectory
      )
    })
    
    it('should handle retryWithUserSeed with current UI state', () => {
      const actions = useStoreActions()
      
      actions.retryWithUserSeed()
      
      expect(mockService.retryWithUserSeed).toHaveBeenCalledWith(
        mockUIState.currentStepInfo,
        mockUIState.retrySeedInput,
        {
          apiKey: mockSettingsState.apiKey,
          temperature: mockSettingsState.temperature,
          seed: mockSettingsState.seed,
          userDvFocus: mockSettingsState.userDvFocus
        }
      )
    })
  })
  
  describe('file operations', () => {
    it('should handle loadStateFromFile with file input', async () => {
      const mockFile = new File(['{}'], 'state.json', { type: 'application/json' })
      const mockEvent = {
        target: {
          files: [mockFile],
          value: 'fakepath/state.json'
        }
      } as any
      
      const mockSavedState = { version: 1, data: {} }
      mockService.loadStateFromFile.mockResolvedValue(mockSavedState)
      
      // Mock window.alert
      global.alert = vi.fn()
      
      const actions = useStoreActions()
      
      await actions.loadStateFromFile(mockEvent)
      
      expect(mockService.loadStateFromFile).toHaveBeenCalledWith(mockFile)
      expect(mockService.loadState).toHaveBeenCalledWith(mockSavedState)
      expect(mockEvent.target.value).toBe('')
      expect(global.alert).toHaveBeenCalledWith('State loaded successfully!')
    })
    
    it('should handle loadStateFromFile errors gracefully', async () => {
      const mockFile = new File(['invalid'], 'state.json', { type: 'application/json' })
      const mockEvent = {
        target: {
          files: [mockFile],
          value: 'fakepath/state.json'
        }
      } as any
      
      mockService.loadStateFromFile.mockRejectedValue(new Error('Invalid format'))
      
      // Mock console.error and window.alert
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      global.alert = vi.fn()
      
      const actions = useStoreActions()
      
      await actions.loadStateFromFile(mockEvent)
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load state:', expect.any(Error))
      expect(global.alert).toHaveBeenCalledWith('Failed to load state file. Please check the file format.')
      
      consoleErrorSpy.mockRestore()
    })
  })
})