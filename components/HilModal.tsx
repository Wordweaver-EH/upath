import React from 'react';
import { STEP_CONFIGS } from '../constants';
import { useUIStore } from '../src/stores/uiStore';
import { usePipelineStore } from '../src/stores/pipelineStore';
import CollapsibleSection from './CollapsibleSection';

interface HilModalProps {
  onSubmit: () => void;
  getHilPreviousResponseDisplay: () => string;
  inputBaseClasses: string;
  secondaryButtonClasses: string;
  primaryButtonClasses: string;
  disabledButtonClasses: string;
}

const HilModal: React.FC<HilModalProps> = ({
  onSubmit,
  getHilPreviousResponseDisplay,
  inputBaseClasses,
  secondaryButtonClasses,
  primaryButtonClasses,
  disabledButtonClasses
}) => {
  // Get state from stores
  const isHilModalOpen = useUIStore(state => state.isHilModalOpen);
  const hilContext = useUIStore(state => state.hilContext);
  const hilUserGuidance = useUIStore(state => state.hilUserGuidance);
  
  const closeHilModal = useUIStore(state => state.closeHilModal);
  const setHilUserGuidance = useUIStore(state => state.setHilUserGuidance);
  const processedData = usePipelineStore(state => state.processedData);

  if (!isHilModalOpen || !hilContext) return null;

  return (
    <div 
      className="fixed inset-0 bg-light-bg/70 dark:bg-dark-bg/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      role="dialog" 
      aria-modal="true" 
      aria-labelledby="hil-modal-title"
    >
      <div className="bg-light-bg-alt dark:bg-dark-bg-alt p-6 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-light-border dark:border-dark-border">
        <h2 id="hil-modal-title" className="text-lg font-semibold text-light-accent dark:text-dark-accent mb-4">
          Provide Guidance for: <span className="font-normal text-light-text dark:text-dark-text">
            {STEP_CONFIGS[hilContext.stepInfo.stepId]?.title}
            {hilContext.stepInfo.transcriptId && ` (Transcript: ${processedData.get(hilContext.stepInfo.transcriptId)?.filename || hilContext.stepInfo.transcriptId})`}
            {hilContext.stepInfo.currentPhaseForP2S && ` (Phase: ${hilContext.stepInfo.currentPhaseForP2S})`}
            {hilContext.stepInfo.currentGduForP4S && ` (GDU: ${hilContext.stepInfo.currentGduForP4S})`}
          </span>
        </h2>
        
        <div className="space-y-3 overflow-y-auto pr-2 flex-grow">
          <CollapsibleSection title="Original Prompt Used" defaultOpen={false} contentMaxHeight="10rem">
            <pre className="text-xs p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md whitespace-pre-wrap break-all">
              {hilContext.originalPrompt}
            </pre>
          </CollapsibleSection>
          <CollapsibleSection title="AI's Previous Response" defaultOpen={false} contentMaxHeight="10rem">
            <pre className="text-xs p-2 bg-light-bg dark:bg-dark-bg border border-light-border dark:border-dark-border rounded-md whitespace-pre-wrap break-all">
              {getHilPreviousResponseDisplay()}
            </pre>
          </CollapsibleSection>
          <div>
            <label htmlFor="hilGuidance" className="block text-sm font-medium text-light-sidenote dark:text-dark-sidenote mb-1">
              Your Guidance for Improvement:
            </label>
            <textarea 
              id="hilGuidance" 
              value={hilUserGuidance} 
              onChange={(e) => setHilUserGuidance(e.target.value)}
              rows={6} 
              className={`${inputBaseClasses} border-light-border dark:border-dark-border`}
              placeholder="Describe what was wrong or how to improve the output."
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-light-border dark:border-dark-border">
          <button onClick={closeHilModal} className={secondaryButtonClasses}>Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={!hilUserGuidance.trim()} 
            className={`${primaryButtonClasses} ${!hilUserGuidance.trim() ? disabledButtonClasses : ''}`}
          >
            Submit Guidance & Re-run
          </button>
        </div>
      </div>
    </div>
  );
};

export default HilModal;