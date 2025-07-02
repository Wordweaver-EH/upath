
import React, { useEffect, useRef } from 'react';
import { StepId, StepStatus } from '../types';
import { UploadIcon, FileTextIcon, SaveIcon, LoadIcon, InfoIcon } from '../constants';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useUIStore } from '../src/stores/uiStore';
import { usePipelineStore } from '../src/stores/pipelineStore';
import { Button, Input } from '../src/components/ui';

// No props needed - component gets all data from stores
interface SettingsPanelProps {
  PipelineOverviewComponent: React.ReactNode;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  PipelineOverviewComponent
}) => {
  // Create refs for file inputs
  const loadStateInputRef = useRef<HTMLInputElement>(null)
  const fileUploadInputRef = useRef<HTMLInputElement>(null)
  // Settings store
  const apiKeyPresent = useSettingsStore(state => state.apiKeyPresent)
  const dvFocusInput = useSettingsStore(state => state.dvFocusInput)
  const dvFocusError = useSettingsStore(state => state.dvFocusError)
  const temperature = useSettingsStore(state => state.temperature)
  const seedInput = useSettingsStore(state => state.seedInput)
  const outputDirectory = useSettingsStore(state => state.outputDirectory)
  const autoDownloadResults = useSettingsStore(state => state.autoDownloadResults)
  
  const validateAndSetDvFocus = useSettingsStore(state => state.validateAndSetDvFocus)
  const validateAndSetSeed = useSettingsStore(state => state.validateAndSetSeed)
  const setTemperature = useSettingsStore(state => state.setTemperature)
  const setOutputDirectory = useSettingsStore(state => state.setOutputDirectory)
  const updateSettings = useSettingsStore(state => state.updateSettings)
  const checkApiKey = useSettingsStore(state => state.checkApiKey)

  // UI store - state and actions
  const currentStepInfo = useUIStore(state => state.currentStepInfo)
  const activeTranscriptIndex = useUIStore(state => state.activeTranscriptIndex)
  const isDraggingOver = useUIStore(state => state.isDraggingOver)
  const handleDragOver = useUIStore(state => state.handleDragOver)
  const handleDragLeave = useUIStore(state => state.handleDragLeave)
  const handleDrop = useUIStore(state => state.handleDrop)
  const setActiveTranscript = useUIStore(state => state.setActiveTranscript)

  // Pipeline store - state and actions
  const rawTranscripts = usePipelineStore(state => state.rawTranscripts)
  const saveStateToFile = usePipelineStore(state => state.saveStateToFile)
  const loadStateFromFile = usePipelineStore(state => state.loadStateFromFile)
  const uploadTranscripts = usePipelineStore(state => state.uploadTranscripts)
  const getTranscriptStatusDisplay = usePipelineStore(state => state.getTranscriptStatusDisplay)
  const isGlobalStep = usePipelineStore(state => state.isGlobalStep)

  // Check API key on component mount
  useEffect(() => {
    checkApiKey()
  }, [checkApiKey])

  return (
    <aside className="md:col-span-1 space-y-4 p-4 bg-light-bg-alt dark:bg-dark-bg-alt rounded-lg shadow overflow-y-auto max-h-[calc(100vh-140px)]">
      {PipelineOverviewComponent}
      {!apiKeyPresent && ( <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md dark:bg-red-900 dark:border-red-700 dark:text-red-300" role="alert"> <p className="font-semibold">API Key Missing!</p> <p className="text-sm">process.env.API_KEY is not set. Please configure it to enable analysis.</p> </div> )}
      <div>
        <div className="relative">
          <Input
            type="text"
            id="dvFocus"
            label="Dependent Variable Focuses"
            value={dvFocusInput}
            onChange={(e) => validateAndSetDvFocus(e.target.value)}
            placeholder="e.g., cognitions, emotions"
            error={dvFocusError}
            aria-invalid={!!dvFocusError}
            aria-describedby={dvFocusError ? "dvFocusError" : undefined}
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center top-7">
            <span className="text-light-sidenote dark:text-dark-sidenote cursor-pointer group" title="Enter comma-separated values. Example: cognitions, emotions, sensations">
              {InfoIcon}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="relative">
            <Input
              type="number"
              id="temperature"
              label="Temperature"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              min="0"
              max="2"
              step="0.1"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center top-7">
              <span className="text-light-sidenote dark:text-dark-sidenote cursor-pointer group" title="Controls randomness. 0.0 for deterministic. Default: 0.0">{InfoIcon}</span>
            </div>
          </div>
        </div>
        <div>
          <div className="relative">
            <Input
              type="text"
              id="seed"
              label="Global Seed"
              value={seedInput}
              onChange={(e) => validateAndSetSeed(e.target.value)}
              placeholder="Optional integer"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center top-7">
              <span className="text-light-sidenote dark:text-dark-sidenote cursor-pointer group" title="Optional positive integer for reproducibility. Default: 42">{InfoIcon}</span>
            </div>
          </div>
        </div>
      </div>
      <div>
        <Input
          type="text"
          id="outputDir"
          label="Output Directory Name"
          value={outputDirectory}
          onChange={(e) => setOutputDirectory(e.target.value)}
          placeholder="e.g., MyProject_Outputs"
          helperText="Prefixes filenames. Browser handles save location."
        />
      </div>
      <div className="flex items-center"> <input id="autoDownload" type="checkbox" checked={autoDownloadResults} onChange={(e) => updateSettings({ autoDownloadResults: e.target.checked })} className="h-4 w-4 rounded border-light-border dark:border-dark-border text-light-accent dark:text-dark-accent focus:ring-light-accent dark:focus:ring-dark-accent bg-light-input-bg dark:bg-dark-input-bg" /> <label htmlFor="autoDownload" className="ml-2 block text-sm text-light-text dark:text-dark-text">Autodownload essential results</label> </div>
      <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={() => saveStateToFile(activeTranscriptIndex, currentStepInfo)}
            disabled={rawTranscripts.length === 0 && currentStepInfo.stepId === StepId.IDLE}
            variant="secondary"
            className="w-full"
          >
            {SaveIcon} <span>Save State</span>
          </Button>
          <div>
            <label htmlFor="loadStateFile">
              <Button as="span" variant="secondary" className="w-full cursor-pointer">
                {LoadIcon} <span>Load State</span>
              </Button>
            </label>
            <input id="loadStateFile" type="file" accept=".json" onChange={loadStateFromFile} className="hidden" ref={loadStateInputRef} />
          </div>
      </div>
       <div
          onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          className={`px-1 py-[1px] border-2 border-dashed rounded-md text-center ${isDraggingOver ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/10' : 'border-light-border dark:border-dark-border hover:border-light-accent/50 dark:hover:border-dark-accent/50'} ${(!apiKeyPresent || !!dvFocusError) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} transition-colors duration-150`}
          role="button" aria-label="File upload area"
      >
          <label htmlFor="fileUpload" className={`w-full flex flex-col items-center justify-center space-y-0 ${(!apiKeyPresent || !!dvFocusError) ? 'cursor-not-allowed' : 'cursor-pointer'}`}> {UploadIcon} <span className="text-sm">{isDraggingOver ? 'Drop files here' : 'Upload or Drag & Drop .txt Files'}</span> </label>
          <input id="fileUpload" type="file" multiple accept=".txt" onChange={uploadTranscripts} className="hidden" disabled={!apiKeyPresent || !!dvFocusError} ref={fileUploadInputRef} />
      </div>
      {rawTranscripts.length > 0 && (
        <div className="mt-4">
          <h3 className="text-md font-semibold mb-2 text-light-text dark:text-dark-text">Uploaded Transcripts:</h3>
          <ul className="space-y-2 max-h-60 overflow-y-auto border border-light-border dark:border-dark-border rounded-md p-2 bg-light-bg dark:bg-dark-bg">
            {rawTranscripts.map((transcript, index) => (
              <li 
                  key={transcript.id} 
                  className={`p-2 rounded-md text-sm flex items-center justify-between transition-colors duration-150 ${activeTranscriptIndex === index && !isGlobalStep(currentStepInfo.stepId) ? 'border-b-2 border-light-accent dark:border-dark-accent text-light-accent dark:text-dark-accent' : 'border-b-2 border-transparent hover:bg-light-border dark:hover:bg-dark-border'} ${currentStepInfo.status === StepStatus.Loading && currentStepInfo.transcriptId === transcript.id ? 'ephemeral-border' : ''}`}
                  onClick={() => setActiveTranscript(index)} role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && setActiveTranscript(index)} aria-current={activeTranscriptIndex === index && !isGlobalStep(currentStepInfo.stepId)}
              >
                <span className="flex items-center space-x-2 truncate"> {FileTextIcon} <span className="truncate" title={transcript.filename}>{transcript.filename}</span> </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getTranscriptStatusDisplay(transcript.id).includes("Done") ? 'bg-light-accent-subtle/20 text-light-accent-subtle dark:bg-dark-accent-subtle/20 dark:text-dark-accent-subtle' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'} whitespace-nowrap`}> {getTranscriptStatusDisplay(transcript.id)} </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};
export default SettingsPanel;