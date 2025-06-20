
import { 
    P5_1_Output, 
    P3_2_Output, 
    P3_3_Output,
    P4S_1_Output,
    P7_1_Output, 
    P7_3b_Output, 
    P7_5_Output,
    GenericDiachronicStructureDefinition,
    P7_1_CandidateVariable,
    P7_3b_ResolutionAction,
    P7_5_FormalHypothesis,
    RawTranscript
} from '../types';
import { calculateGduUtteranceCounts, calculateGssCategoryUtteranceCounts, calculateGduTransitionCounts } from './htmlHelper'; // Assuming these are correctly typed for inputs

// Define the expected input structure for the report generator
// This should match the 'data' field of the getInput result for P6_1
export interface ReportData {
    p5_output: P5_1_Output;
    p3_2_output: P3_2_Output;
    p3_3_output: P3_3_Output;
    p4s_outputs_by_gdu?: Record<string, P4S_1_Output | undefined>;
    p7_1_output: P7_1_Output;
    p7_3_output?: any; // Keep for reference if needed, though p7_3b is primary for cleaned DAG
    p7_3b_output?: P7_3b_Output; // Optional: P7.3 might be used if P7.3b is not available/successful
    p7_5_output: P7_5_Output;
    p7_3_or_3b_dag_output_for_stats: any; // P7_3_Output or P7_3b_Output
    all_mermaid_syntaxes: Record<string, string>; // This will still contain all syntaxes
    transcripts_analyzed_summary: Array<{
        filename: string;
        iv_details: string;
        num_diachronic_phases: number;
        num_core_gdus_related: number;
    }>;
    num_gss_inputs: number;
    gds_name: string;
    gds_definition: GenericDiachronicStructureDefinition;
    gss_structure_example_by_gdu?: Record<string, P4S_1_Output['generic_synchronic_structure'] | undefined>;
    user_dv_focus: string[];
    // The following will be used by HTML appendix, report will just mention their availability
    gdu_utterance_counts: ReturnType<typeof calculateGduUtteranceCounts>;
    gss_category_utterance_counts: ReturnType<typeof calculateGssCategoryUtteranceCounts>;
    gdu_transition_counts: ReturnType<typeof calculateGduTransitionCounts>;
    raw_transcripts: RawTranscript[];
}

