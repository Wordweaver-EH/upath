/**
 * P2S_3 Define Specific Synchronic Structure - Output Parsing
 * Exactly matches the working prototype's parseOutput behavior
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P2S_3_Output } from './types';

/**
 * Parse and validate output for P2S_3 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: any): P2S_3_Output => {
  console.log(`[P2S_3 parseOutput] Parsing raw output:`, rawOutput);

  // Validation: Check required fields (matches prototype validation)
  if (!rawOutput.transcript_id) {
    throw new Error('P2S_3 output missing required field: transcript_id');
  }

  if (!rawOutput.analyzed_diachronic_unit) {
    throw new Error('P2S_3 output missing required field: analyzed_diachronic_unit');
  }

  if (!rawOutput.specific_synchronic_structure) {
    throw new Error('P2S_3 output missing required field: specific_synchronic_structure');
  }

  if (!rawOutput.independent_variable_details) {
    throw new Error('P2S_3 output missing required field: independent_variable_details');
  }

  if (!Array.isArray(rawOutput.dependent_variable_focus)) {
    throw new Error('P2S_3 output field dependent_variable_focus must be an array');
  }

  // Validate specific_synchronic_structure structure
  const sss = rawOutput.specific_synchronic_structure;

  if (sss.representation_type !== 'Semantic Network') {
    throw new Error('P2S_3 specific_synchronic_structure.representation_type must be "Semantic Network"');
  }

  if (!sss.description) {
    throw new Error('P2S_3 specific_synchronic_structure missing required field: description');
  }

  if (!Array.isArray(sss.network_nodes)) {
    throw new Error('P2S_3 specific_synchronic_structure.network_nodes must be an array');
  }

  if (!Array.isArray(sss.network_links)) {
    throw new Error('P2S_3 specific_synchronic_structure.network_links must be an array');
  }

  // Validate network_nodes structure
  for (let i = 0; i < sss.network_nodes.length; i++) {
    const node = sss.network_nodes[i];
    
    if (!node.id) {
      throw new Error(`P2S_3 network_nodes[${i}] missing required field: id`);
    }

    if (!node.label) {
      throw new Error(`P2S_3 network_nodes[${i}] missing required field: label`);
    }

    if (!node.source_isu_id) {
      throw new Error(`P2S_3 network_nodes[${i}] missing required field: source_isu_id`);
    }
  }

  // Validate network_links structure
  for (let i = 0; i < sss.network_links.length; i++) {
    const link = sss.network_links[i];
    
    if (!link.from) {
      throw new Error(`P2S_3 network_links[${i}] missing required field: from`);
    }

    if (!link.to) {
      throw new Error(`P2S_3 network_links[${i}] missing required field: to`);
    }

    if (!link.type) {
      throw new Error(`P2S_3 network_links[${i}] missing required field: type`);
    }
  }

  // Validate that link references point to existing nodes
  const nodeIds = new Set(sss.network_nodes.map((node: any) => node.id));
  for (let i = 0; i < sss.network_links.length; i++) {
    const link = sss.network_links[i];
    
    if (!nodeIds.has(link.from)) {
      throw new Error(`P2S_3 network_links[${i}].from '${link.from}' references non-existent node`);
    }

    if (!nodeIds.has(link.to)) {
      throw new Error(`P2S_3 network_links[${i}].to '${link.to}' references non-existent node`);
    }
  }

  // Return validated and structured output (matches prototype structure)
  const validatedOutput: P2S_3_Output = {
    transcript_id: rawOutput.transcript_id,
    analyzed_diachronic_unit: rawOutput.analyzed_diachronic_unit,
    specific_synchronic_structure: {
      representation_type: 'Semantic Network',
      description: sss.description,
      network_nodes: sss.network_nodes.map((node: any) => ({
        id: node.id,
        label: node.label,
        source_isu_id: node.source_isu_id,
      })),
      network_links: sss.network_links.map((link: any) => ({
        from: link.from,
        to: link.to,
        type: link.type,
      })),
    },
    independent_variable_details: rawOutput.independent_variable_details,
    dependent_variable_focus: rawOutput.dependent_variable_focus,
  };

  console.log(`[P2S_3 parseOutput] Successfully validated output with ${validatedOutput.specific_synchronic_structure.network_nodes.length} nodes and ${validatedOutput.specific_synchronic_structure.network_links.length} links`);

  return validatedOutput;
};