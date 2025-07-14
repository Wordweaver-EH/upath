/**
 * P4S_1_A Identify and Group SSS Nodes - Input Preparation
 * Exactly matches the working prototype's getInput function
 */

import { StepInputParams, StepInputResult } from '../../core/interfaces';
import { P4S_1_A_Input, SssNodeMetadata } from './types';

/**
 * Helper function to check if an ISU node is grounded in utterances
 * Exactly matches the working prototype's isNodeGrounded logic
 */
function isNodeGrounded(sourceIsuId: string, isuHierarchy: any): boolean {
  // Find the ISU in the hierarchy
  const findIsu = (units: any[], targetId: string): any => {
    for (const unit of units) {
      if (unit.isu_id === targetId) {
        return unit;
      }
      if (unit.constituent_units && unit.constituent_units.length > 0) {
        const found = findIsu(unit.constituent_units, targetId);
        if (found) return found;
      }
    }
    return null;
  };

  const isuNode = findIsu(isuHierarchy.specific_synchronic_units_hierarchy, sourceIsuId);
  if (!isuNode) {
    return false; // ISU not found, not grounded
  }

  // Check if this ISU has direct utterances
  if (isuNode.utterances && isuNode.utterances.length > 0) {
    return true;
  }

  // If no direct utterances, recursively check constituent units
  if (isuNode.constituent_units && isuNode.constituent_units.length > 0) {
    return isuNode.constituent_units.some((constituent: any) => 
      isNodeGrounded(constituent.isu_id, isuHierarchy)
    );
  }

  return false; // No utterances and no constituent units
}

/**
 * Helper function to generate TSV string from SSS node metadata
 * Exactly matches the working prototype's TSV generation logic
 */
function generateNodesTsv(sssNodes: SssNodeMetadata[]): string {
  const headers = ['transcript_id', 'phase_name', 'sss_node_id', 'sss_node_label', 'isu_definition'];
  const rows = [headers.join('\t')];
  
  for (const node of sssNodes) {
    const row = [
      node.transcript_id,
      node.phase_name,
      node.sss_node_id,
      node.sss_node_label,
      node.isu_definition
    ];
    rows.push(row.join('\t'));
  }
  
  return rows.join('\n');
}

/**
 * Helper function to generate Mermaid syntax for grounded SSS structures
 * Exactly matches the working prototype's Mermaid generation logic
 */
function generateStructuresMermaid(sssNodes: SssNodeMetadata[], processedData: Map<string, any>): string {
  const mermaidLines = ['graph TD'];
  const addedNodes = new Set<string>();
  
  // Group nodes by transcript and phase
  const nodesByTranscriptPhase = new Map<string, SssNodeMetadata[]>();
  for (const node of sssNodes) {
    const key = `${node.transcript_id}:${node.phase_name}`;
    if (!nodesByTranscriptPhase.has(key)) {
      nodesByTranscriptPhase.set(key, []);
    }
    nodesByTranscriptPhase.get(key)!.push(node);
  }
  
  // Generate Mermaid syntax for each transcript-phase group
  for (const [transcriptPhaseKey, nodes] of nodesByTranscriptPhase) {
    const [transcriptId, phaseName] = transcriptPhaseKey.split(':');
    
    // Add subgraph for this transcript-phase
    const subgraphId = `${transcriptId}_${phaseName}`.replace(/[^a-zA-Z0-9]/g, '_');
    mermaidLines.push(`  subgraph ${subgraphId}["${transcriptId} - ${phaseName}"]`);
    
    // Add nodes
    for (const node of nodes) {
      const nodeId = node.sss_node_id.replace(/[^a-zA-Z0-9]/g, '_');
      mermaidLines.push(`    ${nodeId}["${node.sss_node_label}"]`);
      addedNodes.add(nodeId);
    }
    
    // Add links between nodes (if available from P2S_3 output)
    const transcriptData = processedData.get(transcriptId);
    if (transcriptData?.p2s_3_output) {
      const sssStructure = transcriptData.p2s_3_output.specific_synchronic_structure;
      if (sssStructure?.links) {
        for (const link of sssStructure.links) {
          const sourceId = link.source_node_id?.replace(/[^a-zA-Z0-9]/g, '_');
          const targetId = link.target_node_id?.replace(/[^a-zA-Z0-9]/g, '_');
          
          // Only add links between grounded nodes in this phase
          if (sourceId && targetId && addedNodes.has(sourceId) && addedNodes.has(targetId)) {
            mermaidLines.push(`    ${sourceId} --> ${targetId}`);
          }
        }
      }
    }
    
    mermaidLines.push('  end');
  }
  
  return mermaidLines.join('\n');
}

/**
 * Prepare input data for P4S_1_A step
 * Exactly matches the working prototype's getInput logic
 */
