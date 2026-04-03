import React, { useMemo, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P1_1_Output, SegmentedUtteranceSegment } from '../../types';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface InitialSegmentationTableProps {
  segmentationData: P1_1_Output;
  theme: 'light' | 'dark';
  onSegmentationChange?: (updatedData: P1_1_Output) => void;
  filename?: string;
}

interface SegmentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  utteranceData: {
    lineNum: string;
    speaker?: string;
    text: string;
    segments: SegmentedUtteranceSegment[];
  };
  onSave: (segments: SegmentedUtteranceSegment[]) => void;
  theme: 'light' | 'dark';
}

// Modal component for editing segments
const SegmentEditModal: React.FC<SegmentEditModalProps> = ({
  isOpen,
  onClose,
  utteranceData,
  onSave,
  theme
}) => {
  const [segments, setSegments] = useState<SegmentedUtteranceSegment[]>(utteranceData.segments);

  React.useEffect(() => {
    setSegments(utteranceData.segments);
  }, [utteranceData.segments]);

  if (!isOpen) return null;

  const handleSegmentTextChange = (index: number, text: string) => {
    const updated = [...segments];
    updated[index] = { ...updated[index], segment_text: text };
    setSegments(updated);
  };

  const handleTemporalCuesChange = (index: number, cuesText: string) => {
    const updated = [...segments];
    const cues = cuesText.split(',').map(s => s.trim()).filter(s => s);
    updated[index] = { ...updated[index], temporal_cues: cues };
    setSegments(updated);
  };

  const addSegment = () => {
    const newId = `seg_${segments.length}`;
    setSegments([...segments, {
      segment_id: newId,
      segment_text: '',
      temporal_cues: []
    }]);
  };

  const removeSegment = (index: number) => {
    if (segments.length > 1) {
      setSegments(segments.filter((_, i) => i !== index));
    }
  };

  const handleSave = () => {
    onSave(segments);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className={`${theme === 'dark' ? 'bg-dark-bg text-dark-text' : 'bg-light-bg text-light-text'} 
        rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col`}>
        
        <div className="p-6 border-b border-light-border dark:border-dark-border">
          <h3 className="text-xl font-medium">
            Edit Segments - Line {utteranceData.lineNum}
            {utteranceData.speaker && ` (${utteranceData.speaker})`}
          </h3>
          <p className="mt-2 text-sm text-light-sidenote dark:text-dark-sidenote">
            "{utteranceData.text}"
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {segments.map((segment, index) => (
            <div key={index} className="p-4 border border-light-border dark:border-dark-border rounded-lg">
              <div className="flex justify-between items-start mb-3">
                <h4 className="font-medium">Segment {index + 1}</h4>
                {segments.length > 1 && (
                  <button
                    onClick={() => removeSegment(index)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Segment Text
                  </label>
                  <textarea
                    value={segment.segment_text}
                    onChange={(e) => handleSegmentTextChange(index, e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 
                      border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-light-accent 
                      dark:focus:ring-dark-accent"
                    rows={3}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Temporal Cues (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={(segment.temporal_cues || []).join(', ')}
                    onChange={(e) => handleTemporalCuesChange(index, e.target.value)}
                    placeholder="e.g., first, then, after"
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 
                      border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-light-accent 
                      dark:focus:ring-dark-accent"
                  />
                </div>
              </div>
            </div>
          ))}
          
          <button
            onClick={addSegment}
            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 
              rounded-lg hover:border-light-accent dark:hover:border-dark-accent transition-colors"
          >
            + Add Segment
          </button>
        </div>

        <div className="p-6 border-t border-light-border dark:border-dark-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded 
              hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-light-accent dark:bg-dark-accent text-white rounded 
              hover:opacity-90 transition-opacity"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

// Custom cell renderer for segments
const SegmentsRenderer: React.FC<ICellRendererParams> = (params) => {
  const segments: SegmentedUtteranceSegment[] = params.value || [];
  const onClick = params.onClick;
  
  if (segments.length === 0) {
    return <span className="text-gray-400 italic">No segments</span>;
  }

  const handleClick = () => {
    if (onClick && params.data) {
      onClick(params.data);
    }
  };

  return (
    <div 
      className="py-1 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 -mx-2 px-2 rounded"
      onClick={handleClick}
    >
      {segments.map((segment, index) => (
        <div key={segment.segment_id} className="mb-2 last:mb-0">
          <div className="flex items-start gap-2">
            <span className="text-xs font-mono text-light-accent dark:text-dark-accent">
              [{index + 1}]
            </span>
            <div className="flex-1">
              <div className="text-sm">{segment.segment_text}</div>
              {segment.temporal_cues && segment.temporal_cues.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {segment.temporal_cues.map((cue, idx) => (
                    <span key={idx} className="text-xs px-1.5 py-0.5 rounded bg-yellow-100 
                      dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200">
                      {cue}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="text-xs text-gray-500 mt-1">Click to edit</div>
    </div>
  );
};

export const InitialSegmentationTable: React.FC<InitialSegmentationTableProps> = ({
  segmentationData,
  theme,
  onSegmentationChange,
  filename
}) => {
  const [editingUtterance, setEditingUtterance] = useState<{
    lineNum: string;
    speaker?: string;
    text: string;
    segments: SegmentedUtteranceSegment[];
  } | null>(null);

  // Defensive check for data validity
  if (!segmentationData || !segmentationData.segmented_utterances) {
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        No segmentation data available
      </div>
    );
  }

  const handleSegmentClick = useCallback((utteranceData: any) => {
    setEditingUtterance({
      lineNum: utteranceData.original_line_num,
      speaker: utteranceData.speaker,
      text: utteranceData.utterance_text,
      segments: utteranceData.segments
    });
  }, []);

  const handleSegmentSave = useCallback((updatedSegments: SegmentedUtteranceSegment[]) => {
    if (onSegmentationChange && editingUtterance) {
      const updatedData = { ...segmentationData };
      const utteranceIndex = updatedData.segmented_utterances.findIndex(
        su => su.original_utterance.original_line_num === editingUtterance.lineNum
      );
      
      if (utteranceIndex !== -1) {
        updatedData.segmented_utterances[utteranceIndex] = {
          ...updatedData.segmented_utterances[utteranceIndex],
          segments: updatedSegments
        };
        onSegmentationChange(updatedData);
      }
    }
  }, [segmentationData, editingUtterance, onSegmentationChange]);

  const handleExportCSV = () => {
    const csvData: any[] = [];
    
    segmentationData.segmented_utterances.forEach(su => {
      su.segments.forEach((segment, index) => {
        csvData.push({
          'Line #': su.original_utterance.original_line_num,
          'Speaker': su.original_utterance.speaker || '',
          'Utterance Text': su.original_utterance.utterance_text,
          'Segment #': index + 1,
          'Segment ID': segment.segment_id,
          'Segment Text': segment.segment_text,
          'Temporal Cues': (segment.temporal_cues || []).join('; ')
        });
      });
    });

    const columns = [
      { field: 'Line #', headerName: 'Line #' },
      { field: 'Speaker', headerName: 'Speaker' },
      { field: 'Utterance Text', headerName: 'Utterance Text' },
      { field: 'Segment #', headerName: 'Segment #' },
      { field: 'Segment ID', headerName: 'Segment ID' },
      { field: 'Segment Text', headerName: 'Segment Text' },
      { field: 'Temporal Cues', headerName: 'Temporal Cues' }
    ];
    const csv = convertToCSV(csvData, columns);
    const defaultFilename = filename ? 
      `${filename.replace(/\.[^/.]+$/, '')}_P1.1_segmentation.csv` : 
      'P1.1_segmentation.csv';
    
    downloadCSV(csv, defaultFilename);
  };

  // Column definitions for the main grid
  const columnDefs: ColDef[] = useMemo(() => [
    {
      field: 'original_line_num',
      headerName: 'Line #',
      width: 80,
      cellClass: 'text-center font-mono text-xs text-light-sidenote dark:text-dark-sidenote'
    },
    {
      field: 'speaker',
      headerName: 'Speaker',
      width: 120,
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
      field: 'utterance_text',
      headerName: 'Utterance Text',
      flex: 1,
      wrapText: true,
      autoHeight: true,
      cellClass: 'py-2'
    },
    {
      field: 'segments',
      headerName: 'Segments & Temporal Cues',
      flex: 1.5,
      wrapText: true,
      autoHeight: true,
      cellRenderer: SegmentsRenderer,
      cellRendererParams: {
        onClick: handleSegmentClick
      },
      valueFormatter: (params: any) => {
        const segments = params.value as SegmentedUtteranceSegment[];
        if (!segments || segments.length === 0) return 'No segments';
        return `${segments.length} segment${segments.length !== 1 ? 's' : ''}`;
      }
    },
    {
      field: 'segment_count',
      headerName: '# Segs',
      width: 80,
      cellClass: 'text-center',
      cellRenderer: (params: ICellRendererParams) => {
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs 
            bg-light-bg-alt dark:bg-dark-bg-alt">
            {params.value}
          </span>
        );
      }
    }
  ], [handleSegmentClick]);

  const rowData = useMemo(() => {
    console.log('[P1.1] segmentationData:', segmentationData);
    console.log('[P1.1] segmented_utterances:', segmentationData.segmented_utterances);
    
    const data = segmentationData.segmented_utterances
      .filter(su => su && su.original_utterance) // Add defensive check
      .map(su => ({
        original_line_num: su.original_utterance.original_line_num,
        speaker: su.original_utterance.speaker,
        utterance_text: su.original_utterance.utterance_text,
        segments: su.segments || [],
        segment_count: su.segments?.length || 0
      }));
    
    console.log('[P1.1] rowData:', data);
    return data;
  }, [segmentationData]);

  const defaultColDef = useMemo(() => ({
    sortable: true,
    resizable: true,
    filter: true,
  }), []);

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
    <>
      <div className="mb-2 flex justify-between items-center">
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
          💡 Click on the segments column to edit individual segments and temporal cues.
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Download CSV
        </button>
      </div>
      
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
          defaultColDef={defaultColDef}
          rowHeight={80}
          animateRows={true}
          theme="legacy"
          rowSelection={{ mode: 'singleRow', enableClickSelection: false }}
        />
      </div>

      {editingUtterance && (
        <SegmentEditModal
          isOpen={!!editingUtterance}
          onClose={() => setEditingUtterance(null)}
          utteranceData={editingUtterance}
          onSave={handleSegmentSave}
          theme={theme}
        />
      )}
    </>
  );
};