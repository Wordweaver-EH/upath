import { StepId, P1_3_Output, P1_1_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_4_REFINE_DIACHRONIC_UNITS_CONFIG: StepConfig = {
  id: StepId.P1_4_REFINE_DIACHRONIC_UNITS,
  title: "P1.4: Refine Diachronic Units (RDU)",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.4." };
    
    const transcriptData = allProcessedData?.get(currentTranscript.id);
    const p1_3_data = transcriptData?.p1_3_output;
    const p1_1_data = transcriptData?.p1_1_output;
    
    if (!p1_3_data) return { data: null, error: `Missing P1.3 output for transcript ${currentTranscript.id}` };
    if (!p1_1_data) return { data: null, error: `Missing P1.1 output for transcript ${currentTranscript.id}` };
    
    // Group DUs by phase_type for processing
    const dusByPhase: Record<string, any[]> = {};
    
    p1_3_data.phased_diachronic_units.forEach(du => {
      if (!dusByPhase[du.phase_type]) {
        dusByPhase[du.phase_type] = [];
      }
      
      // Enrich each DU with its source segments and temporal cues
      const enrichedDU = {
        ...du,
        source_segments_with_cues: du.source_segment_ids.map(segId => {
          for (const uttData of p1_1_data.segmented_utterances) {
            const segment = uttData.segments.find(s => s.segment_id === segId);
            if (segment) return segment;
          }
          return null;
        }).filter(Boolean)
      };
      
      dusByPhase[du.phase_type].push(enrichedDU);
    });
    
    return { 
      data: {
        transcript_id: p1_3_data.transcript_id,
        dusByPhase,
        independent_variable_details: p1_3_data.independent_variable_details,
        dependent_variable_focus: p1_3_data.dependent_variable_focus
      }
    };
  },
  generatePrompt: (input: any) => `You are a micro-phenomenological analyst. Your task is to refine Diachronic Units (DUs) by examining them within their phase groups to determine if any should be merged.

Input:
Transcript ID: ${input.transcript_id}
DUs grouped by phase: ${JSON.stringify(input.dusByPhase, null, 2)}

Instructions:
1. **Process Each Phase Group:** For each phase type, examine all DUs within that phase.

2. **Ground Your Analysis:** For each DU, carefully review both its synthesized description and the raw source_segments_with_cues. The original text and temporal cues are the primary source of truth.

3. **Merging Decision:** Within each phase group:
   - MERGE DUs if they describe different facets of the SAME unified moment
   - KEEP SEPARATE if they describe distinct, sequential moments
   - Temporal cues like 'then', 'after', or logical progression indicate sequence

4. **Create RDUs:** For each phase group, create refined DUs with:
   - Unique unit_id (e.g., "rdu_1", "rdu_2") numbered sequentially across all phases
   - Synthesized description
   - source_du_ids listing the original DU IDs
   - merge_justification if multiple DUs were merged
   - phase object with sequence_id (chronological order) and phase_type

5. **Merging Guidelines:**
   MERGE when describing:
   - Different sensory aspects of the same instant
   - Multiple perspectives on a single moment
   - Redundant descriptions of the same experience

   KEEP SEPARATE when describing:
   - Clear sequential steps (indicated by 'then', 'after')
   - Different instances of similar experiences
   - Cause and effect relationships

Output:
{
  "transcript_id": "${input.transcript_id}",
  "refined_diachronic_units": [
    {
      "unit_id": "rdu_1",
      "description": "The participant's initial experience...",
      "source_du_ids": ["du_1"],
      "phase": { "sequence_id": 1, "phase_type": "Onset" }
    },
    {
      "unit_id": "rdu_2", 
      "description": "Visual and emotional opening moment...",
      "source_du_ids": ["du_2", "du_3"],
      "merge_justification": "Merged du_2 and du_3 as they describe complementary aspects of the same moment",
      "phase": { "sequence_id": 2, "phase_type": "Development_1" }
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`
};