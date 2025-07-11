import { describe, test, expect, vi, beforeEach } from 'vitest';
import { 
  useUIStore, 
  useSettingsStore,
  useTranscriptStore,
  useAnalysisResultStore,
  usePipelineOrchestrationStore,
  usePromptHistoryStore,
  useStoreActions
} from '../index';
import { getPipelineService } from '../../services/pipeline/pipelineServiceFactory';
import { StepId, StepStatus } from '../../../types';

// Mock window.alert
global.alert = vi.fn();

// Mock geminiService
vi.mock('../../../services/geminiService');

describe('App Store Orchestration', () => {
  beforeEach(() => {
    // Reset all stores to initial state
    useUIStore.setState({
      isAutorunning: false,
      lastStepTimestamp: null,
      processingStepId: null,
      successfulStepIds: [],
      errorStepIds: []
    });
    
    usePipelineOrchestrationStore.setState({
      currentStepInfo: { stepId: StepId.IDLE, status: StepStatus.Idle },
      activeTranscriptIndex: 0,
      isAutorunning: false,
      shouldStopAutorun: false,
      lastExecutionParams: undefined,
      lastHilContext: undefined
    });
    
    useTranscriptStore.setState({
      rawTranscripts: [],
      processedData: new Map()
    });
    
    useAnalysisResultStore.setState({
      genericAnalysisState: {
        isFullyProcessedGenericDiachronic: false,
        isFullyProcessedGenericSynchronic: false
      }
    });
    
    usePromptHistoryStore.setState({
      promptHistory: [],
      totalInputTokens: 0,
      totalOutputTokens: 0
    });
  });

  test('stores should be properly connected via service layer', () => {
    // This test verifies that stores work together through the service layer
    const pipelineService = getPipelineService();
    const uiStore = useUIStore.getState();
    const orchestrationStore = usePipelineOrchestrationStore.getState();
    
    // UI store should have the required methods
    expect(typeof uiStore.setAutorunning).toBe('function');
    expect(typeof uiStore.setCurrentStepInfo).toBe('function');
    
    // Pipeline service should orchestrate between stores
    expect(typeof pipelineService.handlePipelineStepClick).toBe('function');
    expect(typeof pipelineService.processSingleStep).toBe('function');
    
    // Orchestration store should track state
    expect(typeof orchestrationStore.setCurrentStepInfo).toBe('function');
    expect(typeof orchestrationStore.setAutorunning).toBe('function');
  });
  
  test('new stores should be accessible and properly initialized', () => {
    // Verify new stores are available
    const transcriptStore = useTranscriptStore.getState();
    const analysisStore = useAnalysisResultStore.getState();
    const storeActions = useStoreActions();
    
    // Transcript store should have required methods
    expect(typeof transcriptStore.addTranscripts).toBe('function');
    expect(typeof transcriptStore.updateProcessedData).toBe('function');
    expect(typeof transcriptStore.removeTranscript).toBe('function');
    expect(typeof transcriptStore.reset).toBe('function');
    
    // Analysis store should have required methods
    expect(typeof analysisStore.updateGenericState).toBe('function');
    expect(typeof analysisStore.hasStepOutput).toBe('function');
    expect(typeof analysisStore.getStepOutput).toBe('function');
    expect(typeof analysisStore.reset).toBe('function');
    
    // Store actions should provide cross-store operations
    expect(typeof storeActions.resetPipeline).toBe('function');
    expect(typeof storeActions.coordinateRehydration).toBe('function');
    expect(typeof storeActions.processSingleStep).toBe('function');
  });
  
  test('App.tsx style orchestration should work', () => {
    // Reset stores first
    usePipelineOrchestrationStore.getState().reset();
    useUIStore.getState().resetUIState();
    
    // Track subscription calls
    let subscriptionCalled = false;
    
    // Subscribe to orchestration changes to update UI
    const unsubscribe = usePipelineOrchestrationStore.subscribe(
      state => state.currentStepInfo,
      (currentStepInfo) => {
        subscriptionCalled = true;
        // Update UI store
        useUIStore.getState().setCurrentStepInfo(currentStepInfo);
      }
    );
    
    // Simulate a step change
    usePipelineOrchestrationStore.setState({
      currentStepInfo: {
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        status: StepStatus.Processing
      }
    });
    
    // Check if subscription was called
    expect(subscriptionCalled).toBe(true);
    
    // UI should be updated synchronously - get fresh state
    const updatedUIState = useUIStore.getState();
    expect(updatedUIState.currentStepInfo).toEqual({
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      status: StepStatus.Processing
    });
    
    unsubscribe();
  });
  
  test('stores should communicate through service layer', () => {
    const pipelineService = getPipelineService();
    const orchestrationStore = usePipelineOrchestrationStore.getState();
    const uiStore = useUIStore.getState();
    
    // Mock UI store methods to track calls
    const mockSetAutorunning = vi.spyOn(uiStore, 'setAutorunning');
    const mockSetCurrentStepInfo = vi.spyOn(uiStore, 'setCurrentStepInfo');
    
    // Settings for pipeline operations
    const mockSettings = {
      apiKey: 'test-key',
      temperature: 0.7,
      seed: undefined,
      userDvFocus: { dv_focus: ['test'] }
    };
    
    // Trigger pipeline action through service
    pipelineService.handlePipelineStepClick(StepId.P0_1_TRANSCRIPTION_ADHERENCE, mockSettings);
    
    // Orchestration store should be updated
    const updatedOrchestrationState = usePipelineOrchestrationStore.getState();
    expect(updatedOrchestrationState.currentStepInfo.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
  });
  
  test('settings should be passed as parameters not accessed directly', () => {
    const pipelineService = getPipelineService();
    
    // Settings should be passed to pipeline methods
    const testSettings = {
      apiKey: 'test-api-key',
      temperature: 0.8,
      seed: 456,
      userDvFocus: { dv_focus: ['dependent-variable'] }
    };
    
    // Should be able to call pipeline methods with settings
    expect(() => {
      pipelineService.processSingleStep({
        stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
        settings: testSettings
      });
    }).not.toThrow();
    
    expect(() => {
      pipelineService.handlePipelineStepClick(StepId.P0_1_TRANSCRIPTION_ADHERENCE, testSettings);
    }).not.toThrow();
  });
  
  test('cross-store operations should work through storeComposition', () => {
    const storeActions = useStoreActions();
    const transcriptStore = useTranscriptStore.getState();
    const analysisStore = useAnalysisResultStore.getState();
    const promptHistoryStore = usePromptHistoryStore.getState();
    const orchestrationStore = usePipelineOrchestrationStore.getState();
    
    // Add some test data
    promptHistoryStore.addPromptEntry({
      stepId: 'P0_1',
      timestamp: '2024-01-01T00:00:00Z',
      prompt: 'Test prompt',
      requestPayload: {},
      responseRaw: 'Test response'
    } as any);
    
    orchestrationStore.setCurrentStepInfo({
      stepId: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
      status: StepStatus.Success
    });
    
    // Reset pipeline should clear all stores
    storeActions.resetPipeline();
    
    // Verify all stores were reset
    expect(transcriptStore.rawTranscripts).toEqual([]);
    expect(transcriptStore.processedData.size).toBe(0);
    expect(analysisStore.genericAnalysisState).toMatchObject({
      isFullyProcessedGenericDiachronic: false,
      isFullyProcessedGenericSynchronic: false
    });
    expect(promptHistoryStore.promptHistory).toEqual([]);
    expect(orchestrationStore.currentStepInfo).toEqual({
      stepId: StepId.IDLE,
      status: StepStatus.Idle
    });
  });
  
  test('pipeline operations should update appropriate stores', async () => {
    const pipelineService = getPipelineService();
    const transcriptStore = useTranscriptStore.getState();
    const orchestrationStore = usePipelineOrchestrationStore.getState();
    
    // Settings for pipeline operations
    const mockSettings = {
      apiKey: 'test-key',
      temperature: 0.7,
      seed: undefined,
      userDvFocus: { dv_focus: ['test'] }
    };
    
    // Add a transcript directly (since File.text() doesn't work in tests)
    const mockTranscript = {
      id: 't1',
      name: 'test.txt',
      content: 'test content',
      uploadedAt: Date.now()
    };
    transcriptStore.addTranscriptsSync([mockTranscript]);
    
    // Verify transcript was added - get fresh state
    const updatedTranscriptState = useTranscriptStore.getState();
    expect(updatedTranscriptState.rawTranscripts).toHaveLength(1);
    
    // Trigger pipeline step
    pipelineService.handlePipelineStepClick(StepId.P0_1_TRANSCRIPTION_ADHERENCE, mockSettings);
    
    // Orchestration state should be updated - get fresh state
    const updatedOrchestrationState = usePipelineOrchestrationStore.getState();
    expect(updatedOrchestrationState.currentStepInfo.stepId).toBe(StepId.P0_1_TRANSCRIPTION_ADHERENCE);
  });
});