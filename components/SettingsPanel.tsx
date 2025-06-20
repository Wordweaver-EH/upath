
import React from 'react';
import { RawTranscript, StepId, CurrentStepInfo, StepStatus } from '../types'; // Added StepStatus
import { UploadIcon, FileTextIcon, SaveIcon, LoadIcon, InfoIcon } from '../constants';
import CollapsibleSection from './CollapsibleSection'; // Assuming it's in the same directory

interface SettingsPanelProps {
  apiKeyPresent: boolean;
  dvFocusInput: string;
  onDvFocusInputChange: (value: string) => void;
  dvFocusError: string;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  seedInput: string;
  onSeedInputChange: (value: string) => void;
  outputDirectory: string;
  onOutputDirectoryChange: (value: string) => void;
  autoDownloadResults: boolean;
  onAutoDownloadResultsChange: (checked: boolean) => void;
  onSaveState: () => void;
  onLoadStateFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  loadStateInputRef: React.RefObject<HTMLInputElement>;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileUploadInputRef: React.RefObject<HTMLInputElement>;
  isDraggingOver: boolean;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  rawTranscripts: RawTranscript[];
  activeTranscriptIndex: number;
  isGlobalStep: (stepId: StepId) => boolean;
  currentStepInfo: CurrentStepInfo;
  onTranscriptItemClick: (index: number) => void;
  getTranscriptStatusDisplay: (transcriptId: string) => string;
  PipelineOverviewComponent: React.ReactNode; // To inject PipelineOverview
  inputBaseClasses: string;
  secondaryButtonClasses: string;
  disabledButtonClasses: string;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
  apiKeyPresent, dvFocusInput, onDvFocusInputChange, dvFocusError,
  temperature, onTemperatureChange, seedInput, onSeedInputChange,
  outputDirectory, onOutputDirectoryChange, autoDownloadResults, onAutoDownloadResultsChange,
  onSaveState, onLoadStateFileChange, loadStateInputRef,
  onFileUpload, fileUploadInputRef, isDraggingOver, onDragOver, onDragLeave, onDrop,
  rawTranscripts, activeTranscriptIndex, isGlobalStep, currentStepInfo,
  onTranscriptItemClick, getTranscriptStatusDisplay, PipelineOverviewComponent,
  inputBaseClasses, secondaryButtonClasses, disabledButtonClasses
}) => {
  return (
    <aside className="md:col-span-1 space-y-4 p-4 bg-light-bg-alt dark:bg-dark-bg-alt rounded-lg shadow overflow-y-auto max-h-[calc(100vh-140px)]">
      {PipelineOverviewComponent}
      {!apiKeyPresent && ( <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded-md dark:bg-red-900 dark:border-red-700 dark:text-red-300" role="alert"> <p className="font-semibold">API Key Missing!</p> <p className="text-sm">process.env.API_KEY is not set. Please configure it to enable analysis.</p> </div> )}
      <div> <label htmlFor="dvFocus" className="block text-sm font-medium text-light-sidenote dark:text-dark-sidenote mb-1"> Dependent Variable Focuses </label> <div className="relative"> <input type="text" id="dvFocus" value={dvFocusInput} onChange={(e) => onDvFocusInputChange(e.target.value)} placeholder="e.g., cognitions, emotions" className={`${inputBaseClasses} ${dvFocusError ? 'border-red-500 dark:border-red-400' : 'border-light-border dark:border-dark-border'}`} aria-invalid={!!dvFocusError} aria-describedby={dvFocusError ? "dvFocusError" : undefined} /> <div className="absolute inset-y-0 right-0 pr-3 flex items-center"> <span className="text-light-sidenote dark:text-dark-sidenote cursor-pointer group" title="Enter comma-separated values. Example: cognitions, emotions, sensations"> {InfoIcon} </span> </div> </div> {dvFocusError && <p id="dvFocusError" className="mt-1 text-xs text-red-600 dark:text-red-400">{dvFocusError}</p>} </div>
      <div className="grid grid-cols-2 gap-4"> <div> <label htmlFor="temperature" className="block text-sm font-medium text-light-sidenote dark:text-dark-sidenote mb-1">Temperature</label> <div className="relative"> <input type="number" id="temperature" value={temperature} onChange={(e) => onTemperatureChange(parseFloat(e.target.value))} min="0" max="2" step="0.1" className={`${inputBaseClasses} border-light-border dark:border-dark-border`} /> <div className="absolute inset-y-0 right-0 pr-3 flex items-center"> <span className="text-light-sidenote dark:text-dark-sidenote cursor-pointer group" title="Controls randomness. 0.0 for deterministic. Default: 0.0">{InfoIcon}</span> </div> </div> </div> <div> <label htmlFor="seed" className="block text-sm font-medium text-light-sidenote dark:text-dark-sidenote mb-1">Global Seed</label> <div className="relative"> <input type="text" id="seed" value={seedInput} onChange={(e) => onSeedInputChange(e.target.value)} placeholder="Optional integer" className={`${inputBaseClasses} border-light-border dark:border-dark-border`} /> <div className="absolute inset-y-0 right-0 pr-3 flex items-center"> <span className="text-light-sidenote dark:text-dark-sidenote cursor-pointer group" title="Optional positive integer for reproducibility. Default: 42">{InfoIcon}</span> </div> </div> </div> </div>
      <div> <label htmlFor="outputDir" className="block text-sm font-medium text-light-sidenote dark:text-dark-sidenote mb-1">Output Directory Name</label> <input type="text" id="outputDir" value={outputDirectory} onChange={(e) => onOutputDirectoryChange(e.target.value)} className={`${inputBaseClasses} border-light-border dark:border-dark-border`} placeholder="e.g., MyProject_Outputs" /> <p className="mt-1 text-xs text-light-sidenote dark:text-dark-sidenote">Prefixes filenames. Browser handles save location.</p> </div>
      <div className="flex items-center"> <input id="autoDownload" type="checkbox" checked={autoDownloadResults} onChange={(e) => onAutoDownloadResultsChange(e.target.checked)} className="h-4 w-4 rounded border-light-border dark:border-dark-border text-light-accent dark:text-dark-accent focus:ring-light-accent dark:focus:ring-dark-accent bg-light-input-bg dark:bg-dark-input-bg" /> <label htmlFor="autoDownload" className="ml-2 block text-sm text-light-text dark:text-dark-text">Autodownload essential results</label> </div>
      <div className="grid grid-cols-2 gap-2">
          <button onClick={onSaveState} disabled={rawTranscripts.length === 0 && currentStepInfo.stepId === StepId.IDLE} className={`${secondaryButtonClasses} w-full ${ (rawTranscripts.length === 0 && currentStepInfo.stepId === StepId.IDLE) ? disabledButtonClasses : ''}`}> {SaveIcon} <span>Save State</span> </button>
          <div> <label htmlFor="loadStateFile" className={`${secondaryButtonClasses} w-full cursor-pointer`}> {LoadIcon} <span>Load State</span> </label> <input id="loadStateFile" type="file" accept=".json" onChange={onLoadStateFileChange} className="hidden" ref={loadStateInputRef} /> </div>
      </div>
       <div
          onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
          className={`px-1 py-[1px] border-2 border-dashed rounded-md text-center ${isDraggingOver ? 'border-light-accent dark:border-dark-accent bg-light-accent/10 dark:bg-dark-accent/10' : 'border-light-border dark:border-dark-border hover:border-light-accent/50 dark:hover:border-dark-accent/50'} ${(!apiKeyPresent || !!dvFocusError) ? disabledButtonClasses : 'cursor-pointer'} transition-colors duration-150`}
          role="button" aria-label="File upload area"
      >
          <label htmlFor="fileUpload" className={`w-full flex flex-col items-center justify-center space-y-0 ${(!apiKeyPresent || !!dvFocusError) ? 'cursor-not-allowed' : 'cursor-pointer'}`}> {UploadIcon} <span className="text-sm">{isDraggingOver ? 'Drop files here' : 'Upload or Drag & Drop .txt Files'}</span> </label>
          <input id="fileUpload" type="file" multiple accept=".txt" onChange={onFileUpload} className="hidden" disabled={!apiKeyPresent || !!dvFocusError} ref={fileUploadInputRef} />
      </div>
      {rawTranscripts.length > 0 && (
        <div className="mt-4">
          <h3 className="text-md font-semibold mb-2 text-light-text dark:text-dark-text">Uploaded Transcripts:</h3>
          <ul className="space-y-2 max-h-60 overflow-y-auto border border-light-border dark:border-dark-border rounded-md p-2 bg-light-bg dark:bg-dark-bg">
            {rawTranscripts.map((transcript, index) => (
              <li 
                  key={transcript.id} 
                  className={`p-2 rounded-md text-sm flex items-center justify-between transition-colors duration-150 ${activeTranscriptIndex === index && !isGlobalStep(currentStepInfo.stepId) ? 'bg-light-accent text-white dark:bg-dark-accent dark:text-dark-bg shadow-md ring-2 ring-light-accent dark:ring-dark-accent ring-opacity-75' : 'hover:bg-light-border dark:hover:bg-dark-border'} ${currentStepInfo.status === StepStatus.Loading && currentStepInfo.transcriptId === transcript.id ? 'ephemeral-border' : ''}`}
                  onClick={() => onTranscriptItemClick(index)} role="button" tabIndex={0} onKeyPress={(e) => e.key === 'Enter' && onTranscriptItemClick(index)} aria-current={activeTranscriptIndex === index && !isGlobalStep(currentStepInfo.stepId)}
              >
                <span className="flex items-center space-x-2 truncate"> {FileTextIcon} <span className="truncate" title={transcript.filename}>{transcript.filename}</span> </span>
                <span className={`text-xs px-2 py-0.5 rounded-full ${getTranscriptStatusDisplay(transcript.id).includes("Done") ? 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-100'} whitespace-nowrap`}> {getTranscriptStatusDisplay(transcript.id)} </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
};
export default SettingsPanel;