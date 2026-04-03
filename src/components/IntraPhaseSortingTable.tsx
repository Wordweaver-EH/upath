import React, { useMemo, useCallback, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams, CellValueChangedEvent, RowClassParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P1_3_Output, SortedSegment, StepId } from '../../types';
import { ChevronDownIcon, ChevronRightIcon } from '../../constants';
import { useGridChangeTracker } from '../hooks/useGridChangeTracker';
import { Button } from './ui';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface IntraPhaseSortingTableProps {
  sortingData: P1_3_Output;
  theme: 'light' | 'dark';
  onSortingChange?: (updatedData: P1_3_Output) => void;
  filename?: string;
  transcriptId?: string;
}

// Phase colors mapping (same as P1.2)
const PHASE_COLORS = {
  'Initial State': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' },
  'Core Experience': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', border: 'border-green-300 dark:border-green-700' },
  'Final Action': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-300 dark:border-orange-700' },
  'Post-Hoc Reflection': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' }
};

// Custom renderer for chronological index
const ChronologicalIndexRenderer: React.FC<ICellRendererParams> = (params) => {
  const index = params.value as number;
  const phase = params.data.coarse_phase;
  const colors = PHASE_COLORS[phase as keyof typeof PHASE_COLORS] || { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-800 dark:text-gray-200' };
  
  return (
    <div className="flex items-center justify-center h-full">
      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${colors.bg} ${colors.text}`}>
        {index}
      </span>
    </div>
  );
};

// Custom renderer for temporal cues
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

// Phase summary component
const PhaseSummary: React.FC<{ 
  phase: string; 
  segments: SortedSegment[]; 
  isExpanded: boolean;
  onToggle: () => void;
  theme: 'light' | 'dark';
}> = ({ phase, segments, isExpanded, onToggle, theme }) => {
  const colors = PHASE_COLORS[phase as keyof typeof PHASE_COLORS];
  
  // Calculate stats
  const simultaneousGroups = segments.reduce((acc, seg) => {
    const index = seg.chronological_index;
    acc[index] = (acc[index] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  
  const simultaneousCount = Object.values(simultaneousGroups).filter(count => count > 1).length;
  
  return (
    <div 
      className={`mb-2 p-3 rounded-lg border-2 ${colors.bg} ${colors.border} cursor-pointer transition-all duration-200 hover:shadow-md`}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-gray-500 dark:text-gray-400">
            {isExpanded ? ChevronDownIcon : ChevronRightIcon}
          </span>
          <h3 className={`font-semibold text-lg ${colors.text}`}>{phase}</h3>
          <span className={`text-sm ${colors.text} opacity-75`}>
            ({segments.length} segments)
          </span>
        </div>
        <div className="flex gap-4 text-sm">
          <span className={`${colors.text} opacity-75`}>
            Index range: {Math.min(...segments.map(s => s.chronological_index))} - {Math.max(...segments.map(s => s.chronological_index))}
          </span>
          {simultaneousCount > 0 && (
            <span className={`${colors.text} opacity-75`}>
              {simultaneousCount} simultaneous groups
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export const IntraPhaseSortingTable: React.FC<IntraPhaseSortingTableProps> = ({
  sortingData,
  theme,
  onSortingChange,
  filename,
  transcriptId
}) => {
  console.log('[P1.3] sortingData:', sortingData);
  
  // State for expanded phases
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(
    new Set(['Initial State', 'Core Experience', 'Final Action', 'Post-Hoc Reflection'])
  );
  
  // Defensive check
  if (!sortingData || !sortingData.sorted_segments) {
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        No sorting data available
      </div>
    );
  }

  // Group segments by phase
  const segmentsByPhase = useMemo(() => {
    const grouped: Record<string, SortedSegment[]> = {
      'Initial State': [],
      'Core Experience': [],
      'Final Action': [],
      'Post-Hoc Reflection': []
    };
    
    sortingData.sorted_segments.forEach(segment => {
      if (grouped[segment.coarse_phase]) {
        grouped[segment.coarse_phase].push(segment);
      }
    });
    
    // Sort each phase by chronological index
    Object.keys(grouped).forEach(phase => {
      grouped[phase].sort((a, b) => a.chronological_index - b.chronological_index);
    });
    
    return grouped;
  }, [sortingData]);

  // Flatten data for display, adding unique IDs
  const flattenedData = useMemo(() => {
    return sortingData.sorted_segments.map((segment, index) => ({
      ...segment,
      id: segment.segment_id, // Use segment_id as unique identifier
      index: index, // Store original index
      utterance_line: segment.original_utterance.original_line_num,
      utterance_text: segment.original_utterance.utterance_text
    }));
  }, [sortingData]);

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
    stepId: StepId.P1_3_INTRA_PHASE_SORTING,
    dataPath: 'intra_phase_sorting',
    onSave: (changes) => {
      if (onSortingChange) {
        // Apply changes back to the original structure
        const updatedData = { ...sortingData };
        
        changes.forEach(change => {
          const rowData = displayData[change.rowId as number];
          if (rowData) {
            const segmentIndex = updatedData.sorted_segments.findIndex(
              s => s.segment_id === rowData.segment_id
            );
            if (segmentIndex !== -1) {
              updatedData.sorted_segments[segmentIndex] = {
                ...updatedData.sorted_segments[segmentIndex],
                [change.field]: change.newValue
              };
            }
          }
        });
        
        onSortingChange(updatedData);
      }
    }
  });

  // Reset data when input changes
  useEffect(() => {
    resetData(flattenedData);
  }, [flattenedData, resetData]);

  // Filter data based on expanded phases
  const rowData = useMemo(() => {
    return displayData.filter(segment => expandedPhases.has(segment.coarse_phase));
  }, [displayData, expandedPhases]);

  const columnDefs = useMemo(() => {
    const cols: ColDef[] = [
      { 
        field: 'chronological_index', 
        headerName: 'Index',
        width: 80,
        cellRenderer: ChronologicalIndexRenderer,
        editable: true,
        cellEditor: 'agNumberCellEditor',
        cellEditorParams: {
          min: 1,
          max: 100,
          precision: 0
        }
      },
      { 
        field: 'coarse_phase', 
        headerName: 'Phase',
        width: 140,
        cellClass: (params) => {
          const phase = params.value;
          const colors = PHASE_COLORS[phase as keyof typeof PHASE_COLORS];
          return colors ? `${colors.text} font-medium` : '';
        }
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
        flex: 2,
        wrapText: true,
        autoHeight: true,
        cellClass: 'py-2'
      },
      { 
        field: 'temporal_cues', 
        headerName: 'Temporal Cues',
        width: 200,
        wrapText: true,
        autoHeight: true,
        cellRenderer: TemporalCuesRenderer
      },
      { 
        field: 'placement_justification', 
        headerName: 'Placement Justification',
        flex: 1.5,
        wrapText: true,
        autoHeight: true,
        cellClass: 'py-2 text-sm italic',
        editable: true,
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3
        }
      },
      { 
        field: 'utterance_line', 
        headerName: 'Line #',
        width: 80,
        cellClass: 'font-mono text-xs text-light-sidenote dark:text-dark-sidenote'
      },
      { 
        field: 'utterance_text', 
        headerName: 'Original Utterance',
        flex: 1,
        wrapText: true,
        autoHeight: true,
        cellClass: 'py-2 text-sm italic text-light-sidenote dark:text-dark-sidenote',
        tooltipField: 'utterance_text'
      }
    ];

    return cols;
  }, []);

  const togglePhase = useCallback((phase: string) => {
    setExpandedPhases(prev => {
      const newSet = new Set(prev);
      if (newSet.has(phase)) {
        newSet.delete(phase);
      } else {
        newSet.add(phase);
      }
      return newSet;
    });
  }, []);

  const exportToCsv = useCallback(() => {
    const csvData = sortingData.sorted_segments.map(segment => ({
      'Phase': segment.coarse_phase,
      'Chronological Index': segment.chronological_index,
      'Segment ID': segment.segment_id,
      'Segment Text': segment.segment_text,
      'Temporal Cues': segment.temporal_cues?.join('; ') || '',
      'Placement Justification': segment.placement_justification,
      'Original Line': segment.original_utterance.original_line_num,
      'Original Utterance': segment.original_utterance.utterance_text
    }));
    
    const columns = [
      { field: 'Phase', headerName: 'Phase' },
      { field: 'Chronological Index', headerName: 'Chronological Index' },
      { field: 'Segment ID', headerName: 'Segment ID' },
      { field: 'Segment Text', headerName: 'Segment Text' },
      { field: 'Temporal Cues', headerName: 'Temporal Cues' },
      { field: 'Placement Justification', headerName: 'Placement Justification' },
      { field: 'Original Line', headerName: 'Original Line' },
      { field: 'Original Utterance', headerName: 'Original Utterance' }
    ];
    
    const csv = convertToCSV(csvData, columns);
    const exportFilename = filename ? 
      `${filename.replace(/\.[^/.]+$/, '')}_P1.3_intra_phase_sorting.csv` : 
      'P1.3_intra_phase_sorting.csv';
    downloadCSV(csv, exportFilename);
  }, [sortingData, filename]);

  // Row styling to highlight simultaneous events
  const getRowClass = useCallback((params: RowClassParams) => {
    const segmentsInPhase = segmentsByPhase[params.data.coarse_phase] || [];
    const sameIndexCount = segmentsInPhase.filter(s => s.chronological_index === params.data.chronological_index).length;
    
    if (sameIndexCount > 1) {
      return theme === 'dark' ? 'bg-yellow-900 bg-opacity-20' : 'bg-yellow-100 bg-opacity-50';
    }
    return '';
  }, [segmentsByPhase, theme]);

  // Grid styles
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
    <div className="space-y-4">
      {/* Phase summaries */}
      <div>
        {Object.entries(segmentsByPhase).map(([phase, segments]) => (
          segments.length > 0 && (
            <PhaseSummary
              key={phase}
              phase={phase}
              segments={segments}
              isExpanded={expandedPhases.has(phase)}
              onToggle={() => togglePhase(phase)}
              theme={theme}
            />
          )
        ))}
      </div>

      {/* Export button */}
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
          💡 Click on Index or Justification cells to edit. Segments with the same index are highlighted as simultaneous events. Use Save to commit changes or Cancel to discard.
        </div>
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
          ...gridStyles as React.CSSProperties
        }}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          animateRows={true}
          onCellValueChanged={trackChange}
          getRowClass={getRowClass}
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

      {/* Legend */}
      <div className="text-sm text-light-sidenote dark:text-dark-sidenote space-y-1">
        <div className="flex items-center gap-2">
          <div className={`w-4 h-4 rounded ${theme === 'dark' ? 'bg-yellow-900 bg-opacity-20' : 'bg-yellow-100 bg-opacity-50'}`}></div>
          <span>Simultaneous events (same chronological index within phase)</span>
        </div>
        <div>Click on phase headers to expand/collapse sections</div>
      </div>
    </div>
  );
};