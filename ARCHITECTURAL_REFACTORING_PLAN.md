# Architectural Refactoring Implementation Plan

**Date:** 2025-01-02  
**Objective:** Address three architectural issues identified in Bug Report 003  
**Timeline:** 3-4 days total  

## Overview

This plan details the step-by-step implementation for fixing the architectural issues resulting from the Zustand migration. The fixes will be implemented in priority order to ensure stability throughout the refactoring process.

## Phase 1: Eliminate Circular Store Dependency (P1)

### Day 1: Dependency Injection Pattern Implementation

#### Step 1.1: Analyze and Document Current Dependencies
1. Create a dependency map of all `useUIStore.getState()` calls in pipelineStore
2. Identify which UI actions are being called from pipelineStore
3. Document the data flow for each interaction

#### Step 1.2: Define Callback Interfaces
```typescript
// types/callbacks.ts
export interface PipelineCallbacks {
  onStepUpdate?: (stepInfo: CurrentStepInfo) => void;
  onAutorunUpdate?: (isRunning: boolean) => void;
  onUIReset?: () => void;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}
```

#### Step 1.3: Refactor pipelineStore Actions
1. **processSingleStep**
   ```typescript
   processSingleStep: async (stepId: StepId, callbacks?: PipelineCallbacks) => {
     // Replace direct UI store calls with callbacks
     callbacks?.onStepUpdate?.(newStepInfo);
     callbacks?.onAutorunUpdate?.(false);
   }
   ```

2. **resetPipeline**
   ```typescript
   resetPipeline: (callbacks?: PipelineCallbacks) => {
     // Reset pipeline state
     callbacks?.onUIReset?.();
   }
   ```

3. Continue for all 22 instances of `useUIStore.getState()`

#### Step 1.4: Update App.tsx to Bridge Stores
```typescript
// App.tsx
const bridgeStoreActions = () => {
  const setCurrentStepInfo = useUIStore(state => state.setCurrentStepInfo);
  const setAutorunning = useUIStore(state => state.setAutorunning);
  const resetUIState = useUIStore(state => state.resetUIState);
  
  const callbacks: PipelineCallbacks = {
    onStepUpdate: setCurrentStepInfo,
    onAutorunUpdate: setAutorunning,
    onUIReset: resetUIState,
  };
  
  return callbacks;
};
```

#### Step 1.5: Remove Circular Import from uiStore
1. Remove the dynamic import of pipelineStore
2. Pass pipeline actions as props where needed

### Testing Checklist for Phase 1
- [ ] No import cycles detected by build tools
- [ ] HMR works correctly after changes
- [ ] All UI updates function as before
- [ ] Unit tests pass for both stores
- [ ] No console errors or warnings

## Phase 2: Consolidate Derived State into Store Selectors (P2)

### Day 2: Move Business Logic to Stores

#### Step 2.1: Create UI Store Selectors
```typescript
// uiStore.ts additions
export const useUIStore = create<UIState & UIActions>()((set, get) => ({
  // ... existing state and actions
  
  // New selectors
  selectIsAutorunDisabled: () => {
    const state = get();
    const pipeline = usePipelineStore.getState();
    
    return !state.apiKeyPresent || 
      !!state.dvFocusError || 
      (pipeline.rawTranscripts.length === 0 && state.currentStepInfo.stepId === StepId.IDLE) || 
      state.currentStepInfo.stepId === StepId.COMPLETE;
  },
  
  selectShowRetryUI: () => {
    const state = get();
    return state.currentStepInfo.status === StepStatus.Error && 
           !!state.currentStepInfo.error?.match(/parse JSON/i);
  }
}));
```

#### Step 2.2: Create Pipeline Store Selectors
```typescript
// pipelineStore.ts additions
export const usePipelineStore = create<PipelineState & PipelineActions>()((set, get) => ({
  // ... existing state and actions
  
  // New selectors
  selectCurrentStepDisplay: () => {
    const state = get();
    const { currentStepInfo, rawTranscripts } = state;
    
    if (currentStepInfo.status === StepStatus.Loading) {
      return {
        type: 'loading',
        message: 'Loading output...'
      };
    }
    
    if (currentStepInfo.status === StepStatus.Error && !currentStepInfo.outputData) {
      return {
        type: 'error',
        message: 'Error occurred. See status bar for details.'
      };
    }
    
    // ... rest of renderOutput logic
    
    return {
      type: 'output',
      data: currentStepInfo.outputData,
      mermaidChart: extractedChart
    };
  },
  
  selectMermaidChartForStep: (stepInfo: CurrentStepInfo) => {
    // Extract Mermaid chart generation logic
    const { stepId, transcriptId, currentPhaseForP2S, currentGDUIdForP4S } = stepInfo;
    
    // ... Mermaid chart logic from App.tsx
    
    return mermaidChart;
  }
}));
```

