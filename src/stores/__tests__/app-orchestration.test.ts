import { describe, test, expect, vi } from 'vitest';
import { usePipelineStore, useUIStore, useSettingsStore } from '../index';

describe('App Store Orchestration', () => {
  test('stores should be properly connected via dependency injection', () => {
    // This test verifies that stores can be connected without circular imports
    const pipelineStore = usePipelineStore.getState();
    const uiStore = useUIStore.getState();
    
    // UI store should have the required methods
    expect(typeof uiStore.setAutorunning).toBe('function');
    expect(typeof uiStore.setCurrentStepInfo).toBe('function');
    
    // Pipeline store should have callback setter
    expect(typeof pipelineStore.setUICallbacks).toBe('function');
    
    // Should be able to connect them
    expect(() => {
      pipelineStore.setUICallbacks({
        setAutorunning: uiStore.setAutorunning,
        setCurrentStepInfo: uiStore.setCurrentStepInfo
      });
    }).not.toThrow();
  });
  
  test('App.tsx style orchestration should work', () => {
    // Simulate what App.tsx does for store orchestration
    const pipelineStore = usePipelineStore.getState();
    const uiStore = useUIStore.getState();
    
    // Should be able to inject UI callbacks into pipeline store
    expect(() => {
      pipelineStore.setUICallbacks({
        setAutorunning: uiStore.setAutorunning,
        setCurrentStepInfo: uiStore.setCurrentStepInfo
      });
    }).not.toThrow();
    
    // Callbacks should be stored in pipeline store state
    const storeState = usePipelineStore.getState();
    expect(storeState.uiCallbacks).toBeDefined();
    expect(typeof storeState.uiCallbacks!.setAutorunning).toBe('function');
    expect(typeof storeState.uiCallbacks!.setCurrentStepInfo).toBe('function');
  });
  
  test('stores should communicate through injected callbacks', () => {
    const pipelineStore = usePipelineStore.getState();
    const uiStore = useUIStore.getState();
    
    // Mock UI store methods
    const mockSetAutorunning = vi.fn();
    const mockSetCurrentStepInfo = vi.fn();
    
    // Override UI store methods with mocks
    uiStore.setAutorunning = mockSetAutorunning;
    uiStore.setCurrentStepInfo = mockSetCurrentStepInfo;
    
    // Inject callbacks
    pipelineStore.setUICallbacks({
      setAutorunning: mockSetAutorunning,
      setCurrentStepInfo: mockSetCurrentStepInfo
    });
    
    // Simulate pipeline action that should trigger UI updates
    const mockSettings = {
      apiKey: 'test-key',
      temperature: 0.7,
      userDvFocus: { dv_focus: ['test'] }
    };
    
    pipelineStore.handlePipelineStepClick('P0_1', mockSettings);
    
    // UI methods should have been called via injected callbacks
    expect(mockSetAutorunning).toHaveBeenCalled();
    expect(mockSetCurrentStepInfo).toHaveBeenCalled();
  });
  
  test('settings should be passed as parameters not accessed directly', () => {
    const settingsStore = useSettingsStore.getState();
    const pipelineStore = usePipelineStore.getState();
    
    // Settings should be passed to pipeline methods
    const testSettings = {
      apiKey: 'test-api-key',
      temperature: 0.8,
      seed: 456,
      userDvFocus: { dv_focus: ['dependent-variable'] }
    };
    
    // Should be able to call pipeline methods with settings
    expect(() => {
      pipelineStore.processSingleStep('P0_1', testSettings);
    }).not.toThrow();
    
    expect(() => {
      pipelineStore.handlePipelineStepClick('P0_1', testSettings);
    }).not.toThrow();
  });
});