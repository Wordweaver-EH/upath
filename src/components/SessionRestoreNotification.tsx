import React from 'react'
import { useUIStore } from '../stores/uiStore'
import { usePipelineStore } from '../stores/pipelineStore'

export const SessionRestoreNotification: React.FC = () => {
  const sessionWasRestored = useUIStore(state => state.sessionWasRestored)
  const hideNotification = useUIStore(state => state.hideSessionRestoreNotification)
  const clearAutosaveData = usePipelineStore(state => state.clearAutosaveData)
  const resetPipeline = usePipelineStore(state => state.resetPipeline)
  const resetUIState = useUIStore(state => state.resetUIState)
  
  if (!sessionWasRestored) return null
  
  const handleStartNewSession = async () => {
    // Clear autosaved data
    await clearAutosaveData()
    
    // Reset both stores
    resetPipeline()
    resetUIState()
    
    // Hide the notification
    hideNotification()
    
    // Reload the page to ensure clean state
    window.location.reload()
  }
  
  const handleContinueSession = () => {
    hideNotification()
  }
  
  return (
    <div className="fixed inset-0 bg-light-bg/70 dark:bg-dark-bg/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="max-w-md bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 rounded-lg shadow-2xl p-6">
        <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
            Session Restored
          </h3>
          <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
            <p>
              Your previous analysis session has been restored. You can continue where you left off or start a new session.
            </p>
          </div>
          <div className="mt-4 flex space-x-3">
            <button
              onClick={handleContinueSession}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
            >
              Continue Session
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              onClick={handleStartNewSession}
              className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300"
            >
              Start New Session
            </button>
          </div>
        </div>
        <div className="ml-auto pl-3">
          <div className="-mx-1.5 -my-1.5">
            <button
              onClick={handleContinueSession}
              className="inline-flex rounded-md p-1.5 text-blue-500 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-blue-50 focus:ring-blue-600"
            >
              <span className="sr-only">Dismiss</span>
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}