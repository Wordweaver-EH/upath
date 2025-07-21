import { StepId, P1_2_Output, P1_1_Output, P1_3_Input } from '../../../../types';
import { StepConfig } from '../types';

export const P1_3_TEMPORAL_PHASE_ASSIGNMENT_CONFIG: StepConfig = {
  id: StepId.P1_3_TEMPORAL_PHASE_ASSIGNMENT,
  title: "P1.3: Temporal Phase Assignment",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.3." };
    
    const transcriptData = allProcessedData?.get(currentTranscript.id);
    const p1_2_data = transcriptData?.p1_2_output;
    const p1_1_data = transcriptData?.p1_1_output;
    
    if (!p1_2_data) return { data: null, error: `Missing P1.2 output for transcript ${currentTranscript.id}` };
    if (!p1_1_data) return { data: null, error: `Missing P1.1 output for transcript ${currentTranscript.id}` };
    
    // Enrich DUs with source segment text for context
    const enrichedDUs = p1_2_data.diachronic_units.map(du => {
      const sourceSegments = du.source_segment_ids.map(segId => {
        // Find the segment in P1.1 output
        for (const uttData of p1_1_data.segmented_utterances) {
          const segment = uttData.segments.find(s => s.segment_id === segId);
          if (segment) return segment;
        }
        return null;
      }).filter(Boolean);
      
      return {
        ...du,
        source_segments_text: sourceSegments
      };
    });
    
    const enrichedInput: P1_3_Input = {
      ...p1_2_data,
      diachronic_units: enrichedDUs
    };
    
    return { data: enrichedInput };
  },
  generatePrompt: (input: P1_3_Input) => `You are a micro-phenomenological analyst. Your task is to assign a temporal phase to each Diachronic Unit (DU). This is a categorization step only.

Input:
A list of DUs for transcript ID ${input.transcript_id}. Each DU includes a synthesized \`description\` and the raw \`source_segments_text\` it was derived from.
Input DUs: ${JSON.stringify(input.diachronic_units, null, 2)}

Instructions:
1. For each DU, read both its \`description\` and the detailed \`source_segments_text\` to get the full context.
2. Assign a \`phase_type\` from the FIXED list below that best describes the temporal quality of the DU.
3. **Indexing Rule:** For \`Development\`, \`Peak\`, and \`Transition\`, you MUST add a sequential index if the type is repeated (e.g., "Development_1", "Development_2"). \`Onset\` and \`Conclusion\` must be used only once.
4. Do NOT merge, split, or change the DUs. Simply copy each DU and add the \`phase_type\` key.
5. Preserve IV/DV.

**Phase Vocabulary:**
- \`Onset\`: The very beginning of the experience.
- \`Development_n\`: A period where the experience is unfolding or being sustained.
- \`Peak_n\`: A moment of maximal intensity or a key realization.
- \`Transition_n\`: A moment that marks a clear shift between other phases.
- \`Conclusion\`: The final moment of the experience.
- \`Reflection\`: A period of meta-commentary or looking back on the experience.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "transcript_id": "${input.transcript_id}",
  "phased_diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Initial brief images of glue appeared at the start of the experience.",
      "source_segment_ids": ["utt_59_seg_0"],
      "phase_type": "Onset"
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`
};