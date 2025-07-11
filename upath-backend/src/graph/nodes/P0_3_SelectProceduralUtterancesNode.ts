import { BaseNode } from './BaseNode';
import { GraphState, ExecutionContext, StepId } from '../types';
import { P0_2_Output, P0_3_Output, RefinedLine } from '../types/outputs';

export class P0_3_SelectProceduralUtterancesNode extends BaseNode {
  id = StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES;

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    // Get P0_2 output
    const p0_2_output = state.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
    
    if (!p0_2_output) {
      throw new Error('P0_2 output not found - cannot select procedural utterances');
    }

    if (!p0_2_output.refined_data_transcript || p0_2_output.refined_data_transcript.length === 0) {
      throw new Error('No refined transcript lines to filter');
    }

    // Filter procedural utterances
    const proceduralUtterances = this.filterProceduralUtterances(p0_2_output);
    
    // Generate summary
    const summary = this.generateSelectionSummary(
      proceduralUtterances,
      p0_2_output.refined_data_transcript.length
    );

    // Create output
    const output: P0_3_Output = {
      transcript_id: p0_2_output.transcript_id,
      procedural_utterances: proceduralUtterances,
      non_procedural_count: p0_2_output.refined_data_transcript.length - proceduralUtterances.length,
      total_utterance_count: p0_2_output.refined_data_transcript.length,
      selection_summary: summary
    };

    // Update state
    return {
      currentStep: this.id,
      lastCompletedStep: this.id,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: output
      },
      metadata: {
        ...state.metadata,
        lastUpdateTime: Date.now()
      },
      progress: this.calculateProgress(this.id)
    };
  }

  protected validateInputOrThrow(state: GraphState): void {
    // Call parent validation first
    super.validateInputOrThrow(state);

    // Check for P0_2 output
    if (!state.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES]) {
      throw new Error('P0_2 output not found');
    }

    const p0_2_output = state.stepOutputs[StepId.P0_2_REFINE_DATA_TYPES] as P0_2_Output;
    
    if (!p0_2_output.refined_data_transcript || p0_2_output.refined_data_transcript.length === 0) {
      throw new Error('No refined transcript lines to filter');
    }
  }

  protected isRecoverable(error: Error): boolean {
    // Check for non-recoverable patterns first
    const nonRecoverablePatterns = [
      /p0_2 output not found/i,
      /no refined transcript/i
    ];

    if (nonRecoverablePatterns.some(pattern => pattern.test(error.message))) {
      return false;
    }

    // Use parent's logic for other cases
    return super.isRecoverable(error);
  }

  /**
   * Filter utterances that have P-tag
   */
  filterProceduralUtterances(p0_2_output: P0_2_Output): RefinedLine[] {
    return p0_2_output.refined_data_transcript.filter(line => 
      line.information_tags && line.information_tags.includes('P-tag')
    );
  }

  /**
   * Generate a human-readable summary of the selection
   */
  private generateSelectionSummary(
    proceduralUtterances: RefinedLine[], 
    totalCount: number
  ): string {
    if (proceduralUtterances.length === 0) {
      return 'No procedural utterances found in the transcript.';
    }

    const lineNumbers = proceduralUtterances.map(u => u.line_num).join(', ');
    return `Selected ${proceduralUtterances.length} procedural utterances out of ${totalCount} total utterances (lines ${lineNumbers}).`;
  }
}