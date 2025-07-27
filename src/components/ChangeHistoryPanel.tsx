import React, { useState, useMemo, useEffect } from 'react';
import { useHistoryStore } from '../stores/historyStore';
import { ChangeType, ChangeRecord } from '../../types';

export const ChangeHistoryPanel: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<ChangeType | 'all'>('all');
  
  // Use single selector to ensure proper re-renders
  const store = useHistoryStore();
  const { history = [], clearHistory, removeChange, exportHistory, isEnabled = true, toggleTracking } = store || {};
  
  
  // Filter history based on selected type
  const filteredHistory = useMemo(() => {
    const historyArray = history || [];
    if (filterType === 'all') return historyArray;
    return historyArray.filter(record => record.type === filterType);
  }, [history, filterType]);
  
  const toggleItemExpanded = (id: string) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  const handleExport = () => {
    const jsonData = exportHistory();
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `change-history-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const getChangeTypeColor = (type: ChangeType) => {
    switch (type) {
      case ChangeType.SETTING_CHANGE:
        return 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20';
      case ChangeType.DATA_EDIT:
        return 'text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20';
      case ChangeType.HIL_CORRECTION:
        return 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20';
      case ChangeType.PIPELINE_ACTION:
        return 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20';
      case ChangeType.MODEL_SELECTION:
        return 'text-indigo-600 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-900/20';
      case ChangeType.FILE_UPLOAD:
        return 'text-teal-600 bg-teal-50 dark:text-teal-400 dark:bg-teal-900/20';
      default:
        return 'text-gray-600 bg-gray-50 dark:text-gray-400 dark:bg-gray-900/20';
    }
  };
  
  const renderChangeDetails = (record: ChangeRecord) => {
    const { details } = record;
    
    return (
      <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-md text-sm">
        {details.oldValue !== undefined && (
          <div className="mb-2">
            <span className="font-semibold">Old Value:</span>
            <pre className="mt-1 p-2 bg-white dark:bg-gray-900 rounded text-xs overflow-x-auto">
              {JSON.stringify(details.oldValue, null, 2)}
            </pre>
          </div>
        )}
        {details.newValue !== undefined && (
          <div className="mb-2">
            <span className="font-semibold">New Value:</span>
            <pre className="mt-1 p-2 bg-white dark:bg-gray-900 rounded text-xs overflow-x-auto">
              {JSON.stringify(details.newValue, null, 2)}
            </pre>
          </div>
        )}
        {details.source && (
          <div className="mb-1">
            <span className="font-semibold">Source:</span> {details.source}
          </div>
        )}
        {details.transcriptId && (
          <div className="mb-1">
            <span className="font-semibold">Transcript:</span> {details.transcriptId}
          </div>
        )}
        {details.stepId && (
          <div className="mb-1">
            <span className="font-semibold">Step:</span> {details.stepId}
          </div>
        )}
        {details.path && (
          <div className="mb-1">
            <span className="font-semibold">Path:</span> <code className="text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">{details.path}</code>
          </div>
        )}
        {details.metadata && Object.keys(details.metadata).length > 0 && (
          <div className="mt-2">
            <span className="font-semibold">Additional Info:</span>
            <pre className="mt-1 p-2 bg-white dark:bg-gray-900 rounded text-xs overflow-x-auto">
              {JSON.stringify(details.metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-4">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <span className="text-xs">{isExpanded ? '▼' : '▶'}</span>
          <span>Change History ({filteredHistory?.length || 0})</span>
        </button>
        
        {isExpanded && (
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 text-sm">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => toggleTracking(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
              <span className="text-gray-600 dark:text-gray-400">Track Changes</span>
            </label>
            
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ChangeType | 'all')}
              className="text-sm border-gray-300 dark:border-gray-600 rounded-md"
            >
              <option value="all">All Changes</option>
              <option value={ChangeType.SETTING_CHANGE}>Settings</option>
              <option value={ChangeType.DATA_EDIT}>Data Edits</option>
              <option value={ChangeType.HIL_CORRECTION}>HIL Corrections</option>
              <option value={ChangeType.PIPELINE_ACTION}>Pipeline Actions</option>
              <option value={ChangeType.MODEL_SELECTION}>Model Selection</option>
              <option value={ChangeType.FILE_UPLOAD}>File Uploads</option>
            </select>
            
            <button
              onClick={handleExport}
              className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 border border-gray-300 dark:border-gray-600 rounded"
              title="Export History"
            >
              Export
            </button>
            
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all history?')) {
                  clearHistory();
                }
              }}
              className="px-2 py-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 border border-red-300 dark:border-red-600 rounded"
              title="Clear History"
            >
              Clear
            </button>
          </div>
        )}
      </div>
      
      {isExpanded && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">No changes recorded</p>
          ) : (
            filteredHistory && filteredHistory.map((record) => (
              <div
                key={record.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${getChangeTypeColor(record.type)}`}>
                        {record.type}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(record.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {record.description}
                    </p>
                  </div>
                  
                  <div className="flex items-center ml-2 space-x-1">
                    <button
                      onClick={() => toggleItemExpanded(record.id)}
                      className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      title="Show Details"
                    >
                      <span className="text-xs">{expandedItems.has(record.id) ? '▼' : '▶'}</span>
                    </button>
                    
                    <button
                      onClick={() => removeChange(record.id)}
                      className="p-1 text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                
                {expandedItems.has(record.id) && renderChangeDetails(record)}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};