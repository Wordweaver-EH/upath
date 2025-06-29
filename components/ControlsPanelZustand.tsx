import React from 'react';
import { PlayIcon, PauseIcon, NextIcon, PreviousIcon, RetryIcon, LightbulbIcon, DownloadIcon, AppendixIcon, ChevronDownIcon, STEP_CONFIGS } from '../constants';
import { useUIStore } from '../src/stores/uiStore';
import { usePipelineStore } from '../src/stores/pipelineStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useIRRStore } from '../src/stores/irrStore';

// IRR (Inter-Rater Reliability) icon
const IrrIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M2.5 8a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 3.5 8h-1ZM6.5 8a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1A1.5 1.5 0 0 0 9 10.5v-1A1.5 1.5 0 0 0 7.5 8h-1ZM10.5 8a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 11.5 8h-1Z" />
    <path d="M2.5 4a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 3.5 4h-1ZM6.5 4a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1A1.5 1.5 0 0 0 9 6.5v-1A1.5 1.5 0 0 0 7.5 4h-1ZM10.5 4a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 11.5 4h-1Z" />
  </svg>
);

interface ControlsPanelProps {
  // These props need to be passed from App.tsx as they involve complex logic
  onPreviousStep: () => void;
  isPreviousStepDisabled: boolean;
  onNextStep: () => void;
  isNextStepDisabled: boolean;
  onRunStep: () => void;
  isRunStepDisabled: boolean;
  isHilModalDisabled: boolean;
  onDownloadOutput: () => void;
  isDownloadOutputDisabled: boolean;
  onDownloadHistory: (format: 'tsv' | 'json') => void;
  isDownloadHistoryDisabled: boolean;
  onGenerateAppendix: () => void;
  isAppendixDataAvailable: boolean;
  onGenerateHtmlAppendix: () => void;
  showRetryWithNewSeedUI: boolean;
  retrySeedInput: string;
  onRetrySeedInputChange: (value: string) => void;
  onRetryWithUserSeed: () => void;
  // Style classes
  inputBaseClasses: string;
  primaryButtonClasses: string;
  secondaryButtonClasses: string;
  disabledButtonClasses: string;
}

