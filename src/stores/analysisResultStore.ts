import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { enableMapSet } from 'immer';
import { localForageStorage } from '../utils/storage';
import { V2_ANALYSIS_STORAGE_KEY } from '../utils/storeMigration';
import type { GenericAnalysisState } from '../../types';

// Enable MapSet plugin for Immer
enableMapSet();

interface AnalysisResultState {
  genericAnalysisState: GenericAnalysisState;
}

interface AnalysisResultActions {
  updateGenericState: (updates: Partial<GenericAnalysisState>) => void;
  replaceGenericState: (newState: GenericAnalysisState) => void;
  reset: () => void;
}

interface AnalysisResultSelectors {
  hasStepOutput: (stepId: string) => boolean;
  hasStepError: (stepId: string) => boolean;
  getStepOutput: (stepId: string) => any;
  getStepError: (stepId: string) => string | undefined;
  isPhaseComplete: (phase: 'diachronic' | 'synchronic' | 'refinement' | 'causal' | 'report') => boolean;
  getOverallProgress: () => number;
}

type AnalysisResultStore = AnalysisResultState & AnalysisResultActions & AnalysisResultSelectors;

const initialState: AnalysisResultState = {
  genericAnalysisState: {
    isFullyProcessedGenericDiachronic: false,
    isFullyProcessedGenericSynchronic: false,
    isRefinementDone: false,
    isCausalModelingDone: false,
    isReportGenerated: false
  }
};

export const useAnalysisResultStore = create<AnalysisResultStore>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,
        
        // Actions
        updateGenericState: (updates: Partial<GenericAnalysisState>) => {
          set((state: AnalysisResultState) => {
            state.genericAnalysisState = {
              ...state.genericAnalysisState,
              ...updates
            };
          });
        },
        
        replaceGenericState: (newState: GenericAnalysisState) => {
          set((state: AnalysisResultState) => {
            state.genericAnalysisState = newState;
          });
        },
        
        reset: () => {
          set(() => ({
            ...initialState
          }));
        },
        
        // Selectors
        hasStepOutput: (stepId: string) => {
          const state = get();
          const outputKey = `${stepId}_output` as keyof GenericAnalysisState;
          return state.genericAnalysisState[outputKey] !== undefined;
        },
        
        hasStepError: (stepId: string) => {
          const state = get();
          const errorKey = `${stepId}_error` as keyof GenericAnalysisState;
          return state.genericAnalysisState[errorKey] !== undefined;
        },
        
        getStepOutput: (stepId: string) => {
          const state = get();
          const outputKey = `${stepId}_output` as keyof GenericAnalysisState;
          return state.genericAnalysisState[outputKey];
        },
        
        getStepError: (stepId: string) => {
          const state = get();
          const errorKey = `${stepId}_error` as keyof GenericAnalysisState;
          return state.genericAnalysisState[errorKey] as string | undefined;
        },
        
        isPhaseComplete: (phase: 'diachronic' | 'synchronic' | 'refinement' | 'causal' | 'report') => {
          const state = get();
          switch (phase) {
            case 'diachronic':
              return state.genericAnalysisState.isFullyProcessedGenericDiachronic;
            case 'synchronic':
              return state.genericAnalysisState.isFullyProcessedGenericSynchronic;
            case 'refinement':
              return state.genericAnalysisState.isRefinementDone;
            case 'causal':
              return state.genericAnalysisState.isCausalModelingDone;
            case 'report':
              return state.genericAnalysisState.isReportGenerated;
            default:
              return false;
          }
        },
        
        getOverallProgress: () => {
          const state = get();
          const phases = [
            state.genericAnalysisState.isFullyProcessedGenericDiachronic,
            state.genericAnalysisState.isFullyProcessedGenericSynchronic,
            state.genericAnalysisState.isRefinementDone,
            state.genericAnalysisState.isCausalModelingDone,
            state.genericAnalysisState.isReportGenerated
          ];
          const completedPhases = phases.filter(Boolean).length;
          return completedPhases / phases.length;
        }
      })),
      {
        name: V2_ANALYSIS_STORAGE_KEY,
        storage: localForageStorage,
        version: 1,
        partialize: (state) => ({
          genericAnalysisState: state.genericAnalysisState
        }),
        onRehydrateStorage: () => (state, error) => {
          if (error) {
            console.error('[AnalysisResultStore] Error during rehydration:', error);
          }
        }
      }
    )
  )
);