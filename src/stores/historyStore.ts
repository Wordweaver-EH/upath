import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { ChangeRecord, ChangeType, ChangeDetails } from '../../types';

interface HistoryState {
  // State
  history: ChangeRecord[];
  maxHistorySize: number;
  isEnabled: boolean;
  
  // Actions
  trackChange: (
    type: ChangeType,
    description: string,
    details: ChangeDetails
  ) => void;
  clearHistory: () => void;
  removeChange: (id: string) => void;
  toggleTracking: (enabled: boolean) => void;
  exportHistory: () => string;
  getChangesByType: (type: ChangeType) => ChangeRecord[];
  getChangesByTranscript: (transcriptId: string) => ChangeRecord[];
  getChangesByTimeRange: (startTime: string, endTime: string) => ChangeRecord[];
  getRecentChanges: (count?: number) => ChangeRecord[];
}

// Utility to generate unique IDs
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Utility to generate session ID (persists for browser session)
const getSessionId = (): string => {
  if (!sessionStorage.getItem('upath-session-id')) {
    sessionStorage.setItem('upath-session-id', generateId());
  }
  return sessionStorage.getItem('upath-session-id')!;
};

export const useHistoryStore = create<HistoryState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        history: [] as ChangeRecord[],
        maxHistorySize: 500, // Configurable limit to prevent memory issues
        isEnabled: true,
        
        // Core tracking action
        trackChange: (type, description, details) => {
          const { history, maxHistorySize, isEnabled } = get();
          
          console.log('[HistoryStore] trackChange called:', { 
            type, 
            description, 
            isEnabled,
            currentHistoryLength: history.length 
          });
          
          if (!isEnabled) {
            console.log('[HistoryStore] Tracking disabled, skipping');
            return;
          }
          
          const newRecord: ChangeRecord = {
            id: generateId(),
            timestamp: new Date().toISOString(),
            type,
            description,
            details: {
              ...details,
              metadata: {
                ...details.metadata,
                sessionId: getSessionId(),
              },
            },
          };
          
          // Add new record and maintain size limit
          const newHistory = [newRecord, ...history].slice(0, maxHistorySize);
          
          console.log('[HistoryStore] Setting new history:', {
            oldLength: history.length,
            newLength: newHistory.length,
            newRecord
          });
          
          set({ history: newHistory });
        },
        
        // Clear all history
        clearHistory: () => {
          set({ history: [] });
        },
        
        // Remove specific change
        removeChange: (id) => {
          set((state) => ({
            history: state.history.filter((record) => record.id !== id),
          }));
        },
        
        // Toggle tracking on/off
        toggleTracking: (enabled) => {
          set({ isEnabled: enabled });
        },
        
        // Export history as JSON
        exportHistory: () => {
          const { history } = get();
          return JSON.stringify(history, null, 2);
        },
        
        // Query methods
        getChangesByType: (type) => {
          return get().history.filter((record) => record.type === type);
        },
        
        getChangesByTranscript: (transcriptId) => {
          return get().history.filter(
            (record) => record.details.transcriptId === transcriptId
          );
        },
        
        getChangesByTimeRange: (startTime, endTime) => {
          const start = new Date(startTime).getTime();
          const end = new Date(endTime).getTime();
          
          return get().history.filter((record) => {
            const recordTime = new Date(record.timestamp).getTime();
            return recordTime >= start && recordTime <= end;
          });
        },
        
        getRecentChanges: (count = 10) => {
          return get().history.slice(0, count);
        },
      }),
      {
        name: 'upath-history-store',
        partialize: (state) => ({
          history: state.history,
          maxHistorySize: state.maxHistorySize,
          isEnabled: state.isEnabled,
        }),
      }
    ),
    {
      name: 'HistoryStore',
    }
  )
);

