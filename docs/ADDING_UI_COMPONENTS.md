# Adding UI Components to uPath Pipeline

This guide documents the process of adding new UI components for pipeline steps, based on the experience of implementing the P2S.1 (Synchronic Thematic Grouping) component.

## Overview

When adding a new UI component for a pipeline step, you need to:
1. Create the component itself
2. Integrate it with PipelineStepGrid
3. Ensure the step is included in the gridSteps array in App.tsx

## Step-by-Step Process

### 1. Create the Component

Create a new component file in `src/components/` that handles the display of your step's data.

Example structure for P2S.1:
```typescript
// src/components/SynchronicThematicGroupingTable.tsx
interface SynchronicThematicGroupingTableProps {
  groupingData: P2S_1_Output;  // Your step's output type
  theme: 'light' | 'dark';
  onGroupingChange?: (updatedData: P2S_1_Output) => void;
  filename?: string;
}
```

Key features to implement:
- **Collapsible sections** for better UX
- **Inline editing** capabilities where appropriate
- **CSV export** functionality
- **Visual design** consistent with other components (use existing color schemes)

### 2. Integrate with PipelineStepGrid

Add a case for your step in `src/components/PipelineStepGrid.tsx`:

```typescript
// Special handling for P2S_1 with tabbed display per DU
if (stepId === StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC) {
  return (
    <TabbedStepDisplay
      processedData={processedData}
      extractTabs={(data) => {
        // Extract tabs based on your data structure
      }}
      renderContent={(tabData, theme) => {
        // Render your component
        return <YourComponent data={tabData} theme={theme} />;
      }}
      theme={theme}
      emptyMessage="No data available yet"
    />
  );
}
```

### 3. Add to gridSteps Array (CRITICAL!)

**This is the most common mistake!** You MUST add your step to the `gridSteps` array in `App.tsx`:

```typescript
// In App.tsx, inside the renderOutput function
case 'output':
  const gridSteps = [
    StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
    StepId.P0_1_TRANSCRIPTION_ADHERENCE,
    // ... other steps ...
    StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC  // ADD YOUR STEP HERE!
  ];
```

If you forget this step, your component will show JSON output instead of the UI!

## Understanding Data Flow

### For P2S Steps (Per-DU Processing)

P2S steps process data per Diachronic Unit (DU). The data structure is:
```typescript
processedData.get(transcriptId).p2s_outputs_by_du[duId].p2s_1_output
```

Key considerations:
- Multiple DUs may have data
- Use tabs to show each DU separately
- Check if ANY DU has data, not just the current one

### Data Loading

When a user clicks on a step:
1. `handlePipelineStepClick` is called
2. It determines the appropriate transcript/DU/GDU IDs
3. `loadStepData` loads the output data
4. `setCurrentStepInfo` updates the UI with the loaded data

## Common Pitfalls and Solutions

### Problem: "No output to display for this step yet" when data exists

**Cause**: The app checks `currentStepInfo.outputData`, which might only have data for the current DU, not all DUs.

**Solution**: For P2S steps, special handling was added to check if ANY DU has data:
```typescript
// In selectCurrentStepDisplay
if (STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC.includes(currentStepInfo.stepId)) {
  // Check if any DU has output for this step
  const hasAnyOutput = Object.values(transcriptData.p2s_outputs_by_du).some(
    duData => duData[stepKey] !== undefined
  );
}
```

### Problem: Component shows JSON instead of UI

**Cause**: Step not included in `gridSteps` array in App.tsx.

**Solution**: Add your step ID to the `gridSteps` array.

### Problem: Can't find data in the component

**Cause**: Looking in the wrong place in the data structure.

**Solution**: Use console.log to inspect the processedData structure and understand where your data is stored.

## Testing Your Component

1. **Run the pipeline** up to your step
2. **Check console logs** for any errors
3. **Verify data structure** matches what your component expects
4. **Test all interactive features**: editing, deleting, exporting
5. **Test with multiple transcripts/DUs** if applicable

## Debugging Tips

1. **Add console.logs** in extractTabs to see what data is available
2. **Check the PipelineOrchestrator logs** to understand data flow
3. **Use React DevTools** to inspect component props
4. **Verify step IDs match** between configuration and UI code

## File Structure Reference

```
src/
├── components/
│   ├── PipelineStepGrid.tsx         # Main dispatcher for step UIs
│   ├── TabbedStepDisplay.tsx        # Reusable tabbed display
│   └── YourNewComponent.tsx         # Your step's UI component
├── config/
│   └── pipeline/
│       └── part2/
│           └── P2S_1_config.ts      # Step configuration
└── types.ts                         # TypeScript interfaces
```

## Checklist for Adding New UI Components

- [ ] Create component file in `src/components/`
- [ ] Define TypeScript interfaces for props
- [ ] Implement collapsible/expandable sections
- [ ] Add inline editing where appropriate
- [ ] Implement CSV export functionality
- [ ] Add case in PipelineStepGrid.tsx
- [ ] **Add step to gridSteps array in App.tsx**
- [ ] Test with actual pipeline data
- [ ] Handle empty/loading states
- [ ] Ensure consistent styling with theme

## Example Components to Reference

- `DiachronicUnitGroupingTable.tsx` - Good example of collapsible cards with editing
- `PhaseTaggingTable.tsx` - Example of editable table with phase colors
- `IntraPhaseSortingTable.tsx` - Example of sortable segments
- `SynchronicThematicGroupingTable.tsx` - Example of P2S component with per-DU tabs

Remember: The most common issue is forgetting to add your step to the gridSteps array in App.tsx!