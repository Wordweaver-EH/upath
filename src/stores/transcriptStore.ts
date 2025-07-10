import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { enableMapSet } from 'immer';
import { localForageStorage } from '../utils/storage';
import { V2_TRANSCRIPT_STORAGE_KEY } from '../utils/storeMigration';
import type { RawTranscript, TranscriptProcessedData } from '../../types';

// Enable MapSet plugin for Immer
enableMapSet();

// Helper function to process file content
const processFileContent = async (file: File): Promise<RawTranscript> => {
  const text = await file.text();
  const timestamp = Date.now();
  
  return {
    id: `transcript-${timestamp}-${Math.random().toString(36).substr(2, 9)}`,
    name: file.name,
    content: text,
    uploadedAt: timestamp
  };
};

interface TranscriptState {
  rawTranscripts: RawTranscript[];
  processedData: Map<string, TranscriptProcessedData>;
}

interface TranscriptActions {
  addTranscripts: (files: File[]) => Promise<void>;
  addTranscriptsSync: (transcripts: RawTranscript[]) => void;
  updateProcessedData: (id: string, updates: Partial<TranscriptProcessedData>) => void;
  removeTranscript: (id: string) => void;
  reset: () => void;
}

interface TranscriptSelectors {
  getTranscriptById: (id: string) => RawTranscript | undefined;
  getProcessedDataById: (id: string) => TranscriptProcessedData | undefined;
}

type TranscriptStore = TranscriptState & TranscriptActions & TranscriptSelectors;

const initialState: TranscriptState = {
  rawTranscripts: [],
  processedData: new Map()
};

export const useTranscriptStore = create<TranscriptStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,
        
        // Actions
        addTranscripts: async (files: File[]) => {
          console.log('🔄 [transcriptStore] addTranscripts called with', files.length, 'files');
          
          const newTranscripts = await Promise.all(files.map(processFileContent));
          console.log('✅ [transcriptStore] Processed transcripts:', newTranscripts);
          
          set((state: TranscriptState) => {
            console.log('📝 [transcriptStore] Starting state update...');
            state.rawTranscripts.push(...newTranscripts);
            console.log('📋 [transcriptStore] Updated rawTranscripts, count:', state.rawTranscripts.length);
            
            // Initialize processed data for new transcripts
            console.log('🔄 [transcriptStore] Initializing processed data...');
            newTranscripts.forEach(transcript => {
              console.log('📊 [transcriptStore] Processing transcript:', transcript.id, transcript.name);
              state.processedData.set(transcript.id, {
                id: transcript.id,
                filename: transcript.name,
                isFullyProcessedSpecificDiachronic: false,
                isFullyProcessedSpecificSynchronic: false
              } as TranscriptProcessedData);
            });
          });
        },
        
        addTranscriptsSync: (transcripts: RawTranscript[]) => {
          set((state: TranscriptState) => {
            state.rawTranscripts.push(...transcripts);
            
            // Initialize processed data for new transcripts
            transcripts.forEach(transcript => {
              state.processedData.set(transcript.id, {
                id: transcript.id,
                filename: transcript.name,
                isFullyProcessedSpecificDiachronic: false,
                isFullyProcessedSpecificSynchronic: false
              } as TranscriptProcessedData);
            });
          });
        },
        
        updateProcessedData: (id: string, updates: Partial<TranscriptProcessedData>) => {
          set((state: TranscriptState) => {
            const current = state.processedData.get(id);
            if (current) {
              state.processedData.set(id, { ...current, ...updates });
            } else {
              // Create new entry if it doesn't exist
              state.processedData.set(id, {
                id,
                filename: updates.filename || `transcript-${id}`,
                isFullyProcessedSpecificDiachronic: false,
                isFullyProcessedSpecificSynchronic: false,
                ...updates
              } as TranscriptProcessedData);
            }
          });
        },
        
        removeTranscript: (id: string) => {
          set((state: TranscriptState) => {
            state.rawTranscripts = state.rawTranscripts.filter(t => t.id !== id);
            state.processedData.delete(id);
          });
        },
        
        reset: () => {
          set(() => ({
            ...initialState,
            processedData: new Map()
          }));
        },
        
        // Selectors
        getTranscriptById: (id: string) => {
          return get().rawTranscripts.find(t => t.id === id);
        },
        
        getProcessedDataById: (id: string) => {
          return get().processedData.get(id);
        }
      })),
      {
        name: V2_TRANSCRIPT_STORAGE_KEY,
        storage: localForageStorage,
        version: 1,
        partialize: (state) => {
          // Only persist if there's data
          const hasData = state.rawTranscripts.length > 0 || state.processedData.size > 0;
          
          if (!hasData) {
            return undefined;
          }
          
          return {
            rawTranscripts: state.rawTranscripts,
            processedData: Array.from(state.processedData.entries())
          };
        },
        // Handle Map deserialization on rehydration
        onRehydrateStorage: () => (state, error) => {
          if (state && state.processedData && Array.isArray(state.processedData)) {
            // Convert array back to Map on rehydration
            state.processedData = new Map(state.processedData);
          }
        }
      }
    )
  )
);