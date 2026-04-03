# Change Tracking Implementation Guide

## Overview

This document describes the implementation of a comprehensive change tracking system for all editable AG-Grid tables in the upath application. The system tracks all manual edits, provides a save/cancel workflow, and integrates with the existing history store.

## Architecture

### Core Components

1. **`useGridChangeTracker` Hook** (`/src/hooks/useGridChangeTracker.ts`)
   - Manages pending changes in a local buffer
   - Provides save/cancel functionality
   - Integrates with the history store for persistence
   - Handles different row identification strategies

2. **`historyStore`** (`/src/stores/historyStore.ts`)
   - Centralized store for all tracked changes
   - Persists to localStorage
   - Provides query methods for filtering changes
   - Exposes tracking helpers for different change types

3. **`ChangeHistoryPanel`** (`/src/components/ChangeHistoryPanel.tsx`)
   - UI component that displays all tracked changes
   - Filterable by change type
   - Expandable details for each change
   - Export functionality

## How It Works

### 1. The Hook Pattern

The `useGridChangeTracker` hook encapsulates all the logic for tracking grid edits:

```typescript
const {
  displayData,           // Data to show in the grid (includes pending changes)
  onCellValueChanged,    // Handler for AG-Grid cell changes
  handleSave,           // Commits all pending changes
  handleCancel,         // Discards all pending changes
  hasPendingChanges,    // Boolean flag for conditional UI
  pendingChangesCount,  // Number of unsaved changes
  resetData            // Reset with new data
} = useGridChangeTracker(originalData, options);
```

### 2. Change Detection Flow

1. User edits a cell in AG-Grid
2. `onCellValueChanged` event fires
3. Hook finds the row index using multiple strategies:
   - By `id` field
   - By `line_num` field
   - By `original_line_num` field (for SelectedUtterancesTable)
   - By `segment_id` field
   - By `unit_id` field
   - Fallback to JSON comparison
4. Change is stored in `pendingChanges` Map with key `{rowIndex}-{field}`
5. `displayData` is updated immediately for user feedback
6. Save/Cancel buttons appear when `hasPendingChanges` is true

### 3. Save/Cancel Workflow

**Save:**
- Calls `trackingHelpers.trackDataEdit` to record in history store
- Executes optional `onSave` callback
- Clears pending changes
- Updates original data reference

**Cancel:**
- Discards all pending changes
- Resets display data to original state

## Implementation Steps

### Step 1: Update Table Component

```typescript
// 1. Import required dependencies
import { useGridChangeTracker } from '../hooks/useGridChangeTracker';
import { Button } from './ui';
import { StepId } from '../../types';

// 2. Add transcriptId to props interface
interface TableProps {
  // ... existing props
  transcriptId?: string;
}

// 3. Use the hook in your component
const {
  displayData,
  onCellValueChanged: trackChange,
  handleSave,
  handleCancel,
  hasPendingChanges,
  pendingChangesCount,
  resetData
} = useGridChangeTracker(data, {
  transcriptId,
  stepId: StepId.YOUR_STEP_ID,
  dataPath: 'your_data_path',
  onSave: (changes) => {
    if (onDataChange) {
      onDataChange(displayData);
    }
  }
});

// 4. Reset data when input changes
useEffect(() => {
  resetData(data);
}, [data, resetData]);

// 5. Update AG-Grid configuration
<AgGridReact
  rowData={displayData}  // Use displayData instead of original data
  onCellValueChanged={trackChange}  // Use trackChange handler
  // ... other props
/>

// 6. Add Save/Cancel buttons
{hasPendingChanges && (
  <div className="flex justify-end gap-2 mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
    <span className="text-sm text-yellow-800 dark:text-yellow-200 mr-auto">
      {pendingChangesCount} unsaved change{pendingChangesCount > 1 ? 's' : ''}
    </span>
    <Button onClick={handleCancel} variant="secondary" size="sm">
      Cancel
    </Button>
    <Button onClick={handleSave} size="sm">
      Save Changes
    </Button>
  </div>
)}
```

### Step 2: Update Parent Component

Where the table is used, pass the `transcriptId`:

```typescript
<YourTable
  data={data}
  transcriptId={tabData.transcriptId}
  // ... other props
/>
```

## Special Cases

### Checkbox Handling (SelectedUtterancesTable)

For checkbox columns that use `onCellClicked` instead of `onCellValueChanged`:

```typescript
onCellClicked={(event) => {
  if (event.column.getColId() === 'included') {
    // Simulate a cell value change
    const oldValue = event.data.included;
    const newValue = !oldValue;
    trackChange({
      ...event,
      oldValue,
      newValue,
      colDef: { field: 'included' }
    } as any);
  }
}}
```

### Custom Row Identification

The hook automatically tries multiple strategies to identify rows. If your table uses a different identifier, update the hook's `findIndex` logic:

```typescript
const rowIndex = originalDataRef.current.findIndex(item => {
  // Add your custom identification logic here
  if ('your_id_field' in item && 'your_id_field' in data) 
    return item.your_id_field === data.your_id_field;
  // ... existing strategies
});
```

## Tables Requiring Implementation

### Completed ✅
1. **RefinedDataTable** - Part 0.2 (fields: text, information_tags, decision_notes)
2. **SelectedUtterancesTable** - Part 0.3 (fields: included, selection_justification)

### Pending Implementation
3. **InitialSegmentationTable** - Part 1.1 (fields: segment_text, temporal_cues)
4. **PhaseTaggingTable** - Part 1.2 (fields: coarse_phase)
5. **IntraPhaseSortingTable** - Part 1.3 (fields: chronological_index, placement_justification)
6. **DiachronicUnitTable** - Part 1.4 (fields: name, description)
7. **RefinedDiachronicUnitTable** - Part 1.5 (fields: phase_name, description)
8. **SynchronicThematicGroupingTable** - Part 2S.1 (fields: group_label, justification)
9. **SpecificSynchronicUnitsTable** - Part 2S.2 (fields: unit_name, intensional_definition)
10. **PipelineStepGrid** - Part -1.1 (fields: independent_variable, dependent_variables)

## StepId Mapping

Use these StepId values when implementing:

```typescript
StepId.P0_2_REFINE_DATA_TYPES
StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES
StepId.P1_1_INITIAL_SEGMENTATION
StepId.P1_2_COARSE_PHASE_TAGGING
StepId.P1_3_INTRA_PHASE_SORTING
StepId.P1_4_DIACHRONIC_UNIT_GROUPING
StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE
StepId.P2S_1_GROUP_SEGMENTS_BY_TOPIC
StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS
StepId.P_NEG1_1_VARIABLE_IDENTIFICATION
```

## Debugging Tips

1. **Changes not being tracked:**
   - Check browser console for `[useGridChangeTracker]` logs
   - Verify `transcriptId` is being passed
   - Ensure row identification is working (check findIndex logic)

2. **Save/Cancel buttons not appearing:**
   - Verify `hasPendingChanges` is true after editing
   - Check that `onCellValueChanged` is properly connected

3. **Changes not appearing in ChangeHistoryPanel:**
   - Check if changes are being saved (not just edited)
   - Verify history store is enabled (checkbox in panel)
   - Check browser localStorage for `upath-history-store`

## Benefits

1. **Consistent UX**: All tables work the same way
2. **Batch Operations**: Multiple edits can be saved together
3. **Data Safety**: Cancel discards unwanted changes
4. **Audit Trail**: All changes are tracked with timestamps
5. **Maintainable**: Single hook handles all complexity