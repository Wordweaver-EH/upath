import React from 'react';
import { usePipelineBackendToggle } from '../services/pipeline/pipelineBackendToggle';
import { resetPipelineService } from '../services/pipeline/pipelineServiceFactory';

/**
 * Backend Toggle Component
 * 
 * Provides UI controls for switching between traditional frontend pipeline execution
 * and LangGraph backend execution. Includes health status indicators and warnings.
 */
export const BackendToggle: React.FC = () => {
  const {
    useLangGraphBackend,
    isBackendHealthy,
    enableLangGraphBackend,
    disableLangGraphBackend,
    checkBackendHealth,
    getBackendStatus,
    getRecommendedBackend
  } = usePipelineBackendToggle();

  const [isChecking, setIsChecking] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);

  const backendStatus = getBackendStatus();
  const recommended = getRecommendedBackend();

  const handleToggle = async () => {
    try {
      console.log('[BackendToggle] Toggling backend. Current state:', useLangGraphBackend);
      
      if (useLangGraphBackend) {
        console.log('[BackendToggle] Switching to traditional frontend');
        disableLangGraphBackend();
      } else {
        console.log('[BackendToggle] Switching to LangGraph backend');
        enableLangGraphBackend();
        // Check backend health when enabling
        console.log('[BackendToggle] Checking backend health...');
        await handleHealthCheck();
      }
      
      // Reset pipeline service AFTER changing the backend state
      // This ensures the new service is created with the correct backend
      console.log('[BackendToggle] Resetting pipeline service...');
      resetPipelineService();
      
      // Force a re-render by triggering a small delay
      // This gives React time to process the state change
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('[BackendToggle] Toggle complete');
      
    } catch (error) {
      console.error('[BackendToggle] Error toggling backend:', error);
      // If there's an error, revert to traditional frontend
      if (useLangGraphBackend) {
        disableLangGraphBackend();
      }
    }
  };

  const handleHealthCheck = async () => {
    setIsChecking(true);
    try {
      await checkBackendHealth();
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusColor = () => {
    if (useLangGraphBackend) {
      return isBackendHealthy ? 'text-green-600' : 'text-red-600';
    }
    return 'text-blue-600';
  };

  const getStatusText = () => {
    if (useLangGraphBackend) {
      return isBackendHealthy ? 'LangGraph Backend (Healthy)' : 'LangGraph Backend (Unhealthy)';
    }
    return 'Traditional Frontend';
  };

  const getRecommendationText = () => {
    if (recommended === 'langgraph' && !useLangGraphBackend) {
      return 'Backend is healthy - consider enabling LangGraph';
    }
    if (recommended === 'traditional' && useLangGraphBackend) {
      return 'Backend is unhealthy - consider disabling LangGraph';
    }
    return '';
  };

  return (
    <div className="border border-light-border dark:border-dark-border rounded-lg p-4 bg-light-bg-alt dark:bg-dark-bg-alt">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-light-text dark:text-dark-text">Pipeline Backend</h3>
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="text-sm text-light-text-secondary dark:text-dark-text-secondary hover:text-light-text hover:dark:text-dark-text"
        >
          {showDetails ? 'Hide Details' : 'Show Details'}
        </button>
      </div>

      <div className="flex items-center space-x-4">
        <div className={`font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </div>
        
        <button
          onClick={handleToggle}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Switch to {useLangGraphBackend ? 'Frontend' : 'Backend'}
        </button>

        {useLangGraphBackend && (
          <button
            onClick={handleHealthCheck}
            disabled={isChecking}
            className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-50"
          >
            {isChecking ? 'Checking...' : 'Check Health'}
          </button>
        )}
      </div>

      {getRecommendationText() && (
        <div className="mt-2 text-sm text-amber-600">
          💡 {getRecommendationText()}
        </div>
      )}

      {showDetails && (
        <div className="mt-4 text-sm text-gray-600 space-y-2">
          <div><strong>Backend URL:</strong> {backendStatus.url}</div>
          <div><strong>Enabled:</strong> {backendStatus.isEnabled ? 'Yes' : 'No'}</div>
          <div><strong>Healthy:</strong> {backendStatus.isHealthy ? 'Yes' : 'No'}</div>
          <div>
            <strong>Last Checked:</strong>{' '}
            {backendStatus.lastChecked 
              ? backendStatus.lastChecked.toLocaleTimeString()
              : 'Never'
            }
          </div>
          
          <div className="mt-3 p-3 bg-light-bg dark:bg-dark-bg rounded text-xs">
            <div className="font-medium mb-1">Execution Modes:</div>
            <div><strong>Traditional Frontend:</strong> Direct Gemini API calls from browser (requires API key in frontend)</div>
            <div><strong>LangGraph Backend:</strong> Structured graph execution on backend server (API key secure on server)</div>
          </div>
        </div>
      )}
    </div>
  );
};