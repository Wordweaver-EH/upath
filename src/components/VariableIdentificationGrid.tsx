import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import { TranscriptProcessedData } from '../../types';

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

  return (
    <div 
      className={theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} 
      style={{ height: '400px', width: '100%' }}
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
      />
    </div>
  );
};