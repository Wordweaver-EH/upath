import React, { useMemo, useCallback, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P1_2_Output, PhaseTaggedUtterance, PhaseTaggedSegment, StepId } from '../../types';
import { useGridChangeTracker } from '../hooks/useGridChangeTracker';
import { Button } from './ui';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface PhaseTaggingTableProps {
  phaseTaggingData: P1_2_Output;
  theme: 'light' | 'dark';
  onPhaseTaggingChange?: (updatedData: P1_2_Output) => void;
  filename?: string;
  transcriptId?: string;
}

// Phase colors mapping
const PHASE_COLORS = {
  'Initial State': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
  'Core Experience': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
  'Final Action': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200' },
  'Post-Hoc Reflection': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200' }
};

// Custom cell renderer for phase tags
const PhaseTagRenderer: React.FC<ICellRendererParams> = (params) => {
  const phase = params.value as string;
  const colors = PHASE_COLORS[phase as keyof typeof PHASE_COLORS] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200' };
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
      {phase}
    </span>
  );
};

// Custom cell renderer for temporal cues
const TemporalCuesRenderer: React.FC<ICellRendererParams> = (params) => {
  const cues: string[] = params.value || [];
  
  if (cues.length === 0) {
    return <span className="text-gray-400 italic">No cues</span>;
  }

  return (
    <div className="flex flex-wrap gap-1 py-1">
      {cues.map((cue, index) => (
        <span
          key={index}
          className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700"
          title={`Temporal cue: ${cue}`}
        >
          {cue}
        </span>
      ))}
    </div>
  );
};

