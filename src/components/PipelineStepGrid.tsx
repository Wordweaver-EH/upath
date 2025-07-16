import React, { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { TranscriptProcessedData, StepId } from '../../types';
import { ChevronDownIcon, ChevronRightIcon } from '../../constants';
import { TabbedStepDisplay } from './TabbedStepDisplay';
import { TranscriptLinesTable } from './TranscriptLinesTable';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface ExpandableContentConfig {
  field: string;
  title: string;
  formatter?: (value: any) => React.ReactNode;
}

interface GridConfig {
  extractData: (processedData: Map<string, TranscriptProcessedData>) => any[];
  columns: ColDef[];
  expandableContent?: ExpandableContentConfig;
  height?: string;
}

interface PipelineStepGridProps {
  processedData: Map<string, TranscriptProcessedData>;
  stepId: StepId;
  theme: 'light' | 'dark';
}

// Configuration for each step's grid display
const STEP_GRID_CONFIGS: Partial<Record<StepId, GridConfig>> = {
  [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]: {
    extractData: (processedData) => {
      return Array.from(processedData.entries())
        .filter(([_, data]) => data.p_neg1_1_output)
        .map(([id, data]) => ({
          filename: data.filename,
          independent_variable: data.p_neg1_1_output!.independent_variable_details,
          dependent_variables: data.p_neg1_1_output!.dependent_variable_focus.join(', ')
        }));
    },
    columns: [
      { 
        field: 'filename', 
        headerName: 'Filename',
        width: 200,
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
      },
      { 
        field: 'dependent_variables', 
        headerName: 'Dependent Variables',
        width: 250,
        wrapText: true,
        autoHeight: true,
        sortable: true,
        resizable: true
      }
    ]
  }
};

const ExpandableRow: React.FC<{
  data: any;
  config: ExpandableContentConfig;
  theme: 'light' | 'dark';
}> = ({ data, config, theme }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="border-t border-light-border dark:border-dark-border">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-light-bg-alt dark:hover:bg-dark-bg-alt transition-colors"
      >
        <span className="font-medium text-light-text dark:text-dark-text">
          {config.title}
        </span>
        <span className="text-light-sidenote dark:text-dark-sidenote">
          {isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
        </span>
      </button>
      {isExpanded && (
        <div className="p-4 pt-0 max-h-96 overflow-y-auto">
          {config.formatter ? config.formatter(data[config.field]) : (
            <pre className="text-xs whitespace-pre-wrap break-all">
              {JSON.stringify(data[config.field], null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};

export const PipelineStepGrid: React.FC<PipelineStepGridProps> = ({ 
  processedData, 
  stepId,
  theme 
}) => {
  const [selectedRow, setSelectedRow] = useState<any>(null);
  
  // Special handling for P0_1 with tabbed display
  if (stepId === StepId.P0_1_TRANSCRIPTION_ADHERENCE) {
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          return Array.from(data.entries())
            .filter(([_, transcript]) => transcript.p0_1_output)
            .map(([id, transcript]) => ({
              id,
              label: transcript.filename,
              data: {
                lines: transcript.p0_1_output!.line_numbered_transcript,
                transcriptId: transcript.p0_1_output!.transcript_id,
                initialImpressions: transcript.p0_1_output!.initial_impressions_log,
                conventionNotes: transcript.p0_1_output!.transcription_convention_notes
              }
            }));
        }}
        renderContent={(tabData, theme) => (
          <div className="space-y-4">
            {/* Metadata section */}
            <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg space-y-3">
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                  Transcript ID
                </h4>
                <p className="text-light-text dark:text-dark-text">
                  {tabData.transcriptId}
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                  Transcription Convention Notes
                </h4>
                <p className="text-light-text dark:text-dark-text text-sm">
                  {tabData.conventionNotes}
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                  Initial Impressions
                </h4>
                <p className="text-light-text dark:text-dark-text text-sm">
                  {tabData.initialImpressions}
                </p>
              </div>
            </div>
            
            {/* Transcript lines table */}
            <div>
              <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
                Line-Numbered Transcript
              </h4>
              <TranscriptLinesTable lines={tabData.lines} theme={theme} />
            </div>
          </div>
        )}
        theme={theme}
        emptyMessage="No transcripts with P0.1 output available"
      />
    );
  }
  
  const config = STEP_GRID_CONFIGS[stepId];
  
  if (!config) {
    // Fallback to JSON display if no config
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        No grid configuration for this step. Displaying raw data.
      </div>
    );
  }
  
  const { rowData, columnDefs } = useMemo(() => {
    const data = config.extractData(processedData);
    return { rowData: data, columnDefs: config.columns };
  }, [processedData, config]);

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
  };

  return (
    <div className="space-y-4">
      <div 
        className={theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} 
        style={{ 
          height: config.height || '400px', 
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
          onRowClicked={(event) => {
            if (config.expandableContent) {
              setSelectedRow(event.data);
            }
          }}
          rowSelection={config.expandableContent ? 'single' : undefined}
        />
      </div>
      
      {config.expandableContent && selectedRow && (
        <div className="bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-lg">
          <ExpandableRow 
            data={selectedRow} 
            config={config.expandableContent} 
            theme={theme} 
          />
        </div>
      )}
    </div>
  );
};