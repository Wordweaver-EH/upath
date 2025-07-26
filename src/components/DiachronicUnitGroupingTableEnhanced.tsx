import React, { useState, useMemo, useCallback, useRef } from 'react';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P1_4_Output, P1_3_Output, DiachronicUnit, SortedSegment } from '../../types';
import { ChevronDownIcon, ChevronRightIcon } from '../../constants';
import { AgGridReact } from 'ag-grid-react';
import { ColDef, ModuleRegistry, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface DiachronicUnitGroupingTableProps {
  groupingData: P1_4_Output;
  sortedSegmentsData?: P1_3_Output;
  theme: 'light' | 'dark';
  onGroupingChange?: (updatedData: P1_4_Output) => void;
  filename?: string;
}

// Phase colors mapping
const PHASE_COLORS = {
  'Initial State': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' },
  'Core Experience': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', border: 'border-green-300 dark:border-green-700' },
  'Final Action': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-300 dark:border-orange-700' },
  'Post-Hoc Reflection': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' }
};

// View mode type
type ViewMode = 'cards' | 'table';

// Drag context interface
interface DragContext {
  segmentId: string;
  fromDuId: string;
  segment: SortedSegment;
}

// Draggable Segment Card Component
const DraggableSegmentCard: React.FC<{
  segment: SortedSegment;
  duId: string;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
}> = ({ segment, duId, onRemove, onDragStart }) => {
  const segmentColors = PHASE_COLORS[segment.coarse_phase as keyof typeof PHASE_COLORS];
  
  return (
    <div 
      draggable
      onDragStart={onDragStart}
      className={`p-2 rounded-md border ${segmentColors.border} ${segmentColors.bg} ${segmentColors.bg.includes('100') ? 'bg-opacity-30' : 'bg-opacity-10'} cursor-move hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1">
            <span className="font-mono text-xs">{segment.segment_id}</span>
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${segmentColors.bg} ${segmentColors.text}`}>
              {segment.coarse_phase}
            </span>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Index: {segment.chronological_index}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
          title="Remove from this DU"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p className="text-xs mb-1 line-clamp-2">{segment.segment_text}</p>
      <div className="text-xs text-gray-500 dark:text-gray-400">
        <span>Line {segment.original_utterance.original_line_num}</span>
      </div>
    </div>
  );
};

// DU Card Component
const DiachronicUnitCard: React.FC<{
  unit: DiachronicUnit;
  segments: SortedSegment[];
  isExpanded: boolean;
  onToggle: () => void;
  onDescriptionChange: (description: string) => void;
  onSegmentRemove: (segmentId: string) => void;
  theme: 'light' | 'dark';
  onSplit: () => void;
  onMergeWithNext: boolean;
  canDelete: boolean;
  onDelete: () => void;
  onMerge?: () => void;
  onDrop: (segmentId: string, segment: SortedSegment) => void;
  dragContext: DragContext | null;
  onDragStart: (segmentId: string, duId: string, segment: SortedSegment) => void;
}> = ({ 
  unit, 
  segments, 
  isExpanded, 
  onToggle, 
  onDescriptionChange, 
  onSegmentRemove,
  theme,
  onSplit,
  onMergeWithNext,
  canDelete,
  onDelete,
  onMerge,
  onDrop,
  dragContext,
  onDragStart
}) => {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState(unit.description);
  const [isDragOver, setIsDragOver] = useState(false);

  // Calculate dominant phase color
  const phaseCounts = segments.reduce((acc, seg) => {
    acc[seg.coarse_phase] = (acc[seg.coarse_phase] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const dominantPhase = Object.entries(phaseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Initial State';
  const colors = PHASE_COLORS[dominantPhase as keyof typeof PHASE_COLORS];

  const handleDescriptionSave = () => {
    onDescriptionChange(tempDescription);
    setIsEditingDescription(false);
  };

  const handleDescriptionCancel = () => {
    setTempDescription(unit.description);
    setIsEditingDescription(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (dragContext && dragContext.fromDuId !== unit.unit_id) {
      setIsDragOver(true);
    }
  };
  
  const handleDragLeave = () => {
    setIsDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (dragContext && dragContext.fromDuId !== unit.unit_id) {
      onDrop(dragContext.segmentId, dragContext.segment);
    }
  };

  return (
    <div 
      className={`rounded-lg border ${colors.border} ${theme === 'dark' ? 'bg-dark-bg-alt' : 'bg-light-bg-alt'} overflow-hidden ${isDragOver ? 'ring-2 ring-blue-500' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div 
        className={`p-2 cursor-pointer ${colors.bg} ${colors.bg.includes('100') ? 'bg-opacity-50' : 'bg-opacity-20'}`}
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-500 dark:text-gray-400 text-sm">
                {isExpanded ? ChevronDownIcon : ChevronRightIcon}
              </span>
              <span className="font-mono text-xs font-bold">{unit.unit_id}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                {segments.length}
              </span>
            </div>
            {isEditingDescription ? (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={tempDescription}
                  onChange={(e) => setTempDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDescriptionSave();
                    if (e.key === 'Escape') handleDescriptionCancel();
                  }}
                  className="px-1 py-0.5 text-xs border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 flex-1"
                  autoFocus
                />
                <button
                  onClick={handleDescriptionSave}
                  className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 text-xs"
                >
                  ✓
                </button>
                <button
                  onClick={handleDescriptionCancel}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 text-xs"
                >
                  ✗
                </button>
              </div>
            ) : (
              <div 
                className="group"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingDescription(true);
                }}
              >
                <span className="text-xs line-clamp-2">{unit.description}</span>
              </div>
            )}
          </div>
          {/* Action buttons */}
          <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
            <div className="flex gap-0.5">
              <button
                onClick={onSplit}
                title="Split this DU"
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                disabled={segments.length < 2}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
              {onMergeWithNext && (
                <button
                  onClick={onMerge}
                  title="Merge with next DU"
                  className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              )}
              {canDelete && (
                <button
                  onClick={onDelete}
                  title="Delete this DU"
                  className="p-0.5 hover:bg-red-200 dark:hover:bg-red-900 rounded transition-colors text-red-600 dark:text-red-400"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
          {segments.map((segment) => (
            <DraggableSegmentCard
              key={segment.segment_id}
              segment={segment}
              duId={unit.unit_id}
              onRemove={() => onSegmentRemove(segment.segment_id)}
              onDragStart={(e) => {
                onDragStart(segment.segment_id, unit.unit_id, segment);
              }}
            />
          ))}
          
          {segments.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 italic border border-dashed border-gray-300 dark:border-gray-600 rounded text-xs">
              Drop segments here
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// AG-Grid Table Row Type
interface TableRow {
  duId: string;
  duDescription: string;
  segmentId: string;
  segmentText: string;
  phase: string;
  chronologicalIndex: number;
  originalLine: number;
  originalUtterance: string;
}

export const DiachronicUnitGroupingTable: React.FC<DiachronicUnitGroupingTableProps> = ({
  groupingData,
  sortedSegmentsData,
  theme,
  onGroupingChange,
  filename
}) => {
  // Initialize with all units expanded
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    groupingData.diachronic_units.forEach(unit => {
      initialExpanded.add(unit.unit_id);
    });
    return initialExpanded;
  });
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [dragContext, setDragContext] = useState<DragContext | null>(null);
  const gridRef = useRef<AgGridReact>(null);
  
  // Create segment lookup map
  const segmentLookup = useMemo(() => {
    const lookup = new Map<string, SortedSegment>();
    if (sortedSegmentsData) {
      sortedSegmentsData.sorted_segments.forEach(seg => {
        lookup.set(seg.segment_id, seg);
      });
    }
    return lookup;
  }, [sortedSegmentsData]);

  // Map units to their segments
  const unitsWithSegments = useMemo(() => {
    return groupingData.diachronic_units.map(unit => ({
      unit,
      segments: unit.source_segment_ids
        .map(id => segmentLookup.get(id))
        .filter((seg): seg is SortedSegment => seg !== undefined)
        .sort((a, b) => a.chronological_index - b.chronological_index)
    }));
  }, [groupingData, segmentLookup]);

  // Generate table rows for AG-Grid
  const tableRows = useMemo(() => {
    const rows: TableRow[] = [];
    unitsWithSegments.forEach(({ unit, segments }) => {
      segments.forEach(segment => {
        rows.push({
          duId: unit.unit_id,
          duDescription: unit.description,
          segmentId: segment.segment_id,
          segmentText: segment.segment_text,
          phase: segment.coarse_phase,
          chronologicalIndex: segment.chronological_index,
          originalLine: segment.original_utterance.original_line_num,
          originalUtterance: segment.original_utterance.utterance_text
        });
      });
    });
    return rows;
  }, [unitsWithSegments]);

  // Column definitions for AG-Grid
  const columnDefs: ColDef[] = useMemo(() => [
    {
      field: 'selection',
      headerName: '',
      width: 50,
      pinned: 'left',
      checkboxSelection: true,
      headerCheckboxSelection: true,
      headerCheckboxSelectionFilteredOnly: true
    },
    {
      field: 'duId',
      headerName: 'DU ID',
      width: 100,
      pinned: 'left',
      cellClass: 'selectable-cell'
    },
    {
      field: 'duDescription',
      headerName: 'DU Description',
      width: 250,
      cellClass: 'selectable-cell',
      wrapText: true,
      autoHeight: true
    },
    {
      field: 'segmentId',
      headerName: 'Segment ID',
      width: 120
    },
    {
      field: 'segmentText',
      headerName: 'Segment Text',
      flex: 1,
      minWidth: 300,
      wrapText: true,
      autoHeight: true
    },
    {
      field: 'originalLine',
      headerName: 'Line #',
      width: 80
    },
    {
      field: 'originalUtterance',
      headerName: 'Original Utterance',
      width: 300,
      wrapText: true,
      autoHeight: true
    }
  ], [theme]);

  const toggleUnit = useCallback((unitId: string) => {
    setExpandedUnits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(unitId)) {
        newSet.delete(unitId);
      } else {
        newSet.add(unitId);
      }
      return newSet;
    });
  }, []);

  const handleDescriptionChange = useCallback((unitId: string, newDescription: string) => {
    if (!onGroupingChange) return;
    
    const updatedData = {
      ...groupingData,
      diachronic_units: groupingData.diachronic_units.map(unit => 
        unit.unit_id === unitId 
          ? { ...unit, description: newDescription }
          : unit
      )
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

  const handleSegmentRemove = useCallback((unitId: string, segmentId: string) => {
    if (!onGroupingChange) return;
    
    const updatedData = {
      ...groupingData,
      diachronic_units: groupingData.diachronic_units.map(unit => 
        unit.unit_id === unitId 
          ? { ...unit, source_segment_ids: unit.source_segment_ids.filter(id => id !== segmentId) }
          : unit
      ),
      excluded_segment_ids: [...(groupingData.excluded_segment_ids || []), segmentId]
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

  const handleSegmentDrop = useCallback((targetUnitId: string, segmentId: string, segment: SortedSegment) => {
    if (!onGroupingChange || !dragContext) return;
    
    const updatedData = {
      ...groupingData,
      diachronic_units: groupingData.diachronic_units.map(unit => {
        if (unit.unit_id === dragContext.fromDuId) {
          // Remove from source
          return { ...unit, source_segment_ids: unit.source_segment_ids.filter(id => id !== segmentId) };
        } else if (unit.unit_id === targetUnitId) {
          // Add to target
          return { ...unit, source_segment_ids: [...unit.source_segment_ids, segmentId] };
        }
        return unit;
      })
    };
    
    onGroupingChange(updatedData);
    setDragContext(null);
  }, [groupingData, onGroupingChange, dragContext]);

  const handleDragStart = useCallback((segmentId: string, duId: string, segment: SortedSegment) => {
    setDragContext({ segmentId, fromDuId: duId, segment });
  }, []);

  const handleSplitUnit = useCallback((unitId: string) => {
    if (!onGroupingChange) return;
    
    const unitIndex = groupingData.diachronic_units.findIndex(u => u.unit_id === unitId);
    if (unitIndex === -1) return;
    
    const unit = groupingData.diachronic_units[unitIndex];
    const segments = unit.source_segment_ids
      .map(id => segmentLookup.get(id))
      .filter((seg): seg is SortedSegment => seg !== undefined)
      .sort((a, b) => a.chronological_index - b.chronological_index);
    
    if (segments.length < 2) return;
    
    // Split at midpoint
    const midpoint = Math.floor(segments.length / 2);
    const firstHalf = segments.slice(0, midpoint);
    const secondHalf = segments.slice(midpoint);
    
    // Generate new unit ID
    const maxId = Math.max(...groupingData.diachronic_units
      .map(u => parseInt(u.unit_id.replace('du_', '')) || 0));
    const newUnitId = `du_${maxId + 1}`;
    
    const updatedUnits = [...groupingData.diachronic_units];
    updatedUnits[unitIndex] = {
      ...unit,
      source_segment_ids: firstHalf.map(s => s.segment_id),
      description: unit.description + " (first part)"
    };
    updatedUnits.splice(unitIndex + 1, 0, {
      unit_id: newUnitId,
      description: unit.description + " (second part)",
      source_segment_ids: secondHalf.map(s => s.segment_id)
    });
    
    onGroupingChange({
      ...groupingData,
      diachronic_units: updatedUnits
    });
  }, [groupingData, onGroupingChange, segmentLookup]);

  const handleMergeUnits = useCallback((unitId: string) => {
    if (!onGroupingChange) return;
    
    const unitIndex = groupingData.diachronic_units.findIndex(u => u.unit_id === unitId);
    if (unitIndex === -1 || unitIndex === groupingData.diachronic_units.length - 1) return;
    
    const currentUnit = groupingData.diachronic_units[unitIndex];
    const nextUnit = groupingData.diachronic_units[unitIndex + 1];
    
    const updatedUnits = [...groupingData.diachronic_units];
    updatedUnits[unitIndex] = {
      ...currentUnit,
      source_segment_ids: [...currentUnit.source_segment_ids, ...nextUnit.source_segment_ids],
      description: `${currentUnit.description} + ${nextUnit.description}`
    };
    updatedUnits.splice(unitIndex + 1, 1);
    
    onGroupingChange({
      ...groupingData,
      diachronic_units: updatedUnits
    });
  }, [groupingData, onGroupingChange]);

  const handleDeleteUnit = useCallback((unitId: string) => {
    if (!onGroupingChange) return;
    
    const unit = groupingData.diachronic_units.find(u => u.unit_id === unitId);
    if (!unit) return;
    
    const updatedData = {
      ...groupingData,
      diachronic_units: groupingData.diachronic_units.filter(u => u.unit_id !== unitId),
      excluded_segment_ids: [...(groupingData.excluded_segment_ids || []), ...unit.source_segment_ids]
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

  const handleCreateNewDU = useCallback(() => {
    if (!onGroupingChange) return;
    
    const maxId = Math.max(...groupingData.diachronic_units
      .map(u => parseInt(u.unit_id.replace('du_', '')) || 0), 0);
    const newUnitId = `du_${maxId + 1}`;
    
    const updatedData = {
      ...groupingData,
      diachronic_units: [...groupingData.diachronic_units, {
        unit_id: newUnitId,
        description: "New Diachronic Unit",
        source_segment_ids: []
      }]
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

  const handleSegmentRestore = useCallback((segmentId: string, targetUnitId?: string) => {
    if (!onGroupingChange) return;
    
    const updatedData = { ...groupingData };
    
    // Remove from excluded list
    updatedData.excluded_segment_ids = (updatedData.excluded_segment_ids || []).filter(id => id !== segmentId);
    
    // If target unit specified, add to that unit
    if (targetUnitId) {
      updatedData.diachronic_units = updatedData.diachronic_units.map(unit => 
        unit.unit_id === targetUnitId 
          ? { ...unit, source_segment_ids: [...unit.source_segment_ids, segmentId] }
          : unit
      );
    }
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

  // Calculate excluded segments
  const excludedSegments = useMemo(() => {
    if (!sortedSegmentsData) return [];
    
    const assignedSegmentIds = new Set(groupingData.diachronic_units.flatMap(u => u.source_segment_ids));
    const excludedIds = groupingData.excluded_segment_ids || [];
    
    // Get all unassigned segments
    const allUnassignedIds = sortedSegmentsData.sorted_segments
      .filter(seg => !assignedSegmentIds.has(seg.segment_id))
      .map(seg => seg.segment_id);
    
    // Combine with explicitly excluded segments
    const allExcludedIds = new Set([...excludedIds, ...allUnassignedIds]);
    
    return sortedSegmentsData.sorted_segments
      .filter(seg => allExcludedIds.has(seg.segment_id))
      .sort((a, b) => a.chronological_index - b.chronological_index);
  }, [sortedSegmentsData, groupingData]);

  const copySelectedRowsToClipboard = useCallback(() => {
    if (!gridRef.current) return;
    
    const selectedNodes = gridRef.current.api.getSelectedNodes();
    if (selectedNodes.length === 0) {
      alert('Please select rows to copy');
      return;
    }
    
    // Get column headers
    const headers = ['DU ID', 'DU Description', 'Segment ID', 'Segment Text', 'Phase', 'Chrono Index'];
    
    // Build table data
    const rows = selectedNodes.map(node => {
      const data = node.data;
      return [
        data.duId,
        data.duDescription,
        data.segmentId,
        data.segmentText,
        data.phase,
        data.chronoIndex
      ].join('\t');
    });
    
    // Combine headers and rows with tab separation
    const tableData = [headers.join('\t'), ...rows].join('\n');
    
    // Copy to clipboard
    navigator.clipboard.writeText(tableData).then(() => {
      // Visual feedback
      const originalText = 'Copy Selected Rows';
      const button = document.querySelector('[data-copy-button]');
      if (button) {
        button.textContent = '✓ Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  }, []);

  const exportToCsv = useCallback(() => {
    const csvData: any[] = [];
    
    unitsWithSegments.forEach(({ unit, segments }) => {
      segments.forEach((segment, index) => {
        csvData.push({
          'DU ID': unit.unit_id,
          'DU Description': unit.description,
          'Segment Position': index + 1,
          'Segment ID': segment.segment_id,
          'Phase': segment.coarse_phase,
          'Chronological Index': segment.chronological_index,
          'Segment Text': segment.segment_text,
          'Placement Justification': segment.placement_justification,
          'Original Line': segment.original_utterance.original_line_num,
          'Original Utterance': segment.original_utterance.utterance_text
        });
      });
    });
    
    // Add excluded segments
    excludedSegments.forEach((segment, index) => {
      csvData.push({
        'DU ID': 'EXCLUDED',
        'DU Description': 'Not assigned to any DU',
        'Segment Position': index + 1,
        'Segment ID': segment.segment_id,
        'Phase': segment.coarse_phase,
        'Chronological Index': segment.chronological_index,
        'Segment Text': segment.segment_text,
        'Placement Justification': segment.placement_justification,
        'Original Line': segment.original_utterance.original_line_num,
        'Original Utterance': segment.original_utterance.utterance_text
      });
    });
    
    const columns = [
      { field: 'DU ID', headerName: 'DU ID' },
      { field: 'DU Description', headerName: 'DU Description' },
      { field: 'Segment Position', headerName: 'Segment Position' },
      { field: 'Segment ID', headerName: 'Segment ID' },
      { field: 'Phase', headerName: 'Phase' },
      { field: 'Chronological Index', headerName: 'Chronological Index' },
      { field: 'Segment Text', headerName: 'Segment Text' },
      { field: 'Placement Justification', headerName: 'Placement Justification' },
      { field: 'Original Line', headerName: 'Original Line' },
      { field: 'Original Utterance', headerName: 'Original Utterance' }
    ];
    
    const csv = convertToCSV(csvData, columns);
    const exportFilename = filename ? 
      `${filename.replace(/\.[^/.]+$/, '')}_P1.4_diachronic_unit_grouping.csv` : 
      'P1.4_diachronic_unit_grouping.csv';
    downloadCSV(csv, exportFilename);
  }, [unitsWithSegments, excludedSegments, filename]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    
    // Check for duplicate assignments
    const segmentCounts = new Map<string, number>();
    groupingData.diachronic_units.forEach(unit => {
      unit.source_segment_ids.forEach(id => {
        segmentCounts.set(id, (segmentCounts.get(id) || 0) + 1);
      });
    });
    const duplicates = Array.from(segmentCounts.entries()).filter(([_, count]) => count > 1);
    if (duplicates.length > 0) {
      issues.push(`${duplicates.length} segments are assigned to multiple DUs`);
    }
    
    return issues;
  }, [groupingData]);

  return (
    <div className="space-y-4">
      {/* Summary and Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold mb-2">Diachronic Unit Grouping</h3>
          <div className="text-sm text-light-sidenote dark:text-dark-sidenote space-y-1">
            <div>Total DUs: {groupingData.diachronic_units.length}</div>
            <div>Total segments: {segmentLookup.size}</div>
            {excludedSegments.length > 0 && (
              <div className="text-yellow-600 dark:text-yellow-400">⚠️ {excludedSegments.length} segments are not assigned to any DU</div>
            )}
            {validationIssues.map((issue, idx) => (
              <div key={idx} className="text-red-600 dark:text-red-400">⚠️ {issue}</div>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {/* View mode toggle */}
          <div className="flex rounded overflow-hidden border border-light-border dark:border-dark-border">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 text-sm ${viewMode === 'cards' ? 'bg-light-primary dark:bg-dark-primary text-white' : 'bg-light-bg-alt dark:bg-dark-bg-alt text-light-text dark:text-dark-text'}`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1 text-sm ${viewMode === 'table' ? 'bg-light-primary dark:bg-dark-primary text-white' : 'bg-light-bg-alt dark:bg-dark-bg-alt text-light-text dark:text-dark-text'}`}
            >
              Table
            </button>
          </div>
          <button
            onClick={handleCreateNewDU}
            className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
          >
            + New DU
          </button>
          <button
            onClick={exportToCsv}
            className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
          >
            Download CSV
          </button>
        </div>
      </div>

      {/* Copy button for table view */}
      {viewMode === 'table' && (
        <div className="mb-2 flex gap-2">
          <button
            onClick={copySelectedRowsToClipboard}
            data-copy-button
            className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Copy Selected Rows
          </button>
          <span className="text-sm text-light-sidenote dark:text-dark-sidenote italic">
            Select rows with checkboxes, then click to copy as table
          </span>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'cards' ? (
        <>
          {/* DU Cards in Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {unitsWithSegments.map(({ unit, segments }, index) => (
              <DiachronicUnitCard
                key={unit.unit_id}
                unit={unit}
                segments={segments}
                isExpanded={expandedUnits.has(unit.unit_id)}
                onToggle={() => toggleUnit(unit.unit_id)}
                onDescriptionChange={(desc) => handleDescriptionChange(unit.unit_id, desc)}
                onSegmentRemove={(segId) => handleSegmentRemove(unit.unit_id, segId)}
                theme={theme}
                onSplit={() => handleSplitUnit(unit.unit_id)}
                onMergeWithNext={index < unitsWithSegments.length - 1}
                canDelete={groupingData.diachronic_units.length > 1}
                onDelete={() => handleDeleteUnit(unit.unit_id)}
                onMerge={() => handleMergeUnits(unit.unit_id)}
                onDrop={(segId, seg) => handleSegmentDrop(unit.unit_id, segId, seg)}
                dragContext={dragContext}
                onDragStart={handleDragStart}
              />
            ))}
            
            {/* Excluded Segments Section */}
            {excludedSegments.length > 0 && (
              <div className={`mb-4 rounded-lg border-2 border-gray-400 dark:border-gray-600 ${theme === 'dark' ? 'bg-dark-bg-alt' : 'bg-light-bg-alt'} overflow-hidden`}>
                <div 
                  className={`p-4 cursor-pointer bg-gray-100 dark:bg-gray-800 bg-opacity-50`}
                  onClick={() => toggleUnit('excluded')}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 dark:text-gray-400">
                        {expandedUnits.has('excluded') ? ChevronDownIcon : ChevronRightIcon}
                      </span>
                      <span className="font-mono text-sm font-bold text-gray-600 dark:text-gray-400">Excluded Segments</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">Segments not assigned to any DU</span>
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                      {excludedSegments.length} segments
                    </span>
                  </div>
                </div>
                
                {expandedUnits.has('excluded') && (
                  <div className="p-4 space-y-3">
                    {excludedSegments.map((segment) => (
                      <div key={segment.segment_id} className="flex items-start gap-2">
                        <DraggableSegmentCard
                          segment={segment}
                          duId="excluded"
                          onRemove={() => {}}
                          onDragStart={(e) => {
                            handleDragStart(segment.segment_id, "excluded", segment);
                          }}
                        />
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleSegmentRestore(segment.segment_id, e.target.value);
                            }
                          }}
                          className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                          defaultValue=""
                        >
                          <option value="">Add to DU...</option>
                          {groupingData.diachronic_units.map(unit => (
                            <option key={unit.unit_id} value={unit.unit_id}>
                              {unit.unit_id}: {unit.description.substring(0, 30)}...
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic space-y-1">
            <div>💡 Click on DU headers to expand/collapse</div>
            <div>✏️ Click on descriptions to edit them inline</div>
            <div>🔄 Drag segments between DUs to reorganize</div>
            <div>✂️ Use the split button to divide a DU into two parts</div>
            <div>➕ Use "Merge with next" to combine adjacent DUs</div>
            <div>🗑️ Delete DUs to move all segments to excluded</div>
            <div>📦 Create new DUs with the "+ New DU" button</div>
          </div>
        </>
      ) : (
        /* Table View */
        <div 
          className={`${theme === 'dark' ? 'ag-theme-alpine-dark' : 'ag-theme-alpine'} w-full`}
          style={{ height: 600 }}
        >
          <AgGridReact
            ref={gridRef}
            rowData={tableRows}
            columnDefs={columnDefs}
            defaultColDef={{
              sortable: true,
              filter: true,
              resizable: true,
              wrapText: true,
              autoHeight: true
            }}
            animateRows={true}
            theme="legacy"
            enableCellTextSelection={true}
            ensureDomOrder={true}
            suppressRowClickSelection={true}
            suppressCellFocus={false}
            rowSelection="multiple"
          />
        </div>
      )}
      
      {/* Custom styles for line clamping and text selection */}
      <style>{`
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        
        /* Enable text selection in AG-Grid cells */
        .ag-cell .selectable-cell,
        .ag-cell-value {
          user-select: text !important;
          -webkit-user-select: text !important;
          -moz-user-select: text !important;
          -ms-user-select: text !important;
        }
        
        /* Override AG-Grid's default selection prevention for range selection */
        .ag-root-wrapper,
        .ag-root,
        .ag-body-viewport,
        .ag-center-cols-container,
        .ag-cell {
          user-select: auto !important;
          -webkit-user-select: auto !important;
        }
        
        /* Ensure range selection is visible */
        .ag-range-selected {
          background-color: rgba(14, 101, 235, 0.2) !important;
        }
        
        /* Style for range selection border */
        .ag-range-selection {
          border: 2px solid rgb(14, 101, 235) !important;
        }
      `}</style>
    </div>
  );
};