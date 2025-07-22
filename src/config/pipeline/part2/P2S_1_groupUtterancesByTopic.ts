import { StepId, SelectedUtterance } from '../../../../types';
import { StepConfig } from '../types';

export const P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG: StepConfig = {
  id: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
  title: "P2S.1: Group Utterances by Topic within a Diachronic Phase",
  part: "PartII_Sync",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentPhaseName) => {
    if (!currentTranscript?.id || !currentPhaseName) return { data: null, error: "Missing current transcript ID or phase name for P2S.1." };
    const p0_3_data = allProcessedData?.get(currentTranscript.id)?.p0_3_output;
    const p1_5_data = allProcessedData?.get(currentTranscript.id)?.p1_5_output;
    if (!p0_3_data || !p1_5_data) return { data: null, error: `Missing P0.3 or P1.5 output for transcript ${currentTranscript.id}` };
    
    const phaseObject = p1_5_data.specific_diachronic_structure.phases.find(p => p.phase_name === currentPhaseName);
    if (!phaseObject) return { data: null, error: `Phase ${currentPhaseName} not found in P1.5 output for transcript ${currentTranscript.id}` };
    
    const rduIdsInPhase = phaseObject.units_involved;
    const p1_2_du_ids = new Set<string>();
    const p1_4_data = allProcessedData?.get(currentTranscript.id)?.p1_4_output;
    rduIdsInPhase.forEach(rduId => {
      const rdu = p1_4_data?.refined_diachronic_units.find(u => u.unit_id === rduId);
      rdu?.source_du_ids.forEach(id => p1_2_du_ids.add(id));
    });

    const segment_ids_in_phase = new Set<string>();
    const p1_2_data = allProcessedData?.get(currentTranscript.id)?.p1_2_output;
    p1_2_du_ids.forEach(duId => {
      const du = p1_2_data?.diachronic_units.find(u => u.unit_id === duId);
      du?.source_segment_ids.forEach(id => segment_ids_in_phase.add(id));
    });

    const utterances_for_phase: SelectedUtterance[] = [];
    const p1_1_data = allProcessedData?.get(currentTranscript.id)?.p1_1_output;
    segment_ids_in_phase.forEach(segId => {
      const segContainer = p1_1_data?.segmented_utterances.find(sc => sc.segments.some(s => s.segment_id === segId));
      if (segContainer && !utterances_for_phase.some(u => u.original_line_num === segContainer.original_utterance.original_line_num && u.utterance_text === segContainer.original_utterance.utterance_text)) {
        // Double-check that the utterance is included (though it should be by now)
        if (!('included' in segContainer.original_utterance) || segContainer.original_utterance.included) {
          utterances_for_phase.push(segContainer.original_utterance);
        }
      }
    });

    if (utterances_for_phase.length === 0) return { data: null, error: `No P0.3 utterances could be mapped to phase '${currentPhaseName}' for P2S.1.` };

    return {
      data: {
        transcript_id: currentTranscript.id,
        analyzed_diachronic_unit: currentPhaseName,
        utterances_for_phase_analysis: utterances_for_phase,
        independent_variable_details: p0_3_data.independent_variable_details,
        dependent_variable_focus: p0_3_data.dependent_variable_focus,
      },
    };
  },
  generatePrompt: (input: { transcript_id: string; analyzed_diachronic_unit: string; utterances_for_phase_analysis: SelectedUtterance[]; independent_variable_details: string; dependent_variable_focus: string[]; }) => `You are a micro-phenomenological analyst. Task: Group procedural utterances by topic for a GIVEN DIACHRONIC PHASE/UNIT from a specific transcript.
Input:
- Transcript ID: ${input.transcript_id}
- Diachronic Phase Being Analyzed: "${input.analyzed_diachronic_unit}"
- IV Details: "${input.independent_variable_details}"
- DV Focus: ${JSON.stringify(input.dependent_variable_focus)}
- Utterances that occur within this phase (using P0.3 selection criteria):
${JSON.stringify(input.utterances_for_phase_analysis, null, 2)}

Instructions:
1.  Your Task: Group the provided utterances by topic. Focus on experiential themes that are specific to the DV focus (${JSON.stringify(input.dependent_variable_focus)}).
2.  Topic Identification: Identify the main topic of each utterance. Topics should be:
    *   Relevant to the dependent variable focus
    *   Specific (not generic like "feelings")
    *   Based on the content of the utterances
3.  Grouping: Create groups of utterances that share a similar topic. Be careful not to over-fragment; look for meaningful commonalities.
4.  No Temporal Ordering: This step focuses on thematic grouping, not temporal sequencing. Do not concern yourself with the chronological order of utterances within groups.
5.  Preserve the Diachronic Phase Context: Remember, these utterances all come from the phase "${input.analyzed_diachronic_unit}". Your groupings should make sense within this phase's context.

Output:
A JSON object with ONLY the following structure (NO extra text or explanations):
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_diachronic_unit": "${input.analyzed_diachronic_unit}",
  "thematic_groups": [
    {
      "group_name": "Descriptive Name for Topic Group 1",
      "topic_description": "Brief description of what unites these utterances",
      "utterances": [
        {
          "original_line_num": "string",
          "utterance_text": "text from input",
          "selection_justification": "text from input"
        }
        // ... more utterances in this group
      ]
    }
    // ... more groups
  ]
}
`,
};