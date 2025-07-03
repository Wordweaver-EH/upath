import React from 'react';
import { StepId, StepStatus } from '../types';
import { STEP_CONFIGS, CheckCircleIcon, getStepDisplayName } from '../constants';
import { useUIStore } from '../src/stores/uiStore';
import { usePipelineStore } from '../src/stores/pipelineStore';
import { formatElapsedTime } from '../src/utils/timeHelper';

// No props needed - component gets all data from stores
interface StatusDisplayProps {}

const StatusDisplay: React.FC<StatusDisplayProps> = () => {
  // Get state directly from stores instead of props
  const currentStepInfo = useUIStore(state => state.currentStepInfo);
  const processStartTime = useUIStore(state => state.processStartTime);
  const elapsedTime = useUIStore(state => state.elapsedTime);
  
  const processedData = usePipelineStore(state => state.processedData);
  const totalInputTokens = usePipelineStore(state => state.totalInputTokens);
  const totalOutputTokens = usePipelineStore(state => state.totalOutputTokens);
  
  // Get filename if transcript-specific step
  const filename = currentStepInfo.transcriptId 
    ? processedData.get(currentStepInfo.transcriptId)?.filename || currentStepInfo.transcriptId
    : '';

  return (
    <div className="p-4 bg-light-bg-alt dark:bg-dark-bg-alt rounded-lg shadow">
      <h3 className="text-md font-semibold mb-1 text-light-text dark:text-dark-text">
        Status: {getStepDisplayName(currentStepInfo.stepId)}
        {currentStepInfo.transcriptId && ` on ${filename}`}
        {currentStepInfo.currentPhaseForP2S && ` (Phase: ${currentStepInfo.currentPhaseForP2S})`}
        {currentStepInfo.currentGduForP4S && ` (GDU: ${currentStepInfo.currentGduForP4S})`}
      </h3>
      <p className="text-xs text-light-sidenote dark:text-dark-sidenote">
        Est. Input Tokens: {totalInputTokens} | Est. Output Tokens: {totalOutputTokens} | Total: {totalInputTokens + totalOutputTokens}
        {processStartTime !== null || elapsedTime > 0 ? ` | Runtime: ${formatElapsedTime(elapsedTime)}` : ''}
      </p>
      {currentStepInfo.status === StepStatus.Loading && <div className="mt-1 text-sm text-blue-600 dark:text-blue-400 animate-pulse">Processing...</div>}
      {currentStepInfo.status === StepStatus.Error && currentStepInfo.error && (
          <div className="mt-1 text-sm text-red-600 dark:text-red-400 overflow-hidden">
              <strong className="block">Error:</strong> 
              <span className="whitespace-pre-wrap break-all block max-h-20 overflow-y-auto">{currentStepInfo.error}</span>
          </div>
      )}
      {currentStepInfo.status === StepStatus.Success && currentStepInfo.stepId !== StepId.COMPLETE && (
        <div className="mt-1 text-sm text-green-600 dark:text-green-400 flex items-center">
          {CheckCircleIcon} <span className="ml-1">Step completed successfully.</span>
        </div>
      )}
    </div>
  );
};

export default StatusDisplay;