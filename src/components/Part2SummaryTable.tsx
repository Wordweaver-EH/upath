import React, { useMemo, useRef, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { P2S4SummaryData, P2S4TableRow } from '../types/p2s4Types';
import { generateTableRows, generateAgGridRows } from '../utils/p2s4DataTransformer';
import MermaidDiagram from '../../components/MermaidDiagram';
import { NestedTooltip } from '../components/NestedTooltip';
import { ISUTooltip } from '../components/tooltips/ISUTooltip';
import { generateP2S4Html, downloadP2S4Html } from '../utils/p2s4HtmlExport';

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


export const Part2SummaryTable: React.FC<Part2SummaryTableProps> = ({ data, theme }) => {
  const gridRef = useRef<AgGridReact>(null);
  const [refreshKeys, setRefreshKeys] = React.useState<Record<string, number>>({});
  
  // Detect theme from DOM if not provided
  const effectiveTheme = theme || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  
  // Generate table rows for ag-grid
  const tableRows = useMemo(() => generateAgGridRows(data), [data]);

  // Export handler
  const handleExportHTML = useCallback(() => {
    const htmlContent = generateP2S4Html(data, effectiveTheme);
    downloadP2S4Html(htmlContent, data.filename);
  }, [data, effectiveTheme]);

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
      width: 350,
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
      minWidth: 400,
      resizable: true,
      autoHeight: true,
      wrapText: true,
      cellStyle: { padding: '8px' }
    }
  ], []);

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
      {/* Summary Stats and Export Button */}
      <div className="mb-4 flex justify-between items-start gap-4">
        <div className="flex-1 p-4 bg-light-bg-alt dark:bg-dark-bg-alt rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-light-text dark:text-dark-text">Summary Statistics</h3>
          <div className="flex gap-6 text-sm text-light-text dark:text-dark-text">
            <span>Total DUs: <strong>{data.totalDUs}</strong></span>
            <span>Total ISUs: <strong>{data.totalISUs}</strong></span>
            <span>Total Utterances: <strong>{data.totalUtterances}</strong></span>
          </div>
        </div>
        <button
          onClick={handleExportHTML}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors flex items-center gap-2"
          title="Export summary as HTML document"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export to HTML
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

      {/* Network Diagrams Section */}
      <div className="mt-8">
        <div className="mb-2">
          <div className="flex justify-between items-center mb-1">
            <h3 className="text-lg font-semibold text-light-text dark:text-dark-text">Network Diagrams</h3>
          <button
            onClick={() => {
              const newKeys: Record<string, number> = {};
              data.duRecords.forEach(du => {
                newKeys[du.id] = (refreshKeys[du.id] || 0) + 1;
              });
              setRefreshKeys(newKeys);
            }}
            className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
            title="Refresh all diagrams"
          >
            ↻ Refresh All
          </button>
          </div>
          <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
            Hover over DU names to explore ISU themes and utterances with nested tooltips.
          </div>
        </div>
        <div className="space-y-6">
          {data.duRecords.map((du, index) => (
            <div key={`${du.id}-container`} className="border border-light-border dark:border-dark-border rounded-lg p-4 bg-light-bg-alt dark:bg-dark-bg-alt">
              <div className="mb-3">
                <NestedTooltip
                  content={
                    du.isuThemes.size === 1 ? (
                      // Single ISU - show utterances directly
                      <div className="du-tooltip-content p-6">
                        <div className="font-bold text-light-accent dark:text-dark-accent mb-2">
                          {du.name}
                        </div>
                        <div className="text-sm text-light-text dark:text-dark-text mb-3">
                          {du.description}
                        </div>
                        {(() => {
                          const isu = Array.from(du.isuThemes.values())[0];
                          return (
                            <>
                              <div className="border-t border-light-border dark:border-dark-border pt-2 mb-3">
                                <div className="text-sm font-semibold mb-1">ISU: {isu.unitName}</div>
                                <div className="text-xs text-light-sidenote dark:text-dark-sidenote space-y-1">
                                  <div>Level {isu.level} • {isu.abstractionOp}</div>
                                  <div>{isu.intensionalDefinition}</div>
                                </div>
                              </div>
                              <div className="border-t border-light-border dark:border-dark-border pt-2">
                                <div className="font-semibold text-sm mb-2">Utterances ({isu.utterances.length}):</div>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                  {isu.utterances.map((utterance, idx) => (
                                    <div key={utterance.id} className="p-2 bg-light-bg-alt dark:bg-dark-bg-alt rounded">
                                      <div className="flex items-start gap-2">
                                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
                                          utterance.speaker === 'P' 
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                                            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                        }`}>
                                          {utterance.speaker}
                                        </span>
                                        <div className="flex-1">
                                          <div className="text-sm text-light-text dark:text-dark-text">
                                            {utterance.text}
                                          </div>
                                          <div className="text-xs text-light-sidenote dark:text-dark-sidenote mt-1">
                                            ID: {utterance.segmentId}
                                            {utterance.timestamp && <span> • {utterance.timestamp}</span>}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      // Multiple ISUs - show with nested tooltips
                      <div className="du-tooltip-content p-6">
                        <div className="font-bold text-light-accent dark:text-dark-accent mb-2">
                          {du.name}
                        </div>
                        <div className="text-sm text-light-text dark:text-dark-text mb-3">
                          {du.description}
                        </div>
                        <div className="border-t border-light-border dark:border-dark-border pt-2">
                          <div className="font-semibold text-sm mb-2">ISU Themes ({du.isuThemes.size}):</div>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {Array.from(du.isuThemes.values()).map((isu) => (
                              <div key={isu.id} className="isu-item">
                                <NestedTooltip
                                  depth={1}
                                  content={<ISUTooltip isu={isu} duName={du.name} duDescription={du.description} />}
                                >
                                  <div className="p-2 bg-light-bg-alt dark:bg-dark-bg-alt rounded cursor-pointer hover:bg-light-border dark:hover:bg-dark-border transition-colors">
                                    <div className="font-semibold text-sm">
                                      {isu.unitName}
                                    </div>
                                    <div className="text-xs text-light-sidenote dark:text-dark-sidenote">
                                      Level {isu.level} • {isu.utterances.length} utterances
                                    </div>
                                    <div className="text-xs text-light-accent dark:text-dark-accent mt-1">
                                      {isu.abstractionOp}
                                    </div>
                                  </div>
                                </NestedTooltip>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  }
                >
                  <h4 className="text-base font-semibold text-light-text dark:text-dark-text cursor-pointer hover:text-light-primary dark:hover:text-dark-primary hover:underline transition-colors inline-block" title="Hover to view ISUs and utterances">
                    {du.name}
                  </h4>
                </NestedTooltip>
                <p className="text-sm text-light-sidenote dark:text-dark-sidenote italic mt-1">{du.description}</p>
              </div>
              <div className="flex">
                <div className="flex-1 relative">
                  <div className="w-full">
                    <MermaidDiagram 
                      key={`${du.id}-${refreshKeys[du.id] || 0}`} 
                      chart={du.networkDiagram.mermaidSyntax}
                      uniqueId={`${du.id}-${refreshKeys[du.id] || 0}`}
                    />
                  </div>
                </div>
                <div className="ml-4 text-sm text-light-sidenote dark:text-dark-sidenote">
                  <div>Nodes: {du.networkDiagram.nodeCount}</div>
                  <div>Links: {du.networkDiagram.linkCount}</div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(du.networkDiagram.mermaidSyntax).then(() => {
                          console.log('Mermaid code copied to clipboard');
                        });
                      }}
                      className="px-2 py-1 text-xs bg-light-bg dark:bg-dark-bg hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
                    >
                      Copy Code
                    </button>
                    <button
                      onClick={() => {
                        setRefreshKeys(prev => ({
                          ...prev,
                          [du.id]: (prev[du.id] || 0) + 1
                        }));
                      }}
                      className="px-2 py-1 text-xs bg-light-bg dark:bg-dark-bg hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
                      title="Refresh diagram"
                    >
                      ↻ Refresh
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>


      {/* Custom styles for nested tooltips */}
      <style>{`
        /* Nested tooltip styles */
        .nested-tooltip {
          background: var(--tooltip-bg, #ffffff);
          color: var(--tooltip-text, #1a1a1a);
          border: 1px solid var(--tooltip-border, #e5e5e5);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
          max-width: 90vw;
          min-width: 300px;
          --tooltip-bg: #ffffff;
          --tooltip-text: #1a1a1a;
          --tooltip-border: #e5e5e5;
        }
        
        .dark .nested-tooltip {
          --tooltip-bg: #2a2a2a;
          --tooltip-text: #e5e5e5;
          --tooltip-border: #444444;
        }
        
        .nested-tooltip.depth-1 {
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.2);
        }
        
        .nested-tooltip.depth-2 {
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
        }
        
        .du-tooltip-content,
        .isu-tooltip-content,
        .utterance-tooltip-content {
          max-width: 600px;
        }
        
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>

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