export function getInput(params: StepInputParams): StepInputResult {
  const { processedData, userDvFocus, apiKeyPresent, genericState, currentGduId } = params;

  // Debug logging (matches prototype pattern)
  console.log(`[P4S_1_A getInput] Processing ${processedData.size} transcripts`);
  console.log(`[P4S_1_A getInput] API key present:`, apiKeyPresent);
  console.log(`[P4S_1_A getInput] User DV focus:`, userDvFocus);
  console.log(`[P4S_1_A getInput] Current GDU ID:`, currentGduId);
  console.log(`[P4S_1_A getInput] Generic state keys:`, Object.keys(genericState || {}));

  // Validation (exactly matches prototype logic)
  if (!apiKeyPresent) {
    console.error(`[P4S_1_A getInput] Validation failed - API key not present`);
    return { 
      data: null, 
      error: "API key required for P4S.1A analysis." 
    };
  }

  if (!processedData || processedData.size === 0) {
    console.error(`[P4S_1_A getInput] Validation failed - no processed data available`);
    return { 
      data: null, 
      error: "No processed transcript data available for P4S.1A." 
    };
  }

  // Check for current GDU to analyze
  if (!currentGduId) {
    console.error(`[P4S_1_A getInput] Validation failed - no current GDU specified`);
    return { 
      data: null, 
      error: "No current GDU specified for P4S.1A analysis." 
    };
  }

  // Check for P3.2 output to get GDU definition
  if (!genericState?.p3_2_output?.identified_gdus) {
    console.error(`[P4S_1_A getInput] Validation failed - P3.2 output not available`);
    return { 
      data: null, 
      error: "P3.2 output required for P4S.1A analysis. Please run P3.2 first." 
    };
  }

  // Find the current GDU definition
  const currentGdu = genericState.p3_2_output.identified_gdus.find(
    (gdu: any) => gdu.gdu_id === currentGduId
  );

  if (!currentGdu) {
    console.error(`[P4S_1_A getInput] Validation failed - GDU ${currentGduId} not found in P3.2 output`);
    return { 
      data: null, 
      error: `GDU ${currentGduId} not found in P3.2 output.` 
    };
  }

  // Collect all relevant SSS nodes for this GDU
  const relevantSssNodes: SssNodeMetadata[] = [];
  const transcriptIds = new Set<string>();

  // Iterate through all transcripts to find SSS nodes related to this GDU
  for (const [transcriptId, transcriptData] of processedData) {
    const p2s_3_output = transcriptData.p2s_3_output;
    const p2s_2_output = transcriptData.p2s_2_output;
    const p1_3_output = transcriptData.p1_3_output;

    if (!p2s_3_output || !p2s_2_output || !p1_3_output) {
      console.warn(`[P4S_1_A getInput] Missing required outputs for transcript ${transcriptId}`);
      continue;
    }

    // Check if this transcript has refined DUs that contribute to the current GDU
    const hasContributingRdus = currentGdu.contributing_refined_du_ids.some(
      (contribution: any) => contribution.transcript_id === transcriptId
    );

    if (!hasContributingRdus) {
      console.log(`[P4S_1_A getInput] Transcript ${transcriptId} has no RDUs contributing to GDU ${currentGduId}`);
      continue;
    }

    // Process each phase's SSS output for this transcript
    if (p2s_3_output.phase_synchronic_structures) {
      for (const phaseStructure of p2s_3_output.phase_synchronic_structures) {
        const phaseName = phaseStructure.phase_name;
        const sssStructure = phaseStructure.specific_synchronic_structure;

        if (sssStructure?.nodes) {
          for (const sssNode of sssStructure.nodes) {
            // Check if this SSS node is grounded in utterances
            const isGrounded = isNodeGrounded(sssNode.source_isu_id, p2s_2_output);

            if (isGrounded) {
              relevantSssNodes.push({
                transcript_id: transcriptId,
                phase_name: phaseName,
                sss_node_id: sssNode.node_id,
                sss_node_label: sssNode.label,
                isu_definition: sssNode.semantic_definition || '',
                isGrounded: true
              });
              transcriptIds.add(transcriptId);
            }
          }
        }
      }
    }
  }

  // Validation: Must have grounded SSS nodes
  if (relevantSssNodes.length === 0) {
    console.error(`[P4S_1_A getInput] No grounded SSS nodes found for GDU ${currentGduId}`);
    return { 
      data: null, 
      error: `No grounded SSS nodes found for GDU ${currentGduId}.` 
    };
  }

  // Validation: Must have sufficient transcript diversity (at least 2 transcripts)
  if (transcriptIds.size < 2) {
    console.error(`[P4S_1_A getInput] Insufficient transcript diversity for GDU ${currentGduId}: only ${transcriptIds.size} transcript(s)`);
    return { 
      data: null, 
      error: `Insufficient transcript diversity for Generic Synchronic Analysis of GDU ${currentGduId}. Need at least 2 transcripts, found ${transcriptIds.size}.` 
    };
  }

  // Generate TSV and Mermaid syntax
  const nodesTsv = generateNodesTsv(relevantSssNodes);
  const structuresMermaid = generateStructuresMermaid(relevantSssNodes, processedData);

  // Prepare input data (exactly matches prototype structure)
  const inputData: P4S_1_A_Input = {
    gdu_to_analyze_id: currentGduId,
    gdu_definition: currentGdu.definition,
    nodes_tsv: nodesTsv,
    structures_mermaid: structuresMermaid,
    global_dv_focus: userDvFocus?.dv_focus || [],
  };

  console.log(`[P4S_1_A getInput] Successfully prepared input with ${relevantSssNodes.length} grounded SSS nodes from ${transcriptIds.size} transcripts for GDU ${currentGduId}`);

  return {
    data: inputData,
  };
}