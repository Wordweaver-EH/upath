import React, { useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P1_2_Output, P1_1_Output, DiachronicUnitP1_2 } from '../../types';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface DiachronicUnitTableProps {
  diachronicData: P1_2_Output;
  segmentationData?: P1_1_Output; // Optional, for showing segment details in tooltips
  theme: 'light' | 'dark';
  onDiachronicChange?: (updatedData: P1_2_Output) => void;
  filename?: string;
}

// Custom cell renderer for source segment IDs
const SourceSegmentsRenderer: React.FC<ICellRendererParams> = (params) => {
  const segmentIds: string[] = params.value || [];
  
  if (segmentIds.length === 0) {
    return <span className="text-gray-400 italic">No segments</span>;
  }

  return (
    <div className="flex flex-wrap gap-1 py-1">
      {segmentIds.map((id, index) => (
        <span
          key={index}
          className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono"
          title={`Segment ID: ${id}`}
        >
          {id}
        </span>
      ))}
    </div>
  );
};

export const DiachronicUnitTable: React.FC<DiachronicUnitTableProps> = ({
  diachronicData,
  segmentationData,
  theme,
  onDiachronicChange,
  filename
}) => {
  // Defensive check for data validity
  if (!diachronicData || !diachronicData.diachronic_units) {
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        No diachronic data available
      </div>
    );
  }

  const { rowData, columnDefs } = useMemo(() => {
    const cols: ColDef[] = [
      { 
        field: 'unit_id', 
        headerName: 'Unit ID',
        width: 100,
        cellClass: 'font-mono text-xs text-light-sidenote dark:text-dark-sidenote'
      },
      { 
        field: 'description', 
        headerName: 'Description',
        flex: 2,
        wrapText: true,
        autoHeight: true,
        editable: true,
        cellClass: 'py-2',
        cellEditor: 'agLargeTextCellEditor',
        cellEditorParams: {
          maxLength: 500,
          rows: 3
        }
      },
      { 
        field: 'source_segment_ids', 
        headerName: 'Source Segment IDs',
        flex: 1,
        wrapText: true,
        autoHeight: true,
        cellRenderer: SourceSegmentsRenderer,
        valueFormatter: (params) => {
          const ids = params.value as string[];
          return ids ? ids.join(', ') : '';
        }
      },
      { 
        field: 'segment_count', 
        headerName: '# Segments',
        width: 100,
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
    ];

    const rows = diachronicData.diachronic_units.map(unit => ({
      unit_id: unit.unit_id,
      description: unit.description,
      source_segment_ids: unit.source_segment_ids,
      segment_count: unit.source_segment_ids.length
    }));

    return { rowData: rows, columnDefs: cols };
  }, [diachronicData]);

  const handleCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    if (event.colDef.field === 'description' && onDiachronicChange) {
      const updatedData = { ...diachronicData };
      const unitIndex = updatedData.diachronic_units.findIndex(
        u => u.unit_id === event.data.unit_id
      );
      
      if (unitIndex !== -1) {
        updatedData.diachronic_units[unitIndex] = {
          ...updatedData.diachronic_units[unitIndex],
          description: event.newValue
        };
        onDiachronicChange(updatedData);
      }
    }
  }, [diachronicData, onDiachronicChange]);

  const handleExportCSV = () => {
    const csvData = diachronicData.diachronic_units.map(unit => ({
      'Unit ID': unit.unit_id,
      'Description': unit.description,
      'Source Segment IDs': unit.source_segment_ids.join('; '),
      'Segment Count': unit.source_segment_ids.length
    }));

    const csv = convertToCSV(csvData);
    const defaultFilename = filename ? 
      `${filename.replace(/\.[^/.]+$/, '')}_P1.2_diachronic_units.csv` : 
      'P1.2_diachronic_units.csv';
    
    downloadCSV(csv, defaultFilename);
  };

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

  // Helper function to get segment text for tooltip (if segmentationData is provided)
  const getSegmentTooltip = useCallback((segmentId: string) => {
    if (!segmentationData) return segmentId;
    
    for (const su of segmentationData.segmented_utterances) {
      const segment = su.segments.find(s => s.segment_id === segmentId);
      if (segment) {
        return `${segmentId}: ${segment.segment_text.substring(0, 100)}...`;
      }
    }
    return segmentId;
  }, [segmentationData]);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-2 flex justify-between items-center">
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
          💡 Click on description cells to edit them directly. Changes are saved automatically.
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3 py-1 text-sm bg-light-accent dark:bg-dark-accent text-white rounded 
            hover:opacity-90 transition-opacity"
        >
          Download CSV
        </button>
      </div>
      
      <div 
        className={`${theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} flex-1`}
        style={{ 
          minHeight: '400px',
          ...gridStyles as React.CSSProperties
        }}
      >
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowHeight={60}
          animateRows={true}
          theme="legacy"
          rowSelection={{ mode: 'singleRow', enableClickSelection: false }}
          onCellValueChanged={handleCellValueChanged}
        />
      </div>
    </div>
  );
};