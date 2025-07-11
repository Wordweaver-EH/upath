import { localForageStorage } from './storage';
import type { 
  RawTranscript, 
  TranscriptProcessedData, 
  GenericAnalysisState, 
  PromptHistoryEntry 
} from '../../types';

export const STORAGE_VERSION = 2;
export const MIGRATION_VERSION_KEY = 'storage-migration-version';

// V1 Storage Keys
const V1_PIPELINE_STORAGE_KEY = 'pipeline-storage';

// V2 Storage Keys
export const V2_TRANSCRIPT_STORAGE_KEY = 'transcript-storage';
export const V2_ANALYSIS_STORAGE_KEY = 'analysis-storage';
export const V2_PROMPT_HISTORY_STORAGE_KEY = 'prompt-history-storage';

interface V1State {
  rawTranscripts?: RawTranscript[];
  processedData?: Map<string, TranscriptProcessedData>;
  genericAnalysisState?: GenericAnalysisState;
  promptHistory?: PromptHistoryEntry[];
  totalInputTokens?: number;
  totalOutputTokens?: number;
}

interface V2TranscriptState {
  rawTranscripts: RawTranscript[];
  processedData: Map<string, TranscriptProcessedData>;
}

interface V2AnalysisState {
  genericAnalysisState: GenericAnalysisState;
}

interface V2PromptState {
  promptHistory: PromptHistoryEntry[];
  totalInputTokens: number;
  totalOutputTokens: number;
}

interface V2State {
  transcript: V2TranscriptState;
  analysis: V2AnalysisState;
  prompt: V2PromptState;
}

export function transformV1ToV2(v1State: V1State): V2State {
  return {
    transcript: {
      rawTranscripts: v1State.rawTranscripts || [],
      processedData: v1State.processedData || new Map()
    },
    analysis: {
      genericAnalysisState: v1State.genericAnalysisState || {}
    },
    prompt: {
      promptHistory: v1State.promptHistory || [],
      totalInputTokens: v1State.totalInputTokens || 0,
      totalOutputTokens: v1State.totalOutputTokens || 0
    }
  };
}

/**
 * Migrates V1 data to the new V2 storage format
 * @param v2State - The transformed V2 state
 */
async function writeV2StateToStorage(v2State: V2State): Promise<void> {
  await Promise.all([
    localForageStorage.setItem(V2_TRANSCRIPT_STORAGE_KEY, {
      version: 1,
      state: v2State.transcript
    }),
    localForageStorage.setItem(V2_ANALYSIS_STORAGE_KEY, {
      version: 1,
      state: v2State.analysis
    }),
    localForageStorage.setItem(V2_PROMPT_HISTORY_STORAGE_KEY, {
      version: 1,
      state: v2State.prompt
    })
  ]);
}

/**
 * Checks if migration has already been performed
 */
async function isMigrationComplete(): Promise<boolean> {
  const currentVersion = await localForageStorage.getItem(MIGRATION_VERSION_KEY);
  return currentVersion === STORAGE_VERSION;
}

/**
 * Retrieves existing V1 data from storage
 */
async function getV1Data(): Promise<V1State | null> {
  const v1Data = await localForageStorage.getItem(V1_PIPELINE_STORAGE_KEY);
  
  if (v1Data && typeof v1Data === 'object' && 'state' in v1Data) {
    return v1Data.state as V1State;
  }
  
  return null;
}

/**
 * Marks migration as complete in storage
 */
async function markMigrationComplete(): Promise<void> {
  await localForageStorage.setItem(MIGRATION_VERSION_KEY, STORAGE_VERSION);
}

/**
 * Runs the storage migration from V1 to V2 format
 * @returns boolean indicating whether migration was performed
 */
export async function runStorageMigration(): Promise<boolean> {
  try {
    // Check if migration has already been performed
    if (await isMigrationComplete()) {
      return false; // No migration needed
    }

    // Check for existing V1 data
    const v1State = await getV1Data();
    
    if (v1State) {
      // Transform V1 state to V2 format
      const v2State = transformV1ToV2(v1State);
      
      // Write to new storage keys
      await writeV2StateToStorage(v2State);
    }

    // Mark migration as complete
    await markMigrationComplete();
    
    return true; // Migration performed
  } catch (error) {
    console.error('Storage migration failed:', error);
    throw error;
  }
}