#### Step 2.3: Update Components to Use Selectors
1. **ControlsPanel.tsx**
   ```typescript
   // Remove useMemo
   const isAutorunDisabled = useUIStore(state => state.selectIsAutorunDisabled());
   const showRetryUI = useUIStore(state => state.selectShowRetryUI());
   ```

2. **App.tsx**
   ```typescript
   const stepDisplay = usePipelineStore(state => state.selectCurrentStepDisplay());
   
   const renderOutput = () => {
     switch (stepDisplay.type) {
       case 'loading':
         return <div className="...">{stepDisplay.message}</div>;
       case 'error':
         return <div className="...">{stepDisplay.message}</div>;
       case 'output':
         return <OutputDisplay data={stepDisplay.data} chart={stepDisplay.mermaidChart} />;
     }
   };
   ```

### Testing Checklist for Phase 2
- [ ] All selectors return correct values
- [ ] No performance regression (memoization working)
- [ ] Components re-render only when necessary
- [ ] Business logic properly encapsulated
- [ ] Unit tests for all selectors

## Phase 3: Create Reusable Style Components (P3)

### Day 3: Design System Components

#### Step 3.1: Create Component Library Structure
```
src/components/ui/
├── Button.tsx
├── Input.tsx
├── Modal.tsx
├── Card.tsx
└── index.ts
```

#### Step 3.2: Implement Button Component
```typescript
// src/components/ui/Button.tsx
import React from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  onClick,
  children,
  className = ''
}) => {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors duration-150";
  
  const sizeClasses = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base"
  };
  
  const variantClasses = {
    primary: "bg-light-accent hover:bg-light-accent-hover text-white dark:bg-dark-accent dark:hover:bg-dark-accent-hover dark:text-dark-bg focus:ring-light-accent dark:focus:ring-dark-accent",
    secondary: "bg-light-btn dark:bg-dark-btn text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border border border-light-border dark:border-dark-border"
  };
  
  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";
  
  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

#### Step 3.3: Implement Input Component
```typescript
// src/components/ui/Input.tsx
import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  className = '',
  ...props
}) => {
  const baseClasses = "block w-full text-sm rounded-md shadow-sm bg-light-input-bg dark:bg-dark-input-bg text-light-text dark:text-dark-text placeholder-light-sidenote dark:placeholder-dark-sidenote focus:ring-light-accent dark:focus:ring-dark-accent focus:border-light-accent dark:focus:border-dark-accent";
  
  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-light-text dark:text-dark-text mb-1">
          {label}
        </label>
      )}
      <input
        className={`${baseClasses} ${className}`}
        {...props}
      />
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};
```

#### Step 3.4: Refactor Components to Use Design System
1. **App.tsx**
   - Remove style class definitions
   - Remove style prop passing

2. **ControlsPanel.tsx**
   ```typescript
   import { Button } from '../src/components/ui';
   
   // Replace
   <button onClick={toggleAutorun} disabled={isAutorunDisabled} className={...}>
   
   // With
   <Button onClick={toggleAutorun} disabled={isAutorunDisabled} variant="primary">
     {isAutorunning ? PauseIcon : PlayIcon} <span>{isAutorunning ? 'Pause' : 'Autorun'}</span>
   </Button>
   ```

3. Update all other components similarly

### Testing Checklist for Phase 3
- [ ] All UI components render correctly
- [ ] Dark mode works for all components
- [ ] Responsive behavior maintained
- [ ] No visual regressions
- [ ] Storybook stories created (optional)

## Phase 4: Integration Testing and Cleanup

### Day 4: Final Integration

#### Step 4.1: Full System Testing
1. Test all user workflows end-to-end
2. Verify no regressions in functionality
3. Performance testing
4. Cross-browser testing

#### Step 4.2: Code Cleanup
1. Remove unused imports
2. Update documentation
3. Add JSDoc comments for new functions
4. Update CLAUDE.md with architectural changes

#### Step 4.3: Create Migration Guide
Document the changes for future developers:
- New patterns to follow
- Examples of proper store usage
- Component library usage guide

## Success Metrics

### Quantitative
- Zero circular dependencies (verified by build tools)
- 100% of business logic in stores
- Zero style props passed between components
- Build time improved by X%
- Bundle size reduced by Y%

### Qualitative
- Improved developer experience
- Easier to understand codebase
- Better testability
- More maintainable architecture

## Rollback Plan

If issues arise during implementation:

1. **Phase 1 Rollback**: Revert to direct store imports (temporary)
2. **Phase 2 Rollback**: Keep logic in components until selectors debugged
3. **Phase 3 Rollback**: Continue using prop drilling until components ready

Each phase is independently deployable and can be rolled back without affecting the others.

## Post-Implementation Tasks

1. Update all documentation
2. Create architectural decision records (ADRs)
3. Schedule team knowledge sharing session
4. Monitor for any edge cases in production
5. Plan next architectural improvements

## Conclusion

This plan provides a systematic approach to addressing the architectural issues while maintaining system stability. Each phase builds upon the previous one, creating a more maintainable and scalable codebase that fully leverages the benefits of Zustand state management.