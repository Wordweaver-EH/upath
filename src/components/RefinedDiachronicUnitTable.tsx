import React, { useMemo, useCallback, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P1_4_Output, RefinedDiachronicUnitP1_4, StepId } from '../../types';
import { useGridChangeTracker } from '../hooks/useGridChangeTracker';
import { Button } from './ui';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface RefinedDiachronicUnitTableProps {
  refinedData: P1_4_Output;
  theme: 'light' | 'dark';
  onRefinedChange?: (updatedData: P1_4_Output) => void;
  filename?: string;
  transcriptId?: string;
}

// Custom renderer for temporal phase badges
const TemporalPhaseRenderer: React.FC<ICellRendererParams> = (params) => {
  const phase = params.value || 'Unknown';
  
  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'Beginning':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'Early-Middle':
        return 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200';
      case 'Core Event':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'Late-Middle':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200';
      case 'Ending':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'Reflection':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'Transition':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'Other':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
    }
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getPhaseColor(phase)}`}>
      {phase}
    </span>
  );
};

// Custom renderer for confidence with visual indicator
const ConfidenceRenderer: React.FC<ICellRendererParams> = (params) => {
  const confidence = params.value || 0;
  const percentage = Math.round(confidence * 100);
  
  const getConfidenceColor = (value: number) => {
    if (value >= 0.8) return 'bg-green-500';
    if (value >= 0.6) return 'bg-yellow-500';
    if (value >= 0.4) return 'bg-orange-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center space-x-2">
      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div 
          className={`h-2 rounded-full ${getConfidenceColor(confidence)}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs font-mono w-10 text-right">{percentage}%</span>
    </div>
  );
};

// Custom renderer for source DU IDs
const SourceDuIdsRenderer: React.FC<ICellRendererParams> = (params) => {
  const ids: string[] = params.value || [];
  
  if (ids.length === 0) {
    return <span className="text-gray-400 italic">No source DUs</span>;
  }

  return (
    <div className="flex flex-wrap gap-1 py-1">
      {ids.map((id, index) => (
        <span
          key={index}
          className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono"
        >
          {id}
        </span>
      ))}
    </div>
  );
};

