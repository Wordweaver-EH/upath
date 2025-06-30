
import React, { useMemo } from 'react';
import { StepId } from '../types';
import { PlayIcon, PauseIcon, NextIcon, PreviousIcon, RetryIcon, LightbulbIcon, DownloadIcon, AppendixIcon, ChevronDownIcon } from '../constants';
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
  // Retry UI state (still managed in App.tsx)
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

const ControlsPanel: React.FC<ControlsPanelProps> = ({
  showRetryWithNewSeedUI,
  retrySeedInput,
  onRetrySeedInputChange,
  onRetryWithUserSeed,
  inputBaseClasses,
  primaryButtonClasses,
  secondaryButtonClasses,
  disabledButtonClasses
}) => {
  // UI Store
  const isAutorunning = useUIStore(state => state.isAutorunning);
  const toggleAutorun = useUIStore(state => state.toggleAutorun);
  const currentStepInfo = useUIStore(state => state.currentStepInfo);
  
  // Settings Store
  const apiKeyPresent = useSettingsStore(state => state.apiKeyPresent);
  const dvFocusError = useSettingsStore(state => state.dvFocusError);
  
  // Pipeline Store
  const rawTranscripts = usePipelineStore(state => state.rawTranscripts);
  
  // Combined selector for autorun disabled state (memoized to prevent infinite re-renders)
  const isAutorunDisabled = useMemo(() => {
    return !apiKeyPresent || 
      !!dvFocusError || 
      (rawTranscripts.length === 0 && currentStepInfo.stepId === StepId.IDLE) || 
      currentStepInfo.stepId === StepId.COMPLETE;
  }, [apiKeyPresent, dvFocusError, rawTranscripts.length, currentStepInfo.stepId]);
  const previousStep = useUIStore(state => state.previousStep);
  const nextStep = useUIStore(state => state.nextStep);
  const openHilModalWithContext = useUIStore(state => state.openHilModalWithContext);

  // Pipeline Store
  const isPreviousStepDisabled = usePipelineStore(state => state.isPreviousStepDisabled());
  const isNextStepDisabled = usePipelineStore(state => state.isNextStepDisabled());
  const isRunStepDisabled = usePipelineStore(state => state.isRunStepDisabled());
  const isHilModalDisabled = usePipelineStore(state => state.isHilModalDisabled());
  const isDownloadOutputDisabled = usePipelineStore(state => state.isDownloadOutputDisabled());
  const isDownloadHistoryDisabled = usePipelineStore(state => state.isDownloadHistoryDisabled());
  const isAppendixDataAvailable = usePipelineStore(state => state.isAppendixDataAvailable());
  const processSingleStep = usePipelineStore(state => state.processSingleStep);
  const downloadOutput = usePipelineStore(state => state.downloadOutput);
  const downloadHistory = usePipelineStore(state => state.downloadHistory);
  const generateAppendix = usePipelineStore(state => state.generateAppendix);

  // IRR Store
  const openIrrModal = useIRRStore(state => state.openIrrModal);

  // Handler for running current step
  const handleRunStep = () => {
    const currentStepInfo = useUIStore.getState().currentStepInfo;
    processSingleStep({ stepId: currentStepInfo.stepId });
  };

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <button onClick={toggleAutorun} disabled={isAutorunDisabled} className={`${primaryButtonClasses} ${isAutorunDisabled ? disabledButtonClasses : ''}`}>
            {isAutorunning ? PauseIcon : PlayIcon} <span>{isAutorunning ? 'Pause' : 'Autorun'}</span>
        </button>
        <button onClick={previousStep} disabled={isPreviousStepDisabled} className={`${secondaryButtonClasses} ${isPreviousStepDisabled ? disabledButtonClasses : ''}`}> {PreviousIcon} <span>Prev Step</span> </button>
        <button onClick={nextStep} disabled={isNextStepDisabled} className={`${secondaryButtonClasses} ${isNextStepDisabled ? disabledButtonClasses : ''}`}> {NextIcon} <span>Next Step</span> </button>
        <button onClick={handleRunStep} disabled={isRunStepDisabled} className={`${secondaryButtonClasses} ${isRunStepDisabled ? disabledButtonClasses : ''}`}> {RetryIcon} <span>Run Step</span> </button>
        <button onClick={openHilModalWithContext} disabled={isHilModalDisabled} className={`${secondaryButtonClasses} ${isHilModalDisabled ? disabledButtonClasses : ''}`} title="Provide guidance to correct and re-run current step."> {LightbulbIcon} <span>Guidance</span> </button>
        <button onClick={() => downloadOutput()} disabled={isDownloadOutputDisabled} className={`${secondaryButtonClasses} ${isDownloadOutputDisabled ? disabledButtonClasses : ''}`}> {DownloadIcon} <span>DL Output</span> </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="relative lg:col-span-1">
              <button id="dl-history-button" disabled={isDownloadHistoryDisabled} className={`${secondaryButtonClasses} w-full ${isDownloadHistoryDisabled ? disabledButtonClasses : ''}`} onClick={() => {const el = document.getElementById('history-dropdown'); if(el) el.classList.toggle('hidden');}}> {DownloadIcon} <span>DL History</span> {ChevronDownIcon} </button>
              <div id="history-dropdown" className="absolute z-10 mt-1 w-full bg-light-bg-alt dark:bg-dark-bg-alt border border-light-border dark:border-dark-border rounded-md shadow-lg hidden">
                  <a href="#" onClick={(e)=>{e.preventDefault(); downloadHistory('json');const el = document.getElementById('history-dropdown'); if(el) el.classList.add('hidden');}} className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border">As JSON</a>
                  <a href="#" onClick={(e)=>{e.preventDefault(); downloadHistory('tsv');const el = document.getElementById('history-dropdown'); if(el) el.classList.add('hidden');}} className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border">As TSV</a>
              </div>
          </div>
          <div className="relative lg:col-span-1">
              <button id="dl-appendix-button" disabled={!isAppendixDataAvailable} className={`${secondaryButtonClasses} w-full ${!isAppendixDataAvailable ? disabledButtonClasses : ''}`} onClick={() => {const el = document.getElementById('appendix-dropdown'); if(el) el.classList.toggle('hidden');}} title="Generates a detailed appendix file."> {AppendixIcon} <span>DL Appendix</span> {ChevronDownIcon} </button>
              <div id="appendix-dropdown" className="absolute z-10 mt-1 w-full bg-light-bg-alt dark:bg-dark-bg-alt border border-light-border dark:border-dark-border rounded-md shadow-lg hidden">
                  <a href="#" onClick={(e)=>{e.preventDefault(); generateAppendix('markdown');const el = document.getElementById('appendix-dropdown'); if(el) el.classList.add('hidden');}} className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border">As Markdown (.md)</a>
                  <a href="#" onClick={(e)=>{e.preventDefault(); generateAppendix('html');const el = document.getElementById('appendix-dropdown'); if(el) el.classList.add('hidden');}} className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border">As HTML (.html)</a>
              </div>
          </div>
          <div className="lg:col-span-1">
              <button 
                onClick={openIrrModal} 
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
                      type="number"
                      value={retrySeedInput}
                      onChange={(e) => onRetrySeedInputChange(e.target.value)}
                      placeholder="Enter new seed"
                      className={inputBaseClasses}
                  />
                  <button
                      onClick={onRetryWithUserSeed}
                      className={primaryButtonClasses}
                  >
                      Retry
                  </button>
              </div>
          </div>
      )}
    </>
  );
};
export default ControlsPanel;
