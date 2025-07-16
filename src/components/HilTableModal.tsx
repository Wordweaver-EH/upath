import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, GridApi, GridReadyEvent, CellValueChangedEvent } from 'ag-grid-community';
import { Button } from './ui/Button';

interface HilTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  data: any[];
  columns: ColDef[];
  onSave?: (modifiedData: any[]) => void;
  height?: string;
  readOnly?: boolean;
}

export const HilTableModal: React.FC<HilTableModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  data,
  columns,
  onSave,
  height = '400px',
  readOnly = false
}) => {
  const gridRef = useRef<AgGridReact>(null);
  const [gridApi, setGridApi] = useState<GridApi | null>(null);
  const [modifiedData, setModifiedData] = useState<any[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Reset modified data when modal opens
  useEffect(() => {
    if (isOpen) {
      setModifiedData([...data]);
      setHasChanges(false);
    }
  }, [isOpen, data]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    setGridApi(params.api);
  }, []);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    if (readOnly) return;
    
    const updatedData = [...modifiedData];
    const rowIndex = event.node.rowIndex;
    if (rowIndex !== null && rowIndex >= 0) {
      updatedData[rowIndex] = { ...event.data };
      setModifiedData(updatedData);
      setHasChanges(true);
    }
  }, [modifiedData, readOnly]);

  const handleSave = useCallback(() => {
    if (onSave && hasChanges) {
      onSave(modifiedData);
    }
    onClose();
  }, [onSave, hasChanges, modifiedData, onClose]);

  const handleCancel = useCallback(() => {
    if (hasChanges) {
      const confirmClose = window.confirm('You have unsaved changes. Are you sure you want to close?');
      if (!confirmClose) return;
    }
    onClose();
  }, [hasChanges, onClose]);

  const handleRevert = useCallback(() => {
    setModifiedData([...data]);
    setHasChanges(false);
    if (gridApi) {
      gridApi.setRowData([...data]);
    }
  }, [data, gridApi]);

  // Apply theme class based on current theme
  const isDarkMode = document.documentElement.classList.contains('dark');
  const gridTheme = isDarkMode ? 'ag-theme-material-dark' : 'ag-theme-material';

  // Enhanced column definitions with editable by default
  const enhancedColumns = useMemo(() => {
    return columns.map(col => ({
      ...col,
      editable: !readOnly && (col.editable !== false), // Editable unless explicitly false or readOnly
      cellClass: col.cellClass || 'ag-cell-wrap-text',
      autoHeight: col.autoHeight !== false
    }));
  }, [columns, readOnly]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hil-table-modal-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-[90vw] max-w-6xl max-h-[90vh] flex flex-col m-4">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
          <div className="flex-1">
            <h2 id="hil-table-modal-title" className="text-2xl font-bold text-gray-900 dark:text-white">
              {title}
            </h2>
            {description && (
              <p className="text-gray-600 dark:text-gray-300 mt-2">{description}</p>
            )}
          </div>
          <button 
            onClick={handleCancel} 
            aria-label="Close modal" 
            className="p-1 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Grid Container */}
        <div className="flex-1 p-6 overflow-hidden">
          <div className={`${gridTheme} w-full`} style={{ height }}>
            <AgGridReact
              ref={gridRef}
              rowData={modifiedData}
              columnDefs={enhancedColumns}
              onGridReady={onGridReady}
              onCellValueChanged={onCellValueChanged}
              defaultColDef={{
                resizable: true,
                sortable: true,
                filter: true
              }}
              animateRows={true}
              domLayout="normal"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            {hasChanges && (
              <span className="text-sm text-yellow-600 dark:text-yellow-400">
                • Unsaved changes
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            {hasChanges && !readOnly && (
              <Button
                onClick={handleRevert}
                variant="secondary"
                size="sm"
              >
                Revert Changes
              </Button>
            )}
            <Button
              onClick={handleCancel}
              variant="secondary"
              size="sm"
            >
              {readOnly ? 'Close' : 'Cancel'}
            </Button>
            {!readOnly && onSave && (
              <Button
                onClick={handleSave}
                variant="primary"
                size="sm"
                disabled={!hasChanges}
              >
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};