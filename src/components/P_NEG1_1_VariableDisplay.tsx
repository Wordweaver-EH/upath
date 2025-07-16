import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-community';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { DiscoveredVariable } from '../../types';
import { useTranscriptStore } from '../stores/transcriptStore';
import { useSettingsStore } from '../stores/settingsStore';

interface VariableTableRow {
  transcriptId: string;
  filename: string;
  [variableName: string]: string; // Dynamic columns for discovered variables
}

export const P_NEG1_1_VariableDisplay: React.FC = () => {
  const { rawTranscripts, processedData } = useTranscriptStore();
  const { setBucketingConfig } = useSettingsStore();
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [selectedVariables, setSelectedVariables] = useState<Set<string>>(new Set());
  const [showBinningConfig, setShowBinningConfig] = useState(false);
  const [modifiedData, setModifiedData] = useState<VariableTableRow[]>([]);

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

  // Initialize modified data
  useEffect(() => {
    setModifiedData([...rowData]);
  }, [rowData]);

  // Build column definitions with checkboxes in headers
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
    
    // Add columns for each variable with checkbox in header
    allVariableNames.forEach(varName => {
      cols.push({
        field: varName,
        headerName: varName,
        width: 150,
        editable: true,
        headerComponent: () => (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedVariables.has(varName)}
              onChange={(e) => {
                const newSelection = new Set(selectedVariables);
                if (e.target.checked && newSelection.size < 2) {
                  newSelection.add(varName);
                } else if (!e.target.checked) {
                  newSelection.delete(varName);
                }
                setSelectedVariables(newSelection);
              }}
              disabled={!selectedVariables.has(varName) && selectedVariables.size >= 2}
            />
            <span>{varName}</span>
          </div>
        )
      });
    });
    
    return cols;
  }, [allVariableNames, selectedVariables]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    const updatedData = [...modifiedData];
    const rowIndex = event.node.rowIndex;
    if (rowIndex !== null && rowIndex >= 0) {
      updatedData[rowIndex] = { ...event.data };
      setModifiedData(updatedData);
    }
  }, [modifiedData]);

  const handleProceedWithBucketing = useCallback(() => {
    // Save modified variable data back to store
    // TODO: Update transcript data with user corrections
    
    if (selectedVariables.size > 0) {
      setShowBinningConfig(true);
    } else {
      // Continue without bucketing
      setBucketingConfig(false, 'suggestion', 'score');
    }
  }, [selectedVariables, setBucketingConfig]);

  // Apply theme class based on current theme
  const isDarkMode = document.documentElement.classList.contains('dark');
  const gridTheme = isDarkMode ? 'ag-theme-material-dark' : 'ag-theme-material';

  // Show message if no variables found
  if (allVariableNames.length === 0) {
    return (
      <div className="p-8 text-center">
        <h3 className="text-lg font-semibold mb-4">No Variables Detected</h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          The system did not detect any header variables in your transcripts.
        </p>
        <div className="flex justify-center gap-4">
          <Button
            onClick={() => setBucketingConfig(false, 'suggestion', 'score')}
            variant="primary"
            size="sm"
          >
            Continue Without Bucketing
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold">Variable Review & Bucketing Selection</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Review and correct extracted variables. Select up to 2 variables for bucketing analysis.
        </p>
        {selectedVariables.size > 0 && (
          <p className="text-sm text-blue-600 dark:text-blue-400 mt-2">
            Selected for bucketing: {Array.from(selectedVariables).join(', ')}
          </p>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 p-4">
        <div className={`${gridTheme} w-full h-full`}>
          <AgGridReact
            rowData={modifiedData}
            columnDefs={columns}
            onGridReady={onGridReady}
            onCellValueChanged={onCellValueChanged}
            defaultColDef={{
              resizable: true,
              sortable: true,
              filter: true
            }}
            animateRows={true}
            domLayout="autoHeight"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
        <Button
          onClick={() => setBucketingConfig(false, 'suggestion', 'score')}
          variant="secondary"
          size="sm"
        >
          Continue Without Bucketing
        </Button>
        <Button
          onClick={handleProceedWithBucketing}
          variant="primary"
          size="sm"
        >
          {selectedVariables.size > 0 ? 'Configure Bucketing' : 'Continue'}
        </Button>
      </div>
    </div>
  );
};