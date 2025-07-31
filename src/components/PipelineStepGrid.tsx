import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams, CellValueChangedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { TranscriptProcessedData, StepId } from '../../types';
import { ChevronDownIcon, ChevronRightIcon } from '../../constants';
import { TabbedStepDisplay } from './TabbedStepDisplay';
import { TranscriptLinesTable } from './TranscriptLinesTable';
import { RefinedDataTable } from './RefinedDataTable';
import { SelectedUtterancesTable } from './SelectedUtterancesTable';
import { InitialSegmentationTable } from './InitialSegmentationTable';
import { DiachronicUnitTable } from './DiachronicUnitTable';
import { PhaseTaggingTable } from './PhaseTaggingTable';
import { IntraPhaseSortingTable } from './IntraPhaseSortingTable';
import { DiachronicUnitGroupingTable } from './DiachronicUnitGroupingTableEnhanced';
import { RefinedDiachronicUnitTable } from './RefinedDiachronicUnitTable';
import { TemporalPhaseAssignmentTable } from './TemporalPhaseAssignmentTable';
import { EditableTextArea } from './EditableTextArea';
import { usePipelineStore } from '../stores/pipelineStore';
import { useSettingsStore } from '../stores/settingsStore';
import MermaidDiagram from '../../components/MermaidDiagram';
import { DiachronicComparisonTable } from './DiachronicComparisonTable';
import { DiachronicStructureComparison } from './DiachronicStructureComparison';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { NestedTooltip } from './NestedTooltip';
import { RduTooltip } from './tooltips/RduTooltip';
import { SynchronicThematicGroupingTable } from './SynchronicThematicGroupingTable';
import { SpecificSynchronicUnitsTable } from './SpecificSynchronicUnitsTable';
import { SpecificSynchronicStructureNetwork } from './SpecificSynchronicStructureNetwork';
import { Part2SummaryTable } from './Part2SummaryTable';
import { useGridChangeTracker } from '../hooks/useGridChangeTracker';
import { Button } from './ui';
import { transformP2SDataToSummary } from '../utils/p2s4DataTransformer';

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
          transcriptId: id,
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
        resizable: true,
        editable: false
      },
      { 
        field: 'independent_variable', 
        headerName: 'Independent Variable',
        flex: 1,
        wrapText: true,
        autoHeight: true,
        sortable: true,
        resizable: true,
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 500
        },
        cellClass: 'editable-cell'
      },
      { 
        field: 'dependent_variables', 
        headerName: 'Dependent Variables',
        width: 250,
        wrapText: true,
        autoHeight: true,
        sortable: true,
        resizable: true,
        editable: true,
        cellEditor: 'agTextCellEditor',
        cellEditorParams: {
          maxLength: 500
        },
        cellClass: 'editable-cell'
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

// Variable Identification Grid Component with change tracking
const VariableIdentificationGrid: React.FC<{
  processedData: Map<string, TranscriptProcessedData>;
  theme: 'light' | 'dark';
  config: GridConfig;
}> = ({ processedData, theme, config }) => {
  const updateProcessedData = usePipelineStore(state => state.updateProcessedData);
  
  // Extract data for the grid
  const initialData = useMemo(() => {
    return config.extractData(processedData);
  }, [config, processedData]);
  
  // Get transcript IDs for tracking
  const transcriptIds = useMemo(() => {
    return Array.from(processedData.keys()).filter(id => {
      const data = processedData.get(id);
      return data?.p_neg1_1_output;
    });
  }, [processedData]);
  
  // Use the grid change tracker hook
  const {
    displayData,
    onCellValueChanged: originalTrackChange,
    handleSave,
    handleCancel,
    hasPendingChanges,
    pendingChangesCount,
    resetData
  } = useGridChangeTracker(initialData, {
    transcriptId: 'multi-transcript', // Generic ID since we have multiple transcripts
    stepId: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
    dataPath: 'variable_identification',
    onSave: (changes) => {
      // Apply changes back to the store
      changes.forEach(change => {
        const rowData = displayData[change.rowId as number];
        if (rowData && rowData.transcriptId) {
          const transcriptData = processedData.get(rowData.transcriptId);
          if (transcriptData && transcriptData.p_neg1_1_output) {
            const updatedOutput = { ...transcriptData.p_neg1_1_output };
            
            if (change.field === 'independent_variable') {
              updatedOutput.independent_variable_details = change.newValue || '';
            } else if (change.field === 'dependent_variables') {
              // Split the comma-separated string back into an array
              updatedOutput.dependent_variable_focus = (change.newValue || '')
                .split(',')
                .map((s: string) => s.trim())
                .filter((s: string) => s.length > 0);
            }
            
            // Update the store
            updateProcessedData(rowData.transcriptId, {
              p_neg1_1_output: updatedOutput
            });
          }
        }
      });
    }
  });
  
  // Wrap the trackChange to include row-specific transcriptId
  const trackChange = useCallback((event: CellValueChangedEvent) => {
    // Add row data to the event for tracking
    const enhancedEvent = {
      ...event,
      rowData: event.data
    };
    originalTrackChange(enhancedEvent);
  }, [originalTrackChange]);
  
  // Reset data when input changes
  useEffect(() => {
    resetData(initialData);
  }, [initialData, resetData]);
  
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
  
  // Add editable cell styling
  const editableStyles = `
    .editable-cell {
      cursor: text !important;
      background-color: ${theme === 'dark' ? 'rgba(255, 107, 107, 0.05)' : 'rgba(160, 0, 0, 0.03)'} !important;
    }
    .editable-cell:hover {
      background-color: ${theme === 'dark' ? 'rgba(255, 107, 107, 0.1)' : 'rgba(160, 0, 0, 0.06)'} !important;
    }
    .ag-cell-editing {
      background-color: ${theme === 'dark' ? 'rgba(255, 107, 107, 0.15)' : 'rgba(160, 0, 0, 0.1)'} !important;
      border: 2px solid ${theme === 'dark' ? '#ff6b6b' : '#a00000'} !important;
    }
  `;
  
  return (
    <>
      <style>{editableStyles}</style>
      <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
        💡 Click on Independent Variable or Dependent Variables cells to edit them. Use Save to commit changes or Cancel to discard.
      </div>
      <div 
        className={theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} 
        style={{ 
          height: config.height || '400px', 
          width: '100%',
          ...gridStyles as React.CSSProperties
        }}
      >
        <AgGridReact
          rowData={displayData}
          columnDefs={config.columns}
          defaultColDef={{
            resizable: true,
            sortable: true
          }}
          animateRows={true}
          domLayout='normal'
          theme='legacy'
          onCellValueChanged={trackChange}
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
    </>
  );
};

export const PipelineStepGrid: React.FC<PipelineStepGridProps> = ({ 
  processedData, 
  stepId,
  theme 
}) => {
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const updateProcessedData = usePipelineStore(state => state.updateProcessedData);
  const debugMode = useSettingsStore(state => state.debugMode);
  
  // Debug mode - show raw JSON
  if (debugMode) {
    const debugData = {
      stepId: stepId,
      processedData: processedData.size > 0 ? Object.fromEntries(processedData) : null
    };
    return (
      <div className="space-y-2">
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
          🐛 Debug Mode Active - PipelineStepGrid Raw JSON
        </div>
        <pre className="text-xs whitespace-pre-wrap break-all overflow-x-auto">
          {JSON.stringify(debugData, null, 2)}
        </pre>
      </div>
    );
  }
  
  // Get config and prepare grid data - must call hooks before any returns
  const config = STEP_GRID_CONFIGS[stepId];
  const { rowData, columnDefs } = useMemo(() => {
    if (!config) {
      return { rowData: [], columnDefs: [] };
    }
    const data = config.extractData(processedData);
    return { rowData: data, columnDefs: config.columns };
  }, [processedData, config, stepId]);
  
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
                transcriptMapId: id,  // Store the map key for updates
                lines: transcript.p0_1_output!.line_numbered_transcript,
                transcriptId: transcript.p0_1_output!.transcript_id,
                initialImpressions: transcript.p0_1_output!.initial_impressions_log,
                conventionNotes: transcript.p0_1_output!.transcription_convention_notes,
                filename: transcript.filename
              }
            }));
        }}
        renderContent={(tabData, theme) => {
          const handleUpdateField = (field: 'conventionNotes' | 'initialImpressions', newValue: string) => {
            const transcriptData = processedData.get(tabData.transcriptMapId);
            if (transcriptData && transcriptData.p0_1_output) {
              const updatedOutput = { ...transcriptData.p0_1_output };
              
              if (field === 'conventionNotes') {
                updatedOutput.transcription_convention_notes = newValue;
              } else if (field === 'initialImpressions') {
                updatedOutput.initial_impressions_log = newValue;
              }
              
              updateProcessedData(tabData.transcriptMapId, {
                p0_1_output: updatedOutput
              });
            }
          };
          
          return (
            <div className="space-y-4">
              <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
                💡 Click on the Convention Notes or Initial Impressions to edit them. Changes are saved automatically.
              </div>
              
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
                  <EditableTextArea
                    value={tabData.conventionNotes}
                    onChange={(newValue) => handleUpdateField('conventionNotes', newValue)}
                    theme={theme}
                    placeholder="Add transcription convention notes..."
                    maxLength={500}
                  />
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Initial Impressions
                  </h4>
                  <EditableTextArea
                    value={tabData.initialImpressions}
                    onChange={(newValue) => handleUpdateField('initialImpressions', newValue)}
                    theme={theme}
                    placeholder="Add initial impressions..."
                    maxLength={1000}
                  />
                </div>
              </div>
              
              {/* Transcript lines table */}
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
                  Line-Numbered Transcript (Not Editable)
                </h4>
                <TranscriptLinesTable lines={tabData.lines} theme={theme} filename={tabData.filename} />
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No transcripts with P0.1 output available"
      />
    );
  }
  
  // Special handling for P0_2 with tabbed display
  if (stepId === StepId.P0_2_REFINE_DATA_TYPES) {
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          return Array.from(data.entries())
            .filter(([_, transcript]) => transcript.p0_2_output)
            .map(([id, transcript]) => ({
              id,
              label: transcript.filename,
              data: {
                transcriptMapId: id,
                transcriptId: transcript.p0_2_output!.transcript_id,
                refinedLines: transcript.p0_2_output!.refined_data_transcript,
                filename: transcript.filename
              }
            }));
        }}
        renderContent={(tabData, theme) => {
          const handleLinesChange = (updatedLines: any[]) => {
            const transcriptData = processedData.get(tabData.transcriptMapId);
            if (transcriptData && transcriptData.p0_2_output) {
              const updatedOutput = {
                ...transcriptData.p0_2_output,
                refined_data_transcript: updatedLines
              };
              
              updateProcessedData(tabData.transcriptMapId, {
                p0_2_output: updatedOutput
              });
            }
          };
          
          return (
            <div className="space-y-4">
              {/* Metadata section */}
              <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg">
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                  Transcript ID
                </h4>
                <p className="text-light-text dark:text-dark-text">
                  {tabData.transcriptId}
                </p>
              </div>
              
              {/* Refined data table */}
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
                  Refined Data Transcript
                </h4>
                <RefinedDataTable 
                  refinedLines={tabData.refinedLines} 
                  theme={theme}
                  onLinesChange={handleLinesChange}
                  filename={tabData.filename}
                  transcriptId={tabData.transcriptId}
                  stepId={StepId.P0_2_REFINE_DATA_TYPES}
                />
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No transcripts with P0.2 output available"
      />
    );
  }
  
  // Special handling for P0_3 with tabbed display
  if (stepId === StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES) {
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          return Array.from(data.entries())
            .filter(([_, transcript]) => transcript.p0_3_output)
            .map(([id, transcript]) => ({
              id,
              label: transcript.filename,
              data: {
                transcriptMapId: id,
                transcriptId: transcript.p0_3_output!.transcript_id,
                utterances: transcript.p0_3_output!.selected_procedural_utterances,
                ivDetails: transcript.p0_3_output!.independent_variable_details,
                dvFocus: transcript.p0_3_output!.dependent_variable_focus,
                filename: transcript.filename
              }
            }));
        }}
        renderContent={(tabData, theme) => {
          const handleUtterancesChange = (updatedUtterances: any[]) => {
            const transcriptData = processedData.get(tabData.transcriptMapId);
            if (transcriptData && transcriptData.p0_3_output) {
              const updatedOutput = {
                ...transcriptData.p0_3_output,
                selected_procedural_utterances: updatedUtterances
              };
              
              updateProcessedData(tabData.transcriptMapId, {
                p0_3_output: updatedOutput
              });
            }
          };
          
          
          return (
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
                    Independent Variable
                  </h4>
                  <p className="text-light-text dark:text-dark-text text-sm">
                    {tabData.ivDetails}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Dependent Variable Focus
                  </h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tabData.dvFocus.map((dv: string, index: number) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      >
                        {dv}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Selected utterances table */}
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
                  Procedural Utterances Analysis ({tabData.utterances.filter((u: any) => u.included).length} included / {tabData.utterances.length} total)
                </h4>
                <SelectedUtterancesTable 
                  utterances={tabData.utterances} 
                  theme={theme}
                  onUtterancesChange={handleUtterancesChange}
                  filename={tabData.filename}
                  transcriptId={tabData.transcriptId}
                />
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No transcripts with P0.3 output available"
      />
    );
  }
  
  // Special handling for P1_1 with tabbed display
  if (stepId === StepId.P1_1_INITIAL_SEGMENTATION) {
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          return Array.from(data.entries())
            .filter(([_, transcript]) => transcript.p1_1_output)
            .map(([id, transcript]) => ({
              id,
              label: transcript.filename,
              data: {
                transcriptMapId: id,
                transcriptId: transcript.p1_1_output!.transcript_id || id,
                segmentationData: transcript.p1_1_output!,
                filename: transcript.filename
              }
            }));
        }}
        renderContent={(tabData, theme) => {
          const handleSegmentationChange = (updatedData: any) => {
            updateProcessedData(tabData.transcriptMapId, {
              p1_1_output: updatedData
            });
          };
          
          return (
            <div className="space-y-4">
              {/* Metadata section */}
              <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Transcript ID
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {tabData.segmentationData.transcript_id}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Independent Variable
                  </h4>
                  <p className="text-light-text dark:text-dark-text text-sm">
                    {tabData.segmentationData.independent_variable_details}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Dependent Variable Focus
                  </h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tabData.segmentationData.dependent_variable_focus && Array.isArray(tabData.segmentationData.dependent_variable_focus) ? 
                      tabData.segmentationData.dependent_variable_focus.map((dv: string, index: number) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      >
                        {dv}
                      </span>
                    )) : (
                      <span className="text-xs text-light-sidenote dark:text-dark-sidenote">No dependent variables specified</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Segmentation table */}
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
                  Initial Segmentation of Procedural Utterances
                </h4>
                <InitialSegmentationTable 
                  segmentationData={tabData.segmentationData}
                  theme={theme}
                  onSegmentationChange={handleSegmentationChange}
                  filename={tabData.filename}
                  transcriptId={tabData.transcriptId}
                />
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No transcripts with P1.1 output available"
      />
    );
  }
  
  // Special handling for P1_2 with tabbed display
  if (stepId === StepId.P1_2_COARSE_PHASE_TAGGING) {
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          return Array.from(data.entries())
            .filter(([_, transcript]) => transcript.p1_2_output)
            .map(([id, transcript]) => ({
              id,
              label: transcript.filename,
              data: {
                transcriptMapId: id,
                transcriptId: transcript.p1_2_output!.transcript_id || id,
                diachronicData: transcript.p1_2_output!,
                segmentationData: transcript.p1_1_output,
                filename: transcript.filename
              }
            }));
        }}
        renderContent={(tabData, theme) => {
          const handlePhaseTaggingChange = (updatedData: any) => {
            updateProcessedData(tabData.transcriptMapId, {
              p1_2_output: updatedData
            });
          };
          
          return (
            <div className="space-y-4">
              {/* Metadata section */}
              <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Transcript ID
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {tabData.diachronicData.transcript_id}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Independent Variable
                  </h4>
                  <p className="text-light-text dark:text-dark-text text-sm">
                    {tabData.diachronicData.independent_variable_details}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Dependent Variable Focus
                  </h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tabData.diachronicData.dependent_variable_focus && Array.isArray(tabData.diachronicData.dependent_variable_focus) ? 
                      tabData.diachronicData.dependent_variable_focus.map((dv: string, index: number) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      >
                        {dv}
                      </span>
                    )) : (
                      <span className="text-xs text-light-sidenote dark:text-dark-sidenote">No dependent variables specified</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Phase tagging table */}
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
                  Coarse Phase Tagging
                </h4>
                <PhaseTaggingTable 
                  phaseTaggingData={tabData.diachronicData}
                  theme={theme}
                  onPhaseTaggingChange={handlePhaseTaggingChange}
                  filename={tabData.filename}
                  transcriptId={tabData.transcriptId}
                />
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No transcripts with P1.2 output available"
      />
    );
  }
  
  // Special handling for P1_3 with tabbed display
  if (stepId === StepId.P1_3_INTRA_PHASE_SORTING) {
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          return Array.from(data.entries())
            .filter(([_, transcript]) => transcript.p1_3_output)
            .map(([id, transcript]) => ({
              id,
              label: transcript.filename,
              data: {
                transcriptMapId: id,
                transcriptId: transcript.p1_3_output!.transcript_id || id,
                phaseData: transcript.p1_3_output!,
                p1_2_output: transcript.p1_2_output,
                filename: transcript.filename
              }
            }));
        }}
        renderContent={(tabData, theme) => {
          const handleSortingChange = (updatedData: any) => {
            updateProcessedData(tabData.transcriptMapId, {
              p1_3_output: updatedData
            });
          };
          
          return (
            <div className="space-y-4">
              {/* Metadata section */}
              <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Transcript ID
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {tabData.phaseData.transcript_id}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Total Sorted Segments
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {tabData.phaseData.sorted_segments.length}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Independent Variable
                  </h4>
                  <p className="text-light-text dark:text-dark-text text-sm">
                    {tabData.phaseData.independent_variable_details}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Dependent Variable Focus
                  </h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tabData.phaseData.dependent_variable_focus && Array.isArray(tabData.phaseData.dependent_variable_focus) ? 
                      tabData.phaseData.dependent_variable_focus.map((dv: string, index: number) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      >
                        {dv}
                      </span>
                    )) : (
                      <span className="text-xs text-light-sidenote dark:text-dark-sidenote">No dependent variables specified</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Intra-phase sorting table */}
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
                  Intra-Phase Chronological Sorting
                </h4>
                <IntraPhaseSortingTable 
                  sortingData={tabData.phaseData}
                  theme={theme}
                  onSortingChange={handleSortingChange}
                  filename={tabData.filename}
                  transcriptId={tabData.transcriptId}
                />
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No transcripts with P1.3 output available"
      />
    );
  }
  
  // Special handling for P1_4 with tabbed display
  if (stepId === StepId.P1_4_DIACHRONIC_UNIT_GROUPING) {
    console.log('[P1.4 Debug] Rendering P1.4 component, processedData size:', processedData.size);
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          return Array.from(data.entries())
            .filter(([_, transcript]) => transcript.p1_4_output)
            .map(([id, transcript]) => ({
              id,
              label: transcript.filename,
              data: {
                transcriptMapId: id,
                transcriptId: transcript.p1_4_output!.transcript_id || id,
                groupingData: transcript.p1_4_output!,
                p1_3_output: transcript.p1_3_output,
                filename: transcript.filename
              }
            }));
        }}
        renderContent={(tabData, theme) => {
          try {
            console.log('[P1.4 Debug] tabData:', tabData);
            console.log('[P1.4 Debug] groupingData structure:', {
              hasGroupingData: !!tabData.groupingData,
              hasTranscriptId: !!tabData.groupingData?.transcript_id,
              hasDiachronicUnits: !!tabData.groupingData?.diachronic_units,
              diachronicUnitsLength: tabData.groupingData?.diachronic_units?.length || 0
            });
            
            const handleGroupingChange = (updatedData: any) => {
              updateProcessedData(tabData.transcriptMapId, {
                p1_4_output: updatedData
              });
            };
            
            return (
            <div className="space-y-4">
              {/* Metadata section */}
              <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg space-y-3">
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Transcript ID
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {tabData.groupingData.transcript_id}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Total Diachronic Units
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {tabData.groupingData.diachronic_units.length}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Independent Variable
                  </h4>
                  <p className="text-light-text dark:text-dark-text text-sm">
                    {tabData.groupingData.independent_variable_details}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Dependent Variable Focus
                  </h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {tabData.groupingData.dependent_variable_focus && Array.isArray(tabData.groupingData.dependent_variable_focus) ? 
                      tabData.groupingData.dependent_variable_focus.map((dv: string, index: number) => (
                      <span
                        key={index}
                        className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                      >
                        {dv}
                      </span>
                    )) : (
                      <span className="text-xs text-light-sidenote dark:text-dark-sidenote">No dependent variables specified</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Diachronic unit grouping table */}
              <div>
                <DiachronicUnitGroupingTable 
                  groupingData={tabData.groupingData}
                  sortedSegmentsData={tabData.p1_3_output}
                  theme={theme}
                  onGroupingChange={handleGroupingChange}
                  filename={tabData.filename}
                  transcriptId={tabData.transcriptId}
                />
              </div>
            </div>
          );
          } catch (error) {
            console.error('[P1.4 Debug] Error rendering content:', error);
            return (
              <div className="text-red-600 dark:text-red-400 p-4">
                Error rendering P1.4 content: {error instanceof Error ? error.message : String(error)}
              </div>
            );
          }
        }}
        theme={theme}
        emptyMessage="No transcripts with P1.4 output available"
      />
    );
  }
  
  // Special handling for P1_5 with comparison display
  if (stepId === StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE) {
    console.log('[P1.5 Debug] Rendering P1.5 comparison component, processedData size:', processedData.size);
    return <DiachronicStructureComparison processedData={processedData} theme={theme} />;
  }
  
  // Special handling for P2S_1 with tabbed display per transcript (all DUs on same page)
  if (stepId === StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC) {
    
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          const tabs: any[] = [];
          
          // For each transcript that has P2S outputs
          Array.from(data.entries()).forEach(([transcriptId, transcript]) => {
            if (transcript.p2s_outputs_by_du) {
              // Check if any DU has P2S.1 output
              const duOutputs: { [duId: string]: any } = {};
              Object.entries(transcript.p2s_outputs_by_du).forEach(([duId, duData]) => {
                if (duData.p2s_1_output) {
                  duOutputs[duId] = duData.p2s_1_output;
                }
              });
              
              // If this transcript has any P2S.1 outputs, create a tab for it
              if (Object.keys(duOutputs).length > 0) {
                tabs.push({
                  id: transcriptId,
                  label: transcript.filename,
                  data: {
                    transcriptMapId: transcriptId,
                    duOutputs: duOutputs,
                    filename: transcript.filename,
                    transcriptId: transcript.p0_1_output?.transcript_id || transcriptId
                  }
                });
              }
            }
          });
          
          return tabs;
        }}
        renderContent={(tabData, theme) => {
          const handleGroupingChange = (duId: string, updatedData: any) => {
            const transcriptData = processedData.get(tabData.transcriptMapId);
            if (transcriptData && transcriptData.p2s_outputs_by_du) {
              const updatedP2sOutputs = {
                ...transcriptData.p2s_outputs_by_du,
                [duId]: {
                  ...transcriptData.p2s_outputs_by_du[duId],
                  p2s_1_output: updatedData
                }
              };
              
              updateProcessedData(tabData.transcriptMapId, {
                p2s_outputs_by_du: updatedP2sOutputs
              });
            }
          };
          
          // Sort DU IDs for consistent display
          const sortedDuIds = Object.keys(tabData.duOutputs).sort();
          
          // Get the first DU's data to extract transcript-level info
          const firstDuData = tabData.duOutputs[sortedDuIds[0]];
          
          return (
            <div className="space-y-6">
              {/* Transcript-level metadata */}
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
                    Total Diachronic Units with P2S.1 Output
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {sortedDuIds.length}
                  </p>
                </div>
                
                {/* Variable Information - shown once at transcript level */}
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Independent Variable
                  </h4>
                  <p className="text-light-text dark:text-dark-text text-sm">
                    {firstDuData.independent_variable_details}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Dependent Variable Focus
                  </h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {firstDuData.dependent_variable_focus && Array.isArray(firstDuData.dependent_variable_focus) ? (
                      firstDuData.dependent_variable_focus.map((dv: string, index: number) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                        >
                          {dv}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-light-sidenote dark:text-dark-sidenote">No dependent variables specified</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Display all DUs for this transcript */}
              {sortedDuIds.map((duId, index) => (
                <div key={duId} className="border-t-2 border-light-border dark:border-dark-border pt-6">
                  {/* DU Header */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-light-accent dark:text-dark-accent">
                      Diachronic Unit: {duId}
                    </h3>
                  </div>
                  
                  {/* Synchronic thematic grouping table for this DU */}
                  <SynchronicThematicGroupingTable 
                    groupingData={tabData.duOutputs[duId]}
                    theme={theme}
                    onGroupingChange={(updatedData) => handleGroupingChange(duId, updatedData)}
                    filename={tabData.filename}
                    transcriptId={tabData.transcriptId}
                    hideVariableInfo={true}
                    hideInstructions={true} // Instructions shown at bottom of transcript
                    compactSummary={true} // Use compact summary with just stats and download button
                  />
                </div>
              ))}
              
              {/* Instructions - shown once at the bottom */}
              <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic space-y-1 border-t-2 border-light-border dark:border-dark-border pt-4">
                <div>💡 Click on group headers to expand/collapse</div>
                <div>✏️ Click on group labels or justifications to edit them</div>
                <div>❌ Remove segments from groups using the X button</div>
                <div>🗑️ Delete entire groups using the trash button (when more than one group exists)</div>
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No DUs with P2S.1 output available. Click 'Run Step' to generate thematic groupings."
      />
    );
  }
  
  // Special handling for P2S_2 with tabbed display per transcript (all DUs on same page)
  if (stepId === StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS) {
    
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          const tabs: any[] = [];
          
          // For each transcript that has P2S outputs
          Array.from(data.entries()).forEach(([transcriptId, transcript]) => {
            if (transcript.p2s_outputs_by_du) {
              // Check if any DU has P2S.2 output
              const duOutputs: { [duId: string]: any } = {};
              Object.entries(transcript.p2s_outputs_by_du).forEach(([duId, duData]) => {
                if (duData.p2s_2_output) {
                  duOutputs[duId] = duData.p2s_2_output;
                }
              });
              
              // If this transcript has any P2S.2 outputs, create a tab for it
              if (Object.keys(duOutputs).length > 0) {
                tabs.push({
                  id: transcriptId,
                  label: transcript.filename,
                  data: {
                    transcriptMapId: transcriptId,
                    duOutputs: duOutputs,
                    filename: transcript.filename,
                    transcriptId: transcript.p0_1_output?.transcript_id || transcriptId
                  }
                });
              }
            }
          });
          
          return tabs;
        }}
        renderContent={(tabData, theme) => {
          const handleUnitsChange = (duId: string, updatedData: any) => {
            const transcriptData = processedData.get(tabData.transcriptMapId);
            if (transcriptData && transcriptData.p2s_outputs_by_du) {
              const updatedP2sOutputs = {
                ...transcriptData.p2s_outputs_by_du,
                [duId]: {
                  ...transcriptData.p2s_outputs_by_du[duId],
                  p2s_2_output: updatedData
                }
              };
              
              updateProcessedData(tabData.transcriptMapId, {
                p2s_outputs_by_du: updatedP2sOutputs
              });
            }
          };
          
          // Sort DU IDs for consistent display
          const sortedDuIds = Object.keys(tabData.duOutputs).sort();
          
          // Get the first DU's data to extract transcript-level info
          const firstDuData = tabData.duOutputs[sortedDuIds[0]];
          
          return (
            <div className="space-y-6">
              {/* Transcript-level metadata */}
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
                    Total Diachronic Units with P2S.2 Output
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {sortedDuIds.length}
                  </p>
                </div>
                
                {/* Variable Information - shown once at transcript level */}
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Independent Variable
                  </h4>
                  <p className="text-light-text dark:text-dark-text text-sm">
                    {firstDuData.independent_variable_details}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Dependent Variable Focus
                  </h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {firstDuData.dependent_variable_focus && Array.isArray(firstDuData.dependent_variable_focus) ? (
                      firstDuData.dependent_variable_focus.map((dv: string, index: number) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                        >
                          {dv}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-light-sidenote dark:text-dark-sidenote">No dependent variables specified</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Display all DUs for this transcript */}
              {sortedDuIds.map((duId, index) => (
                <div key={duId} className="border-t-2 border-light-border dark:border-dark-border pt-6">
                  {/* DU Header */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-light-accent dark:text-dark-accent">
                      Diachronic Unit: {duId}
                    </h3>
                  </div>
                  
                  {/* Specific synchronic units table for this DU */}
                  <SpecificSynchronicUnitsTable 
                    unitsData={tabData.duOutputs[duId]}
                    theme={theme}
                    onUnitsChange={(updatedData) => handleUnitsChange(duId, updatedData)}
                    filename={tabData.filename}
                    transcriptId={tabData.transcriptId}
                    hideVariableInfo={true}
                    hideInstructions={true} // Instructions shown at bottom of transcript
                    compactSummary={true} // Use compact summary
                  />
                </div>
              ))}
              
              {/* Instructions - shown once at the bottom */}
              <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic space-y-1 border-t-2 border-light-border dark:border-dark-border pt-4">
                <div>💡 Click on ISU headers to expand/collapse</div>
                <div>✏️ Click on unit names, definitions, or abstraction operations to edit them</div>
                <div>🎯 Units are indented based on their hierarchy level</div>
                <div>❌ Remove segments from ISUs using the X button</div>
                <div>🗑️ Delete entire ISUs using the trash button (when more than one exists)</div>
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No DUs with P2S.2 output available. Click 'Run Step' to identify specific synchronic units."
      />
    );
  }
  
  // Special handling for P2S_3 with tabbed display per transcript (all DUs on same page)
  if (stepId === StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE) {
    
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          const tabs: any[] = [];
          
          // For each transcript that has P2S outputs
          Array.from(data.entries()).forEach(([transcriptId, transcript]) => {
            if (transcript.p2s_outputs_by_du) {
              // Check if any DU has P2S.3 output
              const duOutputs: { [duId: string]: any } = {};
              Object.entries(transcript.p2s_outputs_by_du).forEach(([duId, duData]) => {
                if (duData.p2s_3_output) {
                  duOutputs[duId] = duData.p2s_3_output;
                }
              });
              
              // If this transcript has any P2S.3 outputs, create a tab for it
              if (Object.keys(duOutputs).length > 0) {
                tabs.push({
                  id: transcriptId,
                  label: transcript.filename,
                  data: {
                    transcriptMapId: transcriptId,
                    duOutputs: duOutputs,
                    filename: transcript.filename,
                    transcriptId: transcript.p0_1_output?.transcript_id || transcriptId
                  }
                });
              }
            }
          });
          
          return tabs;
        }}
        renderContent={(tabData, theme) => {
          const handleNetworkChange = (duId: string, updatedData: any) => {
            const transcriptData = processedData.get(tabData.transcriptMapId);
            if (transcriptData && transcriptData.p2s_outputs_by_du) {
              const updatedP2sOutputs = {
                ...transcriptData.p2s_outputs_by_du,
                [duId]: {
                  ...transcriptData.p2s_outputs_by_du[duId],
                  p2s_3_output: updatedData
                }
              };
              
              updateProcessedData(tabData.transcriptMapId, {
                p2s_outputs_by_du: updatedP2sOutputs
              });
            }
          };
          
          // Sort DU IDs for consistent display
          const sortedDuIds = Object.keys(tabData.duOutputs).sort();
          
          // Get the first DU's data to extract transcript-level info
          const firstDuData = tabData.duOutputs[sortedDuIds[0]];
          
          return (
            <div className="space-y-6">
              {/* Transcript-level metadata */}
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
                    Total Diachronic Units with P2S.3 Output
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {sortedDuIds.length}
                  </p>
                </div>
                
                {/* Variable Information - shown once at transcript level */}
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Independent Variable
                  </h4>
                  <p className="text-light-text dark:text-dark-text text-sm">
                    {firstDuData.independent_variable_details}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Dependent Variable Focus
                  </h4>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {firstDuData.dependent_variable_focus && Array.isArray(firstDuData.dependent_variable_focus) ? (
                      firstDuData.dependent_variable_focus.map((dv: string, index: number) => (
                        <span
                          key={index}
                          className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                        >
                          {dv}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-light-sidenote dark:text-dark-sidenote">No dependent variables specified</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Display all DUs for this transcript */}
              {sortedDuIds.map((duId, index) => (
                <div key={duId} className="border-t-2 border-light-border dark:border-dark-border pt-6">
                  {/* DU Header */}
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-light-accent dark:text-dark-accent">
                      Diachronic Unit: {duId}
                    </h3>
                  </div>
                  
                  {/* Specific synchronic structure network for this DU */}
                  <SpecificSynchronicStructureNetwork 
                    networkData={tabData.duOutputs[duId]}
                    theme={theme}
                    onNetworkChange={(updatedData) => handleNetworkChange(duId, updatedData)}
                    filename={tabData.filename}
                    transcriptId={tabData.transcriptId}
                    hideVariableInfo={true}
                    hideInstructions={true} // Instructions shown at bottom of transcript
                    compactSummary={true} // Use compact summary
                  />
                </div>
              ))}
              
              {/* Instructions - shown once at the bottom */}
              <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic space-y-1 border-t-2 border-light-border dark:border-dark-border pt-4">
                <div>📊 View the network as a Mermaid diagram or explore nodes and links</div>
                <div>✏️ Click on description to edit it</div>
                <div>🔗 Click on links in the link list to edit or delete them</div>
                <div>📝 Add, edit, or delete nodes and links to modify the network structure</div>
                <div>💾 Download the network structure as CSV for external analysis</div>
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No DUs with P2S.3 output available. Click 'Run Step' to define specific synchronic structures."
      />
    );
  }

  // Special handling for P2S_4 Summary Table
  if (stepId === StepId.P2S_4_SUMMARY_TABLE) {
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          const tabs: any[] = [];
          
          // For each transcript that has P2S outputs
          Array.from(data.entries()).forEach(([transcriptId, transcript]) => {
            if (transcript.p2s_outputs_by_du && Object.keys(transcript.p2s_outputs_by_du).length > 0) {
              // Check if any DU has P2S outputs (P2S.1, P2S.2, or P2S.3)
              const hasP2SOutputs = Object.values(transcript.p2s_outputs_by_du).some(
                duData => duData.p2s_1_output || duData.p2s_2_output || duData.p2s_3_output
              );
              
              if (hasP2SOutputs) {
                tabs.push({
                  id: transcriptId,
                  label: transcript.filename,
                  data: {
                    transcriptId,
                    p2sOutputsByDU: transcript.p2s_outputs_by_du,
                    p1_4_output: transcript.p1_4_output,
                    filename: transcript.filename
                  }
                });
              }
            }
          });
          
          return tabs;
        }}
        renderContent={(tabData, theme) => {
          // Get transcript data to extract IV/DV info
          const transcriptData = processedData.get(tabData.transcriptId);
          const independentVariable = transcriptData?.p_neg1_1_output?.independent_variable_details || 'Not specified';
          const dependentVariables = transcriptData?.p_neg1_1_output?.dependent_variable_focus || [];
          
          // Debug: Log the P2S outputs
          console.log('[P2S.4 Debug] tabData.p2sOutputsByDU:', tabData.p2sOutputsByDU);
          console.log('[P2S.4 Debug] Number of DUs:', Object.keys(tabData.p2sOutputsByDU).length);
          console.log('[P2S.4 Debug] DU IDs:', Object.keys(tabData.p2sOutputsByDU));
          
          // Transform P2S data into summary format
          const summaryData = transformP2SDataToSummary(
            tabData.transcriptId,
            new Map(Object.entries(tabData.p2sOutputsByDU)),
            tabData.p1_4_output,
            tabData.filename,
            independentVariable,
            dependentVariables
          );
          
          console.log('[P2S.4 Debug] summaryData.duRecords:', summaryData.duRecords);
          console.log('[P2S.4 Debug] Total DUs in summary:', summaryData.totalDUs);
          
          return <Part2SummaryTable data={summaryData} theme={theme} />;
        }}
        theme={theme}
        emptyMessage="No synchronic analysis data available. Please run P2S.1, P2S.2, and P2S.3 first."
      />
    );
  }
  
  // Config check - using the values from the hook above
  if (!config) {
    // Fallback to JSON display if no config
    return (
      <div className="text-center py-8 text-light-sidenote dark:text-dark-sidenote">
        No grid configuration for this step. Displaying raw data.
      </div>
    );
  }

  // Use special component for Variable Identification
  if (stepId === StepId.P_NEG1_1_VARIABLE_IDENTIFICATION) {
    return (
      <VariableIdentificationGrid 
        processedData={processedData}
        theme={theme}
        config={config}
      />
    );
  }

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