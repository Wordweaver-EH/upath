import React, { useMemo, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { TagsEditor } from './TagsEditor';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { usePipelineStore } from '../stores/pipelineStore';
import { StepId } from '../../types';
import { useGridChangeTracker } from '../hooks/useGridChangeTracker';
import { Button } from './ui';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface RefinedLine {
  line_num: number;
  text: string;
  information_tags: string[];
  decision_notes: string | null;
}

interface RefinedDataTableProps {
  refinedLines: RefinedLine[];
  theme: 'light' | 'dark';
  onLinesChange?: (updatedLines: RefinedLine[]) => void;
  filename?: string;
  transcriptId?: string;
  stepId?: StepId;
}

const TagsRenderer: React.FC<ICellRendererParams> = (params) => {
  const tags = params.value as string[];
  return (
    <div className="flex flex-wrap gap-1 py-1">
      {tags.map((tag, index) => {
        const isExperiential = tag === 'experiential_content';
        const isProcedural = tag === 'procedural_information';
        const isAmbiguous = tag === 'ambiguous_or_mixed';
        
        const colorClass = isExperiential ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                          isProcedural ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                          isAmbiguous ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                          'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200';
        
        return (
          <span
            key={index}
            className={`text-xs px-2 py-0.5 rounded-full ${colorClass}`}
          >
            {tag.replace(/_/g, ' ')}
          </span>
        );
      })}
    </div>
  );
};

export const RefinedDataTable: React.FC<RefinedDataTableProps> = ({ 
  refinedLines, 
  theme,
  onLinesChange,
  filename,
  transcriptId,
  stepId
}) => {
  const updateManualData = usePipelineStore(state => state.updateManualData);
  
  // Use the grid change tracker hook
  const {
    displayData,
    onCellValueChanged: trackChange,
    handleSave,
    handleCancel,
    hasPendingChanges,
    pendingChangesCount,
    resetData
  } = useGridChangeTracker(refinedLines, {
    transcriptId,
    stepId: stepId || StepId.P0_2_REFINE_DATA_TYPES,
    dataPath: 'refined_data_transcript',
    onSave: (changes) => {
      // Apply changes and call the parent's onLinesChange
      if (onLinesChange) {
        onLinesChange(displayData);
      }
    }
  });
  
  // Reset data when input changes
  useEffect(() => {
    resetData(refinedLines);
  }, [refinedLines, resetData]);
  const { rowData, columnDefs } = useMemo(() => {
    const cols: ColDef[] = [
      { 
        field: 'line_num', 
        headerName: 'Line #',
        width: 80,
        sortable: true,
        resizable: false,
        pinned: 'left',
        editable: false,
        cellClass: 'text-center font-mono text-xs text-light-sidenote dark:text-dark-sidenote'
      },
      { 
        field: 'speaker', 
        headerName: 'Speaker',
        width: 150,
        sortable: true,
        resizable: true,
        editable: false,
        cellRenderer: (params: ICellRendererParams) => {
          if (!params.value) return '';
          return (
            <span className="font-medium text-light-accent dark:text-dark-accent">
              {params.value}
            </span>
          );
        }
      },
      { 
        field: 'text', 
        headerName: 'Text',
        flex: 2,
        wrapText: true,
        autoHeight: true,
        sortable: false,
        resizable: true,
        editable: false,
        cellClass: 'py-2'
      },
      { 
        field: 'information_tags', 
        headerName: 'Information Tags',
        width: 300,
        wrapText: true,
        autoHeight: true,
        sortable: false,
        resizable: true,
        editable: true,
        cellEditor: TagsEditor,
        cellRenderer: TagsRenderer,
        cellClass: 'editable-cell'
      },
      { 
        field: 'decision_notes', 
        headerName: 'Decision Notes',
        flex: 1,
        wrapText: true,
        autoHeight: true,
        sortable: false,
        resizable: true,
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 500
        },
        cellClass: 'editable-cell',
        cellRenderer: (params: ICellRendererParams) => {
          if (!params.value && !params.node.rowPinned) return <span className="text-light-sidenote dark:text-dark-sidenote italic">Click to add notes...</span>;
          return (
            <span className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
              {params.value}
            </span>
          );
        }
      }
    ];
    
    return { rowData: displayData, columnDefs: cols };
  }, [displayData]);

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
  
  // Add editable cell styling and enable text selection
  const editableStyles = `
    .editable-cell {
      cursor: text !important;
      background-color: ${theme === 'dark' ? 'rgba(255, 107, 107, 0.05)' : 'rgba(160, 0, 0, 0.03)'} !important;
    }
    .editable-cell:hover {
      background-color: ${theme === 'dark' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(160, 0, 0, 0.06)'} !important;
    }
    .ag-cell-editing {
      background-color: ${theme === 'dark' ? 'rgba(255, 107, 107, 0.15)' : 'rgba(160, 0, 0, 0.1)'} !important;
      border: 2px solid ${theme === 'dark' ? '#ff6b6b' : '#a00000'} !important;
    }
    .ag-cell {
      user-select: text !important;
      -webkit-user-select: text !important;
      -moz-user-select: text !important;
      -ms-user-select: text !important;
    }
  `;

  const handleDownloadCSV = () => {
    const columns = [
      { field: 'line_num', headerName: 'Line #' },
      { field: 'speaker', headerName: 'Speaker' },
      { field: 'text', headerName: 'Text' },
      { field: 'information_tags', headerName: 'Information Tags' },
      { field: 'decision_notes', headerName: 'Decision Notes' }
    ];
    const csvContent = convertToCSV(rowData, columns);
    
    // Generate filename with transcript name and date
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const baseName = filename ? filename.replace(/\.[^/.]+$/, '') : 'transcript'; // Remove extension
    const csvFilename = `${baseName}_P0-2_refined_${date}.csv`;
    
    downloadCSV(csvContent, csvFilename);
  };

  return (
    <>
      <style>{editableStyles}</style>
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
          💡 Click on Information Tags or Decision Notes cells to edit them. Line numbers and text are not editable.
        </div>
        <button
          onClick={handleDownloadCSV}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Download CSV
        </button>
      </div>
      <div 
        className={theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} 
        style={{ 
          height: '600px', 
          width: '100%',
          ...gridStyles as React.CSSProperties
        }}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            resizable: true,
            sortable: false
          }}
          animateRows={true}
          domLayout='normal'
          theme='legacy'
          rowHeight={undefined}
          getRowHeight={(params) => {
            // Dynamic row height based on content
            const textLength = params.data.text?.length || 0;
            const hasNotes = params.data.decision_notes?.length || 0;
            const baseHeight = 50;
            const extraHeight = Math.floor(textLength / 80) * 20 + (hasNotes ? 20 : 0);
            return Math.min(baseHeight + extraHeight, 200);
          }}
          onCellValueChanged={trackChange}
        />
      </div>
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