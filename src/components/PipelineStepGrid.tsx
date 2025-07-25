import React, { useMemo, useState } from 'react';
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
import { DiachronicUnitGroupingTable } from './DiachronicUnitGroupingTable';
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
                    {tabData.segmentationData.dependent_variable_focus.map((dv: string, index: number) => (
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
                    {tabData.diachronicData.dependent_variable_focus.map((dv: string, index: number) => (
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
                    {tabData.phaseData.dependent_variable_focus.map((dv: string, index: number) => (
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
                    {tabData.groupingData.dependent_variable_focus.map((dv: string, index: number) => (
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
              
              {/* Diachronic unit grouping table */}
              <div>
                <DiachronicUnitGroupingTable 
                  groupingData={tabData.groupingData}
                  sortedSegmentsData={tabData.p1_3_output}
                  theme={theme}
                  onGroupingChange={handleGroupingChange}
                  filename={tabData.filename}
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
  
  // Special handling for P2S_1 with tabbed display per DU
  if (stepId === StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC) {
    
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          const tabs: any[] = [];
          
          // For each transcript that has P2S outputs
          Array.from(data.entries()).forEach(([transcriptId, transcript]) => {
            if (transcript.p2s_outputs_by_du) {
              // For each DU that has P2S.1 output
              Object.entries(transcript.p2s_outputs_by_du).forEach(([duId, duData]) => {
                if (duData.p2s_1_output) {
                  tabs.push({
                    id: `${transcriptId}_${duId}`,
                    label: `${transcript.filename} - ${duId}`,
                    data: {
                      transcriptMapId: transcriptId,
                      duId: duId,
                      groupingData: duData.p2s_1_output,
                      filename: transcript.filename
                    }
                  });
                }
              });
            }
          });
          
          return tabs;
        }}
        renderContent={(tabData, theme) => {
          const handleGroupingChange = (updatedData: any) => {
            const transcriptData = processedData.get(tabData.transcriptMapId);
            if (transcriptData && transcriptData.p2s_outputs_by_du) {
              const updatedP2sOutputs = {
                ...transcriptData.p2s_outputs_by_du,
                [tabData.duId]: {
                  ...transcriptData.p2s_outputs_by_du[tabData.duId],
                  p2s_1_output: updatedData
                }
              };
              
              updateProcessedData(tabData.transcriptMapId, {
                p2s_outputs_by_du: updatedP2sOutputs
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
                    {tabData.groupingData.transcript_id}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Analyzed Diachronic Unit
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {tabData.groupingData.analyzed_du_id}
                  </p>
                </div>
              </div>
              
              {/* Synchronic thematic grouping table */}
              <div>
                <SynchronicThematicGroupingTable 
                  groupingData={tabData.groupingData}
                  theme={theme}
                  onGroupingChange={handleGroupingChange}
                  filename={tabData.filename}
                />
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No DUs with P2S.1 output available. Click 'Run Step' to generate thematic groupings."
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
    <div className="space-y-4">
      {stepId === StepId.P_NEG1_1_VARIABLE_IDENTIFICATION && (
        <>
          <style>{editableStyles}</style>
          <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
            💡 Click on Independent Variable or Dependent Variables cells to edit them directly. Changes are saved automatically.
          </div>
        </>
      )}
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
          onCellValueChanged={(event: CellValueChangedEvent) => {
            // Handle cell value changes for P_NEG1_1
            if (stepId === StepId.P_NEG1_1_VARIABLE_IDENTIFICATION) {
              const { data, colDef } = event;
              const transcriptId = data.transcriptId;
              const fieldName = colDef.field;
              
              if (transcriptId && fieldName) {
                const transcriptData = processedData.get(transcriptId);
                if (transcriptData && transcriptData.p_neg1_1_output) {
                  // Update the appropriate field
                  const updatedOutput = { ...transcriptData.p_neg1_1_output };
                  
                  if (fieldName === 'independent_variable') {
                    updatedOutput.independent_variable_details = event.newValue || '';
                  } else if (fieldName === 'dependent_variables') {
                    // Split the comma-separated string back into an array
                    updatedOutput.dependent_variable_focus = (event.newValue || '')
                      .split(',')
                      .map((s: string) => s.trim())
                      .filter((s: string) => s.length > 0);
                  }
                  
                  // Update the store
                  updateProcessedData(transcriptId, {
                    p_neg1_1_output: updatedOutput
                  });
                }
              }
            }
          }}
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