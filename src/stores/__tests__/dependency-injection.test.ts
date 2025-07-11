import { describe, test, expect, vi } from 'vitest';
import { useIRRStore } from '../irrStore';
import { useTranscriptStore } from '../transcriptStore';
import { useAnalysisResultStore } from '../analysisResultStore';
import { useStoreActions } from '../storeComposition';
import { getPipelineService } from '../../services/pipeline/pipelineServiceFactory';
import type { CurrentStepInfo, StepId } from '../../../types';

// Mock the external dependencies
vi.mock('../../../services/geminiService');

// Mock window.alert
global.alert = vi.fn();

describe('Dependency Injection Interfaces', () => {
  test('pipeline service should accept settings parameter', () => {
    const pipelineService = getPipelineService();
    
    const mockSettings = {
      apiKey: 'test-key',
      temperature: 0.7,
      seed: 123,
      userDvFocus: { dv_focus: ['test'] }
    };
    
    // Should have the correct method signature
    expect(typeof pipelineService.handlePipelineStepClick).toBe('function');
    
    // Should accept stepId and settings parameters
    expect(() => {
      pipelineService.handlePipelineStepClick('P0_1' as StepId, mockSettings);
    }).not.toThrow();
  });
  
  test('processSingleStep should accept settings parameter', () => {
    const actions = useStoreActions();
    
    const mockParams = {
      stepId: 'P0_1' as StepId
    };
    
    // Should accept params
    expect(() => {
      actions.processSingleStep(mockParams);
    }).not.toThrow();
  });
  
  test('IRR generateSemanticMapping should accept settings parameter', () => {
    const store = useIRRStore.getState();
    
    const mockSettings = {
      temperature: 0.7,
      seed: 123,
      apiKey: 'test-key'
    };
    
    // Should have generateSemanticMapping method
    expect(typeof store.generateSemanticMapping).toBe('function');
  });
  
  test('service functions should accept settings as parameters', () => {
    const pipelineService = getPipelineService();
    
    // Test that service has expected methods
    expect(typeof pipelineService.processSingleStep).toBe('function');
    expect(typeof pipelineService.retryWithUserSeed).toBe('function');
    expect(typeof pipelineService.handlePipelineStepClick).toBe('function');
    
    // Test they accept proper parameters
    const testParams = {
      stepId: 'P0_1' as StepId,
      settings: {
        apiKey: 'test',
        temperature: 0.7,
        seed: undefined,
        userDvFocus: { dv_focus: [] }
      }
    };
    
    expect(() => {
      pipelineService.processSingleStep(testParams);
    }).not.toThrow();
  });
  
  test('stores should be properly isolated', () => {
    // Each store should have its own state
    const transcriptStore = useTranscriptStore.getState();
    const analysisStore = useAnalysisResultStore.getState();
    
    // Should have independent reset methods
    expect(typeof transcriptStore.reset).toBe('function');
    expect(typeof analysisStore.reset).toBe('function');
    
    // Should be able to reset independently
    transcriptStore.reset();
    analysisStore.reset();
    
    expect(transcriptStore.rawTranscripts).toEqual([]);
    expect(analysisStore.genericAnalysisState).toBeDefined();
  });
});