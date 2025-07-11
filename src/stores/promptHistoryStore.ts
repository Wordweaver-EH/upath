import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { localForageStorage } from '../utils/storage'
import { V2_PROMPT_HISTORY_STORAGE_KEY } from '../utils/storeMigration'
import type { PromptHistoryEntry } from '../../types'

/**
 * State interface for the prompt history store
 * 
 * This store manages the history of all prompts sent to the Gemini API
 * and tracks token usage for monitoring and optimization purposes.
 */
interface PromptHistoryState {
  /** Array of all prompt history entries in chronological order */
  promptHistory: PromptHistoryEntry[]
  
  /** Total number of input tokens consumed across all prompts */
  totalInputTokens: number
  
  /** Total number of output tokens generated across all responses */
  totalOutputTokens: number
  
  /** 
   * Add a new prompt entry to the history
   * Automatically updates token counts based on the entry's token estimates
   */
  addPromptEntry: (entry: PromptHistoryEntry) => void
  
  /** Reset the prompt history and token counts to initial state */
  reset: () => void
}

/**
 * Prompt History Store
 * 
 * Manages the history of all prompts sent to the Gemini API during a session.
 * This store is extracted from the monolithic pipelineStore as part of the
 * Strangler Fig migration pattern.
 * 
 * Features:
 * - Tracks all prompt/response pairs with metadata
 * - Accumulates token usage for cost monitoring
 * - Persists history across sessions
 * - Provides data for prompt history export functionality
 */
export const usePromptHistoryStore = create<PromptHistoryState>()(
  persist(
    subscribeWithSelector(
      immer((set) => ({
        // State
        promptHistory: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        
        // Actions
        addPromptEntry: (entry: PromptHistoryEntry) => {
          set((state) => {
            state.promptHistory.push(entry)
            // Only add to totals if tokens are provided (avoid NaN)
            if (entry.estimatedInputTokens) {
              state.totalInputTokens += entry.estimatedInputTokens
            }
            if (entry.estimatedOutputTokens) {
              state.totalOutputTokens += entry.estimatedOutputTokens
            }
          })
        },
        
        reset: () => {
          set((state) => {
            state.promptHistory = []
            state.totalInputTokens = 0
            state.totalOutputTokens = 0
          })
        }
      }))
    ),
    {
      name: V2_PROMPT_HISTORY_STORAGE_KEY,
      storage: localForageStorage,
      partialize: (state) => {
        // Don't persist empty state to save storage space
        // When state is empty, returning undefined tells Zustand to remove the item
        const hasData = state.promptHistory.length > 0 || 
                       state.totalInputTokens > 0 || 
                       state.totalOutputTokens > 0
        
        if (!hasData) {
          return undefined
        }
        
        // Only persist the data, not the methods
        return {
          promptHistory: state.promptHistory,
          totalInputTokens: state.totalInputTokens,
          totalOutputTokens: state.totalOutputTokens
        }
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('[PromptHistoryStore] Error during rehydration:', error);
        }
      }
    }
  )
)