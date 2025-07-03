import React, { useRef } from 'react';
import { AppState } from '../types';
import { useIRRStore } from '../src/stores/irrStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { Button, Input } from '../src/components/ui';

interface IRRModalProps {
  onDownloadDisagreementReport?: () => void;
}

const IRRModal: React.FC<IRRModalProps> = ({
  onDownloadDisagreementReport
}) => {
  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);
  
  // Get state and actions from store
  const irrWorkflowState = useIRRStore(state => state.irrWorkflowState);
  const closeIrrModal = useIRRStore(state => state.closeIrrModal);
  const startComparison = useIRRStore(state => state.startComparison);
  const setRunA = useIRRStore(state => state.setRunA);
  const setRunB = useIRRStore(state => state.setRunB);
  const setErrorMessage = useIRRStore(state => state.setErrorMessage);
  const setLoadingState = useIRRStore(state => state.setLoadingState);
  const generateSemanticMapping = useIRRStore(state => state.generateSemanticMapping);
  
  // Settings for API calls
  const temperature = useSettingsStore(state => state.temperature);
  const seed = useSettingsStore(state => state.seed);
  const apiKeyPresent = useSettingsStore(state => state.apiKeyPresent);
  
  const isIrrModalOpen = irrWorkflowState.isIrrModalOpen;

  if (!isIrrModalOpen) return null;

  const handleFileLoad = (file: File, run: 'A' | 'B') => {
    setLoadingState('loading-files');
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedState: AppState = JSON.parse(content);
        
        // Validate that it's a valid µ-PATH state with P3.2 output
        if (!parsedState.genericAnalysisState?.p3_2_output) {
          throw new Error('Invalid state file: No P3.2 GDU analysis found');
        }

        if (run === 'A') {
          setRunA(parsedState);
          setLoadingState('idle');
        } else {
          setRunB(parsedState);
          setLoadingState('idle');
        }
      } catch (error) {
        setErrorMessage(`Failed to load Run ${run}: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
      }
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>, run: 'A' | 'B') => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileLoad(file, run);
    }
  };

  const canStartComparison = () => {
    return irrWorkflowState.runA && 
           irrWorkflowState.runB && 
           irrWorkflowState.loadingState === 'idle' &&
           irrWorkflowState.runA.genericAnalysisState.p3_2_output &&
           irrWorkflowState.runB.genericAnalysisState.p3_2_output;
  };

  const getLoadingMessage = () => {
    switch (irrWorkflowState.loadingState) {
      case 'loading-files':
        return 'Loading state files...';
      case 'calling-llm':
        return 'Analyzing GDU differences with LLM...';
      case 'calculating':
        return 'Calculating Krippendorff\'s Alpha...';
      default:
        return '';
    }
  };

  const renderFileInput = (run: 'A' | 'B', ref: React.RefObject<HTMLInputElement>) => {
    const isLoaded = run === 'A' ? !!irrWorkflowState.runA : !!irrWorkflowState.runB;
    const state = run === 'A' ? irrWorkflowState.runA : irrWorkflowState.runB;
    
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2 text-light-text dark:text-dark-text">
          Load Run {run} State
        </label>
        <div className="flex items-center space-x-2">
          <input
            ref={ref}
            type="file"
            accept=".json"
            onChange={(e) => handleFileInputChange(e, run)}
            className="block w-full text-sm text-light-sidenote dark:text-dark-sidenote file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-light-accent/10 dark:file:bg-dark-accent/10 file:text-light-accent dark:file:text-dark-accent hover:file:bg-light-accent/20 dark:hover:file:bg-dark-accent/20"
          />
          {isLoaded && (
            <div className="text-light-accent-subtle dark:text-dark-accent-subtle text-sm">
              ✓ Loaded ({state?.rawTranscripts?.length || 0} transcripts, {state?.genericAnalysisState?.p3_2_output?.identified_gdus?.length || 0} GDUs)
            </div>
          )}
        </div>
        {isLoaded && state && (
          <div className="mt-2 text-xs text-light-sidenote dark:text-dark-sidenote">
            File: {state.rawTranscripts?.[0]?.filename || 'Unknown'} (and {(state.rawTranscripts?.length || 1) - 1} more)
          </div>
        )}
      </div>
    );
  };

  const renderResults = () => {
    const results = irrWorkflowState.results;
    if (!results) return null;

    const getReliabilityColor = (alpha: number) => {
      if (alpha >= 0.8) return 'text-light-accent-subtle dark:text-dark-accent-subtle';
      if (alpha >= 0.667) return 'text-light-accent-subtle dark:text-dark-accent-subtle';
      if (alpha >= 0.4) return 'text-yellow-600 dark:text-yellow-400';
      return 'text-light-accent dark:text-dark-accent';
    };

    return (
      <div className="mt-6 p-4 bg-light-bg-alt dark:bg-dark-bg-alt rounded-lg">
        <h3 className="text-lg font-semibold mb-4 text-light-text dark:text-dark-text">Inter-Rater Reliability Results</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-center mb-3">
              <div className={`text-3xl font-bold ${getReliabilityColor(results.alpha_score)}`}>
                α = {results.alpha_score.toFixed(3)}
              </div>
              <div className={`text-sm ${getReliabilityColor(results.alpha_score)}`}>
                {results.interpretation}
              </div>
              <div className="text-xs text-light-sidenote dark:text-dark-sidenote mt-1">
                <div>Obs. disagr.: {results.observed_disagreement.toFixed(3)}</div>
                <div>Exp. disagr.: {results.expected_disagreement.toFixed(3)}</div>
              </div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${getReliabilityColor(results.cohens_kappa)}`}>
                κ = {results.cohens_kappa.toFixed(3)}
              </div>
              <div className={`text-sm ${getReliabilityColor(results.cohens_kappa)}`}>
                {results.kappa_interpretation}
              </div>
              <div className="text-xs text-light-sidenote dark:text-dark-sidenote mt-1">
                <div>Obs. agr.: {results.kappa_observed_agreement.toFixed(3)}</div>
                <div>Exp. agr.: {results.kappa_expected_agreement.toFixed(3)}</div>
              </div>
            </div>
          </div>
          
          <div className="text-sm space-y-1 text-light-text dark:text-dark-text">
            <div>Total utterances: {results.total_utterances}</div>
            <div>Mapped GDUs: {results.mapped_gdus}</div>
            <div>Unmapped in Run A: {results.unmapped_gdus_run_a}</div>
            <div>Unmapped in Run B: {results.unmapped_gdus_run_b}</div>
          </div>
        </div>

        {results.matrix_validation.warnings.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-yellow-600 dark:text-yellow-400 mb-1">Warnings:</div>
            <ul className="text-xs text-yellow-600 dark:text-yellow-400 list-disc list-inside">
              {results.matrix_validation.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {results.matrix_validation.errors.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-red-600 dark:text-red-400 mb-1">Errors:</div>
            <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside">
              {results.matrix_validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {onDownloadDisagreementReport && (
          <div className="flex justify-end">
            <Button
              onClick={onDownloadDisagreementReport}
              variant="primary"
              size="sm"
            >
              Download Full Coding Matrix Report
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50">
      <div className="bg-light-bg dark:bg-dark-bg rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-light-text dark:text-dark-text">
              Inter-Rater Reliability Analysis
            </h2>
            <Button
              onClick={closeIrrModal}
              className="text-light-sidenote dark:text-dark-sidenote hover:text-light-text dark:hover:text-dark-text text-2xl p-1"
              variant="secondary"
              aria-label="Close modal"
            >
              ×
            </Button>
          </div>

          <div className="mb-6">
            <p className="text-light-sidenote dark:text-dark-sidenote text-sm mb-4">
              Compare two independent µ-PATH analysis runs to measure reliability of GDU assignments. 
              Load JSON state files from completed analyses below.
            </p>
          </div>

          {/* File inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              {renderFileInput('A', fileInputARef)}
            </div>
            <div>
              {renderFileInput('B', fileInputBRef)}
            </div>
          </div>

          {/* Loading state */}
          {irrWorkflowState.loadingState !== 'idle' && irrWorkflowState.loadingState !== 'complete' && irrWorkflowState.loadingState !== 'error' && (
            <div className="mb-6 text-center">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-light-sidenote dark:text-dark-sidenote">{getLoadingMessage()}</span>
              </div>
            </div>
          )}

          {/* Error message */}
          {irrWorkflowState.loadingState === 'error' && irrWorkflowState.errorMessage && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="text-red-600 dark:text-red-400 text-sm font-medium">Error</div>
              <div className="text-red-600 dark:text-red-400 text-sm">{irrWorkflowState.errorMessage}</div>
            </div>
          )}

          {/* Smart GDU check info */}
          {irrWorkflowState.runA && irrWorkflowState.runB && irrWorkflowState.loadingState === 'idle' && (
            <div className="mb-6 p-4 bg-light-accent-subtle/10 dark:bg-dark-accent-subtle/10 border border-light-accent-subtle/30 dark:border-dark-accent-subtle/30 rounded-lg">
              <div className="text-light-accent-subtle dark:text-dark-accent-subtle text-sm">
                <div className="font-medium mb-1">GDU Comparison Preview:</div>
                <div>Run A: {irrWorkflowState.runA.genericAnalysisState.p3_2_output?.identified_gdus?.length || 0} GDUs</div>
                <div>Run B: {irrWorkflowState.runB.genericAnalysisState.p3_2_output?.identified_gdus?.length || 0} GDUs</div>
                {(() => {
                  const runAGduIds = new Set(irrWorkflowState.runA.genericAnalysisState.p3_2_output?.identified_gdus?.map(g => g.gdu_id) || []);
                  const runBGduIds = new Set(irrWorkflowState.runB.genericAnalysisState.p3_2_output?.identified_gdus?.map(g => g.gdu_id) || []);
                  const intersection = new Set([...runAGduIds].filter(id => runBGduIds.has(id)));
                  const areIdentical = runAGduIds.size === runBGduIds.size && intersection.size === runAGduIds.size;
                  
                  return (
                    <div className={areIdentical ? 'text-green-700 dark:text-green-300 font-medium' : 'text-orange-700 dark:text-orange-300'}>
                      {areIdentical 
                        ? '✓ Identical GDU sets detected - mapping step will be skipped' 
                        : `${intersection.size} matching GDU IDs - semantic mapping will be required`
                      }
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-between items-center mb-6">
            <div></div>
            <Button
              onClick={() => generateSemanticMapping({
                temperature,
                seed,
                apiKey: apiKeyPresent ? 'present' : ''
              })}
              disabled={!canStartComparison()}
              variant="primary"
              className="px-6 py-3"
            >
              Compare Analyses
            </Button>
          </div>

          {/* Results */}
          {irrWorkflowState.results && renderResults()}

          {/* Footer */}
          <div className="border-t border-light-border dark:border-dark-border pt-4 mt-6">
            <div className="flex justify-end space-x-3">
              <Button
                onClick={closeIrrModal}
                variant="secondary"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IRRModal;