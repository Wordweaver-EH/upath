import React from 'react'

interface AppLoadingScreenProps {
  message?: string
}

export const AppLoadingScreen: React.FC<AppLoadingScreenProps> = ({ 
  message = 'Loading...' 
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white dark:bg-gray-900">
      <div className="text-center">
        {/* Logo/Branding */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200">
            µ-PATH
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Micro-Phenomenological Analysis Tool
          </p>
        </div>
        
        {/* Loading Spinner */}
        <div className="mb-4" data-testid="loading-spinner">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 dark:border-gray-100"></div>
        </div>
        
        {/* Loading Message */}
        <p className="text-lg text-gray-700 dark:text-gray-300">
          {message}
        </p>
      </div>
    </div>
  )
}