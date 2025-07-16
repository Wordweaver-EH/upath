import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { ColDef, ValueGetterParams, HeaderCheckboxSelectionCallbackParams } from 'ag-grid-community';
import { HilTableModal } from './HilTableModal';
import { Button } from './ui/Button';
import { P_NEG1_1_Output, DiscoveredVariable } from '../../types';
import { useTranscriptStore } from '../stores/transcriptStore';
import { usePipelineOrchestrationStore } from '../stores/pipelineOrchestrationStore';

interface VariableTableRow {
  transcriptId: string;
  filename: string;
  [variableName: string]: string; // Dynamic columns for discovered variables
}

interface P_NEG1_1_VariableTableProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (selectedVariables: string[], variableData: Map<string, Map<string, string>>) => void;
}

export const P_NEG1_1_VariableTable: React.FC<P_NEG1_1_VariableTableProps> = ({
  isOpen,
  onClose,
  onProceed
}) => {
  const { rawTranscripts, processedData } = useTranscriptStore();
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [manualVariableMode, setManualVariableMode] = useState(false);
  const [newVariableName, setNewVariableName] = useState('');

  // Extract all unique variable names from all transcripts
  const allVariableNames = useMemo(() => {
    const variableSet = new Set<string>();
    
    processedData.forEach((transcriptData) => {
      const discoveredVars = transcriptData.p_neg1_1_output?.discovered_variables;
      if (discoveredVars && Array.isArray(discoveredVars)) {
        discoveredVars.forEach(variable => {
          if (variable.name) {
            variableSet.add(variable.name);
          }
        });
      }
    });
    
    return Array.from(variableSet).sort();
  }, [processedData]);

  // Build row data for the table
  const rowData = useMemo((): VariableTableRow[] => {
    return rawTranscripts.map(transcript => {
      const row: VariableTableRow = {
        transcriptId: transcript.id,
        filename: transcript.filename
      };
      
      // Get discovered variables for this transcript
      const transcriptData = processedData.get(transcript.id);
      const discoveredVars = transcriptData?.p_neg1_1_output?.discovered_variables;
      
      // Initialize all variables as empty
      allVariableNames.forEach(varName => {
        row[varName] = '';
      });
      
      // Fill in discovered values
      if (discoveredVars && Array.isArray(discoveredVars)) {
        discoveredVars.forEach(variable => {
          if (variable.name && variable.value) {
            row[variable.name] = variable.value;
          }
        });
      }
      
      return row;
    });
  }, [rawTranscripts, processedData, allVariableNames]);

  // Check if any variables were discovered
  const hasDiscoveredVariables = allVariableNames.length > 0;

  // Build column definitions
  const columns = useMemo((): ColDef[] => {
    const cols: ColDef[] = [
      {
        field: 'filename',
        headerName: 'Transcript',
        width: 200,
        pinned: 'left',
        editable: false,
        cellClass: 'font-semibold'
      }
    ];
    
    // Add columns for each variable
    allVariableNames.forEach(varName => {
      cols.push({
        field: varName,
        headerName: varName,
        width: 150,
        editable: true,
        headerCheckboxSelection: true,
        headerCheckboxSelectionFilteredOnly: false,
        checkboxSelection: (params: HeaderCheckboxSelectionCallbackParams) => {
          // Only show checkbox in header row
          return params.api.getDisplayedRowCount() === 0;
        },
        headerComponentParams: {
          checkboxSelection: true,
          onSelectionChanged: (selected: boolean) => {
            const newSelection = new Set(selectedVariables);
            if (selected) {
              newSelection.add(varName);
            } else {
              newSelection.delete(varName);
            }
            setSelectedVariables(newSelection);
          }
        }
      });
    });
    
    return cols;
  }, [allVariableNames, selectedVariables]);

  const handleSave = useCallback((modifiedData: VariableTableRow[]) => {
    // Build variable data map
    const variableData = new Map<string, Map<string, string>>();
    
    modifiedData.forEach(row => {
      const transcriptVars = new Map<string, string>();
      
      allVariableNames.forEach(varName => {
        if (row[varName]) {
          transcriptVars.set(varName, row[varName]);
        }
      });
      
      if (transcriptVars.size > 0) {
        variableData.set(row.transcriptId, transcriptVars);
      }
    });
    
    // Proceed with selected variables (max 2)
    const selected = Array.from(selectedVariables).slice(0, 2);
    onProceed(selected, variableData);
  }, [allVariableNames, selectedVariables, onProceed]);

  const handleAddVariable = useCallback(() => {
    if (!newVariableName.trim()) return;
    
    // This would need to update the column definitions
    // For now, we'll just show an alert
    alert(`To add variable "${newVariableName}", you'll need to manually enter values for each transcript`);
    setNewVariableName('');
  }, [newVariableName]);

  // Show different UI if no variables were discovered
  if (!hasDiscoveredVariables && !manualVariableMode) {
    return (
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
            No Variables Detected
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The system did not detect any header variables in your transcripts.
          </p>
          <div className="flex flex-col space-y-3">
            <Button
              onClick={() => onProceed([], new Map())}
              variant="secondary"
              size="sm"
            >
              Continue without bucketing (single pool)
            </Button>
            <Button
              onClick={() => setManualVariableMode(true)}
              variant="primary"
              size="sm"
            >
              Define variables manually
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <HilTableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Review Transcript Variables"
      description={
        <div>
          <p className="mb-2">
            Review and correct the extracted variables below. Select up to 2 variables to use for bucketing analysis.
          </p>
          {selectedVariables.size > 0 && (
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Selected for bucketing: {Array.from(selectedVariables).join(', ')} 
              {selectedVariables.size > 2 && ' (only first 2 will be used)'}
            </p>
          )}
        </div>
      }
      data={rowData}
      columns={columns}
      onSave={handleSave}
      height="500px"
    />
  );
};