const ControlsPanelZustand: React.FC<ControlsPanelProps> = (props) => {
  const {
    isPreviousStepDisabled, isNextStepDisabled,
    isRunStepDisabled, isHilModalDisabled,
    isDownloadOutputDisabled, isDownloadHistoryDisabled,
    isAppendixDataAvailable,
    showRetryWithNewSeedUI, retrySeedInput,
    inputBaseClasses, primaryButtonClasses, secondaryButtonClasses, disabledButtonClasses
  } = props;
  
  // Get state from stores
  const isAutorunning = useUIStore(state => state.isAutorunning);
  const toggleAutorun = useUIStore(state => state.toggleAutorun);
  const { apiKeyPresent, dvFocusError } = useSettingsStore(state => ({ 
    apiKeyPresent: state.apiKeyPresent, 
    dvFocusError: state.dvFocusError 
  }));
  const rawTranscripts = usePipelineStore(state => state.rawTranscripts);
  const currentStepInfo = useUIStore(state => state.currentStepInfo);
  const openIrrModal = useIRRStore(state => () => state.startComparison);

  // Calculate if autorun button should be disabled
  const isAutorunPauseButtonEffectivelyDisabled = !apiKeyPresent || 
    !!dvFocusError || 
    (rawTranscripts.length === 0 && currentStepInfo.stepId === 'IDLE') || 
    currentStepInfo.stepId === 'COMPLETE';

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <button 
          onClick={toggleAutorun} 
          disabled={isAutorunPauseButtonEffectivelyDisabled} 
          className={`${primaryButtonClasses} ${isAutorunPauseButtonEffectivelyDisabled ? disabledButtonClasses : ''}`}
        >
          {isAutorunning ? PauseIcon : PlayIcon} <span>{isAutorunning ? 'Pause' : 'Autorun'}</span>
        </button>
        <button 
          onClick={props.onPreviousStep} 
          disabled={isPreviousStepDisabled} 
          className={`${secondaryButtonClasses} ${isPreviousStepDisabled ? disabledButtonClasses : ''}`}
        > 
          {PreviousIcon} <span>Prev Step</span> 
        </button>
        <button 
          onClick={props.onNextStep} 
          disabled={isNextStepDisabled} 
          className={`${secondaryButtonClasses} ${isNextStepDisabled ? disabledButtonClasses : ''}`}
        > 
          {NextIcon} <span>Next Step</span> 
        </button>
        <button 
          onClick={props.onRunStep} 
          disabled={isRunStepDisabled} 
          className={`${secondaryButtonClasses} ${isRunStepDisabled ? disabledButtonClasses : ''}`}
        > 
          {RetryIcon} <span>Run Step</span> 
        </button>
        <button 
          onClick={() => {
            // For Zustand version, we need to call openHilModal from UIStore
            const uiStore = useUIStore.getState();
            // Get current state to build the context
            const { currentStepInfo } = uiStore;
            const config = STEP_CONFIGS[currentStepInfo.stepId];
            
            if (config && currentStepInfo.inputData && (currentStepInfo.outputData || currentStepInfo.error)) {
              const originalPrompt = config.generatePrompt(currentStepInfo.inputData);
              uiStore.openHilModal({
                stepInfo: currentStepInfo,
                originalPrompt,
                previousResponse: currentStepInfo.outputData 
                  ? (typeof currentStepInfo.outputData === 'string' 
                    ? currentStepInfo.outputData 
                    : JSON.stringify(currentStepInfo.outputData, null, 2)) 
                  : (currentStepInfo.error || "No previous response data.")
              });
            }
          }} 
          disabled={isHilModalDisabled} 
          className={`${secondaryButtonClasses} ${isHilModalDisabled ? disabledButtonClasses : ''}`} 
          title="Provide guidance to correct and re-run current step."
        > 
          {LightbulbIcon} <span>Guidance</span> 
        </button>
        <button 
          onClick={props.onDownloadOutput} 
          disabled={isDownloadOutputDisabled} 
          className={`${secondaryButtonClasses} ${isDownloadOutputDisabled ? disabledButtonClasses : ''}`}
        > 
          {DownloadIcon} <span>DL Output</span> 
        </button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
        <div className="relative lg:col-span-1">
          <button 
            id="dl-history-button" 
            disabled={isDownloadHistoryDisabled} 
            className={`${secondaryButtonClasses} w-full ${isDownloadHistoryDisabled ? disabledButtonClasses : ''}`} 
            onClick={() => document.getElementById('history-dropdown')?.classList.toggle('hidden')}
          > 
            {DownloadIcon} <span>DL History</span> {ChevronDownIcon} 
          </button>
          <div id="history-dropdown" className="absolute z-10 mt-1 w-full bg-light-bg-alt dark:bg-dark-bg-alt border border-light-border dark:border-dark-border rounded-md shadow-lg hidden">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault(); 
                props.onDownloadHistory('json');
                document.getElementById('history-dropdown')?.classList.add('hidden');
              }} 
              className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border"
            >
              As JSON
            </a>
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault(); 
                props.onDownloadHistory('tsv');
                document.getElementById('history-dropdown')?.classList.add('hidden');
              }} 
              className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border"
            >
              As TSV
            </a>
          </div>
        </div>
        
        <div className="relative lg:col-span-1">
          <button 
            id="dl-appendix-button" 
            disabled={!isAppendixDataAvailable} 
            className={`${secondaryButtonClasses} w-full ${!isAppendixDataAvailable ? disabledButtonClasses : ''}`} 
            onClick={() => document.getElementById('appendix-dropdown')?.classList.toggle('hidden')} 
            title="Generates a detailed appendix file."
          > 
            {AppendixIcon} <span>DL Appendix</span> {ChevronDownIcon} 
          </button>
          <div id="appendix-dropdown" className="absolute z-10 mt-1 w-full bg-light-bg-alt dark:bg-dark-bg-alt border border-light-border dark:border-dark-border rounded-md shadow-lg hidden">
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault(); 
                props.onGenerateAppendix();
                document.getElementById('appendix-dropdown')?.classList.add('hidden');
              }} 
              className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border"
            >
              As Markdown (.md)
            </a>
            <a 
              href="#" 
              onClick={(e) => {
                e.preventDefault(); 
                props.onGenerateHtmlAppendix();
                document.getElementById('appendix-dropdown')?.classList.add('hidden');
              }} 
              className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border"
            >
              As HTML (.html)
            </a>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <button 
            onClick={() => {
              const irrStore = useIRRStore.getState();
              irrStore.resetIrrWorkflow();
              irrStore.openIrrModal();
            }} 
            disabled={false} 
            className={`${secondaryButtonClasses} w-full`} 
            title="Compare two independent analysis runs for inter-rater reliability"
          > 
            {IrrIcon} <span>Compare Runs (IRR)</span> 
          </button>
        </div>
      </div>
      
      {showRetryWithNewSeedUI && (
        <div className="p-3 border border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900 rounded-md space-y-2">
          <p className="text-sm text-yellow-700 dark:text-yellow-300">JSON parsing failed. Try with a different seed for this step:</p>
          <div className="flex items-center space-x-2">
            <input 
              type="text" 
              value={retrySeedInput} 
              onChange={(e) => props.onRetrySeedInputChange(e.target.value)} 
              placeholder="Enter positive integer seed" 
              className={`${inputBaseClasses} flex-grow border-yellow-500 dark:border-yellow-500`} 
            />
            <button 
              onClick={props.onRetryWithUserSeed} 
              className={`${secondaryButtonClasses} bg-yellow-200 dark:bg-yellow-700 border-yellow-400 dark:border-yellow-600 hover:bg-yellow-300 dark:hover:bg-yellow-600`}
            > 
              {RetryIcon} Retry with New Seed 
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ControlsPanelZustand;