import React, { useEffect } from 'react';
import { RawTranscript, StepId, CurrentStepInfo } from '../types';
import { UploadIcon, FileTextIcon, SaveIcon, LoadIcon, InfoIcon } from '../constants';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useUIStore } from '../src/stores/uiStore';
import { usePipelineStore } from '../src/stores/pipelineStore';

interface SettingsPanelProps {
  onSaveState: () => void;
  onLoadStateFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  loadStateInputRef: React.RefObject<HTMLInputElement>;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  fileUploadInputRef: React.RefObject<HTMLInputElement>;
  onDragOver: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (event: React.DragEvent<HTMLDivElement>) => void;
  isGlobalStep: (stepId: StepId) => boolean;
  onTranscriptItemClick: (index: number) => void;
  getTranscriptStatusDisplay: (transcriptId: string) => string;
  PipelineOverviewComponent: React.ReactNode;
  inputBaseClasses: string;
  secondaryButtonClasses: string;
  disabledButtonClasses: string;
}

const SettingsPanelZustand: React.FC<SettingsPanelProps> = ({
  onSaveState, onLoadStateFileChange, loadStateInputRef,
  onFileUpload, fileUploadInputRef, onDragOver, onDragLeave, onDrop,
  isGlobalStep, onTranscriptItemClick, getTranscriptStatusDisplay,
  PipelineOverviewComponent, inputBaseClasses, secondaryButtonClasses, disabledButtonClasses
}) => {
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

  // UI store
  const currentStepInfo = useUIStore(state => state.currentStepInfo)
  const activeTranscriptIndex = useUIStore(state => state.activeTranscriptIndex)
  const isDraggingOver = useUIStore(state => state.isDraggingOver)

  // Pipeline store
  const rawTranscripts = usePipelineStore(state => state.rawTranscripts)

  // Check API key on mount
  useEffect(() => {
    checkApiKey()
  }, [checkApiKey])

  // Initialize DV focus on mount
  useEffect(() => {
    validateAndSetDvFocus(dvFocusInput)
  }, []) // Only run once on mount

  // Initialize seed on mount
  useEffect(() => {
    validateAndSetSeed(seedInput)
  }, []) // Only run once on mount

  return (
    <div className="space-y-4">
      {/* API Key Check */}
      <div className={`rounded-lg p-4 ${apiKeyPresent 
        ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
        : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'}`}>
        <p className="font-medium">
          {apiKeyPresent ? '✓ Gemini API Key is set' : '⚠ Gemini API Key not found'}
        </p>
        {!apiKeyPresent && (
          <p className="text-sm mt-1">
            Please set <code className="font-mono bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded">REACT_APP_API_KEY</code> in your .env file
          </p>
        )}
      </div>

      {/* DV Focus */}
      <div>
        <label className="block text-sm font-medium mb-1">
          DV Focus
        </label>
        <input
          type="text"
          value={dvFocusInput}
          onChange={(e) => validateAndSetDvFocus(e.target.value)}
          className={`${inputBaseClasses} ${dvFocusError ? 'border-red-500' : ''}`}
          placeholder="cognitions, emotions, sensations"
        />
        {dvFocusError && (
          <p className="text-red-500 text-sm mt-1">{dvFocusError}</p>
        )}
      </div>

      {/* Temperature */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Temperature: {temperature.toFixed(1)}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>

      {/* Seed */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Seed (optional)
        </label>
        <input
          type="text"
          value={seedInput}
          onChange={(e) => validateAndSetSeed(e.target.value)}
          className={inputBaseClasses}
          placeholder="42"
        />
      </div>

      {/* Output Directory */}
      <div>
        <label className="block text-sm font-medium mb-1">
          Output Directory
        </label>
        <input
          type="text"
          value={outputDirectory}
          onChange={(e) => setOutputDirectory(e.target.value)}
          className={inputBaseClasses}
        />
      </div>

      {/* Auto Download */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="autoDownload"
          checked={autoDownloadResults}
          onChange={(e) => updateSettings({ autoDownloadResults: e.target.checked })}
          className="mr-2"
        />
        <label htmlFor="autoDownload" className="text-sm">
          Auto-download results
        </label>
      </div>

      {/* Transcript Upload */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
          ${isDraggingOver 
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileUploadInputRef.current?.click()}
      >
        <UploadIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          {isDraggingOver ? 'Drop files here' : 'Drag & drop transcript files here'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          or click to browse
        </p>
        <input
          ref={fileUploadInputRef}
          type="file"
          multiple
          accept=".txt"
          onChange={onFileUpload}
          className="hidden"
        />
      </div>

      {/* Transcript List */}
      {rawTranscripts.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Uploaded Transcripts</h3>
          <div className="space-y-1">
            {rawTranscripts.map((transcript, index) => (
              <div
                key={transcript.id}
                onClick={() => onTranscriptItemClick(index)}
                className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors
                  ${activeTranscriptIndex === index && !isGlobalStep(currentStepInfo.stepId)
                    ? 'bg-blue-100 dark:bg-blue-900' 
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                <div className="flex items-center">
                  <FileTextIcon className="w-4 h-4 mr-2 text-gray-500" />
                  <span className="text-sm">{transcript.metadata.fileName}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {getTranscriptStatusDisplay(transcript.id)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Save/Load State */}
      <div className="space-y-2">
        <button
          onClick={onSaveState}
          className={secondaryButtonClasses}
        >
          <SaveIcon className="w-4 h-4 mr-2" />
          Save State
        </button>
        <button
          onClick={() => loadStateInputRef.current?.click()}
          className={secondaryButtonClasses}
        >
          <LoadIcon className="w-4 h-4 mr-2" />
          Load State
        </button>
        <input
          ref={loadStateInputRef}
          type="file"
          accept=".json"
          onChange={onLoadStateFileChange}
          className="hidden"
        />
      </div>

      {/* Pipeline Overview */}
      {PipelineOverviewComponent}
    </div>
  );
};

export default SettingsPanelZustand;