export const RefinedDiachronicUnitTable: React.FC<RefinedDiachronicUnitTableProps> = ({
  refinedData,
  theme,
  onRefinedChange,
  filename,
  transcriptId
}) => {
  console.log('[RefinedDiachronicUnitTable] Props:', { refinedData, theme, filename });
  
  // Log the structure of the first unit if available
  if (refinedData?.refined_diachronic_units?.[0]) {
    console.log('[RefinedDiachronicUnitTable] First unit structure:', refinedData.refined_diachronic_units[0]);
  }
  
  // Defensive check for data validity
  if (!refinedData || !refinedData.refined_diachronic_units) {
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        No refined diachronic data available
      </div>
    );
  }

  // Prepare data for the grid
  const flattenedData = useMemo(() => {
    return refinedData.refined_diachronic_units.map(unit => ({
      ...unit
    }));
  }, [refinedData]);

  // Use the grid change tracker hook
  const {
    displayData,
    onCellValueChanged: trackChange,
    handleSave,
    handleCancel,
    hasPendingChanges,
    pendingChangesCount,
    resetData
  } = useGridChangeTracker(flattenedData, {
    transcriptId,
    stepId: StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
    dataPath: 'refined_diachronic_units',
    onSave: (changes) => {
      if (onRefinedChange) {
        // Apply changes back to the original structure
        const updatedData = { ...refinedData };
        
        changes.forEach(change => {
          const rowData = displayData[change.rowId as number];
          if (rowData && change.field === 'description') {
            const unitIndex = updatedData.refined_diachronic_units.findIndex(
              u => u.unit_id === rowData.unit_id
            );
            if (unitIndex !== -1) {
              updatedData.refined_diachronic_units[unitIndex] = {
                ...updatedData.refined_diachronic_units[unitIndex],
                description: change.newValue
              };
            }
          }
        });
        
        onRefinedChange(updatedData);
      }
    }
  });

  // Reset data when input changes
  useEffect(() => {
    resetData(flattenedData);
  }, [flattenedData, resetData]);

  const columnDefs = useMemo(() => {
    const cols: ColDef[] = [
      {
        field: 'unit_id',
        headerName: 'Unit ID',
        width: 100,
        pinned: 'left',
        cellClass: 'font-mono text-xs text-light-sidenote dark:text-dark-sidenote'
      },
      {
        field: 'description',
        headerName: 'Description',
        flex: 2,
        wrapText: true,
        autoHeight: true,
        editable: true,
        cellClass: 'py-2',
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3
        }
      },
      {
        field: 'source_du_ids',
        headerName: 'Source DU IDs',
        width: 200,
        wrapText: true,
        autoHeight: true,
        cellRenderer: SourceDuIdsRenderer,
        valueFormatter: (params) => {
          const ids = params.value as string[];
          return ids ? ids.join(', ') : '';
        }
      },
      {
        field: 'phase.sequence_id',
        headerName: 'Phase #',
        width: 80,
        valueGetter: (params) => params.data?.phase?.sequence_id || 0
      },
      {
        field: 'phase.phase_type',
        headerName: 'Phase Type',
        width: 150,
        cellRenderer: (params) => {
          const phaseType = params.data?.phase?.phase_type || 'Unknown';
          return <TemporalPhaseRenderer {...params} value={phaseType} />;
        }
      },
      {
        field: 'merge_justification',
        headerName: 'Merge Justification',
        flex: 1,
        wrapText: true,
        autoHeight: true,
        valueFormatter: (params) => params.value || 'N/A',
        cellStyle: { fontStyle: 'italic' }
      }
    ];

    console.log('[RefinedDiachronicUnitTable] Column definitions:', cols);

    return cols;
  }, []);

  const handleExportCSV = () => {
    const csvData = refinedData.refined_diachronic_units.map(unit => ({
      'Unit ID': unit.unit_id,
      'Description': unit.description,
      'Source DU IDs': unit.source_du_ids.join('; '),
      'Phase #': unit.phase.sequence_id,
      'Phase Type': unit.phase.phase_type,
      'Merge Justification': unit.merge_justification || 'N/A'
    }));

    const columns = [
      { field: 'Unit ID', headerName: 'Unit ID' },
      { field: 'Description', headerName: 'Description' },
      { field: 'Source P1.2 DU IDs', headerName: 'Source P1.2 DU IDs' },
      { field: 'Temporal Phase', headerName: 'Temporal Phase' },
      { field: 'Confidence', headerName: 'Confidence' }
    ];
    const csv = convertToCSV(csvData, columns);
    const defaultFilename = filename ? 
      `${filename.replace(/\.[^/.]+$/, '')}_P1.3_refined_units.csv` : 
      'P1.3_refined_units.csv';
    
    downloadCSV(csv, defaultFilename);
  };

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true,
  }), []);

  // Define custom styles based on theme
  const gridStyles = theme === 'dark' ? {
    '--ag-background-color': '#1a1a1a',
    '--ag-header-background-color': '#252525',
    '--ag-odd-row-background-color': '#252525',
    '--ag-foreground-color': '#e6e6e6',
    '--ag-header-foreground-color': '#e6e6e6',
    '--ag-border-color': '#444444',
    '--ag-row-hover-color': '#333333',
    '--ag-header-column-resize-handle-color': '#ff6b6b',
    '--ag-font-family': '"EB Garamond", "et-book", serif',
    '--ag-font-size': '16px',
    '--ag-row-border-style': 'solid',
    '--ag-row-border-width': '1px',
    '--ag-row-border-color': '#333333',
  } : {
    '--ag-background-color': '#faf8f1',
    '--ag-header-background-color': '#f3f1ea',
    '--ag-odd-row-background-color': '#f3f1ea',
    '--ag-foreground-color': '#222222',
    '--ag-header-foreground-color': '#222222',
    '--ag-border-color': '#dcd9d0',
    '--ag-row-hover-color': '#e9e6de',
    '--ag-header-column-resize-handle-color': '#a00000',
    '--ag-font-family': '"EB Garamond", "et-book", serif',
    '--ag-font-size': '16px',
    '--ag-row-border-style': 'solid',
    '--ag-row-border-width': '1px',
    '--ag-row-border-color': '#e0ddd4',
  };

  return (
    <>
      <div className="mb-2 flex justify-between items-center">
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
          💡 Edit descriptions directly in the grid. Use Save to commit changes or Cancel to discard.
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Download CSV
        </button>
      </div>
      
      <div 
        className={`${theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'}`}
        style={{ 
          height: '600px',
          width: '100%',
          ...gridStyles as React.CSSProperties
        }}
      >
        <AgGridReact
          rowData={displayData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={60}
          animateRows={true}
          theme="legacy"
          rowSelection={{ mode: 'singleRow', enableClickSelection: false }}
          onCellValueChanged={trackChange}
        />
      </div>

      {/* Save/Cancel buttons */}
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
    </>
  );
};