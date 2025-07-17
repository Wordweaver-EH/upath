import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { convertToCSV, downloadCSV } from '../utils/csvExport';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface SelectedUtterance {
  original_line_num: string;
  utterance_text: string;
  included: boolean;
  selection_justification: string;
}

interface SelectedUtterancesTableProps {
  utterances: SelectedUtterance[];
  theme: 'light' | 'dark';
  onUtterancesChange?: (updatedUtterances: SelectedUtterance[]) => void;
}

export const SelectedUtterancesTable: React.FC<SelectedUtterancesTableProps> = ({ 
  utterances, 
  theme,
  onUtterancesChange
}) => {
  const { rowData, columnDefs } = useMemo(() => {
    const cols: ColDef[] = [
      { 
        field: 'original_line_num', 
        headerName: 'Line #',
        width: 80,
        sortable: true,
        resizable: false,
        pinned: 'left',
        editable: false,
        cellClass: 'text-center font-mono text-xs text-light-sidenote dark:text-dark-sidenote',
        comparator: (a: string, b: string) => {
          // Custom comparator for line numbers like "3", "3.1", "3.2"
          const aParts = a.split('.').map(Number);
          const bParts = b.split('.').map(Number);
          
          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i] || 0;
            const bVal = bParts[i] || 0;
            if (aVal !== bVal) return aVal - bVal;
          }
          return 0;
        }
      },
      {
        field: 'included',
        headerName: 'Included',
        width: 100,
        sortable: true,
        resizable: false,
        editable: true,
        cellRenderer: (params: ICellRendererParams) => {
          return (
            <input
              type="checkbox"
              checked={params.value}
              onChange={() => {}}
              className="cursor-pointer"
            />
          );
        },
        cellClass: 'text-center editable-cell'
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
        },
        cellClass: (params) => params.data.included ? '' : 'opacity-60'
      },
      { 
        field: 'utterance_text', 
        headerName: 'Utterance Text',
        flex: 2,
        wrapText: true,
        autoHeight: true,
        sortable: false,
        resizable: true,
        editable: false,
        cellClass: (params) => params.data.included ? 'py-2' : 'py-2 opacity-60'
      },
      { 
        field: 'selection_justification', 
        headerName: 'Selection Justification',
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
          if (!params.value && !params.node.rowPinned) return <span className="text-light-sidenote dark:text-dark-sidenote italic">Click to add justification...</span>;
          return (
            <span className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
              {params.value}
            </span>
          );
        }
      }
    ];
    
    return { rowData: utterances, columnDefs: cols };
  }, [utterances]);

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
      { field: 'original_line_num', headerName: 'Line #' },
      { field: 'included', headerName: 'Included' },
      { field: 'speaker', headerName: 'Speaker' },
      { field: 'utterance_text', headerName: 'Utterance Text' },
      { field: 'selection_justification', headerName: 'Selection Justification' }
    ];
    const csvContent = convertToCSV(rowData, columns);
    downloadCSV(csvContent, 'selected_utterances.csv');
  };

  return (
    <>
      <style>{editableStyles}</style>
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
          💡 Click checkboxes to toggle inclusion status. Click on Selection Justification cells to edit them. Line numbers and utterance text are not editable.
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
            const textLength = params.data.utterance_text?.length || 0;
            const justificationLength = params.data.selection_justification?.length || 0;
            const baseHeight = 50;
            const extraHeight = Math.floor((textLength + justificationLength) / 100) * 20;
            return Math.min(baseHeight + extraHeight, 200);
          }}
          onCellValueChanged={(event: CellValueChangedEvent) => {
            if (onUtterancesChange) {
              // Create a new array with the updated utterance
              const updatedUtterances = [...utterances];
              const index = utterances.findIndex(u => u.original_line_num === event.data.original_line_num);
              if (index !== -1) {
                updatedUtterances[index] = { ...event.data };
                onUtterancesChange(updatedUtterances);
              }
            }
          }}
          onCellClicked={(event) => {
            if (event.column.getColId() === 'included' && onUtterancesChange) {
              const updatedUtterances = [...utterances];
              const index = utterances.findIndex(u => u.original_line_num === event.data.original_line_num);
              if (index !== -1) {
                updatedUtterances[index] = { 
                  ...updatedUtterances[index], 
                  included: !updatedUtterances[index].included 
                };
                onUtterancesChange(updatedUtterances);
              }
            }
          }}
        />
      </div>
    </>
  );
};