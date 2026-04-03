import { StepId, SegmentedUtteranceSegment } from '../../../../types';
import { StepConfig } from '../types';

export const P2S_1_GROUP_UTTERANCES_BY_TOPIC_CONFIG: StepConfig = {
  id: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
  title: "P2S.1: Group Segments by Topic within a Diachronic Unit",
  part: "PartII_Sync",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentDuId) => {
    if (!currentTranscript?.id || !currentDuId) {
      console.error('[P2S_1 Debug] Missing data:', {
        currentTranscript: currentTranscript,
        currentTranscriptId: currentTranscript?.id,
        currentDuId: currentDuId
      });
      return { data: null, error: "Missing current transcript ID or DU ID for P2S.1." };
    }
    const p1_4_data = allProcessedData?.get(currentTranscript.id)?.p1_4_output;
    if (!p1_4_data) return { data: null, error: `Missing P1.4 output for transcript ${currentTranscript.id}` };
    
    const duObject = p1_4_data.diachronic_units.find(u => u.unit_id === currentDuId);
    if (!duObject) return { data: null, error: `DU ${currentDuId} not found in P1.4 output for transcript ${currentTranscript.id}` };
    
    const segment_ids_in_du = new Set<string>(duObject.source_segment_ids);

    const segments_for_du: SegmentedUtteranceSegment[] = [];
    const p1_1_data = allProcessedData?.get(currentTranscript.id)?.p1_1_output;
    if (!p1_1_data) return { data: null, error: `Missing P1.1 output for transcript ${currentTranscript.id}` };
    
    // Collect the specific segments that belong to this DU
    for (const segContainer of p1_1_data.segmented_utterances) {
      if (segContainer.segments && Array.isArray(segContainer.segments)) {
        for (const segment of segContainer.segments) {
          if (segment_ids_in_du.has(segment.segment_id)) {
            segments_for_du.push(segment);
          }
        }
      }
    }

    if (segments_for_du.length === 0) return { data: null, error: `No segments could be mapped to DU '${currentDuId}' for P2S.1.` };

    return {
      data: {
        transcript_id: currentTranscript.id,
        analyzed_du_id: currentDuId,
        segments_for_du_analysis: segments_for_du,
        independent_variable_details: p1_4_data.independent_variable_details,
        dependent_variable_focus: p1_4_data.dependent_variable_focus,
      },
    };
  },
  generatePrompt: (input: { transcript_id: string; analyzed_du_id: string; segments_for_du_analysis: SegmentedUtteranceSegment[]; independent_variable_details: string; dependent_variable_focus: string[]; }) => `You are a micro-phenomenological analyst. Task: Group the provided SEGMENTS by topic for a GIVEN DIACHRONIC UNIT.
Input:
- Transcript ID: ${input.transcript_id}
- Diachronic Unit Being Analyzed: "${input.analyzed_du_id}"
- IV Details: "${input.independent_variable_details}"
- DV Focus: ${JSON.stringify(input.dependent_variable_focus)}
- Segments that occur within this DU:
${JSON.stringify(input.segments_for_du_analysis, null, 2)}

Instructions:
1.  Your Task: Group the provided *segments* by topic. Focus on experiential themes that are specific to the DV focus (${JSON.stringify(input.dependent_variable_focus)}).
2.  Topic Identification: Identify the main topic of each segment. Topics should be:
    *   Relevant to the dependent variable focus
    *   Specific (not generic like "feelings")
    *   Based on the content of the segments
3.  Grouping: Create groups of segments that share a similar topic. Be careful not to over-fragment; look for meaningful commonalities.
4.  No Temporal Ordering: This step focuses on thematic grouping, not temporal sequencing.
5.  Preserve the Diachronic Unit Context: Remember, these segments all come from the DU "${input.analyzed_du_id}". Your groupings should make sense within this DU's context.

Output:
A JSON object with ONLY the following structure (NO extra text or explanations):
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_du_id": "${input.analyzed_du_id}",
  "synchronic_thematic_groups": [
    {
      "group_label": "Descriptive Name for Topic Group 1",
      "justification": "Brief description of what unites these segments",
      "segments": [
        {
          "segment_id": "string",
          "segment_text": "text from input",
          "temporal_cues": ["..."]
        }
        // ... more segments in this group
      ]
    }
    // ... more groups
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
  responseSchema: {
    type: "object",
    properties: {
      transcript_id: { type: "string" },
      analyzed_du_id: { type: "string" },
      synchronic_thematic_groups: {
        type: "array",
        items: {
          type: "object",
          properties: {
            group_label: { type: "string" },
            justification: { type: "string" },
            segments: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  segment_id: { type: "string" },
                  segment_text: { type: "string" },
                  temporal_cues: { type: "array", items: { type: "string" } }
                },
                required: ["segment_id", "segment_text"]
              }
            }
          },
          required: ["group_label", "justification", "segments"]
        }
      },
      independent_variable_details: { type: "string" },
      dependent_variable_focus: { type: "array", items: { type: "string" } }
    },
    required: ["transcript_id", "analyzed_du_id", "synchronic_thematic_groups", "independent_variable_details", "dependent_variable_focus"]
  },
  saveToTranscript: (transcript, output, duId) => {
    if (!duId) {
      console.error('[P2S.1] No DU ID provided to saveToTranscript');
      return transcript;
    }
    
    const p2sOutputs = transcript.p2s_outputs_by_du || {};
    p2sOutputs[duId] = {
      ...p2sOutputs[duId],
      p2s_1_output: output,
      p2s_1_error: undefined
    };
    
    return {
      ...transcript,
      p2s_outputs_by_du: p2sOutputs
    };
  }
};