import { StepId, P1_2_Output, P1_3_Output, PhaseTaggedSegment } from '../../../../types';
import { StepConfig } from '../types';

// Helper function to generate phase-specific prompt
export const generatePhaseSpecificPrompt = (phaseName: string, segments: PhaseTaggedSegment[]) => {
  return `You are a micro-phenomenological data analyst. You will be given a list of interview segments that all belong to the ${phaseName} phase. Your task is to re-order these segments into the chronological order of the ORIGINAL EXPERIENCE.

IMPORTANT — Interview Order vs Experience Order:
Participants do not recount events in the order they happened. They jump around, elaborate, and circle back. A segment mentioned early in the interview may describe something that happened late in the experience, and vice versa. Your job is to reconstruct the order in which things actually happened during the experience, using these cues:
- Causal relationships: causes precede effects
- Temporal language: "at first", "then", "after that", "eventually"
- Logical prerequisites: noticing something must precede reflecting on it; an action must precede awareness of its result

Input:
A list of segmented utterances belonging to the ${phaseName} phase.
Phase segments: ${JSON.stringify(segments, null, 2)}

Instructions:
1. For each segment, determine WHEN in the experience it actually occurred, ignoring its position in the interview transcript.
2. Assign a \`chronological_index\` based on experience order. The sequence starts from 1 for this specific list.
3. Simultaneous events should share the same index.
4. Provide a \`placement_justification\` citing the causal, temporal, or logical evidence for this position.

Output:
A JSON object containing a single, re-ordered list of the provided segments with added chronological_index and placement_justification fields:
{
  "sorted_segments": [
    {
      "segment_id": "utt_5_1_seg_0",
      "segment_text": "...",
      "temporal_cues": ["..."],
      "coarse_phase": "${phaseName}",
      "chronological_index": 1,
      "placement_justification": "This segment describes the initial moment..."
    }
  ]
}`;
};

export const P1_3_INTRA_PHASE_SORTING_CONFIG: StepConfig = {
  id: StepId.P1_3_INTRA_PHASE_SORTING,
  title: "P1.3: Intra-Phase Sorting",
  part: "PartI_Dia",
  isJsonOutput: false, // Special handling - multiple JSON calls handled in pipelineStore
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.3." };
    const p1_2_data = allProcessedData?.get(currentTranscript.id)?.p1_2_output;
    if (!p1_2_data) return { data: null, error: `Missing P1.2 output for transcript ${currentTranscript.id}` };
    return { data: p1_2_data };
  },
  generatePrompt: (input: P1_2_Output) => {
    // This is not used directly - see generatePhaseSpecificPrompt above
    // The pipelineStore will detect P1_3 and use the exported function
    return "";
  }
};