/**
 * P1_4 Construct Specific Diachronic Structure - Output Parsing
 * Exactly matches the working prototype's parseOutput function
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P1_4_Output, SpecificDiachronicStructureType, SpecificDiachronicPhase, isValidVisualizationHint } from './types';

/**
 * Parse and validate JSON output for P1_4 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: string): P1_4_Output => {
  try {
    // Debug logging (matches prototype pattern)
    console.log(`[P1_4 parseOutput] Raw output length: ${rawOutput?.length || 0}`);
    
    if (!rawOutput || typeof rawOutput !== 'string') {
      throw new Error('No output received from Gemini API');
    }

    // Parse JSON (matches prototype's JSON.parse logic)
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseError) {
      console.error(`[P1_4 parseOutput] JSON parse error:`, parseError);
      throw new Error(`Failed to parse JSON output: ${parseError.message}`);
    }

    // Validate required fields (exactly matches prototype validation)
    const validationErrors: string[] = [];

    if (!parsedData.transcript_id || typeof parsedData.transcript_id !== 'string') {
      validationErrors.push('Missing or invalid transcript_id');
    }

    // Validate specific_diachronic_structure
    if (!parsedData.specific_diachronic_structure || typeof parsedData.specific_diachronic_structure !== 'object') {
      validationErrors.push('Missing or invalid specific_diachronic_structure object');
    } else {
      const sds = parsedData.specific_diachronic_structure;

      if (!sds.summary || typeof sds.summary !== 'string') {
        validationErrors.push('specific_diachronic_structure.summary must be a non-empty string');
      }

      if (!Array.isArray(sds.phases)) {
        validationErrors.push('specific_diachronic_structure.phases must be an array');
      } else {
        if (sds.phases.length === 0) {
          validationErrors.push('specific_diachronic_structure.phases cannot be empty');
        } else {
          // Validate each SpecificDiachronicPhase object
          sds.phases.forEach((phase: any, index: number) => {
            const phaseErrors: string[] = [];

            if (!phase.phase_name || typeof phase.phase_name !== 'string') {
              phaseErrors.push('phase_name must be a non-empty string');
            }

            if (!phase.description || typeof phase.description !== 'string') {
              phaseErrors.push('description must be a non-empty string');
            }

            if (!Array.isArray(phase.units_involved)) {
              phaseErrors.push('units_involved must be an array');
            } else {
              if (phase.units_involved.length === 0) {
                phaseErrors.push('units_involved cannot be empty');
              } else {
                // Validate unit_id format (should be like "rdu_1", "rdu_2")
                const invalidUnitIds = phase.units_involved.filter((unitId: any) => 
                  typeof unitId !== 'string' || !/^rdu_\d+$/.test(unitId)
                );
                if (invalidUnitIds.length > 0) {
                  phaseErrors.push(`Invalid units_involved format: ${invalidUnitIds.join(', ')}`);
                }
              }
            }

            if (phaseErrors.length > 0) {
              validationErrors.push(`Phase ${index + 1} (${phase.phase_name || 'unknown'}): ${phaseErrors.join('; ')}`);
            }
          });

          // Validate phase_name uniqueness
          const phaseNames = sds.phases.map((phase: any) => phase.phase_name);
          const duplicateNames = phaseNames.filter((name: string, idx: number) => phaseNames.indexOf(name) !== idx);
          if (duplicateNames.length > 0) {
            validationErrors.push(`Duplicate phase_names: ${duplicateNames.join(', ')}`);
          }

          // Validate units_involved uniqueness (each refined DU should only belong to one phase)
          const allUnitsInvolved: string[] = [];
          sds.phases.forEach((phase: any) => {
            if (Array.isArray(phase.units_involved)) {
              allUnitsInvolved.push(...phase.units_involved);
            }
          });
          const duplicateUnits = allUnitsInvolved.filter((unitId: string, idx: number) => allUnitsInvolved.indexOf(unitId) !== idx);
          if (duplicateUnits.length > 0) {
            validationErrors.push(`Refined DUs assigned to multiple phases: ${duplicateUnits.join(', ')}`);
          }
        }
      }

      if (sds.visualization_hint !== undefined && sds.visualization_hint !== null) {
        if (typeof sds.visualization_hint !== 'string') {
          validationErrors.push('specific_diachronic_structure.visualization_hint must be a string or undefined');
        } else if (sds.visualization_hint.trim() && !isValidVisualizationHint(sds.visualization_hint.trim())) {
          validationErrors.push(`Invalid visualization_hint: "${sds.visualization_hint}". Must be one of: Linear, Cyclical, Branching, Layered, Spiral, Other`);
        }
      }

      if (!sds.iv_preliminary_observation || typeof sds.iv_preliminary_observation !== 'string') {
        validationErrors.push('specific_diachronic_structure.iv_preliminary_observation must be a non-empty string');
      }
    }

    if (!parsedData.independent_variable_details || typeof parsedData.independent_variable_details !== 'string') {
      validationErrors.push('Missing or invalid independent_variable_details');
    }

    if (!Array.isArray(parsedData.dependent_variable_focus)) {
      validationErrors.push('Missing or invalid dependent_variable_focus array');
    } else {
      // Validate dependent_variable_focus items are strings
      const invalidDvItems = parsedData.dependent_variable_focus.filter((item: any) => typeof item !== 'string');
      if (invalidDvItems.length > 0) {
        validationErrors.push('dependent_variable_focus must contain only strings');
      }
      if (parsedData.dependent_variable_focus.length === 0) {
        validationErrors.push('dependent_variable_focus cannot be empty');
      }
    }

    if (!parsedData.mermaid_syntax_specific_diachronic || typeof parsedData.mermaid_syntax_specific_diachronic !== 'string') {
      validationErrors.push('Missing or invalid mermaid_syntax_specific_diachronic');
    } else {
      // Basic Mermaid syntax validation (should contain 'gantt' and 'title')
      const mermaidSyntax = parsedData.mermaid_syntax_specific_diachronic.toLowerCase();
      if (!mermaidSyntax.includes('gantt') || !mermaidSyntax.includes('title')) {
        validationErrors.push('mermaid_syntax_specific_diachronic must be valid Mermaid Gantt chart syntax');
      }
    }

    if (validationErrors.length > 0) {
      console.error(`[P1_4 parseOutput] Validation errors:`, validationErrors);
      throw new Error(`Validation failed: ${validationErrors.join('; ')}`);
    }

    // Create validated output object (exactly matches prototype structure)
    const phases: SpecificDiachronicPhase[] = parsedData.specific_diachronic_structure.phases.map((phase: any) => ({
      phase_name: phase.phase_name.trim(),
      description: phase.description.trim(),
      units_involved: phase.units_involved.map((unitId: string) => unitId.trim()),
    }));

    const specificDiachronicStructure: SpecificDiachronicStructureType = {
      summary: parsedData.specific_diachronic_structure.summary.trim(),
      phases,
      visualization_hint: parsedData.specific_diachronic_structure.visualization_hint ? 
        parsedData.specific_diachronic_structure.visualization_hint.trim() : undefined,
      iv_preliminary_observation: parsedData.specific_diachronic_structure.iv_preliminary_observation.trim(),
    };

    const output: P1_4_Output = {
      transcript_id: parsedData.transcript_id.trim(),
      specific_diachronic_structure: specificDiachronicStructure,
      independent_variable_details: parsedData.independent_variable_details.trim(),
      dependent_variable_focus: parsedData.dependent_variable_focus.map((item: string) => item.trim()),
      mermaid_syntax_specific_diachronic: parsedData.mermaid_syntax_specific_diachronic.trim(),
    };

    // Additional content validation (matches prototype quality checks)
    const totalPhases = output.specific_diachronic_structure.phases.length;
    const totalUnitsInStructure = output.specific_diachronic_structure.phases.reduce((sum, phase) => sum + phase.units_involved.length, 0);
    
    if (totalPhases < 1) {
      throw new Error('specific_diachronic_structure must contain at least one phase');
    }

    if (totalUnitsInStructure < 1) {
      throw new Error('must have at least one refined DU assigned to phases');
    }

    // Analyze phase distribution
    const phaseDistribution: { [key: string]: number } = {};
    output.specific_diachronic_structure.phases.forEach(phase => {
      phaseDistribution[phase.phase_name] = phase.units_involved.length;
    });

    console.log(`[P1_4 parseOutput] Successfully parsed and validated output for transcript: ${output.transcript_id}`);
    console.log(`[P1_4 parseOutput] Specific diachronic phases: ${totalPhases}`);
    console.log(`[P1_4 parseOutput] Total refined DUs in structure: ${totalUnitsInStructure}`);
    console.log(`[P1_4 parseOutput] Phase distribution:`, JSON.stringify(phaseDistribution));
    console.log(`[P1_4 parseOutput] Visualization hint: ${output.specific_diachronic_structure.visualization_hint || 'none'}`);
    console.log(`[P1_4 parseOutput] Mermaid syntax length: ${output.mermaid_syntax_specific_diachronic.length} chars`);
    console.log(`[P1_4 parseOutput] IV preliminary observation available: ${!!output.specific_diachronic_structure.iv_preliminary_observation}`);
    console.log(`[P1_4 parseOutput] Preserved IV details: ${!!output.independent_variable_details}`);
    console.log(`[P1_4 parseOutput] Preserved DV focus count: ${output.dependent_variable_focus.length}`);

    return output;

  } catch (error) {
    console.error(`[P1_4 parseOutput] Unexpected error:`, error);
    throw new Error(`Unexpected parsing error: ${error.message}`);
  }
};