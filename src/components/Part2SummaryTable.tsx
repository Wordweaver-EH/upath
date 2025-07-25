import React, { useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { P2S4SummaryData, P2S4TableRow } from '../types/p2s4Types';
import { generateTableRows, generateAgGridRows } from '../utils/p2s4DataTransformer';
import MermaidDiagram from '../../components/MermaidDiagram';
import { convertToCSV, downloadCSV } from '../utils/csvExport';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface Part2SummaryTableProps {
  data: P2S4SummaryData;
  theme: 'light' | 'dark';
}

// DU Cell Renderer
const DUCellRenderer: React.FC<ICellRendererParams> = ({ data }) => {
  if (!data.duName) return null;
  
  return (
    <div className="h-full p-2">
      <div className="font-semibold mb-1 text-light-text dark:text-dark-text">{data.duName}</div>
      <div className="text-sm text-light-text dark:text-dark-text">
        <div className="mb-1 text-light-sidenote dark:text-dark-sidenote italic break-words whitespace-normal">{data.duDescription}</div>
        <div>Segments: {data.duSegmentCount}</div>
      </div>
    </div>
  );
};

// ISU Cell Renderer
const ISUCellRenderer: React.FC<ICellRendererParams> = ({ data }) => {
  if (!data.isuName) return null;
  
  return (
    <div className="p-2">
      <div className="mb-1">
        {data.isuIsChild && <span className="text-light-sidenote dark:text-dark-sidenote mr-1">└─</span>}
        <span className="font-semibold text-light-text dark:text-dark-text">{data.isuName}</span>
        {data.isuLevel && (
          <span className="text-sm text-light-sidenote dark:text-dark-sidenote ml-2">(Level {data.isuLevel})</span>
        )}
      </div>
      {data.isuAbstractionOp && (
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
          <div>Abstraction: {data.isuAbstractionOp}</div>
          <div className="mt-1">Definition: {data.isuDefinition}</div>
        </div>
      )}
    </div>
  );
};

// Utterance Cell Renderer
const UtteranceCellRenderer: React.FC<ICellRendererParams> = ({ data }) => {
  if (!data.utteranceText) return null;
  
  return (
    <div className="p-2">
      <div className="flex items-start gap-2">
        {data.utteranceSpeaker && (
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
            data.utteranceSpeaker === 'P' 
              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }`}>
            {data.utteranceSpeaker}
          </span>
        )}
        <div className="flex-1">
          <div className="text-sm text-light-text dark:text-dark-text">{data.utteranceText}</div>
          {data.utteranceSegmentId && (
            <div className="text-xs text-light-sidenote dark:text-dark-sidenote mt-1">ID: {data.utteranceSegmentId}</div>
          )}
          {data.utteranceTimestamp && (
            <div className="text-xs text-light-sidenote dark:text-dark-sidenote">Time: {data.utteranceTimestamp}</div>
          )}
        </div>
      </div>
    </div>
  );
};

// Network Diagram Cell Renderer
const NetworkDiagramCellRenderer: React.FC<ICellRendererParams> = ({ data }) => {
  if (!data.networkMermaid) return null;
  
  const handleCopyMermaidCode = () => {
    navigator.clipboard.writeText(data.networkMermaid).then(() => {
      console.log('Mermaid code copied to clipboard');
    });
  };
  
  return (
    <div className="p-2">
      <div>
        <div className="mb-2" style={{ maxWidth: '300px', maxHeight: '200px', overflow: 'auto' }}>
          <MermaidDiagram chart={data.networkMermaid} />
        </div>
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
          <div>Nodes: {data.networkNodeCount}</div>
          <div>Links: {data.networkLinkCount}</div>
        </div>
        <button
          onClick={handleCopyMermaidCode}
          className="mt-2 px-2 py-1 text-xs bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Copy Mermaid Code
        </button>
      </div>
    </div>
  );
};

export const Part2SummaryTable: React.FC<Part2SummaryTableProps> = ({ data, theme }) => {
  const gridRef = useRef<AgGridReact>(null);
  
  // Generate table rows for ag-grid
  const tableRows = useMemo(() => generateAgGridRows(data), [data]);

  // Column definitions
  const columnDefs: ColDef[] = useMemo(() => [
    {
      field: 'duName',
      headerName: 'Diachronic Unit',
      cellRenderer: DUCellRenderer,
      width: 250,
      minWidth: 100,
      resizable: true,
      autoHeight: true,
      wrapText: true,
      cellClass: (params) => params.data._isLastDURow ? 'last-du-row' : '',
      cellStyle: { padding: '8px', whiteSpace: 'normal' }
    },
    {
      field: 'isuName',
      headerName: 'ISU Themes',
      cellRenderer: ISUCellRenderer,
      width: 300,
      minWidth: 250,
      resizable: true,
      autoHeight: true,
      cellClass: (params) => params.data._isFirstISURow ? 'first-isu-row' : '',
      cellStyle: { padding: '8px' }
    },
    {
      field: 'utteranceText',
      headerName: 'Utterances',
      cellRenderer: UtteranceCellRenderer,
      flex: 1,
      minWidth: 300,
      resizable: true,
      autoHeight: true,
      wrapText: true,
      cellStyle: { padding: '8px' }
    },
    {
      field: 'networkMermaid',
      headerName: 'Network Diagram',
      cellRenderer: NetworkDiagramCellRenderer,
      width: 350,
      minWidth: 300,
      resizable: true,
      autoHeight: true,
      cellClass: (params) => params.data._isLastDURow ? 'last-du-row' : '',
      cellStyle: { padding: '8px' }
    }
  ], []);

  // Export handlers
  const handleExportCSV = useCallback(() => {
    if (!gridRef.current) return;
    
    const csvData = tableRows.map(row => ({
      'DU Name': row.duName || '',
      'DU Description': row.duDescription || '',
      'DU Segments': row.duSegmentCount || '',
      'ISU Name': row.isuName || '',
      'ISU Level': row.isuLevel || '',
      'ISU Abstraction': row.isuAbstractionOp || '',
      'ISU Definition': row.isuDefinition || '',
      'Speaker': row.utteranceSpeaker || '',
      'Utterance': row.utteranceText || '',
      'Segment ID': row.utteranceSegmentId || '',
      'Timestamp': row.utteranceTimestamp || '',
      'Network Nodes': row.networkNodeCount || '',
      'Network Links': row.networkLinkCount || ''
    }));
    
    const csv = convertToCSV(csvData);
    downloadCSV(csv, `p2s4_summary_${data.transcriptId}_${new Date().toISOString().split('T')[0]}.csv`);
  }, [tableRows, data.transcriptId]);

  const handleExportPDF = useCallback(() => {
    window.print();
  }, []);

  // Detect theme from DOM if not provided
  const effectiveTheme = theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

  // If no data, show empty state
  if (data.duRecords.length === 0) {
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        No synchronic analysis data available. Please run P2S.1, P2S.2, and P2S.3 first.
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Summary Stats */}
      <div className="mb-4 p-4 bg-light-bg-alt dark:bg-dark-bg-alt rounded-lg">
        <h3 className="text-lg font-semibold mb-2 text-light-text dark:text-dark-text">Summary Statistics</h3>
        <div className="flex gap-6 text-sm text-light-text dark:text-dark-text">
          <span>Total DUs: <strong>{data.totalDUs}</strong></span>
          <span>Total ISUs: <strong>{data.totalISUs}</strong></span>
          <span>Total Utterances: <strong>{data.totalUtterances}</strong></span>
        </div>
      </div>

      {/* Export Buttons */}
      <div className="mb-4 flex justify-end gap-2">
        <button
          onClick={handleExportCSV}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Export to CSV
        </button>
        <button
          onClick={handleExportPDF}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Export to PDF
        </button>
      </div>

      {/* AG Grid Table */}
      <div 
        className={`${effectiveTheme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} w-full`}
        style={{ minHeight: 400 }}
      >
        <AgGridReact
          ref={gridRef}
          rowData={tableRows}
          columnDefs={columnDefs}
          domLayout="autoHeight"
          suppressRowTransform={true}
          animateRows={false}
          suppressCellFocus={true}
          theme="legacy"
          onGridReady={(params) => {
            params.api.sizeColumnsToFit();
          }}
        />
      </div>

      {/* Custom styles for visual grouping and column borders */}
      <style jsx>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .no-print {
            display: none !important;
          }
        }
        
        /* Base theme settings - remove ALL borders */
        :global(.ag-theme-alpine),
        :global(.ag-theme-alpine-dark) {
          font-family: "EB Garamond", "et-book", serif;
          --ag-borders: none !important;
          --ag-border-color: transparent !important;
          --ag-row-border-style: none !important;
          --ag-row-border-width: 0 !important;
          --ag-row-border-color: transparent !important;
          --ag-cell-horizontal-border: none !important;
          --ag-cell-horizontal-border-color: transparent !important;
          --ag-borders-row: none !important;
          --ag-borders-cell: none !important;
        }
        
        /* Remove wrapper border */
        :global(.ag-root-wrapper) {
          border: none !important;
        }
        
        /* Remove ALL borders from rows - comprehensive */
        :global(.ag-theme-alpine .ag-row),
        :global(.ag-theme-alpine-dark .ag-row),
        :global(.ag-row) {
          border: none !important;
          border-bottom: none !important;
          border-top: none !important;
          outline: none !important;
        }
        
        /* Remove row hover borders */
        :global(.ag-row-hover),
        :global(.ag-row-selected),
        :global(.ag-row-focus) {
          border: none !important;
          outline: none !important;
        }
        
        :global(.ag-theme-alpine .ag-row-even),
        :global(.ag-theme-alpine .ag-row-odd),
        :global(.ag-theme-alpine-dark .ag-row-even),
        :global(.ag-theme-alpine-dark .ag-row-odd) {
          background-color: transparent !important;
          border: none !important;
        }
        
        /* Remove ALL borders from cells - comprehensive */
        :global(.ag-theme-alpine .ag-cell),
        :global(.ag-theme-alpine-dark .ag-cell),
        :global(.ag-cell) {
          border: none !important;
          border-bottom: none !important;
          border-right: none !important;
          border-left: none !important;
          border-top: none !important;
          outline: none !important;
        }
        
        /* Remove cell focus borders */
        :global(.ag-cell-focus),
        :global(.ag-cell-no-focus) {
          border: none !important;
          outline: none !important;
        }
        
        /* Keep header bottom border only */
        :global(.ag-theme-alpine .ag-header-cell),
        :global(.ag-theme-alpine-dark .ag-header-cell) {
          border: none !important;
          border-bottom: 1px solid ${effectiveTheme === 'dark' ? '#444444' : '#dcd9d0'} !important;
        }
        
        :global(.ag-theme-alpine .ag-cell-wrapper),
        :global(.ag-theme-alpine-dark .ag-cell-wrapper) {
          line-height: normal !important;
        }
      `}</style>
      
      {/* Additional global styles to ensure borders are removed */}
      <style>{`
        .ag-theme-alpine .ag-row,
        .ag-theme-alpine-dark .ag-row {
          border-bottom: none !important;
          border-top: none !important;
        }
        
        .ag-theme-alpine .ag-cell,
        .ag-theme-alpine-dark .ag-cell {
          border: none !important;
        }
        
        /* Force remove borders with high specificity */
        div.ag-root-wrapper div.ag-root div.ag-body-viewport div.ag-center-cols-container div.ag-row {
          border: none !important;
          border-bottom: none !important;
        }
        
        div.ag-root-wrapper div.ag-root div.ag-body-viewport div.ag-center-cols-container div.ag-row div.ag-cell {
          border: none !important;
          border-bottom: none !important;
        }
      `}</style>
    </div>
  );
};