function escapeMarkdown(text: string | number | undefined | null): string {
    if (text === undefined || text === null) return '';
    const strText = String(text);
    return strText.replace(/([\\`*_{}[\]()#+.!|])/g, '\\$1');
}

function renderMermaidMarkdown(title: string, syntax: string | undefined, diagramId: string): string {
    if (!syntax || syntax.trim() === '') {
        return `\n*Mermaid diagram for "${escapeMarkdown(title)}" not available or empty.*\n`;
    }
    // Ensure the syntax is clean and doesn't break Markdown code blocks
    const cleanedSyntax = syntax.replace(/`/g, "'"); // Replace backticks if any
    return `
### ${escapeMarkdown(title)}
\`\`\`mermaid
${cleanedSyntax}
\`\`\`
`;
}

function renderMarkdownTable(headers: string[], rows: (string | number | undefined | null)[][]): string {
    let table = `| ${headers.map(h => escapeMarkdown(h)).join(' | ')} |\n`;
    table += `| ${headers.map(() => '---').join(' | ')} |\n`;
    rows.forEach(row => {
        table += `| ${row.map(cell => escapeMarkdown(cell)).join(' | ')} |\n`;
    });
    return table + '\n';
}

export function generateMarkdownReportProgrammatically(input: ReportData): string {
    let md = `# µ-PATH Analysis Report\n\n`;
    md += `**Date:** ${new Date().toISOString().slice(0, 10)}\n`;
    md += `**Analysis Version:** Programmatic v1.1 (Report Refactor)\n\n`;

    // Section 2: Introduction
    md += `## 1. Introduction\n`;
    md += `This report summarizes the findings from the µ-PATH analysis pipeline.\n`;
    md += `- **Purpose:** To systematically analyze micro-phenomenological interview transcripts to identify common experiential structures and potential causal relationships.\n`;
    md += `- **Method Overview:** The analysis involved several stages: data preparation, specific diachronic and synchronic analysis per transcript, derivation of generic diachronic and synchronic structures, holistic refinement, and causal modeling.\n`;
    md += `- **Dependent Variable Focus:** The analysis was guided by the following dependent variable(s): ${input.user_dv_focus.map(dv => `\`${escapeMarkdown(dv)}\``).join(', ')}.\n`;
    md += `- **Note on Appendices:** This report focuses on synthesized findings. Detailed per-transcript analyses, specific-level diagrams, full quantitative summaries, and GSS grounding traces are available in the accompanying **HTML Appendix**.\n\n`;

    // Section 3: Transcripts Analyzed
    md += `## 2. Transcripts Analyzed\n`;
    const transcriptHeaders = ["Filename", "Independent Variable (IV) Details", "# Diachronic Phases (P1.4)", "# Core GDUs Involved"];
    const transcriptRows = input.transcripts_analyzed_summary.map(t => [
        t.filename, 
        t.iv_details, 
        t.num_diachronic_phases,
        t.num_core_gdus_related
    ]);
    md += renderMarkdownTable(transcriptHeaders, transcriptRows);
    md += `*For detailed Specific Diachronic Structure (SDS) and Specific Synchronic Structure (SSS) diagrams for each transcript and phase, please refer to the HTML Appendix.*\n\n`;


    // Section 4: Generic Diachronic Structure (GDS)
    md += `## 3. Generic Diachronic Structure (GDS)\n`;
    if (input.p3_3_output && input.gds_definition) {
        const gds = input.gds_definition;
        md += `### 3.1. GDS Definition: ${escapeMarkdown(gds.name)}\n`;
        md += `- **Description:** ${escapeMarkdown(gds.description)}\n`;
        md += `- **Core GDUs:** ${gds.core_gdus.map(gdu => `\`${escapeMarkdown(gdu)}\``).join(', ')}\n`;
        if (gds.optional_gdus && gds.optional_gdus.length > 0) {
            md += `- **Optional GDUs:** ${gds.optional_gdus.map(gdu => `\`${escapeMarkdown(gdu)}\``).join(', ')}\n`;
        }
        if (gds.typical_sequence && gds.typical_sequence.length > 0) {
            md += `- **Typical Sequence:** ${gds.typical_sequence.map(gdu => `\`${escapeMarkdown(gdu)}\``).join(' -> ')}\n`;
        }
        md += renderMermaidMarkdown(`Generic Diachronic Structure: ${escapeMarkdown(gds.name)}`, input.all_mermaid_syntaxes['gds_main'], 'gds_main_diagram');
        
        md += `### 3.2. GDS Quantitative Summary Notes\n`;
        md += `Detailed tables for GDU vs. Utterances per transcript and GDU transitions per transcript are available in the HTML Appendix. These tables provide granular counts showing the distribution and flow of GDUs across the analyzed dataset.\n\n`;


    } else {
        md += `*Generic Diachronic Structure data not available.*\n\n`;
    }

    // Section 5: Generic Synchronic Structures (GSS)
    md += `## 4. Generic Synchronic Structures (GSS) - Per Core GDU\n`;
    if (input.p3_3_output?.generic_diachronic_structure_definition?.core_gdus?.length > 0 && input.p4s_outputs_by_gdu) {
        const coreGdus = input.p3_3_output.generic_diachronic_structure_definition.core_gdus;
        coreGdus.forEach((gduId, index) => {
            md += `### 4.${index + 1}. GSS for GDU: \`${escapeMarkdown(gduId)}\`\n`;
            const gduDef = input.p3_2_output.identified_gdus.find(g => g.gdu_id === gduId);
            md += `- **GDU Definition:** ${escapeMarkdown(gduDef?.definition || 'N/A')}\n`;
            
            const gssOutput = input.p4s_outputs_by_gdu?.[gduId];
            if (gssOutput?.generic_synchronic_structure) {
                const gss = gssOutput.generic_synchronic_structure;
                md += `- **GSS Description:** ${escapeMarkdown(gss.description)}\n`;
                if (gss.generic_nodes_categories && gss.generic_nodes_categories.length > 0) {
                    md += `- **Key Categories/Nodes:** ${gss.generic_nodes_categories.map(node => `\`${escapeMarkdown(node.label)}\``).join(', ')}\n`;
                }
                md += renderMermaidMarkdown(`GSS for GDU: ${escapeMarkdown(gduId)}`, input.all_mermaid_syntaxes[`gss_${gduId.replace(/[^a-zA-Z0-9_]/g, '_')}`], `gss_diagram_${gduId.replace(/[^a-zA-Z0-9_]/g, '_')}`);
                
                md += `#### Instantiation Summary:\n`;
                if (gss.instantiation_notes && gss.instantiation_notes.length > 0) {
                     md += `This GSS is instantiated by specific elements from the source transcripts. For a detailed grounding trace of each GSS category (e.g., \`${escapeMarkdown(gss.generic_nodes_categories[0]?.label || 'example category')}\`) back to its constituent Specific Synchronic Structure (SSS) nodes and original utterances, please refer to the **'GSS Category Grounding Trace'** section in the HTML Appendix.\n\n`;
                } else {
                    md += `*No detailed instantiation notes available for this GSS.*\n\n`;
                }
            } else {
                md += `*GSS data not available for GDU: ${escapeMarkdown(gduId)}.*\n\n`;
            }
        });
        md += `### 4.${coreGdus.length + 1}. GSS Quantitative Summary Notes\n`;
        md += `Detailed tables for GSS Category vs. Utterances per transcript are available in the HTML Appendix, providing insight into the prevalence of each generic synchronic component.\n\n`;

    } else {
        md += `*No core GDUs identified for GSS analysis or GSS data missing.*\n\n`;
    }

    // Section 6: Holistic Refinement Summary
    md += `## 5. Holistic Refinement Summary (P5.1)\n`;
    if (input.p5_output) {
        md += `${escapeMarkdown(input.p5_output.final_refined_generic_diachronic_structure_summary)}\n\n`;
        md += `**Refined GSS Summaries:**\n`;
        for (const [gduId, summary] of Object.entries(input.p5_output.final_refined_generic_synchronic_structures_summary)) {
            md += `- **GDU \`${escapeMarkdown(gduId)}\`:** ${escapeMarkdown(summary)}\n`;
        }
        md += `\n### 5.1. Refinement Log\n`;
        if (input.p5_output.refinement_log && input.p5_output.refinement_log.length > 0) {
            input.p5_output.refinement_log.forEach(log => {
                md += `- **Observation:** ${escapeMarkdown(log.observation)}\n`;
                md += `  - **Adjustment:** ${escapeMarkdown(log.adjustment_made)}\n`;
                md += `  - **Justification:** ${escapeMarkdown(log.justification)}\n\n`;
            });
        } else {
            md += `*No refinement log entries.*\n\n`;
        }
        md += `### 5.2. Emergent Insights\n`;
        if (input.p5_output.emergent_insights && input.p5_output.emergent_insights.length > 0) {
            input.p5_output.emergent_insights.forEach(insight => md += `- ${escapeMarkdown(insight)}\n`);
        } else {
            md += `*No emergent insights recorded.*\n\n`;
        }
        md += `\n### 5.3. Initial Hypotheses (from P5)\n`;
        if (input.p5_output.hypotheses_generated && input.p5_output.hypotheses_generated.length > 0) {
            input.p5_output.hypotheses_generated.forEach(hyp => md += `- ${escapeMarkdown(hyp)}\n`);
        } else {
            md += `*No initial hypotheses generated in P5.*\n\n`;
        }
    } else {
        md += `*Holistic refinement data (P5.1) not available.*\n\n`;
    }

    // Section 7: Proposed Causal Model
    md += `## 6. Proposed Causal Model\n`;
    if (input.p7_1_output && (input.p7_3b_output || input.p7_3_output) && input.p7_5_output) {
        md += `### 6.1. Formal Variables (P7.1)\n`;
        const varHeaders = ["ID", "Name", "Phenomenological Grounding (Excerpt)", "Measurement Type", "Grounding Refs (Type:ID)"];
        const varRows = input.p7_1_output.candidate_variables.map((v: P7_1_CandidateVariable) => [
            v.variable_id,
            v.variable_name,
            v.phenomenological_grounding.substring(0, 50) + "...",
            v.measurement_type,
            v.grounding_references ? v.grounding_references.map(ref => `${ref.type}:${ref.id}`).join(', ') : "N/A"
        ]);
        md += renderMarkdownTable(varHeaders, varRows);

        md += `### 6.2. Causal Graph (P7.3b / P7.3)\n`;
        const dagSyntaxKey = input.all_mermaid_syntaxes['cleaned_causal_dag'] ? 'cleaned_causal_dag' : 'initial_causal_dag';
        const dagTitle = dagSyntaxKey === 'cleaned_causal_dag' ? "Cleaned Causal DAG" : "Initial Proposed Causal DAG";
        md += renderMermaidMarkdown(dagTitle, input.all_mermaid_syntaxes[dagSyntaxKey], 'causal_dag_diagram');
        
        if (input.p7_3b_output?.resolution_log && input.p7_3b_output.resolution_log.length > 0) {
            md += `#### DAG Cleaning Resolution Log (P7.3b):\n`;
            input.p7_3b_output.resolution_log.forEach((action: P7_3b_ResolutionAction) => {
                md += `- **Action:** ${escapeMarkdown(action.action_type)}\n`;
                md += `  - **Reason:** ${escapeMarkdown(action.reason)}\n`;
                md += `  - **Details:** ${escapeMarkdown(action.details)}\n`;
                if (action.affected_variables) md += `  - *Affected: ${action.affected_variables.join(', ')}*\n`;
            });
        } else if (input.p7_3b_output) {
             md += `*DAG was validated as clean, or no P7.3b resolution log available.*\n`;
        } else {
            md += `*P7.3b (DAG Cleaning) was not performed or data is unavailable. Displaying initial DAG from P7.3 if available.*\n`;
        }
        md += `\n`;


        md += `### 6.3. Formal Causal Hypotheses (P7.5)\n`;
        if (input.p7_5_output.formal_causal_hypotheses && input.p7_5_output.formal_causal_hypotheses.length > 0) {
            input.p7_5_output.formal_causal_hypotheses.forEach((h: P7_5_FormalHypothesis) => {
                md += `#### Hypothesis: \`${escapeMarkdown(h.hypothesis_id)}\`\n`;
                md += `- **Claim:** ${escapeMarkdown(h.causal_claim)}\n`;
                md += `- **Concept:** ${escapeMarkdown(h.causal_concept)}\n`;
                if (h.formal_query) md += `- **Formal Query:** \`${escapeMarkdown(h.formal_query)}\`\n`;
                md += `- **Testable Prediction:** ${escapeMarkdown(h.testable_prediction)}\n`;
                if (h.related_primitive_ids && h.related_primitive_ids.length > 0) md += `- *Related P7.3 Primitives: ${h.related_primitive_ids.join(', ')}*\n`;
                if (h.related_path_analysis_ids && h.related_path_analysis_ids.length > 0) md += `- *Related P7.4 Analyses: ${h.related_path_analysis_ids.join(', ')}*\n`;
                md += `\n`;
            });
        } else {
            md += `*No formal causal hypotheses generated (P7.5).*\n\n`;
        }
    } else {
        md += `*Causal modeling data (P7.1, P7.3b/P7.3, P7.5) not fully available.*\n\n`;
    }

    // Section 8: Conclusion
    md += `## 7. Conclusion\n`;
    md += `This report presents a summary of the automated micro-phenomenological analysis. Further interpretation and validation by human researchers are recommended. For detailed specific-level analyses, diagrams, and quantitative data, please consult the accompanying HTML Appendix.\n\n`;

    // Section 9: Appendix (Mermaid Syntaxes - for generic structures only, as specific ones are in HTML Appendix)
    md += `## 8. Appendix: Mermaid Diagram Syntaxes (Generic Structures & Causal DAG)\n`;
    md += `This section provides the raw Mermaid.js syntax for the high-level generic diagrams and the causal DAG included in this report for reference and reproducibility.\n\n`;
    
    const genericDiagramKeys = ['gds_main', 'causal_dag', 'cleaned_causal_dag'];
    if (input.p3_3_output?.generic_diachronic_structure_definition?.core_gdus) {
        input.p3_3_output.generic_diachronic_structure_definition.core_gdus.forEach(gduId => {
            genericDiagramKeys.push(`gss_${gduId.replace(/[^a-zA-Z0-9_]/g, '_')}`);
        });
    }

    for (const key of genericDiagramKeys) {
        if (input.all_mermaid_syntaxes[key] && input.all_mermaid_syntaxes[key].trim() !== '') {
             // Infer title from the mermaid syntax map, or use key as fallback
            let title = key; // Fallback title
            if(key === 'gds_main' && input.gds_definition) title = `GDS: ${input.gds_definition.name}`;
            else if (key.startsWith('gss_')) {
                const gduIdFromKey = key.substring(4); // Remove 'gss_'
                title = `GSS for GDU: ${gduIdFromKey}`;
            } else if (key === 'causal_dag') title = `Initial Proposed Causal DAG`;
            else if (key === 'cleaned_causal_dag') title = `Cleaned Causal DAG`;

            md += renderMermaidMarkdown(`Syntax for: ${title}`, input.all_mermaid_syntaxes[key], `appendix_syntax_${key}`);
        }
    }
    
    return md;
}
