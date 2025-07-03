import { describe, test, expect, vi } from 'vitest';
import { usePipelineStore } from '../pipelineStore';
import { useIRRStore } from '../irrStore';
import type { CurrentStepInfo, StepId } from '../../../types';

// Mock the external dependencies
vi.mock('../../../services/geminiService');

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
});