
import React from 'react';
import { StepId, StepStatus } from '../types';
import { PlayIcon, PauseIcon, NextIcon, PreviousIcon, RetryIcon, LightbulbIcon, DownloadIcon, AppendixIcon, ChevronDownIcon } from '../constants';
import { useUIStore } from '../src/stores/uiStore';
import { usePipelineStore } from '../src/stores/pipelineStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useIRRStore } from '../src/stores/irrStore';
import { Button, Input } from '../src/components/ui';

// IRR (Inter-Rater Reliability) icon
const IrrIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
    <path d="M2.5 8a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 3.5 8h-1ZM6.5 8a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1A1.5 1.5 0 0 0 9 10.5v-1A1.5 1.5 0 0 0 7.5 8h-1ZM10.5 8a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 11.5 8h-1Z" />
    <path d="M2.5 4a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 3.5 4h-1ZM6.5 4a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1A1.5 1.5 0 0 0 9 6.5v-1A1.5 1.5 0 0 0 7.5 4h-1ZM10.5 4a1.5 1.5 0 0 0-1.5 1.5v1a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5v-1A1.5 1.5 0 0 0 11.5 4h-1Z" />
  </svg>
);

const ControlsPanel: React.FC = () => {
  // UI Store
  const isAutorunning = useUIStore(state => state.isAutorunning);
  const toggleAutorun = useUIStore(state => state.toggleAutorun);
  const currentStepInfo = useUIStore(state => state.currentStepInfo);
  const activeTranscriptIndex = useUIStore(state => state.activeTranscriptIndex);
  const retrySeedInput = useUIStore(state => state.retrySeedInput);
  const setRetrySeedInput = useUIStore(state => state.setRetrySeedInput);
  
  // Settings Store
  const apiKeyPresent = useSettingsStore(state => state.apiKeyPresent);
  const dvFocusError = useSettingsStore(state => state.dvFocusError);
  
  // Pipeline Store
  const rawTranscripts = usePipelineStore(state => state.rawTranscripts);
  
  // Use selector from UI store for autorun disabled state
  const selectIsAutorunDisabled = useUIStore(state => state.selectIsAutorunDisabled);
  const isAutorunDisabled = selectIsAutorunDisabled(apiKeyPresent, dvFocusError, rawTranscripts.length);
  const previousStep = useUIStore(state => state.previousStep);
  const nextStep = useUIStore(state => state.nextStep);
  const openHilModalWithContext = useUIStore(state => state.openHilModalWithContext);

  // Pipeline Store
  const isPreviousStepDisabled = usePipelineStore(state => state.isPreviousStepDisabled(currentStepInfo, activeTranscriptIndex));
  const isNextStepDisabled = usePipelineStore(state => state.isNextStepDisabled(currentStepInfo, activeTranscriptIndex));
  const isRunStepDisabled = usePipelineStore(state => state.isRunStepDisabled(currentStepInfo, apiKeyPresent, dvFocusError));
  const isHilModalDisabled = usePipelineStore(state => state.isHilModalDisabled(currentStepInfo));
  const isDownloadOutputDisabled = usePipelineStore(state => state.isDownloadOutputDisabled(currentStepInfo));
  const isDownloadHistoryDisabled = usePipelineStore(state => state.isDownloadHistoryDisabled());
  const isAppendixDataAvailable = usePipelineStore(state => state.isAppendixDataAvailable());
  const processSingleStep = usePipelineStore(state => state.processSingleStep);
  const downloadOutput = usePipelineStore(state => state.downloadOutput);
  const downloadHistory = usePipelineStore(state => state.downloadHistory);
  const generateAppendix = usePipelineStore(state => state.generateAppendix);
  const retryWithUserSeed = usePipelineStore(state => state.retryWithUserSeed);

  // IRR Store
  const openIrrModal = useIRRStore(state => state.openIrrModal);

  // Handler for running current step
  const handleRunStep = () => {
    const currentStepInfo = useUIStore.getState().currentStepInfo;
    processSingleStep({ stepId: currentStepInfo.stepId });
  };

  // Determine if retry UI should be shown
  // Use selector from UI store for retry UI visibility
  const selectShowRetryUI = useUIStore(state => state.selectShowRetryUI);
  const showRetryWithNewSeedUI = selectShowRetryUI();

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        <Button onClick={toggleAutorun} disabled={isAutorunDisabled} variant="primary">
            {isAutorunning ? PauseIcon : PlayIcon} <span>{isAutorunning ? 'Pause' : 'Autorun'}</span>
        </Button>
        <Button onClick={previousStep} disabled={isPreviousStepDisabled} variant="secondary">
          {PreviousIcon} <span>Prev Step</span>
        </Button>
        <Button onClick={nextStep} disabled={isNextStepDisabled} variant="secondary">
          {NextIcon} <span>Next Step</span>
        </Button>
        <Button onClick={handleRunStep} disabled={isRunStepDisabled} variant="secondary">
          {RetryIcon} <span>Run Step</span>
        </Button>
        <Button onClick={openHilModalWithContext} disabled={isHilModalDisabled} variant="secondary" title="Provide guidance to correct and re-run current step.">
          {LightbulbIcon} <span>Guidance</span>
        </Button>
        <Button onClick={() => downloadOutput()} disabled={isDownloadOutputDisabled} variant="secondary">
          {DownloadIcon} <span>DL Output</span>
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          <div className="relative lg:col-span-1">
              <Button id="dl-history-button" disabled={isDownloadHistoryDisabled} className="w-full" variant="secondary" onClick={() => {const el = document.getElementById('history-dropdown'); if(el) el.classList.toggle('hidden');}}>
                {DownloadIcon} <span>DL History</span> {ChevronDownIcon}
              </Button>
              <div id="history-dropdown" className="absolute z-10 mt-1 w-full bg-light-bg-alt dark:bg-dark-bg-alt border border-light-border dark:border-dark-border rounded-md shadow-lg hidden">
                  <a href="#" onClick={(e)=>{e.preventDefault(); downloadHistory('json');const el = document.getElementById('history-dropdown'); if(el) el.classList.add('hidden');}} className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border">As JSON</a>
                  <a href="#" onClick={(e)=>{e.preventDefault(); downloadHistory('tsv');const el = document.getElementById('history-dropdown'); if(el) el.classList.add('hidden');}} className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border">As TSV</a>
              </div>
          </div>
          <div className="relative lg:col-span-1">
              <Button id="dl-appendix-button" disabled={!isAppendixDataAvailable} className="w-full" variant="secondary" onClick={() => {const el = document.getElementById('appendix-dropdown'); if(el) el.classList.toggle('hidden');}} title="Generates a detailed appendix file.">
                {AppendixIcon} <span>DL Appendix</span> {ChevronDownIcon}
              </Button>
              <div id="appendix-dropdown" className="absolute z-10 mt-1 w-full bg-light-bg-alt dark:bg-dark-bg-alt border border-light-border dark:border-dark-border rounded-md shadow-lg hidden">
                  <a href="#" onClick={(e)=>{e.preventDefault(); generateAppendix('markdown');const el = document.getElementById('appendix-dropdown'); if(el) el.classList.add('hidden');}} className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border">As Markdown (.md)</a>
                  <a href="#" onClick={(e)=>{e.preventDefault(); generateAppendix('html');const el = document.getElementById('appendix-dropdown'); if(el) el.classList.add('hidden');}} className="block px-4 py-2 text-sm text-light-text dark:text-dark-text hover:bg-light-border dark:hover:bg-dark-border">As HTML (.html)</a>
              </div>
          </div>
          <div className="lg:col-span-1">
              <Button 
                onClick={openIrrModal} 
                disabled={false} 
                className="w-full" 
                variant="secondary"
                title="Compare two independent analysis runs for inter-rater reliability"
              > 
                {IrrIcon} <span>Compare Runs (IRR)</span> 
              </Button>
          </div>
      </div>
      {showRetryWithNewSeedUI && (
          <div className="p-3 border border-yellow-400 dark:border-yellow-600 bg-yellow-50 dark:bg-yellow-900 rounded-md space-y-2">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">JSON parsing failed. Try with a different seed for this step:</p>
              <div className="flex items-center space-x-2">
                  <Input
                      type="number"
                      value={retrySeedInput}
                      onChange={(e) => setRetrySeedInput(e.target.value)}
                      placeholder="Enter new seed"
                  />
                  <Button
                      onClick={retryWithUserSeed}
                      variant="primary"
                  >
                      Retry
                  </Button>
              </div>
          </div>
      )}
    </>
  );
};
export default ControlsPanel;
