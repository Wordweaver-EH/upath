# Plan: Fix Zustand Infinite Re-render Issue

## Root Cause Analysis
The µ-PATH application is experiencing infinite re-renders due to circular dependencies between Zustand stores:

1. **Circular Store Dependencies**: `pipelineStore` directly calls `uiStore` methods, creating update loops
2. **Destructured Selectors**: Components using `useStore(state => ({ ... }))` create new objects on each render
3. **Synchronous Cross-Store Updates**: Direct store-to-store calls happen synchronously, causing React update loops

## Current Error Stack
```
Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate.
```

## Step-by-Step Fix Plan

### Phase 1: Break Synchronous Update Cycles (PRIORITY 1)
**Target Files**: `src/stores/pipelineStore.ts`

**Action**: Wrap all direct `uiStore` method calls in `setTimeout(() => {}, 0)` to make them asynchronous:

Lines to fix:
- Line 269: `uiStore.setCurrentStepInfo({ stepId, status: StepStatus.Error, error: "API Key not set." })`
- Line 274: `uiStore.setAutorunning(false)`
- Line 282: `uiStore.setCurrentStepInfo({ stepId, status: StepStatus.Error, error: \`DV Focus Error: ${dvFocusError}\` })`
- Line 287: `uiStore.setAutorunning(false)`
- Line 524: `uiStore.setCurrentStepInfo({ stepId: StepId.COMPLETE, status: StepStatus.Success })`
- Line 529: `uiStore.setAutorunning(false)`
- Line 534: `uiStore.setActiveTranscript(details.nextTranscriptIndex)`
- Line 539: `uiStore.setCurrentStepInfo({ stepId: details.nextStepId, status: StepStatus.Idle })`
- Line 544: `uiStore.setAutorunning(false)`
- Line 606: `uiStore.setActiveTranscript(savedState.activeTranscriptIndex)`

### Phase 2: Fix Destructured Selectors (COMPLETED ✅)
**Target Files**: `components/HilModal.tsx`, `components/ControlsPanelZustand.tsx`

**Action**: Replace destructured selectors with individual selectors
- ✅ Fixed HilModal.tsx
- ✅ Fixed ControlsPanelZustand.tsx

### Phase 3: DOM Safety Fixes (COMPLETED ✅)
**Target Files**: `index.html`, `components/ControlsPanel.tsx`

**Action**: Add null checks for DOM manipulation
- ✅ Fixed theme script in index.html
- ✅ Fixed classList access in ControlsPanel.tsx

### Phase 4: Validate Fix and Test
1. **Test application loads without infinite re-renders**
2. **Verify Zustand refactoring still works properly**
3. **Check that all store actions function correctly**
4. **Confirm no console errors remain**

## Success Criteria
- [ ] No "Maximum update depth exceeded" errors
- [ ] Application loads and renders properly
- [ ] All Zustand store interactions work
- [ ] No classList/DOM manipulation errors
- [ ] ControlsPanel component functions correctly with new store architecture

## Notes
- The setTimeout approach is a temporary fix - ideally stores should not directly call each other
- Long-term solution would be to implement proper event-driven architecture or use a mediator pattern
- Current fix maintains existing functionality while breaking the update cycle