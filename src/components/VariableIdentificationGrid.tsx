import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { TranscriptProcessedData } from '../../types';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface VariableIdentificationGridProps {
  processedData: Map<string, TranscriptProcessedData>;
  theme: 'light' | 'dark';
}

export const VariableIdentificationGrid: React.FC<VariableIdentificationGridProps> = ({ 
  processedData, 
  theme 
}) => {
  const { rowData, columnDefs } = useMemo(() => {
    // Extract all P_NEG1_1 outputs
    const rows = Array.from(processedData.entries())
      .filter(([_, data]) => data.p_neg1_1_output)
      .map(([id, data]) => ({
        filename: data.filename,
        independent_variable: data.p_neg1_1_output!.independent_variable_details
      }));

    const cols: ColDef[] = [
      { 
        field: 'filename', 
        headerName: 'Filename',
        width: 250,
        sortable: true,
        resizable: true
      },
      { 
        field: 'independent_variable', 
        headerName: 'Independent Variable',
        flex: 1,
        wrapText: true,
        autoHeight: true,
        sortable: true,
        resizable: true
      }
    ];

    return { rowData: rows, columnDefs: cols };
  }, [processedData]);

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
  };

  return (
    <div 
      className={theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} 
      style={{ 
        height: '400px', 
        width: '100%',
        ...gridStyles as React.CSSProperties
      }}
    >
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={{
          resizable: true,
          sortable: true
        }}
        animateRows={true}
        domLayout='normal'
        theme='legacy'
      />
    </div>
  );
};