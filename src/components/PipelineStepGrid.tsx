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
import { RefinedDiachronicUnitTable } from './RefinedDiachronicUnitTable';
import { EditableTextArea } from './EditableTextArea';
import { usePipelineStore } from '../stores/pipelineStore';
import MermaidDiagram from '../../components/MermaidDiagram';
import { DiachronicComparisonTable } from './DiachronicComparisonTable';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { NestedTooltip } from './NestedTooltip';
import { RduTooltip } from './tooltips/RduTooltip';

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
  if (stepId === StepId.P1_2_DIACHRONIC_UNIT_ID) {
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
          const handleDiachronicChange = (updatedData: any) => {
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
                    Total Diachronic Units
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {tabData.diachronicData.diachronic_units.length}
                  </p>
                </div>
              </div>
              
              {/* Diachronic units table */}
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
                  Diachronic Units (DUs)
                </h4>
                <DiachronicUnitTable 
                  diachronicData={tabData.diachronicData}
                  segmentationData={tabData.segmentationData}
                  theme={theme}
                  onDiachronicChange={handleDiachronicChange}
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
  if (stepId === StepId.P1_3_REFINE_DIACHRONIC_UNITS) {
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
                refinedData: transcript.p1_3_output!,
                filename: transcript.filename
              }
            }));
        }}
        renderContent={(tabData, theme) => {
          const handleRefinedChange = (updatedData: any) => {
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
                    {tabData.refinedData.transcript_id}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Total Refined DUs
                  </h4>
                  <p className="text-light-text dark:text-dark-text">
                    {tabData.refinedData.refined_diachronic_units.length}
                  </p>
                </div>
              </div>
              
              {/* Refined diachronic units table */}
              <div>
                <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-2">
                  Refined Diachronic Units with Temporal Phases
                </h4>
                <RefinedDiachronicUnitTable 
                  refinedData={tabData.refinedData}
                  theme={theme}
                  onRefinedChange={handleRefinedChange}
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
  if (stepId === StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE) {
    console.log('[P1.4 Debug] Rendering P1.4 component, processedData size:', processedData.size);
    return (
      <TabbedStepDisplay
        processedData={processedData}
        extractTabs={(data) => {
          const entries = Array.from(data.entries());
          console.log('[P1.4 Debug] Total transcripts:', entries.length);
          const filtered = entries.filter(([_, transcript]) => {
            console.log('[P1.4 Debug] Transcript:', transcript.filename, 'has p1_4_output:', !!transcript.p1_4_output);
            return transcript.p1_4_output;
          });
          console.log('[P1.4 Debug] Filtered transcripts with P1.4 output:', filtered.length);
          return filtered.map(([id, transcript]) => ({
              id,
              label: transcript.filename,
              data: {
                transcriptMapId: id,
                diachronicStructure: transcript.p1_4_output!,
                mermaidSyntax: transcript.p1_4_mermaid_syntax || transcript.p1_4_output?.mermaid_syntax_specific_diachronic,
                filename: transcript.filename
              }
            }));
        }}
        renderContent={(tabData, theme) => {
          const { diachronicStructure, mermaidSyntax, filename } = tabData;
          console.log('[P1.4 Debug] Rendering content for:', filename, 'mermaidSyntax:', mermaidSyntax);
          
          // Prepare phases data for CSV export
          const phasesData = diachronicStructure.specific_diachronic_structure.phases.map((phase: any, index: number) => ({
            phase_number: index + 1,
            phase_name: phase.phase_name,
            description: phase.description,
            units_involved: phase.units_involved.join('; ')
          }));
          
          const handleDownloadCSV = () => {
            const columns = [
              { field: 'phase_number', headerName: 'Phase #' },
              { field: 'phase_name', headerName: 'Phase Name' },
              { field: 'description', headerName: 'Description' },
              { field: 'units_involved', headerName: 'Units Involved' }
            ];
            const csvContent = convertToCSV(phasesData, columns);
            const timestamp = new Date().toISOString().split('T')[0];
            downloadCSV(csvContent, `${filename}_P1.4_phases_${timestamp}.csv`);
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
                    {diachronicStructure.transcript_id}
                  </p>
                </div>
                
                <div>
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                    Summary
                  </h4>
                  <p className="text-light-text dark:text-dark-text text-sm">
                    {diachronicStructure.specific_diachronic_structure.summary}
                  </p>
                </div>
                
                {diachronicStructure.specific_diachronic_structure.iv_preliminary_observation && (
                  <div>
                    <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote mb-1">
                      IV Preliminary Observation
                    </h4>
                    <p className="text-light-text dark:text-dark-text text-sm">
                      {diachronicStructure.specific_diachronic_structure.iv_preliminary_observation}
                    </p>
                  </div>
                )}
              </div>
              
              {/* Phases table */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-medium text-sm text-light-sidenote dark:text-dark-sidenote">
                    Diachronic Phases ({phasesData.length} phases)
                  </h4>
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-2 px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt border border-light-border dark:border-dark-border rounded hover:bg-light-accent/10 dark:hover:bg-dark-accent/10 transition-colors"
                    title="Download phases as CSV"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    CSV
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-light-border dark:divide-dark-border">
                    <thead className="bg-light-bg-alt dark:bg-dark-bg-alt">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                          Phase
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-light-sidenote dark:text-dark-sidenote uppercase tracking-wider">
                          Units
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-light-bg dark:bg-dark-bg divide-y divide-light-border dark:divide-dark-border">
                      {phasesData.map((phase) => (
                        <tr key={phase.phase_number}>
                          <td className="px-4 py-2 whitespace-nowrap text-sm">
                            {phase.phase_number}
                          </td>
                          <td className="px-4 py-2 text-sm font-medium">
                            {phase.phase_name}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            {phase.description}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <div className="flex flex-wrap gap-1">
                              {phase.units_involved.split('; ').map((unit, idx) => {
                                const transcriptData = processedData.get(tabData.transcriptMapId);
                                if (!transcriptData) {
                                  return (
                                    <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                      {unit}
                                    </span>
                                  );
                                }
                                
                                return (
                                  <NestedTooltip
                                    key={idx}
                                    content={<RduTooltip rduName={unit} transcriptData={transcriptData} />}
                                  >
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 cursor-pointer hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors">
                                      {unit}
                                    </span>
                                  </NestedTooltip>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Comparative Diachronic Table */}
              <div className="mt-8 pt-8 border-t border-light-border dark:border-dark-border">
                <DiachronicComparisonTable />
              </div>
            </div>
          );
        }}
        theme={theme}
        emptyMessage="No transcripts with P1.4 output available"
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