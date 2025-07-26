import React, { useState, useEffect } from 'react';
import { STEP_CONFIGS, getStepDisplayName } from '../constants';
import { useUIStore } from '../src/stores/uiStore';
import { usePipelineStore } from '../src/stores/pipelineStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import CollapsibleSection from './CollapsibleSection';
import { Button, TextArea, Select, Slider } from '../src/components/ui';

interface HilModalProps {
  onSubmit: (modelParams: { model: string; temperature: number }) => void;
  getHilPreviousResponseDisplay: () => string;
}

const HilModal: React.FC<HilModalProps> = ({
  onSubmit,
  getHilPreviousResponseDisplay
}) => {
  // Get state from stores
  const isHilModalOpen = useUIStore(state => state.isHilModalOpen);
  const hilContext = useUIStore(state => state.hilContext);
  const hilUserGuidance = useUIStore(state => state.hilUserGuidance);
  
  const closeHilModal = useUIStore(state => state.closeHilModal);
  const setHilUserGuidance = useUIStore(state => state.setHilUserGuidance);
  const processedData = usePipelineStore(state => state.processedData);
  
  // Get current settings
  const currentModel = useSettingsStore(state => state.model);
  const currentTemperature = useSettingsStore(state => state.temperature);
  const availableModels = useSettingsStore(state => state.availableModels);
  
  // Local state for model parameters
  const [selectedModel, setSelectedModel] = useState(currentModel);
  const [selectedTemperature, setSelectedTemperature] = useState(currentTemperature);
  
  // Reset local state when modal opens
  useEffect(() => {
    if (isHilModalOpen) {
      setSelectedModel(currentModel);
      setSelectedTemperature(currentTemperature);
    }
  }, [isHilModalOpen, currentModel, currentTemperature]);

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
            {getStepDisplayName(hilContext.stepInfo.stepId)}
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
          <TextArea
            label="Your Guidance for Improvement:"
            id="hilGuidance" 
            value={hilUserGuidance} 
            onChange={(e) => setHilUserGuidance(e.target.value)}
            rows={6} 
            placeholder="Describe what was wrong or how to improve the output."
          />
          
          <div className="space-y-4 pt-4 border-t border-light-border dark:border-dark-border">
            <h3 className="text-sm font-semibold text-light-text dark:text-dark-text">Model Parameters for Re-run</h3>
            
            <Select
              label="Model"
              id="hilModel"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              options={availableModels}
              helpText="Select a more powerful model if needed for complex corrections"
            />
            
            <Slider
              label={`Temperature: ${selectedTemperature.toFixed(1)}`}
              id="hilTemperature"
              value={selectedTemperature}
              onChange={(value) => setSelectedTemperature(value)}
              min={0}
              max={2}
              step={0.1}
              helpText="Lower values are more focused, higher values are more creative"
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3 pt-4 border-t border-light-border dark:border-dark-border">
          <Button onClick={closeHilModal} variant="secondary">Cancel</Button>
          <Button 
            onClick={() => onSubmit({ model: selectedModel, temperature: selectedTemperature })} 
            disabled={!hilUserGuidance.trim()} 
            variant="primary"
          >
            Submit Guidance & Re-run
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HilModal;