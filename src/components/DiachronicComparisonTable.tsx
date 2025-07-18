import React, { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridOptions } from 'ag-grid-community';
import { usePipelineStore } from '../stores/pipelineStore';
import { P1_4_Output } from '../types';
import { downloadCSV } from '../utils/csvExport';

interface PhaseData {
  transcriptId: string;
  phases: {
    name: string;
    description: string;
    units: string[];
  }[];
}

export const DiachronicComparisonTable: React.FC = () => {
  const processedData = usePipelineStore(state => state.processedData);
  const activeTranscriptId = usePipelineStore(state => state.activeTranscriptId);
  
  // Collect all P1.4 outputs from all transcripts
  const phaseDataByTranscript = useMemo(() => {
    const data: PhaseData[] = [];
    
    processedData.forEach((transcriptData, transcriptId) => {
      if (transcriptData.p1_4_output) {
        const output = transcriptData.p1_4_output as P1_4_Output;
        if (output.specific_diachronic_structure?.phases) {
          data.push({
            transcriptId,
            phases: output.specific_diachronic_structure.phases.map(phase => ({
              name: phase.phase_name || 'Unnamed',
              description: phase.description || '',
              units: phase.units_involved || []
            }))
          });
        }
      }
    });
    
    return data.sort((a, b) => a.transcriptId.localeCompare(b.transcriptId));
  }, [processedData]);

  // Find the maximum number of phases across all transcripts
  const maxPhases = useMemo(() => {
    return Math.max(...phaseDataByTranscript.map(d => d.phases.length), 0);
  }, [phaseDataByTranscript]);

  // Create row data for AG-Grid
  const rowData = useMemo(() => {
    return phaseDataByTranscript.map(transcript => {
      const row: any = {
        transcriptId: transcript.transcriptId,
        isActive: transcript.transcriptId === activeTranscriptId
      };
      
      // Add phase data for each phase slot
      for (let i = 0; i < maxPhases; i++) {
        const phase = transcript.phases[i];
        row[`phase${i + 1}`] = phase ? phase.name : '-';
        row[`phase${i + 1}_tooltip`] = phase ? {
          description: phase.description,
          units: phase.units.join(', ')
        } : null;
      }
      
      return row;
    });
  }, [phaseDataByTranscript, maxPhases, activeTranscriptId]);

  // Create column definitions
  const columnDefs = useMemo<ColDef[]>(() => {
    const columns: ColDef[] = [
      {
        field: 'transcriptId',
        headerName: 'Transcript',
        pinned: 'left',
        width: 120,
        cellClass: (params) => params.data.isActive ? 'font-bold text-light-accent dark:text-dark-accent' : ''
      }
    ];
    
    // Add a column for each phase
    for (let i = 0; i < maxPhases; i++) {
      columns.push({
        field: `phase${i + 1}`,
        headerName: `Phase ${i + 1}`,
        width: 150,
        tooltipField: `phase${i + 1}_tooltip`,
        tooltipComponent: 'customTooltip',
        cellClass: (params) => {
          const value = params.value;
          if (!value || value === '-') return 'text-light-sidenote dark:text-dark-sidenote';
          
          // Color-code common phase names
          const lowerValue = value.toLowerCase();
          if (lowerValue.includes('beginning') || lowerValue.includes('initial')) {
            return 'bg-green-100 dark:bg-green-900';
          } else if (lowerValue.includes('core') || lowerValue.includes('peak')) {
            return 'bg-blue-100 dark:bg-blue-900';
          } else if (lowerValue.includes('end') || lowerValue.includes('resolution') || lowerValue.includes('reflection')) {
            return 'bg-purple-100 dark:bg-purple-900';
          } else if (lowerValue.includes('transition')) {
            return 'bg-yellow-100 dark:bg-yellow-900';
          }
          return '';
        }
      });
    }
    
    return columns;
  }, [maxPhases]);

  // Custom tooltip component
  const CustomTooltip = useMemo(() => {
    return (props: any) => {
      const data = props.value;
      if (!data) return null;
      
      return (
        <div className="p-3 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded shadow-lg">
          <div className="font-semibold mb-2">Description:</div>
          <div className="text-sm mb-3">{data.description}</div>
          <div className="font-semibold mb-1">Units Involved:</div>
          <div className="text-sm">{data.units || 'None'}</div>
        </div>
      );
    };
  }, []);

  const gridOptions: GridOptions = {
    components: {
      customTooltip: CustomTooltip
    },
    defaultColDef: {
      sortable: true,
      resizable: true,
      suppressMovable: true
    },
    tooltipShowDelay: 200,
    tooltipMouseTrack: true,
    rowHeight: 40,
    headerHeight: 45,
    animateRows: true,
    suppressCellFocus: true
  };

  // Export functionality
  const handleExport = () => {
    const csvData = rowData.map(row => {
      const csvRow: any = { Transcript: row.transcriptId };
      for (let i = 0; i < maxPhases; i++) {
        csvRow[`Phase ${i + 1}`] = row[`phase${i + 1}`] || '-';
      }
      return csvRow;
    });
    
    const csvContent = csvData.map(row => 
      Object.values(row).map(v => `"${v}"`).join(',')
    ).join('\n');
    
    const header = Object.keys(csvData[0]).join(',');
    const fullCsv = header + '\n' + csvContent;
    
    downloadCSV(fullCsv, 'diachronic_comparison.csv');
  };

  if (phaseDataByTranscript.length === 0) {
    return (
      <div className="p-4 text-center text-light-sidenote dark:text-dark-sidenote">
        No diachronic structures available yet. Process transcripts with Part 1.4 to see comparison.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Comparative Diachronic Phases</h3>
        <button
          onClick={handleExport}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Download CSV
        </button>
      </div>
      
      <div className="text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
        Hover over phase names to see descriptions and units involved. Common phase types are color-coded.
      </div>
      
      <div 
        className="ag-theme-alpine dark:ag-theme-alpine-dark w-full" 
        style={{ height: Math.min(400, 100 + rowData.length * 40) }}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          gridOptions={gridOptions}
        />
      </div>
    </div>
  );
};