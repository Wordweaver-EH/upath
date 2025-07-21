import { StepId, P1_4_Output, P1_5_Output, RefinedDiachronicUnitP1_4, SpecificDiachronicPhase } from '../../../../types';
import { StepConfig } from '../types';

const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Programmatically constructs the Specific Diachronic Structure from P1.4 output
 * This is a deterministic aggregation function that groups RDUs by phase
 */
function programmaticallyConstructSds(p1_4_data: P1_4_Output): P1_5_Output {
  const { refined_diachronic_units, transcript_id, independent_variable_details, dependent_variable_focus } = p1_4_data;

  // 1. Group RDUs by phase
  const phasesMap = new Map<string, RefinedDiachronicUnitP1_4[]>();
  refined_diachronic_units.forEach(rdu => {
    const phaseType = rdu.phase.phase_type;
    if (!phasesMap.has(phaseType)) {
      phasesMap.set(phaseType, []);
    }
    phasesMap.get(phaseType)!.push(rdu);
  });

  // 2. Create the final phase objects, ensuring chronological order
  const sortedPhaseTypes = Array.from(phasesMap.keys()).sort((a, b) => {
    const seqA = phasesMap.get(a)![0].phase.sequence_id;
    const seqB = phasesMap.get(b)![0].phase.sequence_id;
    return seqA - seqB;
  });

  const phases: SpecificDiachronicPhase[] = sortedPhaseTypes.map(phaseType => {
    const rdusInPhase = phasesMap.get(phaseType)!;
    // Programmatically generate a description by combining RDU descriptions
    const descriptions = rdusInPhase.map(r => r.description).filter(d => d).join('. ');
    const description = descriptions.length > 0 
      ? descriptions.substring(0, MAX_DESCRIPTION_LENGTH) // Truncate to avoid excessive length
      : `This phase consists of ${rdusInPhase.length} refined diachronic unit(s).`;
    
    return {
      phase_name: phaseType,
      description,
      units_involved: rdusInPhase.map(rdu => rdu.unit_id),
    };
  });

  // 3. Perform validation checks
  const validationErrors: string[] = [];
  
  // Check for single-unit phases like 'Onset' and 'Conclusion'
  const onsetRDUs = phasesMap.get('Onset');
  if (onsetRDUs && onsetRDUs.length > 1) {
    validationErrors.push(`Multiple units (${onsetRDUs.length}) found in 'Onset' phase. It should only contain one.`);
  }

  const conclusionRDUs = phasesMap.get('Conclusion');
  if (conclusionRDUs && conclusionRDUs.length > 1) {
    validationErrors.push(`Multiple units (${conclusionRDUs.length}) found in 'Conclusion' phase. It should only contain one.`);
  }
  
  // Check sequence IDs are consecutive
  const uniqueSequenceIds = Array.from(new Set(refined_diachronic_units.map(rdu => rdu.phase.sequence_id))).sort((a, b) => a - b);
  for (let i = 0; i < uniqueSequenceIds.length - 1; i++) {
    if (uniqueSequenceIds[i + 1] !== uniqueSequenceIds[i] + 1) {
      validationErrors.push(`Non-consecutive phase sequence IDs: ${uniqueSequenceIds[i]} -> ${uniqueSequenceIds[i + 1]}`);
    }
  }
  
  // Check logical phase progression (using sorted phase types)
  if (sortedPhaseTypes.length > 0 && sortedPhaseTypes[0] !== 'Onset') {
    validationErrors.push("Experience should start with 'Onset' phase");
  }

  // 4. Programmatically generate the summary
  const summary = `The experience is structured into ${phases.length} distinct phase(s), comprising a total of ${refined_diachronic_units.length} refined diachronic unit(s).`;

  // 5. Assemble the final P1_5_Output object
  return {
    transcript_id,
    specific_diachronic_structure: {
      summary,
      phases,
      validation_errors: validationErrors,
      visualization_hint: "Linear progression with clear phase transitions",
      iv_preliminary_observation: "No immediate IV connection apparent at this programmatic stage."
    },
    refined_diachronic_units, // Pass through the RDUs for reference
    independent_variable_details,
    dependent_variable_focus,
  };
}

export const P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE_CONFIG: StepConfig = {
  id: StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  title: "P1.5: Construct Specific Diachronic Structure (SDS)",
  part: "PartI_Dia",
  isJsonOutput: false, // This is no longer a JSON output from an LLM
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.5." };
    
    const transcriptData = allProcessedData?.get(currentTranscript.id);
    const p1_4_data = transcriptData?.p1_4_output;
    
    if (!p1_4_data) return { data: null, error: `Missing P1.4 output for transcript ${currentTranscript.id}` };
    
    // The entire step's logic is now here - programmatic construction
    const p1_5_output = programmaticallyConstructSds(p1_4_data);
    
    return { data: p1_5_output }; // Return the fully formed output
  },
  // generatePrompt function is now REMOVED - this is a programmatic step
};