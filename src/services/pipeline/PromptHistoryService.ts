import { StepId, PromptHistoryEntry } from '../../../types'
import type { 
  IPromptHistoryService, 
  ExecutionContext, 
  StepOutput 
} from './types'

/**
 * Service for managing prompt history entries
 * 
 * This service extracts the prompt history creation logic from the monolithic
 * processSingleStep function. It handles:
 * - Creating structured history entries
 * - Handling different output types (string, object, null)
 * - Managing timestamp generation
 * - Formatting response data for storage
 */
export class PromptHistoryService implements IPromptHistoryService {
  
  createHistoryEntry(
    stepId: StepId,
    transcriptIdToProcess: string | undefined,
    output: StepOutput,
    context: ExecutionContext
  ): PromptHistoryEntry {
    // Format response data
    const responseRaw = typeof output.output === 'string' 
      ? output.output 
      : (output.output ? JSON.stringify(output.output) : '')
    
    const responseParsed = output.output

    // Create history entry
    const historyEntry: PromptHistoryEntry = {
      stepId,
      transcriptId: transcriptIdToProcess,
      timestamp: new Date().toISOString(),
      prompt: output.promptForHistory,
      requestPayload: context.isReportStep 
        ? { programmaticInput: 'Generated programmatically' }
        : { 
            model: 'gemini-2.5-flash-preview-04-17', 
            contents: output.promptForHistory, 
            temperature: 0.7, // Default temperature - this should be passed in if needed
            seed: undefined // This would need to be passed in if needed
          },
      responseRaw,
      responseParsed,
      error: output.apiError,
      groundingSources: output.groundingSources,
      estimatedInputTokens: output.estimatedInputTokens,
      estimatedOutputTokens: output.estimatedOutputTokens
    }

    return historyEntry
  }
}