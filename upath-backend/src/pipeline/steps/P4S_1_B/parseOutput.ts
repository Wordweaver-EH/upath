/**
 * P4S_1_B Define GSS from Groups - Output Parsing
 * Exactly matches the working prototype's parseOutput behavior
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P4S_1_B_Output, GenericSynchronicStructure, P4S_1_GenericNode, P4S_1_GenericLink, P4S_1_InstantiationNote } from './types';

/**
 * Parse and validate output for P4S_1_B step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: any): P4S_1_B_Output => {
  console.log(`[P4S_1_B parseOutput] Parsing raw output:`, rawOutput);

  // Validation: Check required fields (matches prototype validation)
  if (!rawOutput.analyzed_gdu) {
    throw new Error('P4S_1_B output missing required field: analyzed_gdu');
  }

  if (!rawOutput.generic_synchronic_structure) {
    throw new Error('P4S_1_B output missing required field: generic_synchronic_structure');
  }

  if (!Array.isArray(rawOutput.dependent_variable_focus)) {
    throw new Error('P4S_1_B output field dependent_variable_focus must be an array');
  }

  // Validate Generic Synchronic Structure (matches prototype GSS validation)
  const gss = rawOutput.generic_synchronic_structure;

  if (!gss.representation_type) {
    throw new Error('P4S_1_B generic_synchronic_structure missing required field: representation_type');
  }

  if (!gss.description) {
    throw new Error('P4S_1_B generic_synchronic_structure missing required field: description');
  }

  if (!Array.isArray(gss.generic_nodes_categories)) {
    throw new Error('P4S_1_B generic_synchronic_structure field generic_nodes_categories must be an array');
  }

  if (!Array.isArray(gss.generic_network_links)) {
    throw new Error('P4S_1_B generic_synchronic_structure field generic_network_links must be an array');
  }

  // Validate generic nodes categories
  const validatedGenericNodes: P4S_1_GenericNode[] = [];
  const nodeIds = new Set<string>();

  for (let i = 0; i < gss.generic_nodes_categories.length; i++) {
    const node = gss.generic_nodes_categories[i];

    if (!node.id) {
      throw new Error(`P4S_1_B generic_nodes_categories at index ${i} missing required field: id`);
    }

    if (!node.label) {
      throw new Error(`P4S_1_B generic_nodes_categories at index ${i} missing required field: label`);
    }

    if (nodeIds.has(node.id)) {
      throw new Error(`P4S_1_B generic_nodes_categories contains duplicate id: ${node.id}`);
    }

    nodeIds.add(node.id);
    validatedGenericNodes.push({
      id: node.id,
      label: node.label,
    });
  }

  // Validate generic network links
  const validatedGenericLinks: P4S_1_GenericLink[] = [];

  for (let i = 0; i < gss.generic_network_links.length; i++) {
    const link = gss.generic_network_links[i];

    if (!link.from) {
      throw new Error(`P4S_1_B generic_network_links at index ${i} missing required field: from`);
    }

    if (!link.to) {
      throw new Error(`P4S_1_B generic_network_links at index ${i} missing required field: to`);
    }

    if (!link.type) {
      throw new Error(`P4S_1_B generic_network_links at index ${i} missing required field: type`);
    }

    // Validate that link references exist in nodes
    if (!nodeIds.has(link.from)) {
      throw new Error(`P4S_1_B generic_network_links at index ${i} references non-existent node: ${link.from}`);
    }

    if (!nodeIds.has(link.to)) {
      throw new Error(`P4S_1_B generic_network_links at index ${i} references non-existent node: ${link.to}`);
    }

    validatedGenericLinks.push({
      from: link.from,
      to: link.to,
      type: link.type,
    });
  }

  // Validate instantiation notes (mandatory for traceability)
  const validatedInstantiationNotes: P4S_1_InstantiationNote[] = [];

  if (gss.instantiation_notes && Array.isArray(gss.instantiation_notes)) {
    for (let i = 0; i < gss.instantiation_notes.length; i++) {
      const note = gss.instantiation_notes[i];

      if (!note.generic_category_id) {
        throw new Error(`P4S_1_B instantiation_notes at index ${i} missing required field: generic_category_id`);
      }

      if (!note.textual_description) {
        throw new Error(`P4S_1_B instantiation_notes at index ${i} missing required field: textual_description`);
      }

      if (!Array.isArray(note.example_specific_nodes)) {
        throw new Error(`P4S_1_B instantiation_notes at index ${i} field example_specific_nodes must be an array`);
      }

      if (note.example_specific_nodes.length === 0) {
        throw new Error(`P4S_1_B instantiation_notes at index ${i} example_specific_nodes cannot be empty (required for traceability)`);
      }

      // Validate that instantiation note references an existing generic category
      if (!nodeIds.has(note.generic_category_id)) {
        throw new Error(`P4S_1_B instantiation_notes at index ${i} references non-existent generic_category_id: ${note.generic_category_id}`);
      }

      // Validate example specific nodes
      for (let j = 0; j < note.example_specific_nodes.length; j++) {
        const exampleNode = note.example_specific_nodes[j];

        if (!exampleNode.transcript_id) {
          throw new Error(`P4S_1_B instantiation_notes[${i}].example_specific_nodes[${j}] missing required field: transcript_id`);
        }

        if (!exampleNode.sss_node_id) {
          throw new Error(`P4S_1_B instantiation_notes[${i}].example_specific_nodes[${j}] missing required field: sss_node_id`);
        }

        if (!exampleNode.phase_name) {
          throw new Error(`P4S_1_B instantiation_notes[${i}].example_specific_nodes[${j}] missing required field: phase_name`);
        }
      }

      validatedInstantiationNotes.push({
        generic_category_id: note.generic_category_id,
        textual_description: note.textual_description,
        example_specific_nodes: note.example_specific_nodes.map((node: any) => ({
          transcript_id: node.transcript_id,
          sss_node_id: node.sss_node_id,
          phase_name: node.phase_name,
        })),
      });
    }
  }

  // Create validated Generic Synchronic Structure
  const validatedGss: GenericSynchronicStructure = {
    representation_type: gss.representation_type,
    description: gss.description,
    generic_nodes_categories: validatedGenericNodes,
    generic_network_links: validatedGenericLinks,
  };

  // Include instantiation notes if present
  if (validatedInstantiationNotes.length > 0) {
    validatedGss.instantiation_notes = validatedInstantiationNotes;
  }

  // Return validated and structured output (matches prototype structure)
  const validatedOutput: P4S_1_B_Output = {
    analyzed_gdu: rawOutput.analyzed_gdu,
    generic_synchronic_structure: validatedGss,
    dependent_variable_focus: rawOutput.dependent_variable_focus,
  };

  // Include optional variations_notes if present
  if (rawOutput.variations_notes) {
    validatedOutput.variations_notes = rawOutput.variations_notes;
  }

  console.log(`[P4S_1_B parseOutput] Successfully validated output with ${validatedGenericNodes.length} generic categories and ${validatedGenericLinks.length} links for GDU ${rawOutput.analyzed_gdu}`);

  return validatedOutput;
};