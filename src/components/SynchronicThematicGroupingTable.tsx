import React, { useState, useMemo, useCallback } from 'react';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P2S_1_Output, P2S_1_ThematicGroup, SegmentedUtteranceSegment, StepId } from '../../types';
import { ChevronDownIcon, ChevronRightIcon } from '../../constants';
import { trackingHelpers } from '../stores/historyStore';

interface SynchronicThematicGroupingTableProps {
  groupingData: P2S_1_Output;
  theme: 'light' | 'dark';
  onGroupingChange?: (updatedData: P2S_1_Output) => void;
  filename?: string;
  transcriptId?: string;
  hideVariableInfo?: boolean;
  hideInstructions?: boolean;
  hideSummaryActions?: boolean;
  compactSummary?: boolean;
}

// Phase colors mapping (consistent with other components)
const PHASE_COLORS = {
  'Initial State': { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', border: 'border-blue-300 dark:border-blue-700' },
  'Core Experience': { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', border: 'border-green-300 dark:border-green-700' },
  'Final Action': { bg: 'bg-orange-100 dark:bg-orange-900', text: 'text-orange-800 dark:text-orange-200', border: 'border-orange-300 dark:border-orange-700' },
  'Post-Hoc Reflection': { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-300 dark:border-purple-700' }
};

// Thematic Group Card Component
const ThematicGroupCard: React.FC<{
  group: P2S_1_ThematicGroup;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onLabelChange: (label: string) => void;
  onJustificationChange: (justification: string) => void;
  onSegmentRemove: (segmentId: string) => void;
  theme: 'light' | 'dark';
  canDelete: boolean;
  onDelete: () => void;
  transcriptId?: string;
  groupingDataId?: string;
}> = ({ 
  group, 
  index,
  isExpanded, 
  onToggle, 
  onLabelChange,
  onJustificationChange,
  onSegmentRemove,
  theme,
  canDelete,
  onDelete,
  transcriptId,
  groupingDataId
}) => {
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [tempLabel, setTempLabel] = useState(group.group_label);
  const [isEditingJustification, setIsEditingJustification] = useState(false);
  const [tempJustification, setTempJustification] = useState(group.justification);

  const handleLabelSave = () => {
    // Track the change
    if (transcriptId && groupingDataId) {
      trackingHelpers.trackDataEdit(
        `thematic_groups/${groupingDataId}/group_${index}/label`,
        group.group_label,
        tempLabel,
        transcriptId,
        StepId.P2S_1_GROUP_SEGMENTS_BY_TOPIC
      );
    }
    onLabelChange(tempLabel);
    setIsEditingLabel(false);
  };

  const handleLabelCancel = () => {
    setTempLabel(group.group_label);
    setIsEditingLabel(false);
  };

  const handleJustificationSave = () => {
    // Track the change
    if (transcriptId && groupingDataId) {
      trackingHelpers.trackDataEdit(
        `thematic_groups/${groupingDataId}/group_${index}/justification`,
        group.justification,
        tempJustification,
        transcriptId,
        StepId.P2S_1_GROUP_SEGMENTS_BY_TOPIC
      );
    }
    onJustificationChange(tempJustification);
    setIsEditingJustification(false);
  };

  const handleJustificationCancel = () => {
    setTempJustification(group.justification);
    setIsEditingJustification(false);
  };

  return (
    <div className={`mb-4 rounded-lg border-2 border-indigo-400 dark:border-indigo-600 ${theme === 'dark' ? 'bg-dark-bg-alt' : 'bg-light-bg-alt'} overflow-hidden`}>
      {/* Header */}
      <div 
        className={`p-4 cursor-pointer bg-indigo-100 dark:bg-indigo-900 bg-opacity-50 dark:bg-opacity-20`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 dark:text-gray-400">
              {isExpanded ? ChevronDownIcon : ChevronRightIcon}
            </span>
            <span className="font-mono text-sm font-bold">Group {index + 1}</span>
            {isEditingLabel ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={tempLabel}
                  onChange={(e) => setTempLabel(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLabelSave();
                    if (e.key === 'Escape') handleLabelCancel();
                  }}
                  className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  autoFocus
                />
                <button
                  onClick={handleLabelSave}
                  className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                >
                  ✓
                </button>
                <button
                  onClick={handleLabelCancel}
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
                  setIsEditingLabel(true);
                }}
              >
                <span className="text-sm font-semibold">{group.group_label}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 dark:text-gray-400">
                  (click to edit)
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-2 py-1 rounded-full text-xs font-medium bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200`}>
              {group.segments.length} segments
            </span>
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete this group"
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

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {/* Justification section */}
          <div className="mb-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="flex items-start justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Justification</h4>
              {!isEditingJustification && (
                <button
                  onClick={() => setIsEditingJustification(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  edit
                </button>
              )}
            </div>
            {isEditingJustification ? (
              <div className="space-y-2">
                <textarea
                  value={tempJustification}
                  onChange={(e) => setTempJustification(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleJustificationSave}
                    className="text-sm px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleJustificationCancel}
                    className="text-sm px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">{group.justification}</p>
            )}
          </div>

          {/* Segments */}
          {group.segments.map((segment) => {
            const phaseTag = (segment as any).coarse_phase || 'Core Experience';
            const segmentColors = PHASE_COLORS[phaseTag as keyof typeof PHASE_COLORS] || PHASE_COLORS['Core Experience'];
            
            return (
              <div 
                key={segment.segment_id}
                className={`p-3 rounded-lg border ${segmentColors.border} ${segmentColors.bg} ${segmentColors.bg.includes('100') ? 'bg-opacity-30' : 'bg-opacity-10'}`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{segment.segment_id}</span>
                    {(segment as any).temporal_cues && (segment as any).temporal_cues.length > 0 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Temporal: {(segment as any).temporal_cues.join(', ')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => onSegmentRemove(segment.segment_id)}
                    className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                    title="Remove from this group"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-sm">{segment.segment_text}</p>
                {segment.original_utterance && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    <span>From line {segment.original_utterance.original_line_num}: </span>
                    <span className="italic">{segment.original_utterance.utterance_text.substring(0, 100)}...</span>
                  </div>
                )}
              </div>
            );
          })}
          
          {group.segments.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 italic">
              No segments in this group
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const SynchronicThematicGroupingTable: React.FC<SynchronicThematicGroupingTableProps> = ({
  groupingData,
  theme,
  onGroupingChange,
  filename,
  transcriptId,
  hideVariableInfo = false,
  hideInstructions = false,
  hideSummaryActions = false,
  compactSummary = false
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  
  const toggleGroup = useCallback((index: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const handleLabelChange = useCallback((index: number, newLabel: string) => {
    if (!onGroupingChange) return;
    
    const updatedData = {
      ...groupingData,
      synchronic_thematic_groups: groupingData.synchronic_thematic_groups.map((group, i) => 
        i === index 
          ? { ...group, group_label: newLabel }
          : group
      )
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

  const handleJustificationChange = useCallback((index: number, newJustification: string) => {
    if (!onGroupingChange) return;
    
    const updatedData = {
      ...groupingData,
      synchronic_thematic_groups: groupingData.synchronic_thematic_groups.map((group, i) => 
        i === index 
          ? { ...group, justification: newJustification }
          : group
      )
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

  const handleSegmentRemove = useCallback((groupIndex: number, segmentId: string) => {
    if (!onGroupingChange) return;
    
    const updatedData = {
      ...groupingData,
      synchronic_thematic_groups: groupingData.synchronic_thematic_groups.map((group, i) => 
        i === groupIndex 
          ? { ...group, segments: group.segments.filter(seg => seg.segment_id !== segmentId) }
          : group
      )
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

  const handleDeleteGroup = useCallback((index: number) => {
    if (!onGroupingChange) return;
    
    const updatedData = {
      ...groupingData,
      synchronic_thematic_groups: groupingData.synchronic_thematic_groups.filter((_, i) => i !== index)
    };
    
    onGroupingChange(updatedData);
  }, [groupingData, onGroupingChange]);

  const exportToCsv = useCallback(() => {
    const csvData: any[] = [];
    
    groupingData.synchronic_thematic_groups.forEach((group, groupIndex) => {
      group.segments.forEach((segment, segIndex) => {
        csvData.push({
          'DU ID': groupingData.analyzed_du_id,
          'Group Number': groupIndex + 1,
          'Group Label': group.group_label,
          'Group Justification': group.justification,
          'Segment Position': segIndex + 1,
          'Segment ID': segment.segment_id,
          'Segment Text': segment.segment_text,
          'Temporal Cues': (segment as any).temporal_cues?.join('; ') || '',
          'Original Line': segment.original_utterance?.original_line_num || '',
          'Original Utterance': segment.original_utterance?.utterance_text || ''
        });
      });
    });
    
    const columns = [
      { field: 'DU ID', headerName: 'DU ID' },
      { field: 'Group Number', headerName: 'Group Number' },
      { field: 'Group Label', headerName: 'Group Label' },
      { field: 'Group Justification', headerName: 'Group Justification' },
      { field: 'Segment Position', headerName: 'Segment Position' },
      { field: 'Segment ID', headerName: 'Segment ID' },
      { field: 'Segment Text', headerName: 'Segment Text' },
      { field: 'Temporal Cues', headerName: 'Temporal Cues' },
      { field: 'Original Line', headerName: 'Original Line' },
      { field: 'Original Utterance', headerName: 'Original Utterance' }
    ];
    
    const csv = convertToCSV(csvData, columns);
    const exportFilename = filename ? 
      `${filename.replace(/\.[^/.]+$/, '')}_P2S.1_${groupingData.analyzed_du_id}_thematic_groups.csv` : 
      `P2S.1_${groupingData.analyzed_du_id}_thematic_groups.csv`;
    downloadCSV(csv, exportFilename);
  }, [groupingData, filename]);

  // Calculate total segments
  const totalSegments = useMemo(() => {
    return groupingData.synchronic_thematic_groups.reduce((sum, group) => sum + group.segments.length, 0);
  }, [groupingData]);

  return (
    <div className="space-y-4">
      {/* Summary and Actions */}
      {!hideSummaryActions && (
        compactSummary ? (
          // Compact version - just stats and download button
          <div className="flex justify-between items-center">
            <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
              {groupingData.synchronic_thematic_groups.length} groups • {totalSegments} segments
            </div>
            <button
              onClick={exportToCsv}
              className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
            >
              Download CSV
            </button>
          </div>
        ) : (
          // Full version
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold mb-2">Synchronic Thematic Grouping for DU: {groupingData.analyzed_du_id}</h3>
              <div className="text-sm text-light-sidenote dark:text-dark-sidenote space-y-1">
                <div>Total Thematic Groups: {groupingData.synchronic_thematic_groups.length}</div>
                <div>Total Segments: {totalSegments}</div>
                <div>Transcript: {groupingData.transcript_id}</div>
              </div>
            </div>
            <button
              onClick={exportToCsv}
              className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
            >
              Download CSV
            </button>
          </div>
        )
      )}

      {/* Variable Information */}
      {!hideVariableInfo && (
        <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg space-y-2">
          <div>
            <span className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote">Independent Variable: </span>
            <span className="text-sm">{groupingData.independent_variable_details}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote">Dependent Variable Focus: </span>
            <div className="inline-flex flex-wrap gap-1 ml-2">
              {groupingData.dependent_variable_focus.map((dv, index) => (
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
      )}

      {/* Thematic Group Cards */}
      <div className="space-y-2">
        {groupingData.synchronic_thematic_groups.map((group, index) => (
          <ThematicGroupCard
            key={index}
            group={group}
            index={index}
            isExpanded={expandedGroups.has(index)}
            onToggle={() => toggleGroup(index)}
            onLabelChange={(label) => handleLabelChange(index, label)}
            onJustificationChange={(justification) => handleJustificationChange(index, justification)}
            onSegmentRemove={(segId) => handleSegmentRemove(index, segId)}
            theme={theme}
            canDelete={groupingData.synchronic_thematic_groups.length > 1}
            onDelete={() => handleDeleteGroup(index)}
            transcriptId={transcriptId}
            groupingDataId={groupingData.analyzed_du_id}
          />
        ))}
      </div>

      {/* Instructions */}
      {!hideInstructions && (
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic space-y-1">
          <div>💡 Click on group headers to expand/collapse</div>
          <div>✏️ Click on group labels or justifications to edit them</div>
          <div>❌ Remove segments from groups using the X button</div>
          <div>🗑️ Delete entire groups using the trash button (when more than one group exists)</div>
        </div>
      )}
    </div>
  );
};