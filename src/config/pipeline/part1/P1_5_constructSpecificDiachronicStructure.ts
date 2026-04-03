import { StepId, P1_4_Output, P1_5_Output, DiachronicUnit, SpecificDiachronicPhase } from '../../../../types';
import { StepConfig } from '../types';

const MAX_DESCRIPTION_LENGTH = 500;

/**
 * Programmatically constructs the Specific Diachronic Structure from P1.4 output
 * Since P1_4 now provides chronologically ordered DUs without phases,
 * this step will identify natural phase transitions in the DU sequence
 */
function programmaticallyConstructSds(p1_4_data: P1_4_Output): P1_5_Output {
  const { diachronic_units, transcript_id, independent_variable_details, dependent_variable_focus } = p1_4_data;

  // Since DUs are already chronologically ordered, we can identify natural phases
  // by looking for significant transitions or groupings in the narrative
  
  // For now, we'll create a simple structure that preserves the chronological flow
  // Future enhancement: Could use more sophisticated phase detection
  
  const phases: SpecificDiachronicPhase[] = [];
  
  // Group DUs into natural phases based on their position in the sequence
  // This is a simplified approach - in practice, you might want to analyze
  // the content of descriptions to find natural breakpoints
  
  if (diachronic_units.length === 0) {
    // No units to process
  } else if (diachronic_units.length <= 3) {
    // For very short sequences, treat as a single phase
    phases.push({
      phase_name: 'Main Experience',
      description: diachronic_units.map(du => du.description).join('. ').substring(0, MAX_DESCRIPTION_LENGTH),
      units_involved: diachronic_units.map(du => du.unit_id)
    });
  } else {
    // For longer sequences, divide into Beginning, Middle, End
    const firstThird = Math.ceil(diachronic_units.length / 3);
    const secondThird = Math.ceil(2 * diachronic_units.length / 3);
    
    phases.push({
      phase_name: 'Initial Phase',
      description: diachronic_units.slice(0, firstThird).map(du => du.description).join('. ').substring(0, MAX_DESCRIPTION_LENGTH),
      units_involved: diachronic_units.slice(0, firstThird).map(du => du.unit_id)
    });
    
    phases.push({
      phase_name: 'Development Phase',
      description: diachronic_units.slice(firstThird, secondThird).map(du => du.description).join('. ').substring(0, MAX_DESCRIPTION_LENGTH),
      units_involved: diachronic_units.slice(firstThird, secondThird).map(du => du.unit_id)
    });
    
    phases.push({
      phase_name: 'Concluding Phase',
      description: diachronic_units.slice(secondThird).map(du => du.description).join('. ').substring(0, MAX_DESCRIPTION_LENGTH),
      units_involved: diachronic_units.slice(secondThird).map(du => du.unit_id)
    });
  }

  // 3. Perform validation checks
  const validationErrors: string[] = [];
  
  // Basic validation - ensure we have units and phases
  if (diachronic_units.length === 0) {
    validationErrors.push("No diachronic units found in input");
  }
  
  if (phases.length === 0 && diachronic_units.length > 0) {
    validationErrors.push("Failed to create phase structure from diachronic units");
  }
  
  // Ensure all units are assigned to phases
  const assignedUnits = new Set(phases.flatMap(p => p.units_involved));
  const missingUnits = diachronic_units.filter(du => !assignedUnits.has(du.unit_id));
  if (missingUnits.length > 0) {
    validationErrors.push(`Some units not assigned to phases: ${missingUnits.map(u => u.unit_id).join(', ')}`);
  }

  // 4. Programmatically generate the summary
  const summary = `The experience is structured into ${phases.length} distinct phase(s), comprising a total of ${diachronic_units.length} diachronic unit(s).`;

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
    diachronic_units, // Pass through the DUs for reference
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