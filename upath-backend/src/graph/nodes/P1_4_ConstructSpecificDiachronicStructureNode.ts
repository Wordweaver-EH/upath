import { BaseNode } from './BaseNode';
import { GraphState, ExecutionContext } from '../types';
import { StepId } from '../types/enums';
import { P1_3_Output, P1_4_Output } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';

export class P1_4_ConstructSpecificDiachronicStructureNode extends BaseNode {
  id = StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE;
  name = 'Construct Specific Diachronic Structure';

  protected async validateInputOrThrow(state: GraphState): Promise<void> {
    // Check for P1_3 output
    const p1_3Output = state.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS] as P1_3_Output | undefined;
    
    if (!p1_3Output) {
      throw new Error('P1_3 output not found');
    }

    if (!p1_3Output.refined_diachronic_units || p1_3Output.refined_diachronic_units.length === 0) {
      throw new Error('No refined diachronic units to process');
    }
  }

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    // Validate input
    await this.validateInputOrThrow(state);

    const p1_3Output = state.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS] as P1_3_Output;

    // Build prompt
    const prompt = this.buildPrompt(p1_3Output);

    // Call LLM
    const response = await context.llmClient.generateContent({
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: context.settings.temperature || 0.3,
        responseMimeType: 'application/json'
      }
    });

    // Parse response
    const responseText = response.response.text();
    let parsedResponse: P1_4_Output;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      throw new LLMResponseError(
        `Failed to parse P1_4 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseText
      );
    }

    // Validate response structure
    if (!parsedResponse.specific_diachronic_structure) {
      throw new Error('Invalid response: missing specific_diachronic_structure');
    }

    if (!parsedResponse.specific_diachronic_structure.phases || 
        parsedResponse.specific_diachronic_structure.phases.length === 0) {
      throw new Error('No phases identified in specific diachronic structure');
    }

    // Update state
    return {
      currentStep: this.id,
      lastCompletedStep: this.id,
      stepOutputs: {
        ...state.stepOutputs,
        [this.id]: parsedResponse
      },
      metadata: {
        ...state.metadata,
        lastUpdateTime: Date.now()
      }
    };
  }

  protected isRecoverable(error: Error): boolean {
    // Validation errors are not recoverable
    if (error.message.includes('No refined diachronic units to process') ||
        error.message.includes('P1_3 output not found')) {
      return false;
    }
    // LLM errors are typically recoverable
    return true;
  }

  private buildPrompt(p1_3Output: P1_3_Output & { 
    independent_variable_details?: string; 
    dependent_variable_focus?: string[];
    transcript_id?: string;
  }): string {
    // Extract transcript_id - it might be on the P1_3 output or we need to infer it
    const transcriptId = p1_3Output.transcript_id || 'transcript-1';
    
    // Get IV/DV from P1_3 output (they should be there based on MVP)
    const independentVariable = p1_3Output.independent_variable_details || '';
    const dependentVariableFocus = p1_3Output.dependent_variable_focus || [];

    return `You are a micro-phenomenological analyst. Your task is to construct the Specific Diachronic Structure (SDS) for this transcript based on the refined DUs and their temporal phases.
Input:
JSON output from P1.3 for transcript ID ${transcriptId}.
P1.3 Output: ${JSON.stringify(p1_3Output, null, 2)}
User-defined Dependent Variable Focus: ${JSON.stringify(dependentVariableFocus)}
Independent Variable details: ${independentVariable}

Instructions:
1.  Define Specific Diachronic Phases:
    *   Group the refined DUs from P1.3 by their assigned \`temporal_phase\`.
    *   For each unique temporal phase present in the P1.3 output, create a \`SpecificDiachronicPhase\` object.
    *   \`phase_name\` should be the temporal phase (e.g., "Beginning", "Core Event").
    *   \`description\` should be a brief summary of what happens in this phase, derived from the descriptions of the DUs within it.
    *   \`units_involved\` must be an array of \`unit_id\`s from P1.3 that belong to this phase.
2.  Structure Summary: Provide an overall \`summary\` of the entire Specific Diachronic Structure.
3.  Visualization Hint: Optionally, provide a \`visualization_hint\` (e.g., "Linear", "Cyclical elements present", "Branching paths noted") based on the flow of phases.
4.  IV Preliminary Observation: Based on the \`independent_variable_details\` provided in the input, make a very brief, preliminary observation IF any immediate connection seems apparent between the IV and the overall diachronic structure observed. If no connection is obvious, state "No immediate IV connection apparent at this stage." This is a speculative note.
5.  Mermaid Syntax for Gantt Chart:
    *   Generate Mermaid.js syntax for a Gantt chart representing the SDS.
    *   The Gantt chart should display the \`SpecificDiachronicPhase\` objects as tasks.
    *   The title of the Gantt chart should be descriptive, like "Specific Diachronic Structure for ${transcriptId}".
    *   Use the \`phase_name\` for task labels. Task IDs should be derived from \`phase_name\` (sanitized for Mermaid).
    *   Order tasks by their natural temporal progression (Beginning, Early-Middle, etc.).
    *   The duration of each phase task can be heuristically based on the number of \`units_involved\` (e.g., 1 day per unit, or a fixed small duration like 2d or 3d if number of units is fairly consistent).
    *   Ensure \`dateFormat X\` and \`axisFormat %s\` are used for relative sequencing.
    Example segment for one phase: \`Beginning Phase :bgn_phase, 0, 3d\` (label:id, start_day_index, duration_days)
6.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P1.3 MUST be copied verbatim into the main output JSON.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${transcriptId}",
  "specific_diachronic_structure": {
    "summary": "Overall summary of the experience's diachronic flow.",
    "phases": [
      {
        "phase_name": "Beginning",
        "description": "Summary of the beginning phase.",
        "units_involved": ["rdu_1"] // unit_ids from P1.3
      },
      {
        "phase_name": "Core Event",
        "description": "Summary of the core event phase.",
        "units_involved": ["rdu_2", "rdu_3"]
      }
      // ... more phases
    ],
    "visualization_hint": "e.g., Linear progression",
    "iv_preliminary_observation": "Brief note on potential IV connection or N/A."
  },
  "independent_variable_details": "${independentVariable}",
  "dependent_variable_focus": ${JSON.stringify(dependentVariableFocus)},
  "mermaid_syntax_specific_diachronic": "gantt\\ndateFormat X\\ntitle Specific Diachronic Structure for ${transcriptId}\\naxisFormat %s\\n\\nsection Phases\\nBeginning :ph_beginning, 0, 2d\\nCore Event :ph_core, 2, 3d\\nEnding :ph_ending, 5, 1d"
}`;
  }
}