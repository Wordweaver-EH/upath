import { useState, useCallback, useRef } from 'react';
import { CellValueChangedEvent } from 'ag-grid-community';
import { trackingHelpers } from '../stores/historyStore';
import { StepId } from '../../types';

interface GridChange {
  rowId: string | number;
  field: string;
  oldValue: any;
  newValue: any;
  rowData?: any;
}

interface UseGridChangeTrackerOptions {
  transcriptId?: string;
  stepId?: StepId;
  dataPath?: string;
  onSave?: (changes: GridChange[]) => void;
}

export function useGridChangeTracker<T extends Record<string, any>>(
  originalData: T[],
  options: UseGridChangeTrackerOptions = {}
) {
  const { transcriptId, stepId, dataPath, onSave } = options;
  
  // Keep track of the original data
  const originalDataRef = useRef(originalData);
  
  // Display data that includes pending changes
  const [displayData, setDisplayData] = useState<T[]>(() => 
    originalData.map(item => ({ ...item }))
  );
  
  // Track pending changes
  const [pendingChanges, setPendingChanges] = useState<Map<string, GridChange>>(
    new Map()
  );
  
  // Handle cell value changes
  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const { data, colDef, oldValue, newValue } = event;
    const field = colDef.field;
    
    console.log('[useGridChangeTracker] onCellValueChanged:', { field, oldValue, newValue, data });
    
    if (!field || oldValue === newValue) return;
    
    // Find the row index
    const rowIndex = originalDataRef.current.findIndex(item => {
      // Try to match by common id fields
      if ('id' in item && 'id' in data) return item.id === data.id;
      if ('line_num' in item && 'line_num' in data) return item.line_num === data.line_num;
      if ('original_line_num' in item && 'original_line_num' in data) return item.original_line_num === data.original_line_num;
      if ('segment_id' in item && 'segment_id' in data) return item.segment_id === data.segment_id;
      if ('unit_id' in item && 'unit_id' in data) return item.unit_id === data.unit_id;
      // Fallback to object comparison
      return JSON.stringify(item) === JSON.stringify(data);
    });
    
    if (rowIndex === -1) {
      console.log('[useGridChangeTracker] Could not find row index for data:', data);
      return;
    }
    
    console.log('[useGridChangeTracker] Found row at index:', rowIndex);
    
    // Create a unique key for this change
    const changeKey = `${rowIndex}-${field}`;
    
    // Update pending changes
    setPendingChanges(prev => {
      const newChanges = new Map(prev);
      
      // If this cell was previously changed, use the original oldValue
      const existingChange = prev.get(changeKey);
      const originalOldValue = existingChange ? existingChange.oldValue : oldValue;
      
      // If we're changing back to the original value, remove the change
      if (originalOldValue === newValue) {
        newChanges.delete(changeKey);
      } else {
        newChanges.set(changeKey, {
          rowId: rowIndex,
          field,
          oldValue: originalOldValue,
          newValue,
          rowData: data
        });
      }
      
      return newChanges;
    });
    
    // Update display data immediately for user feedback
    setDisplayData(prev => {
      const newData = [...prev];
      newData[rowIndex] = { ...newData[rowIndex], [field]: newValue };
      return newData;
    });
  }, []);
  
  // Save all pending changes
  const handleSave = useCallback(() => {
    console.log('[useGridChangeTracker] handleSave called with:', {
      pendingChangesSize: pendingChanges.size,
      transcriptId,
      dataPath,
      stepId
    });
    
    if (pendingChanges.size === 0) return;
    
    const changesArray = Array.from(pendingChanges.values());
    
    console.log('[useGridChangeTracker] Changes to save:', changesArray);
    
    // Track changes in history store
    if (transcriptId && dataPath) {
      // Create a summary of all changes
      const changesSummary = changesArray
        .map(change => `${change.field}: ${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`)
        .join(', ');
      
      console.log('[useGridChangeTracker] Calling trackingHelpers.trackDataEdit with:', {
        dataPath,
        oldValues: changesArray.map(c => ({ field: c.field, value: c.oldValue })),
        newValues: changesArray.map(c => ({ field: c.field, value: c.newValue })),
        transcriptId,
        stepId
      });
      
      trackingHelpers.trackDataEdit(
        dataPath,
        changesArray.map(c => ({ field: c.field, value: c.oldValue })),
        changesArray.map(c => ({ field: c.field, value: c.newValue })),
        transcriptId,
        stepId
      );
    } else {
      console.warn('[useGridChangeTracker] Missing transcriptId or dataPath, cannot track changes:', {
        transcriptId,
        dataPath
      });
    }
    
    // Call the optional onSave callback
    if (onSave) {
      onSave(changesArray);
    }
    
    // Clear pending changes
    setPendingChanges(new Map());
    
    // Update the original data reference
    originalDataRef.current = displayData;
  }, [pendingChanges, transcriptId, dataPath, stepId, onSave, displayData]);
  
  // Cancel all pending changes
  const handleCancel = useCallback(() => {
    setPendingChanges(new Map());
    setDisplayData(originalDataRef.current.map(item => ({ ...item })));
  }, []);
  
  // Reset with new data (useful when parent data changes)
  const resetData = useCallback((newData: T[]) => {
    originalDataRef.current = newData;
    setDisplayData(newData.map(item => ({ ...item })));
    setPendingChanges(new Map());
  }, []);
  
  return {
    displayData,
    onCellValueChanged,
    handleSave,
    handleCancel,
    hasPendingChanges: pendingChanges.size > 0,
    pendingChangesCount: pendingChanges.size,
    pendingChanges: Array.from(pendingChanges.values()),
    resetData
  };
}