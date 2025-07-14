import React from 'react';
import { getPipelineService } from '../services/pipeline/pipelineServiceFactory';

const BACKEND_URL = process.env.NODE_ENV === 'production' 
  ? process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001'
  : 'http://localhost:3001';

/**
 * Backend Status Component
 * 
 * Displays the health status of the Modular Pipeline backend service.
 */
export const BackendToggle: React.FC = () => {
  const [isBackendHealthy, setIsBackendHealthy] = React.useState(false);
  const [isChecking, setIsChecking] = React.useState(false);
  const [showDetails, setShowDetails] = React.useState(false);
  const [lastChecked, setLastChecked] = React.useState<Date | null>(null);

  const checkBackendHealth = async () => {
    setIsChecking(true);
    try {
      const pipelineService = getPipelineService();
      await pipelineService.getHealthStatus();
      setIsBackendHealthy(true);
      setLastChecked(new Date());
    } catch (error) {
      setIsBackendHealthy(false);
      console.error('Backend health check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const getStatusColor = () => {
    return isBackendHealthy ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400';
  };

  const getStatusText = () => {
    return isBackendHealthy ? 'Modular Pipeline Backend (Healthy)' : 'Modular Pipeline Backend (Unhealthy)';
  };

  return (
    <div className="border border-light-border dark:border-dark-border rounded-lg p-4 bg-light-bg-alt dark:bg-dark-bg-alt">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium text-light-text dark:text-dark-text">Pipeline Engine</h3>
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
          onClick={checkBackendHealth}
          disabled={isChecking}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 text-light-text dark:text-dark-text rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
        >
          {isChecking ? 'Checking...' : 'Check Health'}
        </button>
      </div>

      {!isBackendHealthy && (
        <div className="mt-2 text-sm text-amber-600 dark:text-amber-400">
          ⚠️ Backend is unhealthy. Please ensure the backend server is running on {BACKEND_URL}
        </div>
      )}

      {showDetails && (
        <div className="mt-4 text-sm text-gray-600 space-y-2">
          <div><strong>Backend URL:</strong> {BACKEND_URL}</div>
          <div><strong>Enabled:</strong> Yes (Permanent)</div>
          <div><strong>Healthy:</strong> {isBackendHealthy ? 'Yes' : 'No'}</div>
          <div>
            <strong>Last Checked:</strong>{' '}
            {lastChecked 
              ? lastChecked.toLocaleTimeString()
              : 'Never'
            }
          </div>
          
          <div className="mt-3 p-3 bg-light-bg dark:bg-dark-bg rounded text-xs">
            <div className="font-medium mb-1">Execution Mode:</div>
            <div className="text-green-600 dark:text-green-400">
              <strong>Modular Pipeline Backend:</strong> All pipeline execution happens via /api/pipeline/* endpoints. 
              Each µ-PATH step is executed independently with proper dependency resolution.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};