import React, { useState, useMemo, useCallback } from 'react';
import { convertToCSV, downloadCSV } from '../utils/csvExport';
import { P2S_2_Output, P2S_2_SynchronicUnit } from '../../types';
import { ChevronDownIcon, ChevronRightIcon } from '../../constants';

interface SpecificSynchronicUnitsTableProps {
  unitsData: P2S_2_Output;
  theme: 'light' | 'dark';
  onUnitsChange?: (updatedData: P2S_2_Output) => void;
  filename?: string;
  hideVariableInfo?: boolean;
  hideInstructions?: boolean;
  compactSummary?: boolean;
}

// Color scheme for hierarchy levels
const LEVEL_COLORS = {
  1: { bg: 'bg-indigo-100 dark:bg-indigo-900', text: 'text-indigo-800 dark:text-indigo-200', border: 'border-indigo-400 dark:border-indigo-600' },
  2: { bg: 'bg-purple-100 dark:bg-purple-900', text: 'text-purple-800 dark:text-purple-200', border: 'border-purple-400 dark:border-purple-600' },
  3: { bg: 'bg-pink-100 dark:bg-pink-900', text: 'text-pink-800 dark:text-pink-200', border: 'border-pink-400 dark:border-pink-600' },
  4: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-200', border: 'border-gray-400 dark:border-gray-600' },
};