export const PhaseTaggingTable: React.FC<PhaseTaggingTableProps> = ({
  phaseTaggingData,
  theme,
  onPhaseTaggingChange,
  filename,
  transcriptId
}) => {
  console.log('[P1.2] phaseTaggingData:', phaseTaggingData);
  
  // Defensive check for data validity
  if (!phaseTaggingData || !phaseTaggingData.phase_tagged_utterances) {
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        No phase tagging data available
      </div>
    );
  }

  // Calculate phase distribution
  const phaseDistribution = useMemo(() => {
    const distribution: Record<string, number> = {
      'Initial State': 0,
      'Core Experience': 0,
      'Final Action': 0,
      'Post-Hoc Reflection': 0
    };

    phaseTaggingData.phase_tagged_utterances.forEach(utterance => {
      utterance.segments.forEach(segment => {
        if (segment.coarse_phase && distribution.hasOwnProperty(segment.coarse_phase)) {
          distribution[segment.coarse_phase]++;
        }
      });
    });

    return distribution;
  }, [phaseTaggingData]);

  // Flatten the data for grid display
  const flattenedData = useMemo(() => {
    const rows: any[] = [];
    
    phaseTaggingData.phase_tagged_utterances.forEach((utterance: PhaseTaggedUtterance, uIndex) => {
      utterance.segments.forEach((segment: PhaseTaggedSegment, sIndex) => {
        rows.push({
          id: `${uIndex}-${sIndex}`, // Unique identifier for tracking
          utterance_line: utterance.original_utterance.original_line_num,
          utterance_text: utterance.original_utterance.utterance_text,
          segment_id: segment.segment_id,
          segment_text: segment.segment_text,
          temporal_cues: segment.temporal_cues,
          coarse_phase: segment.coarse_phase,
          // Store indices for updates
          utterance_index: uIndex,
          segment_index: sIndex
        });
      });
    });
    
    return rows;
  }, [phaseTaggingData]);

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
    stepId: StepId.P1_2_COARSE_PHASE_TAGGING,
    dataPath: 'phase_tagging',
    onSave: (changes) => {
      if (onPhaseTaggingChange) {
        // Apply changes back to the original structure
        const updatedData = { ...phaseTaggingData };
        
        changes.forEach(change => {
          // Find the row by its index (change.rowId is the row index)
          const rowData = displayData[change.rowId as number];
          if (rowData && change.field === 'coarse_phase') {
            const utterance = updatedData.phase_tagged_utterances[rowData.utterance_index];
            if (utterance && utterance.segments[rowData.segment_index]) {
              utterance.segments[rowData.segment_index].coarse_phase = change.newValue;
            }
          }
        });
        
        onPhaseTaggingChange(updatedData);
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
        field: 'utterance_line', 
        headerName: 'Line #',
        width: 80,
        cellClass: 'font-mono text-xs text-light-sidenote dark:text-dark-sidenote'
      },
      { 
        field: 'utterance_text', 
        headerName: 'Original Utterance',
        flex: 2,
        wrapText: true,
        autoHeight: true,
        cellClass: 'py-2 text-sm italic text-light-sidenote dark:text-dark-sidenote',
        tooltipField: 'utterance_text'
      },
      { 
        field: 'segment_id', 
        headerName: 'Segment ID',
        width: 120,
        cellClass: 'font-mono text-xs'
      },
      { 
        field: 'segment_text', 
        headerName: 'Segment Text',
        flex: 3,
        wrapText: true,
        autoHeight: true,
        cellClass: 'py-2'
      },
      { 
        field: 'temporal_cues', 
        headerName: 'Temporal Cues',
        flex: 1,
        wrapText: true,
        autoHeight: true,
        cellRenderer: TemporalCuesRenderer
      },
      { 
        field: 'coarse_phase', 
        headerName: 'Phase',
        width: 150,
        cellRenderer: PhaseTagRenderer,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: {
          values: ['Initial State', 'Core Experience', 'Final Action', 'Post-Hoc Reflection']
        }
      }
    ];

    return cols;
  }, []);

  const exportToCsv = useCallback(() => {
    const csvData = displayData.map(row => ({
      'Line Number': row.utterance_line,
      'Original Utterance': row.utterance_text,
      'Segment ID': row.segment_id,
      'Segment Text': row.segment_text,
      'Temporal Cues': row.temporal_cues?.join('; ') || '',
      'Phase': row.coarse_phase
    }));
    
    const columns = [
      { field: 'Line Number', headerName: 'Line Number' },
      { field: 'Original Utterance', headerName: 'Original Utterance' },
      { field: 'Segment ID', headerName: 'Segment ID' },
      { field: 'Segment Text', headerName: 'Segment Text' },
      { field: 'Temporal Cues', headerName: 'Temporal Cues' },
      { field: 'Phase', headerName: 'Phase' }
    ];
    
    const csv = convertToCSV(csvData, columns);
    const exportFilename = filename ? 
      `${filename.replace(/\.[^/.]+$/, '')}_P1.2_phase_tagging.csv` : 
      'P1.2_phase_tagging.csv';
    downloadCSV(csv, exportFilename);
  }, [displayData, filename]);

  return (
    <div className="space-y-4">
      {/* Phase distribution summary */}
      <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg">
        <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-3">
          Phase Distribution
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(phaseDistribution).map(([phase, count]) => {
            const colors = PHASE_COLORS[phase as keyof typeof PHASE_COLORS];
            return (
              <div key={phase} className="text-center">
                <div className={`rounded-lg p-3 ${colors.bg}`}>
                  <div className={`text-2xl font-bold ${colors.text}`}>{count}</div>
                  <div className={`text-xs ${colors.text}`}>{phase}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export button */}
      <div className="flex justify-end mb-2">
        <button
          onClick={exportToCsv}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Download CSV
        </button>
      </div>

      {/* Grid */}
      <div 
        className={`${theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'}`}
        style={{ 
          height: '600px',
          width: '100%',
          ...(theme === 'dark' ? {
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
          }) as React.CSSProperties
        }}
      >
        <AgGridReact
          rowData={displayData}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          animateRows={true}
          onCellValueChanged={trackChange}
          groupDisplayType="singleColumn"
          tooltipShowDelay={500}
          theme="legacy"
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

      {/* Instructions */}
      <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
        💡 Click on any Phase cell to change the phase assignment. Use Save to commit changes or Cancel to discard.
      </div>
    </div>
  );
};