import {
    SynchronicStructureType,
    SynchronicStructureP2S,
    SynchronicStructureP4S,
    SpecificDiachronicStructureType,
    GenericDiachronicStructureDefinition,
    P2S_3_NetworkNode,
    P4S_1_GenericNode,
    P7_3_DagEdge, // Corrected from P7_2_DagEdge
    P7_3_DagNode, // Corrected from P7_2_DagNode
    P7_3_Output  // To use for final_dag type
} from '../types';


function isP2SStructure(structure: SynchronicStructureType): structure is SynchronicStructureP2S {
    return 'network_nodes' in structure && 'network_links' in structure;
}

function isP4SStructure(structure: SynchronicStructureType): structure is SynchronicStructureP4S {
    return 'generic_nodes_categories' in structure && 'generic_network_links' in structure;
}

// Sanitize node IDs for Mermaid syntax
const sanitizeMermaidId = (id: string, prefix: string = 'id_'): string => {
    if (typeof id !== 'string' || id.trim() === "") {
        return `${prefix}empty_${Math.random().toString(36).substring(2, 7)}`;
    }
    // More restrictive: only allow alphanumeric and underscore, remove others.
    let sanitized = id.replace(/[^a-zA-Z0-9_]/g, '_');

    // Ensure it starts with a letter or the provided prefix if it doesn't already.
    if (!/^[a-zA-Z_]/.test(sanitized)) {
        sanitized = prefix + sanitized;
    } else if (/^[0-9_]+$/.test(sanitized)) { // If it's purely numeric/underscores after initial alpha/_, still prefix
        sanitized = prefix + sanitized;
    }

    return sanitized.substring(0, 60); // Max length for IDs
};

