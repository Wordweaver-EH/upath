import React, { useState, useRef } from 'react';
import { IrrWorkflowState, AppState, IrrResults } from '../types';

interface IRRModalProps {
  isOpen: boolean;
  onClose: () => void;
  irrState: IrrWorkflowState;
  onStateUpdate: (updates: Partial<IrrWorkflowState>) => void;
  onStartComparison: () => void;
  onDownloadDisagreementReport?: () => void;
}

const IRRModal: React.FC<IRRModalProps> = ({
  isOpen,
  onClose,
  irrState,
  onStateUpdate,
  onStartComparison,
  onDownloadDisagreementReport
}) => {
  const fileInputARef = useRef<HTMLInputElement>(null);
  const fileInputBRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileLoad = (file: File, run: 'A' | 'B') => {
    onStateUpdate({ loadingState: 'loading-files' });
    
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
          onStateUpdate({ runA: parsedState, loadingState: 'idle' });
        } else {
          onStateUpdate({ runB: parsedState, loadingState: 'idle' });
        }
      } catch (error) {
        onStateUpdate({ 
          loadingState: 'error', 
          errorMessage: `Failed to load Run ${run}: ${error instanceof Error ? error.message : 'Invalid JSON'}` 
        });
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
    return irrState.runA && 
           irrState.runB && 
           irrState.loadingState === 'idle' &&
           irrState.runA.genericAnalysisState.p3_2_output &&
           irrState.runB.genericAnalysisState.p3_2_output;
  };

  const getLoadingMessage = () => {
    switch (irrState.loadingState) {
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
    const isLoaded = run === 'A' ? !!irrState.runA : !!irrState.runB;
    const state = run === 'A' ? irrState.runA : irrState.runB;
    
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Load Run {run} State
        </label>
        <div className="flex items-center space-x-2">
          <input
            ref={ref}
            type="file"
            accept=".json"
            onChange={(e) => handleFileInputChange(e, run)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {isLoaded && (
            <div className="text-green-600 text-sm">
              ✓ Loaded ({state?.rawTranscripts?.length || 0} transcripts, {state?.genericAnalysisState?.p3_2_output?.identified_gdus?.length || 0} GDUs)
            </div>
          )}
        </div>
        {isLoaded && state && (
          <div className="mt-2 text-xs text-gray-600">
            File: {state.rawTranscripts?.[0]?.filename || 'Unknown'} (and {(state.rawTranscripts?.length || 1) - 1} more)
          </div>
        )}
      </div>
    );
  };

  const renderResults = (results: IrrResults) => {
    const getReliabilityColor = (alpha: number) => {
      if (alpha >= 0.8) return 'text-green-600';
      if (alpha >= 0.667) return 'text-blue-600';
      if (alpha >= 0.4) return 'text-yellow-600';
      return 'text-red-600';
    };

    return (
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Inter-Rater Reliability Results</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="text-center">
            <div className={`text-3xl font-bold ${getReliabilityColor(results.alpha_score)}`}>
              α = {results.alpha_score.toFixed(3)}
            </div>
            <div className={`text-sm ${getReliabilityColor(results.alpha_score)}`}>
              {results.interpretation}
            </div>
          </div>
          
          <div className="text-sm space-y-1">
            <div>Total utterances: {results.total_utterances}</div>
            <div>Mapped GDUs: {results.mapped_gdus}</div>
            <div>Unmapped in Run A: {results.unmapped_gdus_run_a}</div>
            <div>Unmapped in Run B: {results.unmapped_gdus_run_b}</div>
          </div>
        </div>

        <div className="text-xs text-gray-600 mb-4">
          <div>Observed disagreement: {results.observed_disagreement.toFixed(3)}</div>
          <div>Expected disagreement: {results.expected_disagreement.toFixed(3)}</div>
        </div>

        {results.matrix_validation.warnings.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-yellow-600 mb-1">Warnings:</div>
            <ul className="text-xs text-yellow-600 list-disc list-inside">
              {results.matrix_validation.warnings.map((warning, i) => (
                <li key={i}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        {results.matrix_validation.errors.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium text-red-600 mb-1">Errors:</div>
            <ul className="text-xs text-red-600 list-disc list-inside">
              {results.matrix_validation.errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {onDownloadDisagreementReport && (
          <div className="flex justify-end">
            <button
              onClick={onDownloadDisagreementReport}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
            >
              Download Disagreement Report
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Inter-Rater Reliability Analysis
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <div className="mb-6">
            <p className="text-gray-600 text-sm mb-4">
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
          {irrState.loadingState !== 'idle' && irrState.loadingState !== 'complete' && irrState.loadingState !== 'error' && (
            <div className="mb-6 text-center">
              <div className="inline-flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-gray-600">{getLoadingMessage()}</span>
              </div>
            </div>
          )}

          {/* Error message */}
          {irrState.loadingState === 'error' && irrState.errorMessage && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-red-600 text-sm font-medium">Error</div>
              <div className="text-red-600 text-sm">{irrState.errorMessage}</div>
            </div>
          )}

          {/* Smart GDU check info */}
          {irrState.runA && irrState.runB && irrState.loadingState === 'idle' && (
            <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-blue-800 text-sm">
                <div className="font-medium mb-1">GDU Comparison Preview:</div>
                <div>Run A: {irrState.runA.genericAnalysisState.p3_2_output?.identified_gdus?.length || 0} GDUs</div>
                <div>Run B: {irrState.runB.genericAnalysisState.p3_2_output?.identified_gdus?.length || 0} GDUs</div>
                {(() => {
                  const runAGduIds = new Set(irrState.runA.genericAnalysisState.p3_2_output?.identified_gdus?.map(g => g.gdu_id) || []);
                  const runBGduIds = new Set(irrState.runB.genericAnalysisState.p3_2_output?.identified_gdus?.map(g => g.gdu_id) || []);
                  const intersection = new Set([...runAGduIds].filter(id => runBGduIds.has(id)));
                  const areIdentical = runAGduIds.size === runBGduIds.size && intersection.size === runAGduIds.size;
                  
                  return (
                    <div className={areIdentical ? 'text-green-700 font-medium' : 'text-orange-700'}>
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
            <button
              onClick={onStartComparison}
              disabled={!canStartComparison()}
              className={`px-6 py-3 rounded font-medium ${
                canStartComparison()
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              Compare Analyses
            </button>
          </div>

          {/* Results */}
          {irrState.results && renderResults(irrState.results)}

          {/* Footer */}
          <div className="border-t pt-4 mt-6">
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default IRRModal;