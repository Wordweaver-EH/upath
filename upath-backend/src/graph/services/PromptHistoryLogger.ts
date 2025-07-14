import { PromptHistoryEntry } from '../types/stateManagement';

/**
 * PromptHistoryLogger tracks all LLM interactions for audit and analysis
 * Provides comprehensive logging of prompts, responses, and token usage
 */
export class PromptHistoryLogger {
  private history: PromptHistoryEntry[] = [];

  /**
   * Logs a completed LLM interaction
   */
  logInteraction(
    stepId: string,
    prompt: string,
    response: string,
    estimatedInputTokens: number,
    estimatedOutputTokens: number,
    transcriptId?: string,
    actualInputTokens?: number,
    actualOutputTokens?: number
  ): void {
    const entry: PromptHistoryEntry = {
      timestamp: new Date().toISOString(),
      stepId,
      transcriptId,
      prompt,
      response,
      estimatedInputTokens,
      estimatedOutputTokens,
      actualInputTokens,
      actualOutputTokens
    };

    this.history.push(entry);
  }

  /**
   * Gets complete prompt history
   */
  getHistory(): PromptHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Gets prompt history for specific step
   */
  getHistoryForStep(stepId: string): PromptHistoryEntry[] {
    return this.history.filter(entry => entry.stepId === stepId);
  }

  /**
   * Gets prompt history for specific transcript
   */
  getHistoryForTranscript(transcriptId: string): PromptHistoryEntry[] {
    return this.history.filter(entry => entry.transcriptId === transcriptId);
  }

  /**
   * Gets recent interactions (last N entries)
   */
  getRecentHistory(count: number): PromptHistoryEntry[] {
    return this.history.slice(-count);
  }

  /**
   * Clears all history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Gets total token usage statistics
   */
  getTokenStats(): {
    totalEstimatedInput: number;
    totalEstimatedOutput: number;
    totalActualInput: number;
    totalActualOutput: number;
    interactionCount: number;
  } {
    const stats = {
      totalEstimatedInput: 0,
      totalEstimatedOutput: 0,
      totalActualInput: 0,
      totalActualOutput: 0,
      interactionCount: this.history.length
    };

    for (const entry of this.history) {
      stats.totalEstimatedInput += entry.estimatedInputTokens;
      stats.totalEstimatedOutput += entry.estimatedOutputTokens;
      
      if (entry.actualInputTokens) {
        stats.totalActualInput += entry.actualInputTokens;
      }
      
      if (entry.actualOutputTokens) {
        stats.totalActualOutput += entry.actualOutputTokens;
      }
    }

    return stats;
  }

  /**
   * Gets token usage by step
   */
  getTokenStatsByStep(): Record<string, {
    estimatedInput: number;
    estimatedOutput: number;
    actualInput: number;
    actualOutput: number;
    count: number;
  }> {
    const statsByStep: Record<string, any> = {};

    for (const entry of this.history) {
      if (!statsByStep[entry.stepId]) {
        statsByStep[entry.stepId] = {
          estimatedInput: 0,
          estimatedOutput: 0,
          actualInput: 0,
          actualOutput: 0,
          count: 0
        };
      }

      const stepStats = statsByStep[entry.stepId];
      stepStats.estimatedInput += entry.estimatedInputTokens;
      stepStats.estimatedOutput += entry.estimatedOutputTokens;
      stepStats.actualInput += entry.actualInputTokens || 0;
      stepStats.actualOutput += entry.actualOutputTokens || 0;
      stepStats.count++;
    }

    return statsByStep;
  }

  /**
   * Exports history as JSON
   */
  exportAsJSON(): string {
    return JSON.stringify({
      metadata: {
        exportTime: new Date().toISOString(),
        totalEntries: this.history.length,
        tokenStats: this.getTokenStats()
      },
      history: this.history
    }, null, 2);
  }

  /**
   * Exports history as TSV format
   */
  exportAsTSV(): string {
    const headers = [
      'timestamp',
      'stepId', 
      'transcriptId',
      'prompt',
      'response',
      'estimatedInputTokens',
      'estimatedOutputTokens',
      'actualInputTokens',
      'actualOutputTokens'
    ];

    const rows = [headers.join('\t')];

    for (const entry of this.history) {
      const row = [
        entry.timestamp,
        entry.stepId,
        entry.transcriptId || '',
        entry.prompt.replace(/\t/g, ' ').replace(/\n/g, ' '), // Clean tabs/newlines for TSV
        entry.response.replace(/\t/g, ' ').replace(/\n/g, ' '),
        entry.estimatedInputTokens.toString(),
        entry.estimatedOutputTokens.toString(),
        entry.actualInputTokens?.toString() || '',
        entry.actualOutputTokens?.toString() || ''
      ];
      rows.push(row.join('\t'));
    }

    return rows.join('\n');
  }

  /**
   * Loads history from exported JSON
   */
  loadFromJSON(jsonData: string): void {
    try {
      const data = JSON.parse(jsonData);
      if (data.history && Array.isArray(data.history)) {
        this.history = data.history;
      } else {
        throw new Error('Invalid JSON format: missing history array');
      }
    } catch (error) {
      throw new Error(`Failed to load history from JSON: ${error.message}`);
    }
  }

  /**
   * Merges another logger's history into this one
   */
  mergeHistory(otherLogger: PromptHistoryLogger): void {
    const otherHistory = otherLogger.getHistory();
    this.history.push(...otherHistory);
    
    // Sort by timestamp to maintain chronological order
    this.history.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  /**
   * Estimates token count for a text string (rough approximation)
   * Uses the common 4 characters ≈ 1 token heuristic
   */
  static estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}