// Helper functions for common tracking scenarios
export const trackingHelpers = {
  // Track a setting change with automatic old/new value capture
  trackSettingChange: (
    settingName: string,
    oldValue: any,
    newValue: any,
    source: string = 'SettingsPanel'
  ) => {
    console.log('[trackingHelpers] trackSettingChange:', { settingName, oldValue, newValue });
    useHistoryStore.getState().trackChange(
      ChangeType.SETTING_CHANGE,
      `Changed ${settingName} from ${JSON.stringify(oldValue)} to ${JSON.stringify(newValue)}`,
      {
        source,
        oldValue,
        newValue,
        metadata: {
          settingName,
        },
      }
    );
  },
  
  // Track a manual data edit with path information
  trackDataEdit: (
    path: string,
    oldValue: any,
    newValue: any,
    transcriptId?: string,
    stepId?: any
  ) => {
    // Handle batch changes
    if (Array.isArray(oldValue) && Array.isArray(newValue)) {
      const changeCount = oldValue.length;
      const description = changeCount > 1 
        ? `Edited ${changeCount} fields in ${path}` 
        : `Edited data at ${path}`;
      
      useHistoryStore.getState().trackChange(
        ChangeType.DATA_EDIT,
        description,
        {
          path,
          oldValue,
          newValue,
          transcriptId,
          stepId,
          source: 'DataTable',
          metadata: {
            changeCount,
            isBatch: true
          }
        }
      );
    } else {
      useHistoryStore.getState().trackChange(
        ChangeType.DATA_EDIT,
        `Edited data at ${path}`,
        {
          path,
          oldValue,
          newValue,
          transcriptId,
          stepId,
          source: 'DataTable',
        }
      );
    }
  },
  
  // Track HIL correction
  trackHilCorrection: (
    guidance: string,
    transcriptId?: string,
    stepId?: any,
    context?: any
  ) => {
    useHistoryStore.getState().trackChange(
      ChangeType.HIL_CORRECTION,
      `HIL correction: ${guidance.substring(0, 50)}...`,
      {
        newValue: guidance,
        transcriptId,
        stepId,
        source: 'HilModal',
        metadata: {
          context,
        },
      }
    );
  },
  
  // Track pipeline action
  trackPipelineAction: (
    action: string,
    stepId?: any,
    transcriptId?: string,
    details?: any
  ) => {
    useHistoryStore.getState().trackChange(
      ChangeType.PIPELINE_ACTION,
      action,
      {
        stepId,
        transcriptId,
        source: 'Pipeline',
        metadata: {
          ...details,
        },
      }
    );
  },
  
  // Track model selection
  trackModelSelection: (
    oldModel: string | undefined,
    newModel: string,
    context: string = 'ModelSelector'
  ) => {
    useHistoryStore.getState().trackChange(
      ChangeType.MODEL_SELECTION,
      `Selected model: ${newModel}`,
      {
        oldValue: oldModel,
        newValue: newModel,
        source: context,
      }
    );
  },
  
  // Track file upload
  trackFileUpload: (
    filename: string,
    fileSize?: number,
    fileType?: string
  ) => {
    useHistoryStore.getState().trackChange(
      ChangeType.FILE_UPLOAD,
      `Uploaded file: ${filename}`,
      {
        newValue: filename,
        source: 'FileUpload',
        metadata: {
          fileSize,
          fileType,
        },
      }
    );
  },
};

// Add debugging helper in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).checkTrackingHistory = () => {
    const state = useHistoryStore.getState();
    console.log('History Store State:', {
      isEnabled: state.isEnabled,
      historyCount: state.history.length,
      recentChanges: state.getRecentChanges(5),
      fullHistory: state.history
    });
    return state.history;
  };
  
  (window as any).clearTrackingHistory = () => {
    useHistoryStore.getState().clearHistory();
    console.log('History cleared');
  };
  
  console.log('🔍 History debugging helpers added to window: checkTrackingHistory(), clearTrackingHistory()');
}

// Expose store to window for debugging
if (typeof window !== 'undefined') {
  (window as any).historyStore = useHistoryStore;
  (window as any).trackingHelpers = trackingHelpers;
}