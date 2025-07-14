/**
 * P2S_1 Group Utterances by Topic - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P2S_1_Input, SelectedUtterance } from './types';

/**
 * Prepare input data for P2S_1 step
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { currentTranscript, processedData, currentPhaseName } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P2S_1 getInput] currentTranscript:`, 
    currentTranscript ? { 
      id: currentTranscript.id 
    } : null
  );
  console.log(`[P2S_1 getInput] currentPhaseName:`, currentPhaseName);

  // Validation (exactly matches prototype logic)
  if (!currentTranscript?.id) {
    console.error(`[P2S_1 getInput] Validation failed - missing transcript ID`);
    return { 
      data: null, 
      error: "Missing transcript ID for P2S.1." 
    };
  }

  if (!currentPhaseName) {
    console.error(`[P2S_1 getInput] Validation failed - missing current phase name`);
    return { 
      data: null, 
      error: "Missing current phase name for P2S.1." 
    };
  }

  // Get required outputs from previous steps
  const transcriptData = processedData.get(currentTranscript.id);
  if (!transcriptData) {
    console.error(`[P2S_1 getInput] No processed data found for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: `No processed data found for transcript ${currentTranscript.id}` 
    };
  }

  const p0_3_output = transcriptData.p0_3_output;
  const p1_4_output = transcriptData.p1_4_output;
  const p1_1_output = transcriptData.p1_1_output;

  if (!p0_3_output) {
    console.error(`[P2S_1 getInput] Missing P0.3 output for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: "Missing P0.3 output for P2S.1." 
    };
  }

  if (!p1_4_output) {
    console.error(`[P2S_1 getInput] Missing P1.4 output for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: "Missing P1.4 output for P2S.1." 
    };
  }

  if (!p1_1_output) {
    console.error(`[P2S_1 getInput] Missing P1.1 output for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: "Missing P1.1 output for P2S.1." 
    };
  }

  // Find the phase object that matches currentPhaseName
  const phaseObject = p1_4_output.specific_diachronic_structure.phases.find(
    phase => phase.phase_name === currentPhaseName
  );

  if (!phaseObject) {
    console.error(`[P2S_1 getInput] Phase '${currentPhaseName}' not found in P1.4 output`);
    return { 
      data: null, 
      error: `Phase '${currentPhaseName}' not found in P1.4 output for P2S.1.` 
    };
  }

  // Get RDU IDs in this phase
  const rduIdsInPhase = phaseObject.units_involved;

  // Trace back from RDUs to segments to utterances
  const p1_3_output = transcriptData.p1_3_output;
  if (!p1_3_output) {
    console.error(`[P2S_1 getInput] Missing P1.3 output for transcript ${currentTranscript.id}`);
    return { 
      data: null, 
      error: "Missing P1.3 output for P2S.1." 
    };
  }

  // Get all segment IDs from the RDUs in this phase
  const segmentIdsInPhase: string[] = [];
  for (const rduId of rduIdsInPhase) {
    const rdu = p1_3_output.refined_diachronic_units.find(unit => unit.unit_id === rduId);
    if (rdu) {
      // Get segments from P1.2 DUs that formed this RDU
      const p1_2_output = transcriptData.p1_2_output;
      if (p1_2_output) {
        for (const sourceP1_2_Id of rdu.source_p1_2_du_ids) {
          const p1_2_du = p1_2_output.diachronic_units.find(du => du.unit_id === sourceP1_2_Id);
          if (p1_2_du) {
            segmentIdsInPhase.push(...p1_2_du.source_segment_ids);
          }
        }
      }
    }
  }

  // Map segments to utterances
  const utterancesForPhase: SelectedUtterance[] = [];
  for (const segmentId of segmentIdsInPhase) {
    // Find the utterance that contains this segment
    for (const segmentedUtterance of p1_1_output.segmented_utterances) {
      const segment = segmentedUtterance.segments.find(seg => seg.segment_id === segmentId);
      if (segment) {
        // Add the original utterance if not already added
        const existingUtterance = utterancesForPhase.find(
          utt => utt.original_line_num === segmentedUtterance.original_utterance.original_line_num
        );
        if (!existingUtterance) {
          utterancesForPhase.push({
            original_line_num: segmentedUtterance.original_utterance.original_line_num,
            utterance_text: segmentedUtterance.original_utterance.utterance_text,
            selection_justification: segmentedUtterance.original_utterance.selection_justification,
          });
        }
        break;
      }
    }
  }

  // Prepare input data (exactly matches prototype structure)
  const inputData: P2S_1_Input = {
    transcript_id: currentTranscript.id,
    analyzed_diachronic_unit: currentPhaseName,
    utterances_for_phase_analysis: utterancesForPhase,
    independent_variable_details: p0_3_output.independent_variable_details,
    dependent_variable_focus: p0_3_output.dependent_variable_focus,
  };

  console.log(`[P2S_1 getInput] Successfully prepared input for phase '${currentPhaseName}' with ${utterancesForPhase.length} utterances`);

  return {
    data: inputData,
  };
}