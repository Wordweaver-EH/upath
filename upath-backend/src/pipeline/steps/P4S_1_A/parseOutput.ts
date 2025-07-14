/**
 * P4S_1_A Identify and Group SSS Nodes - Output Parsing
 * Exactly matches the working prototype's parseOutput behavior
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P4S_1_A_Output, GroupedSssNode } from './types';

/**
 * Parse and validate output for P4S_1_A step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: any): P4S_1_A_Output => {
  console.log(`[P4S_1_A parseOutput] Parsing raw output:`, rawOutput);

  // Validation: Check required fields (matches prototype validation)
  if (!rawOutput.analyzed_gdu) {
    throw new Error('P4S_1_A output missing required field: analyzed_gdu');
  }

  if (!Array.isArray(rawOutput.grouped_data)) {
    throw new Error('P4S_1_A output missing required field: grouped_data (must be array)');
  }

  if (rawOutput.grouped_data.length === 0) {
    throw new Error('P4S_1_A output grouped_data cannot be empty');
  }

  // Validate each grouped SSS node structure (matches prototype validation)
  const validatedGroupedData: GroupedSssNode[] = [];

  for (let i = 0; i < rawOutput.grouped_data.length; i++) {
    const groupedNode = rawOutput.grouped_data[i];

    // Validate required fields for each grouped node
    if (!groupedNode.sss_node_id) {
      throw new Error(`P4S_1_A grouped_data at index ${i} missing required field: sss_node_id`);
    }

    if (!groupedNode.transcript_id) {
      throw new Error(`P4S_1_A grouped_data at index ${i} missing required field: transcript_id`);
    }

    if (!groupedNode.phase_name) {
      throw new Error(`P4S_1_A grouped_data at index ${i} missing required field: phase_name`);
    }

    if (!groupedNode.sss_node_label) {
      throw new Error(`P4S_1_A grouped_data at index ${i} missing required field: sss_node_label`);
    }

    if (!groupedNode.group_id) {
      throw new Error(`P4S_1_A grouped_data at index ${i} missing required field: group_id`);
    }

    if (!groupedNode.group_rationale) {
      throw new Error(`P4S_1_A grouped_data at index ${i} missing required field: group_rationale`);
    }

    // Create validated grouped node
    const validatedGroupedNode: GroupedSssNode = {
      sss_node_id: groupedNode.sss_node_id,
      transcript_id: groupedNode.transcript_id,
      phase_name: groupedNode.phase_name,
      sss_node_label: groupedNode.sss_node_label,
      group_id: groupedNode.group_id,
      group_rationale: groupedNode.group_rationale,
    };

    validatedGroupedData.push(validatedGroupedNode);
  }

  // Check for duplicate sss_node_id entries (matches prototype validation)
  const sssNodeIds = new Set<string>();
  for (const groupedNode of validatedGroupedData) {
    if (sssNodeIds.has(groupedNode.sss_node_id)) {
      throw new Error(`P4S_1_A output contains duplicate sss_node_id: ${groupedNode.sss_node_id}`);
    }
    sssNodeIds.add(groupedNode.sss_node_id);
  }

  // Return validated and structured output (matches prototype structure)
  const validatedOutput: P4S_1_A_Output = {
    analyzed_gdu: rawOutput.analyzed_gdu,
    grouped_data: validatedGroupedData,
  };

  // Include optional classification_notes if present
  if (rawOutput.classification_notes) {
    validatedOutput.classification_notes = rawOutput.classification_notes;
  }

  console.log(`[P4S_1_A parseOutput] Successfully validated output with ${validatedGroupedData.length} grouped SSS nodes for GDU ${rawOutput.analyzed_gdu}`);

  return validatedOutput;
};