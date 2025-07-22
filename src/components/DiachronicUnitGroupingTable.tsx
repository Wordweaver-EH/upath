import React, { useState, useMemo, useCallback } from 'react';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P1_4_Output, P1_3_Output, DiachronicUnit, SortedSegment } from '../../types';
import { ChevronDownIcon, ChevronRightIcon } from '../../constants';

interface DiachronicUnitGroupingTableProps {
  groupingData: P1_4_Output;
  sortedSegmentsData?: P1_3_Output; // For segment details
  theme: 'light' | 'dark';
  onGroupingChange?: (updatedData: P1_4_Output) => void;
  filename?: string;
}

// Phase colors mapping (consistent with other components)
const PHASE_COLORS = {
  'Initial State': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' },
  'Core Experience': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', border: 'border-green-300 dark:border-green-700' },
  'Final Action': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-300 dark:border-orange-700' },
  'Post-Hoc Reflection': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' }
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
  onDelete
}) => {
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [tempDescription, setTempDescription] = useState(unit.description);

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

  return (
    <div className={`mb-4 rounded-lg border-2 ${colors.border} ${theme === 'dark' ? 'bg-dark-bg-alt' : 'bg-light-bg-alt'} overflow-hidden`}>
      {/* Header */}
      <div 
        className={`p-4 cursor-pointer ${colors.bg} ${colors.bg.includes('100') ? 'bg-opacity-50' : 'bg-opacity-20'}`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 dark:text-gray-400">
              {isExpanded ? ChevronDownIcon : ChevronRightIcon}
            </span>
            <span className="font-mono text-sm font-bold">{unit.unit_id}</span>
            {isEditingDescription ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={tempDescription}
                  onChange={(e) => setTempDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDescriptionSave();
                    if (e.key === 'Escape') handleDescriptionCancel();
                  }}
                  className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  autoFocus
                />
                <button
                  onClick={handleDescriptionSave}
                  className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                >
                  ✓
                </button>
                <button
                  onClick={handleDescriptionCancel}
                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  ✗
                </button>
              </div>
            ) : (
              <div 
                className="flex items-center gap-2 group"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingDescription(true);
                }}
              >
                <span className="text-sm">{unit.description}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 dark:text-gray-400">
                  (click to edit)
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
              {segments.length} segments
            </span>
            {/* Action buttons */}
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={onSplit}
                title="Split this DU"
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                disabled={segments.length < 2}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
              {onMergeWithNext && (
                <button
                  onClick={() => {/* Handle merge */}}
                  title="Merge with next DU"
                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
              )}
              {canDelete && (
                <button
                  onClick={onDelete}
                  title="Delete this DU"
                  className="p-1 hover:bg-red-200 dark:hover:bg-red-900 rounded transition-colors text-red-600 dark:text-red-400"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="p-4 space-y-3">
          {segments.map((segment) => {
            const segmentColors = PHASE_COLORS[segment.coarse_phase as keyof typeof PHASE_COLORS];
            return (
              <div 
                key={segment.segment_id}
                className={`p-3 rounded-lg border ${segmentColors.border} ${segmentColors.bg} ${segmentColors.bg.includes('100') ? 'bg-opacity-30' : 'bg-opacity-10'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{segment.segment_id}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${segmentColors.bg} ${segmentColors.text}`}>
                      {segment.coarse_phase}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Index: {segment.chronological_index}
                    </span>
                  </div>
                  <button
                    onClick={() => onSegmentRemove(segment.segment_id)}
                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                    title="Remove from this DU"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm mb-2">{segment.segment_text}</p>
                {segment.placement_justification && (
                  <p className="text-xs italic text-gray-600 dark:text-gray-400 mb-2">
                    Justification: {segment.placement_justification}
                  </p>
                )}
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  <span>From line {segment.original_utterance.original_line_num}: </span>
                  <span className="italic">{segment.original_utterance.utterance_text.substring(0, 100)}...</span>
                </div>
              </div>
            );
          })}
          
          {segments.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 italic">
              No segments in this DU
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const DiachronicUnitGroupingTable: React.FC<DiachronicUnitGroupingTableProps> = ({
  groupingData,
  sortedSegmentsData,
  theme,
  onGroupingChange,
  filename
}) => {
  console.log('[P1.4] groupingData:', groupingData);
  console.log('[P1.4] sortedSegmentsData:', sortedSegmentsData);
  
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  
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
      )
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

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

  const handleDeleteUnit = useCallback((unitId: string) => {
    if (!onGroupingChange) return;
    
    const updatedData = {
      ...groupingData,
      diachronic_units: groupingData.diachronic_units.filter(unit => unit.unit_id !== unitId)
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

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
  }, [unitsWithSegments, filename]);

  // Validation checks
  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    
    // Check for unassigned segments
    const assignedSegmentIds = new Set(groupingData.diachronic_units.flatMap(u => u.source_segment_ids));
    const allSegmentIds = new Set(sortedSegmentsData?.sorted_segments.map(s => s.segment_id) || []);
    const unassignedIds = Array.from(allSegmentIds).filter(id => !assignedSegmentIds.has(id));
    
    if (unassignedIds.length > 0) {
      issues.push(`${unassignedIds.length} segments are not assigned to any DU`);
    }
    
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
  }, [groupingData, sortedSegmentsData]);

  return (
    <div className="space-y-4">
      {/* Summary and Actions */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold mb-2">Diachronic Unit Grouping</h3>
          <div className="text-sm text-light-sidenote dark:text-dark-sidenote space-y-1">
            <div>Total DUs: {groupingData.diachronic_units.length}</div>
            <div>Total segments: {segmentLookup.size}</div>
            {validationIssues.map((issue, idx) => (
              <div key={idx} className="text-red-600 dark:text-red-400">⚠️ {issue}</div>
            ))}
          </div>
        </div>
        <button
          onClick={exportToCsv}
          className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
        >
          Download CSV
        </button>
      </div>

      {/* DU Cards */}
      <div className="space-y-2">
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
          />
        ))}
      </div>

      {/* Instructions */}
      <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic space-y-1">
        <div>💡 Click on DU headers to expand/collapse</div>
        <div>✏️ Click on descriptions to edit them inline</div>
        <div>✂️ Use the split button to divide a DU into two parts</div>
        <div>❌ Remove segments from DUs using the X button</div>
      </div>
    </div>
  );
};