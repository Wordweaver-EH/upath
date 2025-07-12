import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { CompleteOutput, P5_2_Output } from '../types/outputs';

export class CompleteNode extends BaseNode {
  id = StepId.COMPLETE;
  
  async execute(
    state: GraphState,
    context: ExecutionContext
  ): Promise<GraphState> {
    console.log('[COMPLETE] Finalizing analysis pipeline');
    
    // Get P5_2 output (Holistic Refinement)
    const p5_2Output = state.stepOutputs?.[StepId.P5_2_HOLISTIC_REFINEMENT] as P5_2_Output;
    if (!p5_2Output) {
      throw new Error('P5_2 output not found');
    }
    
    // Calculate total processing time
    const startTime = state.metadata?.startTime || Date.now();
    const completionTime = Date.now();
    const totalProcessingTime = completionTime - startTime;
    
    // Get global DV focus
    const globalDvFocus = state.metadata?.global_dv_focus || [];
    
    console.log(`[COMPLETE] Analysis completed in ${totalProcessingTime}ms`);
    
    // Create completion output
    const completionOutput: CompleteOutput = {
      completion_status: 'success',
      analysis_complete: true,
      final_confidence_rating: p5_2Output.final_confidence_rating,
      holistic_assessment: p5_2Output.holistic_assessment,
      refinement_recommendations: p5_2Output.refinement_recommendations,
      study_limitations: p5_2Output.study_limitations,
      future_research_directions: p5_2Output.future_research_directions,
      total_processing_time_ms: totalProcessingTime,
      completion_timestamp: new Date(completionTime).toISOString(),
      dependent_variable_focus: globalDvFocus
    };
    
    // Update state to completed
    return {
      ...state,
      currentStep: this.id,
      lastCompletedStep: this.id,
      status: 'completed',
      progress: 100,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: completionOutput
      },
      metadata: {
        ...state.metadata,
        lastUpdateTime: completionTime
      }
    };
  }
  
  protected isRecoverable(error: Error): boolean {
    // Complete node errors are generally not recoverable
    // since we're at the end of the pipeline
    return false;
  }
}