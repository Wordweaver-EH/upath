import { UPathMVPState } from '../langgraph/annotations';
import { SavedPipelineState, PromptHistoryEntry, StateExportOptions } from '../types/stateManagement';
import { GraphState } from '../types/state';

/**
 * StateManagementService handles saving, loading, and exporting pipeline states
 * Provides JSON-based state persistence compatible with frontend AppState
 */
export class StateManagementService {
  /**
   * Converts current UPathMVPState to SavedPipelineState for persistence
   */
  static saveState(
    state: any, // Accept any for legacy compatibility 
    promptHistory: PromptHistoryEntry[] = []
  ): SavedPipelineState {
    const savedState: SavedPipelineState = {
      // Core pipeline state
      pipelineId: state.pipelineId,
      transcripts: state.transcripts,
      stepOutputs: state.stepOutputs,
      currentPhase: state.currentPhase,
      status: state.status,
      progress: state.progress,
      
      // User configuration
      userDvFocus: state.userDvFocus,
      settings: state.settings || {},
      
      // Execution history
      promptHistory,
      
      // Metadata
      metadata: {
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        totalSteps: 24, // Total µ-PATH pipeline steps
        completedSteps: this.calculateCompletedSteps(state),
        sessionId: state.pipelineId // Map to session ID for backend compatibility
      },
      
      // Loop control state
      currentTranscriptIndex: state.currentTranscriptIndex,
      currentPhaseIndex: state.currentPhaseIndex,
      currentGDUIndex: state.currentGDUIndex,
      isMultiTranscript: state.isMultiTranscript
    };

    return savedState;
  }

  /**
   * Loads SavedPipelineState back into UPathMVPState format
   */
  static loadState(savedState: SavedPipelineState): UPathMVPState {
    const loadedState: UPathMVPState = {
      // Core pipeline state
      pipelineId: savedState.pipelineId,
      transcripts: savedState.transcripts,
      stepOutputs: savedState.stepOutputs,
      currentPhase: savedState.currentPhase,
      status: savedState.status,
      progress: savedState.progress,
      
      // User configuration
      userDvFocus: savedState.userDvFocus,
      settings: savedState.settings,
      
      // Loop control state
      currentTranscriptIndex: savedState.currentTranscriptIndex,
      currentPhaseIndex: savedState.currentPhaseIndex,
      currentGDUIndex: savedState.currentGDUIndex,
      isMultiTranscript: savedState.isMultiTranscript,
      
      // Default required state fields
      gdus: [],
      errors: [],
      phasesForP2SProcessing: [],
      currentPhaseForP2S: undefined,
      processedPhasesForP2S: []
    };

    return loadedState;
  }

  /**
   * Exports state data in specified format
   */
  static exportState(
    savedState: SavedPipelineState, 
    options: StateExportOptions
  ): string {
    if (options.format === 'json') {
      return this.exportAsJSON(savedState, options);
    } else if (options.format === 'tsv') {
      return this.exportAsTSV(savedState, options);
    }
    
    throw new Error(`Unsupported export format: ${options.format}`);
  }

  /**
   * Exports state as JSON format
   */
  private static exportAsJSON(
    savedState: SavedPipelineState, 
    options: StateExportOptions
  ): string {
    const exportData: any = {
      metadata: savedState.metadata,
      pipelineId: savedState.pipelineId,
      status: savedState.status,
      progress: savedState.progress,
      currentPhase: savedState.currentPhase
    };

    if (options.includeSettings) {
      exportData.settings = savedState.settings;
      exportData.userDvFocus = savedState.userDvFocus;
    }

    if (options.includeStepOutputs) {
      exportData.stepOutputs = this.filterStepOutputs(
        savedState.stepOutputs, 
        options.stepFilter
      );
    }

    if (options.includePromptHistory) {
      exportData.promptHistory = this.filterPromptHistory(
        savedState.promptHistory,
        options.stepFilter,
        options.transcriptFilter
      );
    }

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * Exports state as TSV format
   */
  private static exportAsTSV(
    savedState: SavedPipelineState, 
    options: StateExportOptions
  ): string {
    const rows: string[] = [];
    
    // Headers
    rows.push([
      'timestamp',
      'stepId', 
      'transcriptId',
      'status',
      'inputTokens',
      'outputTokens'
    ].join('\t'));

    // Filter and add prompt history data
    const filteredHistory = this.filterPromptHistory(
      savedState.promptHistory,
      options.stepFilter,
      options.transcriptFilter
    );

    for (const entry of filteredHistory) {
      rows.push([
        entry.timestamp,
        entry.stepId,
        entry.transcriptId || '',
        'completed',
        entry.actualInputTokens?.toString() || entry.estimatedInputTokens.toString(),
        entry.actualOutputTokens?.toString() || entry.estimatedOutputTokens.toString()
      ].join('\t'));
    }

    return rows.join('\n');
  }

  /**
   * Filters step outputs based on step filter
   */
  private static filterStepOutputs(
    stepOutputs: Record<string, any>,
    stepFilter?: string[]
  ): Record<string, any> {
    if (!stepFilter) return stepOutputs;
    
    const filtered: Record<string, any> = {};
    for (const stepId of stepFilter) {
      if (stepOutputs[stepId]) {
        filtered[stepId] = stepOutputs[stepId];
      }
    }
    return filtered;
  }

  /**
   * Filters prompt history based on step and transcript filters
   */
  private static filterPromptHistory(
    promptHistory: PromptHistoryEntry[],
    stepFilter?: string[],
    transcriptFilter?: string[]
  ): PromptHistoryEntry[] {
    let filtered = promptHistory;

    if (stepFilter) {
      filtered = filtered.filter(entry => stepFilter.includes(entry.stepId));
    }

    if (transcriptFilter) {
      filtered = filtered.filter(entry => 
        entry.transcriptId && transcriptFilter.includes(entry.transcriptId)
      );
    }

    return filtered;
  }

  /**
   * Calculates number of completed steps based on step outputs
   */
  private static calculateCompletedSteps(state: any): number {
    return Object.keys(state.stepOutputs || {}).length;
  }

  /**
   * Validates a saved state for loading compatibility
   */
  static validateSavedState(savedState: any): savedState is SavedPipelineState {
    const required = [
      'pipelineId',
      'transcripts', 
      'stepOutputs',
      'currentPhase',
      'status',
      'progress',
      'metadata'
    ];

    for (const field of required) {
      if (!(field in savedState)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (!Array.isArray(savedState.transcripts)) {
      throw new Error('transcripts must be an array');
    }

    if (typeof savedState.stepOutputs !== 'object') {
      throw new Error('stepOutputs must be an object');
    }

    return true;
  }

  /**
   * Creates a filename for saved state exports
   */
  static generateFilename(
    savedState: SavedPipelineState, 
    format: 'json' | 'tsv',
    prefix?: string
  ): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = prefix || 'upath-state';
    const transcriptCount = savedState.transcripts.length;
    const stepCount = Object.keys(savedState.stepOutputs).length;
    
    return `${baseName}-${transcriptCount}t-${stepCount}s-${timestamp}.${format}`;
  }
}