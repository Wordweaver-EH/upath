import React, { useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridOptions, ICellRendererParams } from 'ag-grid-community';
import { usePipelineStore } from '../stores/pipelineStore';
import { P1_4_Output, TranscriptProcessedData } from '../types';
import { downloadCSV } from '../utils/csvExport';
import { NestedTooltip } from './NestedTooltip';
import { PhaseTooltip } from './tooltips/PhaseTooltip';
import { tracePhaseToUtterances } from '../utils/phaseTracingHelper';

interface PhaseData {
  transcriptId: string;
  phases: {
    name: string;
    description: string;
    units: string[];
  }[];
}

interface DiachronicComparisonTableProps {
  theme?: 'light' | 'dark';
}

export const DiachronicComparisonTable: React.FC<DiachronicComparisonTableProps> = ({ theme }) => {
  const processedData = usePipelineStore(state => state.processedData);
  const activeTranscriptId = usePipelineStore(state => state.activeTranscriptId);
  
  // Detect theme from DOM if not provided
  const effectiveTheme = theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  
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
        cellRenderer: 'phaseCellRenderer'
      });
    }
    
    return columns;
  }, [maxPhases]);

  // Custom cell renderer with nested tooltips
  const PhaseCellRenderer = useCallback((params: ICellRendererParams) => {
    const { value, data, colDef } = params;
    if (!value || value === '-') {
      return <span className="text-light-sidenote dark:text-dark-sidenote">-</span>;
    }

    // Extract phase index from field name (e.g., "phase1" -> 0)
    const phaseIndex = parseInt(colDef.field?.replace('phase', '') || '1') - 1;
    const transcriptId = data.transcriptId;
    const transcriptData = processedData.get(transcriptId);
    
    if (!transcriptData) {
      return <span>{value}</span>;
    }

    // Get phase trace data
    const phaseTrace = tracePhaseToUtterances(value, transcriptData);
    
    if (!phaseTrace) {
      return <span>{value}</span>;
    }

    // Determine color class based on phase name
    let colorClass = '';
    const lowerValue = value.toLowerCase();
    if (lowerValue.includes('beginning') || lowerValue.includes('initial')) {
      colorClass = 'phase-beginning';
    } else if (lowerValue.includes('core') || lowerValue.includes('peak')) {
      colorClass = 'phase-core';
    } else if (lowerValue.includes('end') || lowerValue.includes('resolution') || lowerValue.includes('reflection')) {
      colorClass = 'phase-ending';
    } else if (lowerValue.includes('transition')) {
      colorClass = 'phase-transition';
    }

    return (
      <NestedTooltip
        content={<PhaseTooltip phaseTrace={phaseTrace} transcriptId={transcriptId} />}
      >
        <div className={`w-full h-full flex items-center justify-center px-2 py-1 cursor-pointer ${colorClass}`}>
          {value}
        </div>
      </NestedTooltip>
    );
  }, [processedData]);

  const gridOptions: GridOptions = {
    theme: 'legacy',
    components: {
      phaseCellRenderer: PhaseCellRenderer
    },
    defaultColDef: {
      sortable: true,
      resizable: true,
      suppressMovable: true
    },
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
        className={`${effectiveTheme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} w-full`}
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