// ISU Card Component
const ISUCard: React.FC<{
  unit: P2S_2_SynchronicUnit;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onNameChange: (name: string) => void;
  onDefinitionChange: (definition: string) => void;
  onAbstractionOpChange: (op: string) => void;
  onSegmentRemove: (segmentId: string) => void;
  theme: 'light' | 'dark';
  canDelete: boolean;
  onDelete: () => void;
  allUnits: P2S_2_SynchronicUnit[];
}> = ({ 
  unit, 
  index,
  isExpanded, 
  onToggle, 
  onNameChange,
  onDefinitionChange,
  onAbstractionOpChange,
  onSegmentRemove,
  theme,
  canDelete,
  onDelete,
  allUnits
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(unit.unit_name);
  const [isEditingDefinition, setIsEditingDefinition] = useState(false);
  const [tempDefinition, setTempDefinition] = useState(unit.intensional_definition);
  const [isEditingOp, setIsEditingOp] = useState(false);
  const [tempOp, setTempOp] = useState(unit.abstraction_op);

  const levelColors = LEVEL_COLORS[unit.level as keyof typeof LEVEL_COLORS] || LEVEL_COLORS[1];

  const handleNameSave = () => {
    onNameChange(tempName);
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(unit.unit_name);
    setIsEditingName(false);
  };

  const handleDefinitionSave = () => {
    onDefinitionChange(tempDefinition);
    setIsEditingDefinition(false);
  };

  const handleDefinitionCancel = () => {
    setTempDefinition(unit.intensional_definition);
    setIsEditingDefinition(false);
  };

  const handleOpSave = () => {
    onAbstractionOpChange(tempOp);
    setIsEditingOp(false);
  };

  const handleOpCancel = () => {
    setTempOp(unit.abstraction_op);
    setIsEditingOp(false);
  };

  // Get constituent units' names
  const constituentUnits = unit.constituent_lower_units?.map(unitName => 
    allUnits.find(u => u.unit_name === unitName)
  ).filter(Boolean) || [];

  return (
    <div 
      className={`mb-4 rounded-lg border-2 ${levelColors.border} ${theme === 'dark' ? 'bg-dark-bg-alt' : 'bg-light-bg-alt'} overflow-hidden`}
      style={{ marginLeft: `${(unit.level - 1) * 20}px` }}
    >
      {/* Header */}
      <div 
        className={`p-4 cursor-pointer ${levelColors.bg} bg-opacity-50 dark:bg-opacity-20`}
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-gray-500 dark:text-gray-400">
              {isExpanded ? ChevronDownIcon : ChevronRightIcon}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${levelColors.bg} ${levelColors.text} font-medium`}>
              Level {unit.level}
            </span>
            {isEditingName ? (
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleNameSave();
                    if (e.key === 'Escape') handleNameCancel();
                  }}
                  className="px-2 py-1 text-sm border rounded bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  autoFocus
                />
                <button
                  onClick={handleNameSave}
                  className="text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                >
                  ✓
                </button>
                <button
                  onClick={handleNameCancel}
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
                  setIsEditingName(true);
                }}
              >
                <span className="text-sm font-semibold">{unit.unit_name}</span>
                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-500 dark:text-gray-400">
                  (click to edit)
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            {unit.segments && unit.segments.length > 0 && (
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${levelColors.bg} ${levelColors.text}`}>
                {unit.segments.length} segments
              </span>
            )}
            {constituentUnits.length > 0 && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                {constituentUnits.length} sub-units
              </span>
            )}
            {canDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                title="Delete this ISU"
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
          {/* Abstraction Operation */}
          <div className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="flex items-start justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Abstraction Operation</h4>
              {!isEditingOp && (
                <button
                  onClick={() => setIsEditingOp(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  edit
                </button>
              )}
            </div>
            {isEditingOp ? (
              <div className="space-y-2">
                <select
                  value={tempOp}
                  onChange={(e) => setTempOp(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600"
                >
                  <option value="generalization">Generalization</option>
                  <option value="aggregation">Aggregation</option>
                  <option value="instantiation">Instantiation</option>
                  <option value="abstraction">Abstraction</option>
                  <option value="composition">Composition</option>
                  <option value="categorization">Categorization</option>
                </select>
                <div className="flex gap-2">
                  <button
                    onClick={handleOpSave}
                    className="text-sm px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleOpCancel}
                    className="text-sm px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{unit.abstraction_op}</p>
            )}
          </div>

          {/* Intensional Definition */}
          <div className="mb-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-800">
            <div className="flex items-start justify-between mb-1">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Intensional Definition</h4>
              {!isEditingDefinition && (
                <button
                  onClick={() => setIsEditingDefinition(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  edit
                </button>
              )}
            </div>
            {isEditingDefinition ? (
              <div className="space-y-2">
                <textarea
                  value={tempDefinition}
                  onChange={(e) => setTempDefinition(e.target.value)}
                  className="w-full px-2 py-1 text-sm border rounded bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleDefinitionSave}
                    className="text-sm px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleDefinitionCancel}
                    className="text-sm px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">{unit.intensional_definition}</p>
            )}
          </div>

          {/* Constituent Units */}
          {constituentUnits.length > 0 && (
            <div className="mb-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Constituent Lower Units</h4>
              <div className="space-y-1">
                {constituentUnits.map((subUnit, idx) => (
                  <div key={idx} className="text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded">
                    <span className="font-medium">{subUnit?.unit_name}</span>
                    <span className="text-gray-500 dark:text-gray-400"> (Level {subUnit?.level})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Segments */}
          {unit.segments && unit.segments.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Grounded in Segments</h4>
              {unit.segments.map((segment) => (
                <div 
                  key={segment.segment_id}
                  className="p-3 mb-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{segment.segment_id}</span>
                      {segment.temporal_cues && segment.temporal_cues.length > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          Temporal: {segment.temporal_cues.join(', ')}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => onSegmentRemove(segment.segment_id)}
                      className="text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300"
                      title="Remove from this ISU"
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
              ))}
            </div>
          )}
          
          {(!unit.segments || unit.segments.length === 0) && constituentUnits.length === 0 && (
            <div className="text-center py-4 text-gray-500 dark:text-gray-400 italic">
              No segments or constituent units in this ISU
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const SpecificSynchronicUnitsTable: React.FC<SpecificSynchronicUnitsTableProps> = ({
  unitsData,
  theme,
  onUnitsChange,
  filename,
  hideVariableInfo = false,
  hideInstructions = false,
  compactSummary = false
}) => {
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());
  
  const toggleUnit = useCallback((index: number) => {
    setExpandedUnits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  const handleNameChange = useCallback((index: number, newName: string) => {
    if (!onUnitsChange) return;
    
    const oldName = unitsData.specific_synchronic_units_hierarchy[index].unit_name;
    
    // Update the unit name and any references to it
    const updatedData = {
      ...unitsData,
      specific_synchronic_units_hierarchy: unitsData.specific_synchronic_units_hierarchy.map((unit, i) => {
        if (i === index) {
          return { ...unit, unit_name: newName };
        } else {
          // Update references in constituent_lower_units
          if (unit.constituent_lower_units && unit.constituent_lower_units.includes(oldName)) {
            return {
              ...unit,
              constituent_lower_units: unit.constituent_lower_units.map(name => 
                name === oldName ? newName : name
              )
            };
          }
        }
        return unit;
      })
    };
    
    onUnitsChange(updatedData);
  }, [unitsData, onUnitsChange]);

  const handleDefinitionChange = useCallback((index: number, newDefinition: string) => {
    if (!onUnitsChange) return;
    
    const updatedData = {
      ...unitsData,
      specific_synchronic_units_hierarchy: unitsData.specific_synchronic_units_hierarchy.map((unit, i) => 
        i === index 
          ? { ...unit, intensional_definition: newDefinition }
          : unit
      )
    };
    
    onUnitsChange(updatedData);
  }, [unitsData, onUnitsChange]);

  const handleAbstractionOpChange = useCallback((index: number, newOp: string) => {
    if (!onUnitsChange) return;
    
    const updatedData = {
      ...unitsData,
      specific_synchronic_units_hierarchy: unitsData.specific_synchronic_units_hierarchy.map((unit, i) => 
        i === index 
          ? { ...unit, abstraction_op: newOp }
          : unit
      )
    };
    
    onUnitsChange(updatedData);
  }, [unitsData, onUnitsChange]);

  const handleSegmentRemove = useCallback((unitIndex: number, segmentId: string) => {
    if (!onUnitsChange) return;
    
    const updatedData = {
      ...unitsData,
      specific_synchronic_units_hierarchy: unitsData.specific_synchronic_units_hierarchy.map((unit, i) => 
        i === unitIndex && unit.segments
          ? { ...unit, segments: unit.segments.filter(seg => seg.segment_id !== segmentId) }
          : unit
      )
    };
    
    onUnitsChange(updatedData);
  }, [unitsData, onUnitsChange]);

  const handleDeleteUnit = useCallback((index: number) => {
    if (!onUnitsChange) return;
    
    const unitToDelete = unitsData.specific_synchronic_units_hierarchy[index];
    
    // Remove the unit and update references
    const updatedData = {
      ...unitsData,
      specific_synchronic_units_hierarchy: unitsData.specific_synchronic_units_hierarchy
        .filter((_, i) => i !== index)
        .map(unit => {
          // Remove references to deleted unit
          if (unit.constituent_lower_units && unit.constituent_lower_units.includes(unitToDelete.unit_name)) {
            return {
              ...unit,
              constituent_lower_units: unit.constituent_lower_units.filter(name => 
                name !== unitToDelete.unit_name
              )
            };
          }
          return unit;
        })
    };
    
    onUnitsChange(updatedData);
  }, [unitsData, onUnitsChange]);

  const exportToCsv = useCallback(() => {
    const csvData: any[] = [];
    
    unitsData.specific_synchronic_units_hierarchy.forEach((unit, unitIndex) => {
      // Add unit-level row
      csvData.push({
        'DU ID': unitsData.analyzed_du_id,
        'Unit Number': unitIndex + 1,
        'Unit Name': unit.unit_name,
        'Level': unit.level,
        'Abstraction Operation': unit.abstraction_op,
        'Intensional Definition': unit.intensional_definition,
        'Constituent Units': unit.constituent_lower_units?.join('; ') || '',
        'Segment ID': '',
        'Segment Text': '',
        'Temporal Cues': ''
      });
      
      // Add segment rows
      unit.segments?.forEach((segment) => {
        csvData.push({
          'DU ID': unitsData.analyzed_du_id,
          'Unit Number': unitIndex + 1,
          'Unit Name': unit.unit_name,
          'Level': unit.level,
          'Abstraction Operation': '',
          'Intensional Definition': '',
          'Constituent Units': '',
          'Segment ID': segment.segment_id,
          'Segment Text': segment.segment_text,
          'Temporal Cues': segment.temporal_cues?.join('; ') || ''
        });
      });
    });
    
    const columns = [
      { field: 'DU ID', headerName: 'DU ID' },
      { field: 'Unit Number', headerName: 'Unit Number' },
      { field: 'Unit Name', headerName: 'Unit Name' },
      { field: 'Level', headerName: 'Level' },
      { field: 'Abstraction Operation', headerName: 'Abstraction Operation' },
      { field: 'Intensional Definition', headerName: 'Intensional Definition' },
      { field: 'Constituent Units', headerName: 'Constituent Units' },
      { field: 'Segment ID', headerName: 'Segment ID' },
      { field: 'Segment Text', headerName: 'Segment Text' },
      { field: 'Temporal Cues', headerName: 'Temporal Cues' }
    ];
    
    const csv = convertToCSV(csvData, columns);
    const exportFilename = filename ? 
      `${filename.replace(/\.[^/.]+$/, '')}_P2S.2_${unitsData.analyzed_du_id}_synchronic_units.csv` : 
      `P2S.2_${unitsData.analyzed_du_id}_synchronic_units.csv`;
    downloadCSV(csv, exportFilename);
  }, [unitsData, filename]);

  // Calculate statistics
  const stats = useMemo(() => {
    const hierarchy = unitsData.specific_synchronic_units_hierarchy;
    const totalSegments = hierarchy.reduce((sum, unit) => sum + (unit.segments?.length || 0), 0);
    const maxLevel = Math.max(...hierarchy.map(u => u.level), 0);
    const levelCounts = hierarchy.reduce((acc, unit) => {
      acc[unit.level] = (acc[unit.level] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    
    return { totalUnits: hierarchy.length, totalSegments, maxLevel, levelCounts };
  }, [unitsData]);

  return (
    <div className="space-y-4">
      {/* Summary and Actions */}
      {!compactSummary ? (
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold mb-2">Specific Synchronic Units for DU: {unitsData.analyzed_du_id}</h3>
            <div className="text-sm text-light-sidenote dark:text-dark-sidenote space-y-1">
              <div>Total ISUs: {stats.totalUnits}</div>
              <div>Total Segments: {stats.totalSegments}</div>
              <div>Max Hierarchy Level: {stats.maxLevel}</div>
              <div>Level Distribution: {Object.entries(stats.levelCounts).map(([level, count]) => 
                `L${level}: ${count}`).join(', ')}</div>
            </div>
          </div>
          <button
            onClick={exportToCsv}
            className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
          >
            Download CSV
          </button>
        </div>
      ) : (
        <div className="flex justify-between items-center">
          <div className="text-sm text-light-sidenote dark:text-dark-sidenote">
            {stats.totalUnits} ISUs • {stats.totalSegments} segments • Max level {stats.maxLevel}
          </div>
          <button
            onClick={exportToCsv}
            className="px-3 py-1 text-sm bg-light-bg-alt dark:bg-dark-bg-alt hover:bg-light-border dark:hover:bg-dark-border text-light-text dark:text-dark-text rounded transition-colors"
          >
            Download CSV
          </button>
        </div>
      )}

      {/* Variable Information */}
      {!hideVariableInfo && (
        <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-4 rounded-lg space-y-2">
          <div>
            <span className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote">Independent Variable: </span>
            <span className="text-sm">{unitsData.independent_variable_details}</span>
          </div>
          <div>
            <span className="text-sm font-medium text-light-sidenote dark:text-dark-sidenote">Dependent Variable Focus: </span>
            <div className="inline-flex flex-wrap gap-1 ml-2">
              {unitsData.dependent_variable_focus.map((dv, index) => (
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

      {/* ISU Cards */}
      <div className="space-y-2">
        {unitsData.specific_synchronic_units_hierarchy.map((unit, index) => (
          <ISUCard
            key={index}
            unit={unit}
            index={index}
            isExpanded={expandedUnits.has(index)}
            onToggle={() => toggleUnit(index)}
            onNameChange={(name) => handleNameChange(index, name)}
            onDefinitionChange={(definition) => handleDefinitionChange(index, definition)}
            onAbstractionOpChange={(op) => handleAbstractionOpChange(index, op)}
            onSegmentRemove={(segId) => handleSegmentRemove(index, segId)}
            theme={theme}
            canDelete={unitsData.specific_synchronic_units_hierarchy.length > 1}
            onDelete={() => handleDeleteUnit(index)}
            allUnits={unitsData.specific_synchronic_units_hierarchy}
          />
        ))}
      </div>

      {/* Instructions */}
      {!hideInstructions && (
        <div className="text-sm text-light-sidenote dark:text-dark-sidenote italic space-y-1">
          <div>💡 Click on ISU headers to expand/collapse</div>
          <div>✏️ Click on unit names, definitions, or abstraction operations to edit them</div>
          <div>🎯 Units are indented based on their hierarchy level</div>
          <div>❌ Remove segments from ISUs using the X button</div>
          <div>🗑️ Delete entire ISUs using the trash button (when more than one exists)</div>
        </div>
      )}
    </div>
  );
};