// Sanitize labels for Mermaid syntax
const sanitizeMermaidLabel = (label: string, maxLength: number = 50): string => {
    if (typeof label !== 'string' || label.trim() === "") {
        return '" "'; // Return a quoted space for empty labels
    }

    let truncedLabel = label.length > maxLength ? label.substring(0, maxLength - 3) + "..." : label;

    const escapedLabel = truncedLabel
        .replace(/"/g, '#quot;')
        .replace(/`/g, '#grave;')
        .replace(/\n/g, ' ')
        .replace(/[^\w\s#&;().,-/:@!?%+*=]/g, '');

    return `"${escapedLabel.trim() || ' '}"`;
};


export function transformSynchronicToMermaid(
    structure?: SynchronicStructureType,
    dynamicTitleHint?: string
): string {
  if (!structure) return `graph TD;\n  error_no_data[${sanitizeMermaidLabel("Error: No synchronic structure data provided")}];`;

  let mermaidSyntax = "graph TD;\n";

  const nodes: Array<P2S_3_NetworkNode | P4S_1_GenericNode> = [];
  const links: Array<any> = [];

  let subgraphTitleText: string;
  if (dynamicTitleHint && dynamicTitleHint.trim() !== "") {
    subgraphTitleText = `Details for: ${dynamicTitleHint}`;
  } else if (structure.description && structure.description.trim() !== "") {
    subgraphTitleText = `Details for: ${structure.description}`;
  } else {
    subgraphTitleText = "Structure Details";
  }

  const safeSubgraphTitle = sanitizeMermaidId(subgraphTitleText.substring(0, 60), 'subgraph_title_');

  mermaidSyntax += `    subgraph ${safeSubgraphTitle}\n`;

    if (isP2SStructure(structure)) {
        if (!structure.network_nodes || !structure.network_links) {
            mermaidSyntax += `        error_malformed_p2s[${sanitizeMermaidLabel("Error: Malformed Specific Synchronic Structure - Missing nodes or links.")}];\n`;
            mermaidSyntax += "    end\n";
            return mermaidSyntax;
        }
        nodes.push(...structure.network_nodes);
        links.push(...structure.network_links);
    } else if (isP4SStructure(structure)) {
        if (!structure.generic_nodes_categories || !structure.generic_network_links) {
            mermaidSyntax += `        error_malformed_p4s[${sanitizeMermaidLabel("Error: Malformed Generic Synchronic Structure - Missing categories or links.")}];\n`;
            mermaidSyntax += "    end\n";
            return mermaidSyntax;
        }
        nodes.push(...structure.generic_nodes_categories);
        links.push(...structure.generic_network_links);
    } else {
        mermaidSyntax += `        error_unknown_type[${sanitizeMermaidLabel("Error: Unknown or incomplete synchronic structure type provided.")}];\n`;
        mermaidSyntax += "    end\n";
        return mermaidSyntax;
    }

    if (nodes.length === 0) {
        mermaidSyntax += `        empty_state[${sanitizeMermaidLabel("No nodes in this structure")}];\n`;
    } else {
        const existingNodeIds = new Set<string>();
        nodes.forEach((node, idx) => {
            const originalNodeId = node.id || `s_node_${idx}`;
            const nodeId = sanitizeMermaidId(originalNodeId, 's_node_');
            existingNodeIds.add(nodeId);

            const nodeLabelText = node.label || `Unit ${idx + 1}`;
            const nodeLabel = sanitizeMermaidLabel(nodeLabelText, 70);
            mermaidSyntax += `        ${nodeId}[${nodeLabel}];\n`;
        });

        links.forEach((link, idx) => {
            const originalSourceId = link.from || `s_link_source_${idx}`;
            const originalTargetId = link.to || `s_link_target_${idx}`;
            const sourceId = sanitizeMermaidId(originalSourceId, 's_node_');
            const targetId = sanitizeMermaidId(originalTargetId, 's_node_');

            const linkTypeText = link.type || `relation_${idx}`;
            const linkTypeLabel = sanitizeMermaidLabel(linkTypeText, 40);

            if (existingNodeIds.has(sourceId) && existingNodeIds.has(targetId)) {
                mermaidSyntax += `        ${sourceId} -->|${linkTypeLabel}| ${targetId};\n`;
            } else {
                const warningMsg = `Mermaid transform: Skipping link. Invalid/missing node. Original From: "${originalSourceId}" (Sanitized: "${sourceId}"), Original To: "${originalTargetId}" (Sanitized: "${targetId}"). Link type: "${linkTypeText}"`;
                console.warn(warningMsg);
                mermaidSyntax += `        %% ${warningMsg.replace(/\n/g, ' ')}\n`;
            }
        });
    }
    mermaidSyntax += "    end\n";

  return mermaidSyntax;
}


export function transformDiachronicToMermaid(structure?: SpecificDiachronicStructureType): string {
  if (!structure || !structure.phases || structure.phases.length === 0) {
    return `gantt
dateFormat X
title Specific Diachronic Structure (No Phases)
axisFormat %s

section Empty
Empty Phase :empty_phase, 0, 1d`;
  }
  const titleText = structure.summary ? `SDS: ${structure.summary}` : 'Specific Diachronic Experience';
  const safeTitle = sanitizeMermaidLabel(titleText.substring(0, 70) + (titleText.length > 70 ? "..." : "")).slice(1,-1);

  let mermaidSyntax = `gantt
dateFormat X
title ${safeTitle}
axisFormat %s\n\n`;

  mermaidSyntax += `section Phases\n`;
  structure.phases.forEach((phase, index) => {
    const duration = Math.max(1, phase.units_involved?.length || 1);
    const phaseId = sanitizeMermaidId(phase.phase_name || `phase_${index}`, `ph_`);
    const phaseLabelText = phase.phase_name || `Phase ${index + 1}`;
    const safePhaseLabel = phaseLabelText.replace(/:/g, '-').replace(/,/g, '');

    mermaidSyntax += `${safePhaseLabel} :${phaseId}, ${index}, ${duration}d\n`;
  });
  return mermaidSyntax;
}

export function transformGenericDiachronicToMermaid(gdsDefinition?: GenericDiachronicStructureDefinition): string {
  if (!gdsDefinition || (!gdsDefinition.core_gdus || gdsDefinition.core_gdus.length === 0) && (!gdsDefinition.typical_sequence || gdsDefinition.typical_sequence.length === 0) ) {
    return `gantt
dateFormat X
title Generic Diachronic Structure (No Definition)
axisFormat %s

section Empty
No GDS Data :empty_gds, 0, 1d`;
  }

  const titleText = gdsDefinition.name ? `GDS: ${gdsDefinition.name}` : 'Generic Diachronic Structure';
  const safeTitle = sanitizeMermaidLabel(titleText.substring(0, 70) + (titleText.length > 70 ? "..." : "")).slice(1,-1);


  let mermaidSyntax = `gantt
dateFormat X
title ${safeTitle}
axisFormat %s\n\n`;

  const gdusToDisplay: string[] = gdsDefinition.typical_sequence && gdsDefinition.typical_sequence.length > 0
                               ? gdsDefinition.typical_sequence
                               : gdsDefinition.core_gdus || [];

  if (gdusToDisplay.length === 0) {
    mermaidSyntax += `section GDUs\nNo Core GDUs/Sequence :no_gdus, 0, 1d\n`;
    return mermaidSyntax;
  }

  mermaidSyntax += `section ${gdsDefinition.typical_sequence && gdsDefinition.typical_sequence.length > 0 ? 'Typical Sequence' : 'Core GDUs'}\n`;
  gdusToDisplay.forEach((gduId, index) => {
    const duration = 1;
    const gduLabelText = String(gduId); // Ensure gduLabelText is a string
    const safeGduLabel = gduLabelText.replace(/:/g, '-').replace(/,/g, '');
    const gduMermaidId = sanitizeMermaidId(gduId, 'gdu_');
    mermaidSyntax += `${safeGduLabel} :${gduMermaidId}, ${index}, ${duration}d\n`;
  });

  return mermaidSyntax;
}

export function transformDagToMermaid(dagData?: P7_3_Output['final_dag']): string {
    if (!dagData || !dagData.nodes || !dagData.edges) {
    return `graph TD;\n  error_no_data[${sanitizeMermaidLabel("Error: No DAG data provided")}];`;
    }

  let mermaidSyntax = "graph TD;\n";
  const existingNodeIds = new Set<string>();

  // First pass: Add all nodes
  dagData.nodes.forEach((node, idx) => {
    const nodeId = sanitizeMermaidId(node.id || `node_${idx}`, 'node_');
    existingNodeIds.add(nodeId);

    const nodeLabelText = node.label || `Variable ${idx + 1}`;
    const nodeLabel = sanitizeMermaidLabel(nodeLabelText, 70);

    // Check if this is a composite variable (contains "_Cluster" or "_Complex" in the label)
    if (nodeLabelText.includes('_Cluster') || nodeLabelText.includes('_Complex')) {
      mermaidSyntax += `    subgraph ${nodeId}_group[${nodeLabel}]\n`;
      mermaidSyntax += `        ${nodeId}[${nodeLabel}];\n`;
      mermaidSyntax += `    end\n`;
    } else {
      mermaidSyntax += `    ${nodeId}[${nodeLabel}];\n`;
    }
    });

  // Second pass: Add all edges
  dagData.edges.forEach((edge, idx) => {
    const sourceId = sanitizeMermaidId(edge.source, 'node_');
    const targetId = sanitizeMermaidId(edge.target, 'node_');

    // Check if either node is time-indexed (contains "_t1" or "_t2" in the ID)
    const isTimeIndexed = edge.source.includes('_t') || edge.target.includes('_t');
    const edgeStyle = isTimeIndexed ? '==>' : '-->';

    if (existingNodeIds.has(sourceId) && existingNodeIds.has(targetId)) {
      const edgeLabel = edge.rationale ? sanitizeMermaidLabel(edge.rationale, 40) : '';
      mermaidSyntax += `    ${sourceId} ${edgeStyle}|${edgeLabel}| ${targetId};\n`;
    } else {
      const warningMsg = `Mermaid transform: Skipping edge. Invalid/missing node. From: "${edge.source}" (Sanitized: "${sourceId}"), To: "${edge.target}" (Sanitized: "${targetId}")`;
      console.warn(warningMsg);
      mermaidSyntax += `    %% ${warningMsg.replace(/\n/g, ' ')}\n`;
    }
    });

    return mermaidSyntax;
}
