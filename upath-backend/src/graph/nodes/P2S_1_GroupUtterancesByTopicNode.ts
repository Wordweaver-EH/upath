import { BaseNode } from './BaseNode';
import { GraphState, StepId, ExecutionContext } from '../types';
import { P0_3_Output, P1_1_Output, P1_2_Output, P1_3_Output, P1_4_Output, P2S_1_Output, SelectedUtterance } from '../types/outputs';
import { LLMResponseError } from '../errors/LLMResponseError';

export class P2S_1_GroupUtterancesByTopicNode extends BaseNode {
  id = StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC;

  async execute(state: GraphState, context: ExecutionContext): Promise<Partial<GraphState>> {
    // Get current phase name from metadata
    const currentPhaseName = state.metadata.currentPhaseName;
    if (!currentPhaseName) {
      throw new Error('Missing currentPhaseName in metadata for P2S.1');
    }

    // Get required outputs from previous steps
    const p0_3Output = state.stepOutputs[StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES] as P0_3_Output;
    const p1_1Output = state.stepOutputs[StepId.P1_1_INITIAL_SEGMENTATION] as P1_1_Output;
    const p1_2Output = state.stepOutputs[StepId.P1_2_DIACHRONIC_UNIT_ID] as P1_2_Output;
    const p1_3Output = state.stepOutputs[StepId.P1_3_REFINE_DIACHRONIC_UNITS] as P1_3_Output;
    const p1_4Output = state.stepOutputs[StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE] as P1_4_Output;

    if (!p0_3Output) {
      throw new Error('P0_3 output not found');
    }
    if (!p1_4Output) {
      throw new Error('P1_4 output not found');
    }

    // Find the phase in P1_4 output
    const phaseObject = p1_4Output.specific_diachronic_structure.phases.find(
      p => p.phase_name === currentPhaseName
    );
    if (!phaseObject) {
      throw new Error(`Phase ${currentPhaseName} not found in P1.4 output`);
    }

    // Trace back from phase to original utterances
    const utterancesForPhase = this.tracePhaseToUtterances(
      phaseObject,
      p1_3Output,
      p1_2Output,
      p1_1Output,
      currentPhaseName
    );

    if (utterancesForPhase.length === 0) {
      throw new Error(`No utterances could be mapped to phase '${currentPhaseName}' for P2S.1`);
    }

    // Build prompt
    const prompt = this.buildPrompt({
      transcript_id: p0_3Output.transcript_id || 'transcript-1',
      analyzed_diachronic_unit: currentPhaseName,
      utterances_for_phase_analysis: utterancesForPhase,
      independent_variable_details: p0_3Output.independent_variable_details,
      dependent_variable_focus: p0_3Output.dependent_variable_focus
    });

    // Call LLM
    const response = await context.llmClient.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: context.settings.temperature || 0.3,
        responseMimeType: 'application/json'
      }
    });

    // Parse response
    const responseText = response.response.text();
    let parsedResponse: P2S_1_Output;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      throw new LLMResponseError(
        `Failed to parse P2S_1 response: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseText
      );
    }

    // Validate response structure
    if (!parsedResponse.synchronic_thematic_groups || 
        !Array.isArray(parsedResponse.synchronic_thematic_groups)) {
      throw new Error('Invalid response: missing or invalid synchronic_thematic_groups');
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

  private tracePhaseToUtterances(
    phaseObject: { phase_name: string; description: string; units_involved: string[] },
    p1_3Output: P1_3_Output | undefined,
    p1_2Output: P1_2_Output | undefined,
    p1_1Output: P1_1_Output | undefined,
    currentPhaseName: string
  ): SelectedUtterance[] {
    if (!p1_3Output || !p1_2Output || !p1_1Output) {
      throw new Error('Missing required outputs for tracing phase to utterances');
    }

    // Step 1: Get RDU IDs from the phase
    const rduIdsInPhase = phaseObject.units_involved;

    // Step 2: Trace RDUs back to P1_2 DU IDs
    const p1_2_du_ids = new Set<string>();
    rduIdsInPhase.forEach(rduId => {
      const rdu = p1_3Output.refined_diachronic_units.find(u => u.unit_id === rduId);
      if (rdu && rdu.source_p1_2_du_ids) {
        rdu.source_p1_2_du_ids.forEach(id => p1_2_du_ids.add(id));
      }
    });

    // Step 3: Trace DUs back to segment IDs
    const segment_ids_in_phase = new Set<string>();
    p1_2_du_ids.forEach(duId => {
      const du = p1_2Output.diachronic_units.find(u => u.unit_id === duId);
      if (du && du.source_segment_ids) {
        du.source_segment_ids.forEach(id => segment_ids_in_phase.add(id));
      }
    });

    // Step 4: Find original utterances that contain these segments
    const utterances_for_phase: SelectedUtterance[] = [];
    const seenUtterances = new Set<string>(); // To avoid duplicates

    segment_ids_in_phase.forEach(segId => {
      const segContainer = p1_1Output.segmented_utterances.find(sc => 
        sc.segments.some(s => s.segment_id === segId)
      );
      
      if (segContainer) {
        const utteranceKey = `${segContainer.original_utterance.original_line_num}:${segContainer.original_utterance.utterance_text}`;
        if (!seenUtterances.has(utteranceKey)) {
          seenUtterances.add(utteranceKey);
          utterances_for_phase.push(segContainer.original_utterance);
        }
      }
    });

    return utterances_for_phase;
  }

  private buildPrompt(input: {
    transcript_id: string;
    analyzed_diachronic_unit: string;
    utterances_for_phase_analysis: SelectedUtterance[];
    independent_variable_details: string;
    dependent_variable_focus: string[];
  }): string {
    return `You are a micro-phenomenological analyst. Your task is to identify Specific Synchronic Units (ISUs) based on the thematic groups from P2S.1 for a GIVEN DIACHRONIC PHASE.

Input:
- Transcript ID: ${input.transcript_id}
- Diachronic Phase Being Analyzed: "${input.analyzed_diachronic_unit}"
- Utterances for this Phase:
${JSON.stringify(input.utterances_for_phase_analysis, null, 2)}
- Independent Variable details: ${input.independent_variable_details}
- User-defined Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus)}

Instructions:
1. Focus only on the provided utterances for the specific diachronic phase.
2. Identify thematic content relevant to the user-defined dependent_variable_focus.
3. Group utterances sharing a common, fine-grained theme into synchronic_thematic_groups.
4. For each group, create a group_label, a justification, and list the exact utterances that belong to it.
5. Copy the independent_variable_details and dependent_variable_focus fields verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_diachronic_unit": "${input.analyzed_diachronic_unit}",
  "synchronic_thematic_groups": [
    {
      "group_label": "Theme A about DV1",
      "justification": "These utterances all describe aspect X of DV1.",
      "utterances": [
        {
          "original_line_num": "10.1",
          "utterance_text": "text of utterance 10.1..."
        }
        // ... more utterances in this group
      ]
    }
    // ... more groups
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}`;
  }

  protected isRecoverable(error: Error): boolean {
    // Validation errors are not recoverable
    if (error.message.includes('not found') ||
        error.message.includes('Missing') ||
        error.message.includes('No utterances could be mapped')) {
      return false;
    }
    // LLM errors are typically recoverable
    return true;
  }
}