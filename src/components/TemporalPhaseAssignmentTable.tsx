import React from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { P1_3_Output } from '../../types';
import { convertToCSV, downloadCSV } from '../utils/csvExport';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface TemporalPhaseAssignmentTableProps {
  phaseData: P1_3_Output;
  theme: 'light' | 'dark';
  onPhaseChange: (updatedData: P1_3_Output) => void;
  filename: string;
}

export const TemporalPhaseAssignmentTable: React.FC<TemporalPhaseAssignmentTableProps> = ({ 
  phaseData, 
  theme, 
  onPhaseChange,
  filename 
}) => {
  // Prepare data for the grid
  const rowData = phaseData.phased_diachronic_units.map((phasedUnit, index) => {
    // Get source segments text
    const sourceSegmentsText = phasedUnit.source_segments_text
      ?.map(seg => `[${seg.segment_id}] ${seg.segment_text}`)
      .join(' | ') || '';
    
    const temporalCues = phasedUnit.source_segments_text
      ?.flatMap(seg => seg.temporal_cues)
      .filter((cue, idx, arr) => arr.indexOf(cue) === idx) // unique cues
      .join(', ') || '';

    return {
      unit_id: phasedUnit.unit_id,
      phase: phasedUnit.phase,
      phase_description: phasedUnit.phase_description,
      description: phasedUnit.description,
      temporal_cues: temporalCues,
      source_segments: sourceSegmentsText,
      source_segment_ids: phasedUnit.source_segment_ids
    };
  });

  const columnDefs: ColDef[] = [
    { 
      field: 'unit_id', 
      headerName: 'Unit ID',
      width: 90,
      sortable: true,
      pinned: 'left'
    },
    { 
      field: 'phase', 
      headerName: 'Phase',
      width: 80,
      sortable: true,
      cellClass: 'font-medium',
      cellStyle: params => ({
        backgroundColor: theme === 'dark' ? 'rgba(147, 51, 234, 0.1)' : 'rgba(147, 51, 234, 0.05)'
      })
    },
    { 
      field: 'phase_description', 
      headerName: 'Phase Description',
      width: 150,
      wrapText: true,
      autoHeight: true,
      sortable: true
    },
    { 
      field: 'description', 
      headerName: 'Unit Description',
      flex: 1,
      minWidth: 200,
      wrapText: true,
      autoHeight: true,
      sortable: true
    },
    { 
      field: 'temporal_cues', 
      headerName: 'Temporal Cues',
      width: 200,
      wrapText: true,
      autoHeight: true,
      sortable: true,
      cellClass: 'text-xs',
      cellStyle: {
        fontStyle: 'italic'
      }
    },
    { 
      field: 'source_segments', 
      headerName: 'Source Segments',
      flex: 2,
      minWidth: 300,
      wrapText: true,
      autoHeight: true,
      sortable: false,
      cellClass: 'text-xs'
    }
  ];

  const handleDownloadCSV = () => {
    const csvContent = convertToCSV(rowData, columnDefs);
    const timestamp = new Date().toISOString().split('T')[0];
    downloadCSV(csvContent, `${filename}_P1.3_temporal_phases_${timestamp}.csv`);
  };

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
    '--ag-cell-horizontal-border': 'solid 1px #444444',
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
    '--ag-cell-horizontal-border': 'solid 1px #dcd9d0',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
          Showing {rowData.length} diachronic units with temporal phase assignments
        </div>
        <button
          onClick={handleDownloadCSV}
          className="flex items-center gap-2 px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt border border-light-border dark:border-dark-border rounded hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-colors"
          title="Download as CSV"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSV
        </button>
      </div>
      
      <div 
        className={theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} 
        style={{ 
          height: '500px', 
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
          rowHeight={undefined}
          suppressRowClickSelection={true}
        />
      </div>
      
      {/* Phase distribution summary */}
      <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg">
        <h5 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
          Phase Distribution
        </h5>
        <div className="flex flex-wrap gap-2">
          {Object.entries(
            phaseData.phased_diachronic_units.reduce((acc, unit) => {
              const key = `${unit.phase}: ${unit.phase_description}`;
              acc[key] = (acc[key] || 0) + 1;
              return acc;
            }, {} as Record<string, number>)
          )
            .sort(([a], [b]) => {
              const phaseA = parseInt(a.split(':')[0]);
              const phaseB = parseInt(b.split(':')[0]);
              return phaseA - phaseB;
            })
            .map(([phase, count]) => (
              <span
                key={phase}
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
              >
                {phase} ({count} units)
              </span>
            ))}
        </div>
      </div>
    </div>
  );
};