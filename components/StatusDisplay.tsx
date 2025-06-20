
import React from 'react';
import { CurrentStepInfo, StepId, StepStatus, TranscriptProcessedData, GenericAnalysisState } from '../types';
import { STEP_CONFIGS, CheckCircleIcon } from '../constants'; // Assuming CheckCircleIcon is in constants

interface StatusDisplayProps {
  currentStepInfo: CurrentStepInfo;
  STEP_CONFIGS: typeof STEP_CONFIGS; // Use typeof to get the type of STEP_CONFIGS object
  processedData: Map<string, TranscriptProcessedData>;
  totalInputTokens: number;
  totalOutputTokens: number;
  processStartTime: number | null;
  elapsedTime: number;
  formatElapsedTime: (seconds: number) => string;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({
  currentStepInfo, STEP_CONFIGS, processedData,
  totalInputTokens, totalOutputTokens,
  processStartTime, elapsedTime, formatElapsedTime
}) => {
  return (
    <div className="p-4 bg-light-bg-alt dark:bg-dark-bg-alt rounded-lg shadow">
      <h3 className="text-md font-semibold mb-1 text-light-text dark:text-dark-text">
        Status: {STEP_CONFIGS[currentStepInfo.stepId]?.title || currentStepInfo.stepId}
        {currentStepInfo.transcriptId && ` on ${processedData.get(currentStepInfo.transcriptId)?.filename || currentStepInfo.transcriptId}`}
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
