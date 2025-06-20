
import React from 'react';
import { StepId, StepStatus, CurrentStepInfo } from '../types';
import { STEP_CONFIGS as StepConfigsType, CheckCircleIcon, InfoIcon } from '../constants';
import CollapsibleSection from './CollapsibleSection';

interface PipelineStepNodeProps {
  stepId: StepId;
  title: string;
  status: StepStatus;
  isActive: boolean;
  isPerTranscript?: boolean;
  isPerPhase?: boolean;
  isPerGDU?: boolean;
  error?: string;
  onClick?: () => void;
}

export const PipelineStepNode: React.FC<PipelineStepNodeProps> = ({
  stepId, title, status, isActive, isPerTranscript, isPerPhase, isPerGDU, error, onClick
}) => {
  let bgColor = 'bg-light-bg dark:bg-dark-bg';
  let textColor = 'text-light-text dark:text-dark-text';
  let borderColor = 'border-light-border dark:border-dark-border';
  let statusIcon = null;
  let subtext = '';

  if (isPerTranscript) subtext = '(Per Transcript)';
  if (isPerPhase) subtext = '(Per Phase)';
  if (isPerGDU) subtext = '(Per GDU)';

  if (isActive) {
    bgColor = 'bg-light-accent/10 dark:bg-dark-accent/10';
    borderColor = 'border-light-accent dark:border-dark-accent';
    textColor = 'text-light-accent dark:text-dark-accent';
  }

  switch (status) {
    case StepStatus.Success:
      bgColor = 'bg-green-100 dark:bg-green-800'; textColor = 'text-green-700 dark:text-green-200';
      borderColor = 'border-green-500 dark:border-green-600'; statusIcon = CheckCircleIcon; break;
    case StepStatus.Error:
      bgColor = 'bg-red-100 dark:bg-red-800'; textColor = 'text-red-700 dark:text-red-300';
      borderColor = 'border-red-500 dark:border-red-600'; statusIcon = InfoIcon; break;
    case StepStatus.Loading:
      bgColor = 'bg-blue-100 dark:bg-blue-800'; textColor = 'text-blue-700 dark:text-blue-200';
      borderColor = 'border-blue-500 dark:border-blue-600'; break;
    default: break;
  }
  const shortTitle = title.split(':')[1]?.trim() || title;
  return (
    <div
      className={`p-2 rounded-md border text-xs text-center transition-all duration-150 ${bgColor} ${textColor} ${borderColor} ${isActive ? 'ring-2 ring-offset-1 ring-offset-light-bg-alt dark:ring-offset-dark-bg-alt ring-light-accent dark:ring-dark-accent ephemeral-border' : ''} ${onClick ? 'cursor-pointer hover:shadow-md' : 'cursor-default'}`}
      onClick={onClick} title={error ? `Error: ${error}` : title} role="button" tabIndex={onClick ? 0 : -1}
      onKeyPress={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      aria-label={`Pipeline step: ${title}. Status: ${status}. ${error ? `Error: ${error}` : ''} ${subtext}`}
    >
      <div className="flex items-center justify-center space-x-1"> {statusIcon && React.cloneElement(statusIcon, { className: `w-3 h-3 ${isActive ? textColor : ''}`})} <span className="font-semibold truncate" title={title}>{shortTitle}</span> </div>
      {subtext && <p className="text-[10px] opacity-70">{subtext}</p>}
    </div>
  );
};

interface PipelinePart {
  name: string;
  steps: StepId[];
  isPerTranscript?: boolean;
  isPerPhase?: boolean;
  isPerGDU?: boolean;
}

interface PipelineOverviewProps {
  allPipelineParts: PipelinePart[];
  STEP_CONFIGS: typeof StepConfigsType;
  currentStepInfo: CurrentStepInfo;
  getStepStatusForPipelineView: (stepId: StepId) => { status: StepStatus; error?: string };
  handlePipelineStepClick: (stepId: StepId) => void;
  PipelineStepNodeComponent: React.FC<PipelineStepNodeProps>; // To pass PipelineStepNode as a prop
}

const PipelineOverview: React.FC<PipelineOverviewProps> = ({
  allPipelineParts, STEP_CONFIGS, currentStepInfo,
  getStepStatusForPipelineView, handlePipelineStepClick,
  PipelineStepNodeComponent: NodeComponent // Use the passed component
}) => {
  return (
    <CollapsibleSection title="Analysis Pipeline Overview" defaultOpen={false} contentMaxHeight="60vh">
      <div className="flex flex-col space-y-3 p-1">
        {allPipelineParts.map(part => (
          <div key={part.name} className="p-2 border border-light-border dark:border-dark-border rounded-md bg-light-bg-alt dark:bg-dark-bg-alt shadow-sm">
            <h4 className="text-sm font-semibold mb-2 text-light-accent dark:text-dark-accent">{part.name}</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {part.steps.map(stepId => {
                const config = STEP_CONFIGS[stepId];
                if (!config) return null;
                const {status, error} = getStepStatusForPipelineView(stepId);
                return (
                  <NodeComponent // Use the passed NodeComponent
                    key={stepId} stepId={stepId} title={config.title} status={status}
                    isActive={currentStepInfo.stepId === stepId && currentStepInfo.status !== StepStatus.Idle}
                    isPerTranscript={part.isPerTranscript} isPerPhase={part.isPerPhase} isPerGDU={part.isPerGDU}
                    error={error} onClick={() => handlePipelineStepClick(stepId)}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
};
export default PipelineOverview;
