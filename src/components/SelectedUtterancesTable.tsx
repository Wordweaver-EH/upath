import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface SelectedUtterance {
  original_line_num: string;
  utterance_text: string;
  selection_justification?: string;
}

interface SelectedUtterancesTableProps {
  utterances: SelectedUtterance[];
  theme: 'light' | 'dark';
}

export const SelectedUtterancesTable: React.FC<SelectedUtterancesTableProps> = ({ 
  utterances, 
  theme 
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
        field: 'utterance_text', 
        headerName: 'Utterance Text',
        flex: 2,
        wrapText: true,
        autoHeight: true,
        sortable: false,
        resizable: true,
        cellClass: 'py-2'
      },
      { 
        field: 'selection_justification', 
        headerName: 'Selection Justification',
        flex: 1,
        wrapText: true,
        autoHeight: true,
        sortable: false,
        resizable: true,
        cellRenderer: (params: ICellRendererParams) => {
          if (!params.value) return '';
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

  return (
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
      />
    </div>
  );
};