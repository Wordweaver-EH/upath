import { describe, test, expect, vi } from 'vitest';
import { usePipelineStore } from '../pipelineStore';
import { useIRRStore } from '../irrStore';
import { useTranscriptStore } from '../transcriptStore';
import { useAnalysisResultStore } from '../analysisResultStore';
import { useStoreActions } from '../storeComposition';
import type { CurrentStepInfo, StepId } from '../../../types';

// Mock the external dependencies
vi.mock('../../../services/geminiService');

// Mock window.alert
global.alert = vi.fn();

describe('Dependency Injection Interfaces', () => {
  test('pipelineStore should have setUICallbacks method', () => {
    const store = usePipelineStore.getState();
    
    // Should have method to set UI callbacks
    expect(typeof store.setUICallbacks).toBe('function');
  });
  
  test('pipelineStore should accept UI callbacks without crashing', () => {
    const store = usePipelineStore.getState();
    
    const mockCallbacks = {
      setAutorunning: vi.fn(),
      setCurrentStepInfo: vi.fn()
    };
    
    // Should not crash when setting callbacks
    expect(() => {
      store.setUICallbacks(mockCallbacks);
    }).not.toThrow();
  });
  
  test('handlePipelineStepClick should accept settings parameter', () => {
    const store = usePipelineStore.getState();
    
    const mockSettings = {
      apiKey: 'test-key',
      temperature: 0.7,
      seed: 123,
      userDvFocus: { dv_focus: ['test'] }
    };
    
    // Should have the correct method signature
    expect(typeof store.handlePipelineStepClick).toBe('function');
    
    // Should accept stepId and settings parameters
    expect(() => {
      store.handlePipelineStepClick('P0_1' as StepId, mockSettings);
    }).not.toThrow();
  });
  
  test('processSingleStep should accept settings parameter', () => {
    const store = usePipelineStore.getState();
    
    const mockSettings = {
      apiKey: 'test-key',
      temperature: 0.7,
      seed: 123,
      userDvFocus: { dv_focus: ['test'] }
    };
    
    // Should accept settings as parameter
    expect(() => {
      store.processSingleStep('P0_1' as StepId, mockSettings);
    }).not.toThrow();
  });
  
  test('IRR generateSemanticMapping should accept settings parameter', () => {
    const store = useIRRStore.getState();
    
    const mockSettings = {
      temperature: 0.7,
      seed: 123,
      apiKey: 'test-key'
    };
    
    const mockMappingData = {
      run1GduIds: ['GDU1', 'GDU2'],
      run2GduIds: ['GDU_A', 'GDU_B']
    };
    
    // Should accept mapping data and settings parameters
    expect(() => {
      store.generateSemanticMapping(mockMappingData, mockSettings);
    }).not.toThrow();
  });
  
  test('pipelineStore should store UI callbacks in state', () => {
    const store = usePipelineStore.getState();
    
    const mockCallbacks = {
      setAutorunning: vi.fn(),
      setCurrentStepInfo: vi.fn()
    };
    
    store.setUICallbacks(mockCallbacks);
    
    // UI callbacks should be stored in state
    const updatedState = usePipelineStore.getState();
    expect(updatedState.uiCallbacks).toBeDefined();
    expect(updatedState.uiCallbacks?.setAutorunning).toBe(mockCallbacks.setAutorunning);
  });
  
  test('new stores should have proper interfaces for dependency injection', () => {
    const transcriptStore = useTranscriptStore.getState();
    const analysisStore = useAnalysisResultStore.getState();
    
    // TranscriptStore should expose required methods
    expect(typeof transcriptStore.addTranscripts).toBe('function');
    expect(typeof transcriptStore.addTranscriptsSync).toBe('function');
    expect(typeof transcriptStore.updateProcessedData).toBe('function');
    expect(typeof transcriptStore.removeTranscript).toBe('function');
    expect(typeof transcriptStore.getTranscriptById).toBe('function');
    expect(typeof transcriptStore.getProcessedDataById).toBe('function');
    
    // AnalysisResultStore should expose required methods
    expect(typeof analysisStore.updateGenericState).toBe('function');
    expect(typeof analysisStore.hasStepOutput).toBe('function');
    expect(typeof analysisStore.hasStepError).toBe('function');
    expect(typeof analysisStore.getStepOutput).toBe('function');
    expect(typeof analysisStore.getStepError).toBe('function');
  });
  
  test('storeComposition should provide cross-store operations', () => {
    const storeActions = useStoreActions();
    
    // Should provide orchestration methods
    expect(typeof storeActions.resetPipeline).toBe('function');
    expect(typeof storeActions.clearAutosaveData).toBe('function');
    expect(typeof storeActions.coordinateRehydration).toBe('function');
    
    // Should delegate pipeline operations during migration
    expect(typeof storeActions.getNextStepDetails).toBe('function');
    expect(typeof storeActions.processSingleStep).toBe('function');
    expect(typeof storeActions.downloadOutput).toBe('function');
    expect(typeof storeActions.isGlobalStep).toBe('function');
  });
  
  test('service functions should accept settings as parameters', () => {
    const pipelineStore = usePipelineStore.getState();
    const storeActions = useStoreActions();
    
    const mockSettings = {
      apiKey: 'test-key',
      temperature: 0.7,
      seed: 123,
      userDvFocus: { dv_focus: ['test'] }
    };
    
    // Both direct pipeline store methods and delegated store actions should accept settings
    expect(() => {
      pipelineStore.processSingleStep('P0_1' as StepId, mockSettings);
    }).not.toThrow();
    
    expect(() => {
      storeActions.processSingleStep('P0_1' as StepId, mockSettings);
    }).not.toThrow();
  });
  
  test('stores should maintain proper boundaries - no circular dependencies', () => {
    // Get all stores
    const transcriptStore = useTranscriptStore.getState();
    const analysisStore = useAnalysisResultStore.getState();
    const pipelineStore = usePipelineStore.getState();
    
    // Transcript store should not have references to other stores
    expect(transcriptStore).not.toHaveProperty('pipelineStore');
    expect(transcriptStore).not.toHaveProperty('analysisStore');
    
    // Analysis store should not have references to other stores
    expect(analysisStore).not.toHaveProperty('pipelineStore');
    expect(analysisStore).not.toHaveProperty('transcriptStore');
    
    // Pipeline store can have UI callbacks but not direct store references
    expect(pipelineStore).toHaveProperty('uiCallbacks');
    expect(pipelineStore).not.toHaveProperty('transcriptStore');
    expect(pipelineStore).not.toHaveProperty('analysisStore');
  });
});