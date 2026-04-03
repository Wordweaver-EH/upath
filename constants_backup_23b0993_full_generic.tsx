


import { StepId, UserDVFocus, SelectedUtterance, RawTranscript, TranscriptProcessedData, GenericAnalysisState, P_neg1_1_Output, P0_1_Output, P0_2_Output, P0_3_Output, P1_1_Output, P1_2_Output, P1_3_Output, P2S_1_Output, P2S_2_Output, P2S_3_Output, P3_1_Output, P3_2_Output, P4S_1_A_Output, P5_1_ComparativeAnalysisOutput, P5_1_Input, P5_1_InputWithFlag, P5_2_RefinementOutput, P7_1_Output, P7_3_Output, P7_3b_Output, P7_4_Output, P7_2_ProposedLink, P7_1_CandidateVariable } from './types';
import { calculateGduUtteranceCounts, calculateGssCategoryUtteranceCounts, calculateGduTransitionCounts } from './utils/htmlHelper'; // For P6.1 input
import { ReportData } from './utils/reportHelper'; // Ensure this matches the actual path if different

export const GEMINI_MODEL_TEXT = 'gemini-2.5-flash-preview-04-17';

// Feature flag for P3_2 implementation approach
export const P3_2_APPROACH = process.env.REACT_APP_P3_2_APPROACH || 'original';
             
             // Optional runtime validator for strict P3_2 schema compliance with defensive duplicate handling
export function validateAndCleanP3_2_Output(output: any, expectedTotRdus: number): any {
    if (!output || !Array.isArray(output.identified_gdus)) {
        throw new Error('No GDUs array found in output');
    }
    
    const seen = new Set<string>();
    const cleanedGdus = output.identified_gdus.map((gdu: any) => {
        if (!Array.isArray(gdu.contributing_refined_du_ids)) {
            throw new Error(`GDU ${gdu.gdu_id} missing contributing_refined_du_ids array`);
        }
        
        const cleanedContributions = gdu.contributing_refined_du_ids.filter((item: any) => {
            const key = `${item.transcript_id}|${item.refined_du_id}`;
            if (seen.has(key)) {
                console.warn(`[P3.2 VALIDATION] Duplicate RDU assignment for '${key}' to GDU '${gdu.gdu_id}'. Ignoring subsequent assignment (first-assignment-wins).`);
                return false; // Filter out this duplicate
            }
            seen.add(key);
            return true; // Keep this assignment
        });
        
        return {
            ...gdu,
            contributing_refined_du_ids: cleanedContributions
        };
    });
    
    // Validate that all RDUs have been accounted for
    if (seen.size !== expectedTotRdus) {
        throw new Error(`[P3.2 VALIDATION] Mismatch in RDU count: Expected ${expectedTotRdus} RDUs to be processed, but found ${seen.size} unique RDUs in GDU assignments. This indicates some RDUs were missed or duplicated.`);
    }
    
    // Note: output.tot_rdus is not part of the P3_2_Output type, it's only an input parameter
    
    return {
        ...output,
        identified_gdus: cleanedGdus
    };
}// Values: 'original' | 'minified' | 'minimal_context_tsv' | 'full_context_tsv' | 'zero_context_tsv'

// Helper function to extract numeric value from RDU ID for proper sorting
function extractNumericFromRduId(rduId: string): number {
    // Handle various formats: "DU_1", "DU_01", "RDU_1", "RDU_01", etc.
    const match = rduId.match(/(\d+)/);
    if (match) {
        return parseInt(match[1], 10);
    }
    // Fallback for non-numeric IDs - use string comparison
    return 0;
}

// Compare RDU IDs with proper numeric handling
function compareRduIds(a: string, b: string): number {
    const numA = extractNumericFromRduId(a);
    const numB = extractNumericFromRduId(b);
    
    // If both have numeric parts, compare numerically
    if (numA !== 0 && numB !== 0) {
        return numA - numB;
    }
    
    // Fallback to string comparison if no numeric parts
    return a.localeCompare(b);
}             
             // ───────────────────────────────────────────────────────────────────────────────
             // P5.2 - Holistic Review Prompt Builder (schema_version: "2.0" - Dynamic)
             // ───────────────────────────────────────────────────────────────────────────
             
             /**
              * A dictionary of high-quality, instructional placeholder text.
              * This centralizes the qualitative guidance, making it easy to tune.
              */
             const instructionalText = {
               summary: "Provide a concise, insightful summary of the refined structure. Detail key themes and significant adjustments made based on the holistic review of all specific data.",
               gdsName: "A refined, descriptive name for the generic structure based on its core experiential arc.",
               gdsDescription: "A rich description of the entire experiential journey, explaining the core flow and any optional variations.",
               gduDescription: "A clear, phenomenologically-grounded description of what it is like to be in this phase of the experience.",
               sequenceDescription: "Describe the experiential transition between these two phases.",
               gssDescription: "A detailed summary of the synchronic structure for this phase, outlining the key categories of experience and their typical interplay.",
               gssCategoryName: "A concise, descriptive name for this generic category of experience.",
               gssCategoryDescription: "A definition of this category, explaining what types of specific experiences it groups together.",
               gssLinkDescription: "Explain the typical relationship or influence between these two categories (e.g., causal, correlated, sequential).",
               instantiationNotesDescription: "Provide illustrative examples from the specific data that are captured by this generic category.",
               logObservation: "A key observation from the holistic data review that prompted a change.",
               logAdjustment: "The specific change made to the generic structures as a result of the observation.",
               logJustification: "The reasoning for the adjustment, linking it back to the empirical data.",
               insight: "A novel, high-level understanding derived from seeing all the data together. Frame as a declarative statement about the phenomenon.",
               hypothesis: "A specific, testable phenomenological hypothesis that emerges from the refined structures or insights.",
             };
                   
                   /**
                    * Builds the P5.2 prompt with a dynamically generated, un-anchored output schema.
                    * This minimizes overfitting and maintenance burden while maximizing structural guidance.
                    */
                   const buildDynamicP5Prompt = ({
                                              gdsName,
                                              numGss,
                                              numSds,
                                              numSss,
                                              generic_diachronic_structure_input,
                                              generic_synchronic_structures_by_gdu_input,
                                              all_specific_diachronic_structures_input,
                                              all_specific_synchronic_structures_input,
                                              dvFocus,
                                              p5_1_comparative_analysis,
                                            }: {
                                              gdsName: string;
                                              numGss: number;
                                              numSds: number;
                                              numSss: number;
                                              generic_diachronic_structure_input: any;
                                              generic_synchronic_structures_by_gdu_input: any;
                                              all_specific_diachronic_structures_input: any[];
                                              all_specific_synchronic_structures_input: any[];
                                              dvFocus: string[];
                                              p5_1_comparative_analysis?: any; // NEW: P5.1 output
                                            }) => {
                                              // Dynamically get the GDU IDs from the *current* input data.
                                              const gduIds = Object.keys(generic_synchronic_structures_by_gdu_input);
                                            
                                              // Programmatically build the exemplar to match the input's structure.
                                              const dynamicExemplar = {
                                                final_refined_generic_diachronic_structure_summary: instructionalText.summary,
                                                final_refined_generic_synchronic_structures_summary: Object.fromEntries(
                                                  gduIds.map(id => [id, `(${instructionalText.summary} for GDU: ${id})`])
                                                ),
                                                updated_gds_object: {
                                                  name: instructionalText.gdsName,
                                                  description: instructionalText.gdsDescription,
                                                  core_gdus: [{ gdu_id: "GDU_ID_CORE_EXAMPLE", name: "Example Core GDU", description: instructionalText.gduDescription }],
                                                  optional_gdus: [{ gdu_id: "GDU_ID_OPTIONAL_EXAMPLE", name: "Example Optional GDU", description: instructionalText.gduDescription }],
                                                  typical_sequence: [{ from_gdu_id: "GDU_ID_A", to_gdu_id: "GDU_ID_B", description: instructionalText.sequenceDescription }],
                                                },
                                                updated_gss_outputs_by_gdu: Object.fromEntries(
                                                  gduIds.map(id => [
                                                    id,
                                                    {
                                                      representation_type: "Semantic Network",
                                                      description: `(${instructionalText.gssDescription} for GDU: ${id})`,
                                                      generic_nodes_categories: [{ generic_category_id: "gss_cat_example_id", name: instructionalText.gssCategoryName, description: instructionalText.gssCategoryDescription }],
                                                      generic_network_links: [{ from_category_id: "gss_cat_id_1", to_category_id: "gss_cat_id_2", description: instructionalText.gssLinkDescription }],
                                                      instantiation_notes: [{
                                                        generic_category_id: "gss_cat_example_id",
                                                        textual_description: instructionalText.instantiationNotesDescription,
                                                        // NOTE: We show the structure but keep the array empty, as the model's task is to populate it.
                                                        // The instruction in TASKS enforces the non-empty rule on output.
                                                        example_specific_nodes: [ { transcript_id: "tx_id", sss_node_id: "node_id", phase_name: "phase_name" } ]
                                                      }]
                                                    }
                                                  ])
                                                ),
                                                refinement_log: [{ observation: instructionalText.logObservation, adjustment_made: instructionalText.logAdjustment, justification: instructionalText.logJustification }],
                                                emergent_insights: [instructionalText.insight],
                                                hypotheses_generated: [instructionalText.hypothesis],
                                              };
                                            
                                              return `
                                            ### SYSTEM
                                            You are a **senior micro-phenomenological researcher**.  
                                            Your sole task is to (1) perform a holistic review of the provided data, and (2) output a single JSON object that **exactly** follows the structure and qualitative instructions provided in <DYNAMIC_OUTPUT_SCHEMA>.
                                            
                                            ### CONTEXT
                                            <DATA_STATS>
                                            gds_name:             ${gdsName}
                                            num_gss_inputs:       ${numGss}
                                            num_sds_inputs:       ${numSds}
                                            num_sss_inputs:       ${numSss}
                                            dv_focus:             ${dvFocus.join(', ')}
                                            </DATA_STATS>
                                            ${p5_1_comparative_analysis ? `
                                            <IV_COMPARATIVE_ANALYSIS>
                                            This analysis was performed in P5.1 to compare patterns across different Independent Variable groups:
                                            ${JSON.stringify(p5_1_comparative_analysis, null, 2)}
                                            </IV_COMPARATIVE_ANALYSIS>
                                            ` : ''}
                                            <GENERIC_DDS>
                                            ${JSON.stringify(generic_diachronic_structure_input, null, 2)}
                                            </GENERIC_DDS>
                                            
                                            <GENERIC_SSS_BY_GDU>
                                            ${JSON.stringify(generic_synchronic_structures_by_gdu_input, null, 2)}
                                            </GENERIC_SSS_BY_GDU>
                                            
                                            <SPECIFIC_DDS_ARRAY>
                                            ${JSON.stringify(all_specific_diachronic_structures_input, null, 2)}
                                            </SPECIFIC_DDS_ARRAY>
                                            
                                            <SPECIFIC_SSS_ARRAY>
                                            ${JSON.stringify(all_specific_synchronic_structures_input, null, 2)}
                                            </SPECIFIC_SSS_ARRAY>
                                            
                                            ### TASKS
                                            1. **Holistic Review:** Analyze all provided structures (<GENERIC_DDS>, <GENERIC_SSS_BY_GDU>, <SPECIFIC_DDS_ARRAY>, <SPECIFIC_SSS_ARRAY>) to identify patterns, inconsistencies, and emergent themes.
                                               ${p5_1_comparative_analysis ? '- **IMPORTANT**: Use the IV Comparative Analysis from P5.1 as critical context. The patterns identified across IV groups should inform your refinements and insights.' : ''}
                                            2. **Refine & Generate:** Based on your review, refine the generic structures and generate the requested summaries, logs, insights, and hypotheses.
                                            3. **Output JSON:** Populate the schema provided in <DYNAMIC_OUTPUT_SCHEMA> with your complete analysis.
                                               – Adhere strictly to the keys and structure.
                                               – The text you generate should match the *quality and intent* described by the instructional placeholders.
                                               – For any retained GSS category, the \`example_specific_nodes\` array **must** be populated with relevant nodes from the input data.
                                            
                                            ### DYNAMIC_OUTPUT_SCHEMA (Follow this structure and the instructions within)
                                            <DYNAMIC_OUTPUT_SCHEMA>
                                            ${JSON.stringify(dynamicExemplar, null, 2)}
                                            </DYNAMIC_OUTPUT_SCHEMA>
                                            
                                            ### FORMAT
                                            Respond **only** with the single, valid JSON object. Do not include any other text, apologies, or code fences.
                                            `.trim();
                                            };
;// Legacy feature flag removed - use P3_2_APPROACH instead

// Two-phase P3_2 implementation functions
const getTwoPhaseP3_2_Input = (_: any, allProcessedData: any, genericState: any, apiKeyPresent: any, userDvFocus: any) => {
    if (!apiKeyPresent) return { data: null, error: "API Key not set." };
    if (!allProcessedData || allProcessedData.size === 0) return { data: null, error: "No processed transcript data available for P3.2." };
    if (!genericState?.p3_1_output) return { data: null, error: "P3.1 output (for guidance) not found for P3.2." };

    const rdu_rows: string[] = ["transcript_id\trefined_du_id\tdescription\ttemporal_phase\tiv_details"];
    
    allProcessedData.forEach((tData: any, tId: any) => {
        if (tData.p1_3_output?.refined_diachronic_units) {
            const ivDetails = tData.p_neg1_1_output?.independent_variable_details || 
                             tData.p1_4_output?.independent_variable_details || 
                             "IV Not Available";
            
            tData.p1_3_output.refined_diachronic_units.forEach((rdu: any) => {
                const row = [
                    tId,
                    rdu.unit_id,
                    rdu.description.replace(/\s+/g, ' '), // Clean description for TSV
                    rdu.temporal_phase,
                    ivDetails.replace(/\t/g, ' ').replace(/\n/g, ' ') // Clean IV details for TSV
                ].join('\t');
                rdu_rows.push(row);
            });
        }
    });

    if (rdu_rows.length <= 1) { // Only header row
        return { data: null, error: "No Refined Diachronic Units (P1.3 outputs) found across all transcripts." };
    }

    const totalRdus = rdu_rows.length - 1; // header excluded
    
    return {
        data: {
            // Minimal guidance from P3.1
            high_level_context: {
                common_patterns_summary: genericState.p3_1_output.common_patterns_summary,
                key_differences: genericState.p3_1_output.key_differences,
            },
            // Token-efficient RDU data
            rdu_list_tsv: rdu_rows.join('\n'),
            global_dv_focus: userDvFocus?.dv_focus || [],
            tot_rdus: totalRdus
        }
    };
};

const generateTwoPhaseP3_2_Prompt = (input: any) => `
Micro-phenomenological analyst. Produce **only** the JSON object described below.

### Context from P3.1 (abridged)
PATTERN: ${input.high_level_context.common_patterns_summary}
DIFFS : ${input.high_level_context.key_differences.join(' | ')}

### RDU TSV (total rows = ${input.tot_rdus})
\`\`\`tsv
${input.rdu_list_tsv}
\`\`\`

### TASK
1. Cluster RDUs into Generic Diachronic Units (GDUs) by semantic similarity and structural role.
2. For each GDU output
   • \`gdu_id\`, single-sentence \`definition\`,
   • \`supporting_transcripts_count\`, optional \`iv_variation_notes\` (incidental observations if patterns coincidentally align with IVs),
   • full \`contributing_refined_du_ids\` trace list.
3. State the criteria you used in ≤160 characters.
4. Copy the DV focus list exactly as given.

### STRICT OUTPUT
Return **only** this JSON object (no markdown):

{
  "identified_gdus": […],
  "criteria_for_gdu_identification": "…",
  "dependent_variable_focus": ${JSON.stringify(input.global_dv_focus)},
  "tot_rdus": ${input.tot_rdus}
}

Hard rules – obey or fail:
• Use ONLY \`transcript_id\` and \`refined_du_id\` values from the TSV; never invent or change IDs.
• Every TSV row appears **exactly once** in some GDU's \`contributing_refined_du_ids\`.
• Output nothing except the JSON object.`.trim();

// Minified JSON implementation functions
const getMinifiedP3_2_Input = (_: any, allProcessedData: any, genericState: any, apiKeyPresent: any, userDvFocus: any) => {
    if (!apiKeyPresent) return { data: null, error: "API Key not set." };
    if (!allProcessedData || allProcessedData.size === 0) return { data: null, error: "No processed transcript data available for P3.2." };
    if (!genericState?.p3_1_output) return { data: null, error: "P3.1 output (for guidance) not found for P3.2." };

    // Create minified RDU data with IV information
    const allRefinedDus = [];
    allProcessedData.forEach((tData: any, tId: any) => {
        if (tData.p1_3_output?.refined_diachronic_units) {
            const ivDetails = tData.p_neg1_1_output?.independent_variable_details || 
                             tData.p1_4_output?.independent_variable_details || 
                             "IV Not Available";
            
            tData.p1_3_output.refined_diachronic_units.forEach((rdu: any) => {
                allRefinedDus.push({
                    tid: tId, // Shortened field names
                    id: rdu.unit_id,
                    desc: rdu.description,
                    phase: rdu.temporal_phase,
                    iv: ivDetails // Add IV details
                });
            });
        }
    });

    if (allRefinedDus.length === 0) {
        return { data: null, error: "No Refined Diachronic Units (P1.3 outputs) found across all transcripts." };
    }

    return {
        data: {
            // Minimal P3.1 context
            patterns: genericState.p3_1_output.common_patterns_summary,
            diffs: genericState.p3_1_output.key_differences,
            // Minified RDU list
            rdus: allRefinedDus,
            dv: userDvFocus?.dv_focus || [],
            tot_rdus: allRefinedDus.length
        }
    };
};

const generateMinifiedP3_2_Prompt = (input: any) => `
Analyst. Produce the strict JSON object only.

Context PATTERN: ${input.patterns}
Context DIFFS  : ${input.diffs.join(' | ')}

RDU LIST (total = ${input.tot_rdus}):
${JSON.stringify(input.rdus)}

### TASK
1. Cluster RDUs into Generic Diachronic Units (GDUs) by semantic similarity and structural role.
2. For each GDU output
   • \`gdu_id\`, single-sentence \`definition\`,
   • \`supporting_transcripts_count\`, optional \`iv_variation_notes\` (incidental observations if patterns coincidentally align with IVs),
   • full \`contributing_refined_du_ids\` trace list.
3. State the criteria you used in ≤160 characters.
4. Copy the DV focus list exactly as given.

### STRICT OUTPUT
Return **only** this JSON object (no markdown):

{
  "identified_gdus": […],
  "criteria_for_gdu_identification": "…",
  "dependent_variable_focus": ${JSON.stringify(input.dv)},
  "tot_rdus": ${input.tot_rdus}
}

Hard rules – obey or fail:
• Use ONLY the 'tid' and 'id' fields from the list above; never invent or change IDs.
• Every RDU appears **exactly once** in some GDU's \`contributing_refined_du_ids\`.
• Output nothing except the JSON object.`.trim();

// Original P3_2 implementation functions
const getOriginalP3_2_Input = (_: any, allProcessedData: any, genericState: any, apiKeyPresent: any, userDvFocus: any) => {
    if (!apiKeyPresent) return { data: null, error: "API Key not set." };
    if (!allProcessedData || allProcessedData.size === 0) return { data: null, error: "No processed transcript data available for P3.2." };
    if (!genericState?.p3_1_output) return { data: null, error: "P3.1 output not found for P3.2." };

    const all_refined_dus_with_iv_and_ids: Array<{
        transcript_id: string;
        filename: string;
        independent_variable_details: string;
        refined_diachronic_units: Array<{ unit_id: string; description: string; confidence: number; temporal_phase: string; source_p1_2_du_ids: string[] }>;
    }> = [];

     allProcessedData.forEach(tData => {
        if (tData.p1_3_output && tData.p1_3_output.refined_diachronic_units && (tData.p_neg1_1_output || tData.p1_4_output) ) {
            all_refined_dus_with_iv_and_ids.push({
                transcript_id: tData.id,
                filename: tData.filename,
                independent_variable_details: tData.p_neg1_1_output?.independent_variable_details || tData.p1_4_output?.independent_variable_details || "IV Not Found",
                refined_diachronic_units: tData.p1_3_output.refined_diachronic_units
            });
        }
    });
    if (all_refined_dus_with_iv_and_ids.length === 0) return { data: null, error: "No refined diachronic units (P1.3 outputs with IVs and unit_ids) found." };

    // Count total RDUs for validation
    const totalRdus = all_refined_dus_with_iv_and_ids.reduce((count, transcript) => 
        count + transcript.refined_diachronic_units.length, 0);

    return { data: { p3_1_output: genericState.p3_1_output, all_refined_dus_with_iv_and_ids, global_dv_focus: userDvFocus?.dv_focus, tot_rdus: totalRdus } };
};

const generateOriginalP3_2_Prompt = (input: { p3_1_output: P3_1_Output, all_refined_dus_with_iv_and_ids: any[], global_dv_focus: string[], tot_rdus: number }) => `You are a Generic Diachronic Analysis assistant. Task: Identify Generic Diachronic Units (GDUs) from refined DUs across transcripts, considering IVs and ensuring traceability.
Input:
- P3.1 output (\`aligned_structures_report\`, etc.).
- All P1.3 outputs, provided as \`all_refined_dus_with_iv_and_ids\`. Each element contains \`transcript_id\`, \`filename\`, \`independent_variable_details\`, and \`refined_diachronic_units\` (which is an array of objects, each with \`unit_id\`, \`description\`, etc.).
- Global DV focus.
${JSON.stringify(input, null, 2)}

Instructions:
1.  Abstract from DUs: Review \`refined_diachronic_units\` from \`all_refined_dus_with_iv_and_ids\`. Group similar DUs across transcripts to define GDUs. A GDU is an abstraction representing a common type of diachronic unit.
2.  Define GDUs: For each GDU, provide:
    *   \`gdu_id\`: A unique identifier for the GDU (e.g., "GDU_Orientation").
    *   \`definition\`: A clear definition of what this GDU represents.
    *   \`supporting_transcripts_count\`: Number of unique transcripts contributing to this GDU.
    *   \`iv_variation_notes\` (Optional): If you notice patterns that coincidentally align with the \`independent_variable_details\` of the supporting transcripts, you may note them here as incidental observations. This is not a primary focus of the analysis.
    *   \`contributing_refined_du_ids\`: An array of objects, where each object specifies a \`transcript_id\` and the \`refined_du_id\` (this is the \`unit_id\` from the P1.3 \`refined_diachronic_units\` object) that contributes to this GDU. This is crucial for traceability.
3.  Criteria: Briefly state the criteria used for GDU abstraction and identification.

**CRITICAL CONSTRAINT**: Each refined DU (identified by transcript_id + refined_du_id) must appear in **exactly one** GDU's contributing_refined_du_ids list. No refined DU can be assigned to multiple GDUs.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "identified_gdus": [
    {
      "gdu_id": "GDU_Example",
      "definition": "Definition of the GDU.",
      "supporting_transcripts_count": 3,
      "iv_variation_notes": "Observed variations linked to IVs.",
      "contributing_refined_du_ids": [
        { "transcript_id": "transcript_A_id", "refined_du_id": "refinedDU-5_from_transcript_A" },
        { "transcript_id": "transcript_B_id", "refined_du_id": "refinedDU-2_from_transcript_B" }
      ]
    }
    // ... more GDUs
  ],
  "criteria_for_gdu_identification": "Criteria used for GDU abstraction (e.g., thematic similarity of DU descriptions, similar temporal phase).",
  "dependent_variable_focus": ${JSON.stringify(input.global_dv_focus)},
  "tot_rdus": ${input.tot_rdus}
`;

// Zero context TSV implementation functions  
const getZeroContextTsvP3_2_Input = (_: any, allProcessedData: any, genericState: any, apiKeyPresent: any, userDvFocus: any) => {
    if (!apiKeyPresent) return { data: null, error: "API Key not set." };
    if (!allProcessedData || allProcessedData.size === 0) return { data: null, error: "No processed transcript data available for P3.2." };

    const rdu_rows: string[] = ["transcript_id\trefined_du_id\tdescription\ttemporal_phase\tiv_details"];
    
    allProcessedData.forEach((tData: any, tId: any) => {
        if (tData.p1_3_output?.refined_diachronic_units) {
            const ivDetails = tData.p_neg1_1_output?.independent_variable_details || 
                             tData.p1_4_output?.independent_variable_details || 
                             "IV Not Available";
            
            tData.p1_3_output.refined_diachronic_units.forEach((rdu: any) => {
                const row = [
                    tId,
                    rdu.unit_id,
                    rdu.description.replace(/\s+/g, ' '), // Clean description for TSV
                    rdu.temporal_phase,
                    ivDetails.replace(/\t/g, ' ').replace(/\n/g, ' ') // Clean IV details for TSV
                ].join('\t');
                rdu_rows.push(row);
            });
        }
    });

    if (rdu_rows.length <= 1) { // Only header row
        return { data: null, error: "No Refined Diachronic Units (P1.3 outputs) found across all transcripts." };
    }

    const totalRdus = rdu_rows.length - 1; // header excluded
    
    return {
        data: {
            // No context from P3.1 - pure bottom-up analysis
            rdu_list_tsv: rdu_rows.join('\n'),
            global_dv_focus: userDvFocus?.dv_focus || [],
            tot_rdus: totalRdus
        }
    };
};

const generateZeroContextTsvP3_2_Prompt = (input: any) => `
Micro-phenomenological analyst. Produce **only** the JSON object described below.

### Context
No top-down context provided. Perform bottom-up clustering only.

### RDU TSV (total rows = ${input.tot_rdus})
\`\`\`tsv
${input.rdu_list_tsv}
\`\`\`

### TASK
1. Cluster RDUs into Generic Diachronic Units (GDUs) by semantic similarity and structural role.
2. For each GDU output
   • \`gdu_id\`, single-sentence \`definition\`,
   • \`supporting_transcripts_count\`, optional \`iv_variation_notes\` (incidental observations if patterns coincidentally align with IVs),
   • full \`contributing_refined_du_ids\` trace list.
3. State the criteria you used in ≤160 characters.
4. Copy the DV focus list exactly as given.

### STRICT OUTPUT
Return **only** this JSON object (no markdown):

{
  "identified_gdus": […],
  "criteria_for_gdu_identification": "…",
  "dependent_variable_focus": ${JSON.stringify(input.global_dv_focus)},
  "tot_rdus": ${input.tot_rdus}
}

Hard rules – obey or fail:
• Use ONLY \`transcript_id\` and \`refined_du_id\` values from the TSV; never invent or change IDs.
• Every TSV row appears **exactly once** in some GDU's \`contributing_refined_du_ids\`.
• Output nothing except the JSON object.`.trim();

// Full context TSV implementation functions  
const getFullContextTsvP3_2_Input = (_: any, allProcessedData: any, genericState: any, apiKeyPresent: any, userDvFocus: any) => {
    if (!apiKeyPresent) return { data: null, error: "API Key not set." };
    if (!allProcessedData || allProcessedData.size === 0) return { data: null, error: "No processed transcript data available for P3.2." };
    if (!genericState?.p3_1_output) return { data: null, error: "P3.1 output (for guidance) not found for P3.2." };

    const rdu_rows: string[] = ["transcript_id\trefined_du_id\tdescription\ttemporal_phase\tiv_details"];
    
    allProcessedData.forEach((tData: any, tId: any) => {
        if (tData.p1_3_output?.refined_diachronic_units) {
            const ivDetails = tData.p_neg1_1_output?.independent_variable_details || 
                             tData.p1_4_output?.independent_variable_details || 
                             "IV Not Available";
            
            tData.p1_3_output.refined_diachronic_units.forEach((rdu: any) => {
                const row = [
                    tId,
                    rdu.unit_id,
                    rdu.description.replace(/\s+/g, ' '), // Clean description for TSV
                    rdu.temporal_phase,
                    ivDetails.replace(/\t/g, ' ').replace(/\n/g, ' ') // Clean IV details for TSV
                ].join('\t');
                rdu_rows.push(row);
            });
        }
    });

    if (rdu_rows.length <= 1) { // Only header row
        return { data: null, error: "No Refined Diachronic Units (P1.3 outputs) found across all transcripts." };
    }

    const totalRdus = rdu_rows.length - 1; // header excluded
    
    return {
        data: {
            // Full context from P3.1 including complete aligned_structures_report
            full_context: {
                aligned_structures_report: genericState.p3_1_output.aligned_structures_report,
                common_patterns_summary: genericState.p3_1_output.common_patterns_summary,
                key_differences: genericState.p3_1_output.key_differences,
            },
            // Token-efficient RDU data
            rdu_list_tsv: rdu_rows.join('\n'),
            global_dv_focus: userDvFocus?.dv_focus || [],
            tot_rdus: totalRdus
        }
    };
};

const generateFullContextTsvP3_2_Prompt = (input: any) => `
Micro-phenomenological analyst. Produce **only** the JSON object described below.

### Complete Context from P3.1
ALIGNED STRUCTURES: ${input.full_context.aligned_structures_report}
PATTERN: ${input.full_context.common_patterns_summary}
DIFFS : ${input.full_context.key_differences.join(' | ')}

### RDU TSV (total rows = ${input.tot_rdus})
\`\`\`tsv
${input.rdu_list_tsv}
\`\`\`

### TASK
1. Cluster RDUs into Generic Diachronic Units (GDUs) by semantic similarity and structural role.
2. For each GDU output
   • \`gdu_id\`, single-sentence \`definition\`,
   • \`supporting_transcripts_count\`, optional \`iv_variation_notes\` (incidental observations if patterns coincidentally align with IVs),
   • full \`contributing_refined_du_ids\` trace list.
3. State the criteria you used in ≤160 characters.
4. Copy the DV focus list exactly as given.

### STRICT OUTPUT
Return **only** this JSON object (no markdown):

{
  "identified_gdus": […],
  "criteria_for_gdu_identification": "…",
  "dependent_variable_focus": ${JSON.stringify(input.global_dv_focus)},
  "tot_rdus": ${input.tot_rdus}
}

Hard rules – obey or fail:
• Use ONLY \`transcript_id\` and \`refined_du_id\` values from the TSV; never invent or change IDs.
• Every TSV row appears **exactly once** in some GDU's \`contributing_refined_du_ids\`.
• Output nothing except the JSON object.`.trim();

export const PlayIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>);
export const PauseIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M5.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 007.25 3h-1.5zM12.75 3a.75.75 0 00-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 00.75-.75V3.75A.75.75 0 00-.75-.75h-1.5z" /></svg>);
export const DownloadIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>);
export const NextIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>);
export const PreviousIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 0-1.06 0L6.47 9.47a.75.75 0 0 0 0 1.06l4.25 4.25a.75.75 0 0 0 1.06-1.06L8.06 10l3.72-3.72a.75.75 0 0 0 0-1.06z" clipRule="evenodd" /></svg>);
export const UploadIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M9.25 13.25a.75.75 0 001.5 0V4.793l2.969 2.97a.75.75 0 001.06-1.06l-4.25-4.25a.75.75 0 00-1.06 0L5.22 6.704a.75.75 0 001.06 1.06L9.25 4.793V13.25z" /><path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" /></svg>);
export const LoadIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v1.272A2.228 2.228 0 0 0 3.75 6h12.5A2.228 2.228 0 0 0 18 6.022V4.75A1.75 1.75 0 0 0 16.25 3h-4.835a.25.25 0 0 1-.202-.098L10.5 2.016a.25.25 0 0 0-.202-.098H3.75zM2 9.75A1.75 1.75 0 0 1 3.75 8h12.5A1.75 1.75 0 0 1 18 9.75v5.5A1.75 1.75 0 0 1 16.25 17H3.75A1.75 1.75 0 0 1 2 15.25v-5.5z" /></svg>);
export const SaveIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M2.5 2.5A2.5 2.5 0 0 0 0 5v10a2.5 2.5 0 0 0 2.5 2.5h15A2.5 2.5 0 0 0 20 15V5a2.5 2.5 0 0 0-2.5-2.5H15V.75a.75.75 0 0 0-1.5 0V2.5H6.5V.75a.75.75 0 0 0-1.5 0V2.5H2.5zM3.5 15V7h13v8a1 1 0 0 1-1 1H4.5a1 1 0 0 1-1-1zM7 9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1H7z" /></svg>);
export const LightbulbIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M9.05 3.296a6.5 6.5 0 0 1 1.903 0l.536.216a.75.75 0 0 0 .86.095A6.476 6.476 0 0 1 16 9.5c0 1.598-.595 3.036-1.581 4.148a.75.75 0 0 0 .205 1.118l.26.173c.182.121.38.223.59.309a.75.75 0 0 1 .318 1.006A6.5 6.5 0 0 1 9.051 3.296zM5.556 14.898A.75.75 0 0 0 6 14.5V11a.75.75 0 0 0-1.5 0v3.5a.75.75 0 0 0 .556.725zM14.444 14.898a.75.75 0 0 1-.556-.725V11a.75.75 0 0 1 1.5 0v3.5a.75.75 0 0 1-.556.725zM10 17.5a.75.75 0 0 0 .75-.75V14h-1.5v2.75a.75.75 0 0 0 .75.75zM3.823 10.992a.75.75 0 0 1 1.006-.318c.21-.086.408-.188.59-.309l.26-.173a.75.75 0 0 1 .206-1.118A4.983 4.983 0 0 0 4 9.5a4.978 4.978 0 0 0-2.455-4.382.75.75 0 0 1-.095-.86l.216-.536a6.503 6.503 0 0 1 10.668 0l.216.536a.75.75 0 0 1-.095.86A4.979 4.979 0 0 0 12 9.5c0 .052.001.104.004.155a.75.75 0 0 1-1.498.09A3.5 3.5 0 0 0 10 9.498V9.5a3.5 3.5 0 0 0-3.418 3.072.75.75 0 0 1-1.006.318A6.522 6.522 0 0 1 3.823 10.992z"/></svg>);
export const FileTextIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6.707A2.25 2.25 0 0017.328 5L14 1.672A2.25 2.25 0 0012.293 1H5.707A2.25 2.25 0 004 2zm.75 4.75A.75.75 0 015.5 6h9a.75.75 0 010 1.5h-9A.75.75 0 014.75 6.75zM4.75 9.25A.75.75 0 015.5 8.5h9a.75.75 0 010 1.5h-9A.75.75 0 014.75 9.25zm0 2.5A.75.75 0 015.5 11h9a.75.75 0 010 1.5h-9a.75.75 0 01-.75-.75zm.75 2.45a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z" clipRule="evenodd" /></svg>);
export const CheckCircleIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" /></svg>);
export const InfoIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 opacity-75"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" /></svg>);
export const ChevronDownIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" /></svg>);
export const ChevronUpIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M14.78 11.78a.75.75 0 01-1.06 0L10 8.06l-3.72 3.72a.75.75 0 11-1.06-1.06l4.25-4.25a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06z" clipRule="evenodd" /></svg>);
export const RetryIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M15.323 10.243a5.25 5.25 0 00-7.815-1.11L6.06 7.677a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.06 0l2.25-2.25a.75.75 0 00-1.06-1.06l-1.274 1.273A3.75 3.75 0 0113.5 7.5c1.657 0 3.073 1.075 3.55 2.578a.75.75 0 001.45-.358A5.25 5.25 0 0015.323 10.243zM4.677 9.757a5.25 5.25 0 007.815 1.11l1.448 1.448a.75.75 0 001.06-1.06l-2.25-2.25a.75.75 0 00-1.06 0l-2.25 2.25a.75.75 0 101.06 1.06l1.274-1.273A3.75 3.75 0 016.5 12.5c-1.657 0-3.073-1.075-3.55-2.578a.75.75 0 00-1.45.358A5.25 5.25 0 004.677 9.757z" clipRule="evenodd" /></svg>);
export const AppendixIcon = (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
  <path fillRule="evenodd" d="M3 3.75A.75.75 0 013.75 3h12.5a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75V3.75zm0-1.5A2.25 2.25 0 00.75 3.75v12.5c0 1.243 1.007 2.25 2.25 2.25h12.5A2.25 2.25 0 0018.5 16.25V3.75A2.25 2.25 0 0016.25 1.5H3.75z" clipRule="evenodd" />
  <path d="M5.023 6.958A.75.75 0 015.75 6.5h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.727-.542zM5.023 9.958A.75.75 0 015.75 9.5h8.5a.75.75 0 010 1.5h-8.5a.75.75 0 01-.727-.542zM5.75 12.5a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z" />
</svg>);


export interface StepConfig {
  id: StepId;
  title: string;
  part: 'PartNeg1' | 'Part0' | 'PartI_Dia' | 'PartII_Sync' | 'PartIII_GenDia' | 'PartIV_GenSync' | 'PartV_Refine' | 'PartVII_Causal' | 'PartVI_Report';
  getInput: (
    currentTranscript?: RawTranscript,
    allProcessedData?: Map<string, TranscriptProcessedData>,
    genericState?: GenericAnalysisState,
    apiKeyPresent?: boolean,
    userDvFocus?: UserDVFocus,
    allRawTranscripts?: RawTranscript[],
    currentPhaseName?: string, // Added for P2S steps
    currentGduName?: string, // Added for P4S_1_B step to get P4S_1_A output
  ) => { data: any; error?: string } | null; // data can be any, error is optional string
  generatePrompt: (input: any) => string;
  isJsonOutput: boolean;
  parseOutput?: (response: any, ...args: any[]) => any; // Optional for steps that need custom output parsing
  validateAndClean?: (output: any, ...args: any[]) => any; // Optional for steps that need validation/cleaning
}

type ConfigMap = { [key in StepId]?: StepConfig };

export const STEP_ORDER_PART_NEG1 = [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION];
export const STEP_ORDER_PART_0 = [StepId.P0_1_TRANSCRIPTION_ADHERENCE, StepId.P0_2_REFINE_DATA_TYPES, StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES];
export const STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC = [StepId.P1_1_INITIAL_SEGMENTATION, StepId.P1_2_DIACHRONIC_UNIT_ID, StepId.P1_3_REFINE_DIACHRONIC_UNITS, StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE];
export const STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC = [StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC, StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS, StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE];
export const STEP_ORDER_PART_3_GENERIC_DIACHRONIC = [StepId.P3_1_ALIGN_STRUCTURES, StepId.P3_2_IDENTIFY_GDUS, StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE];
export const STEP_ORDER_PART_4_GENERIC_SYNCHRONIC = [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES, StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS];
export const STEP_ORDER_PART_5_REFINEMENT = [
  StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
  StepId.P5_2_HOLISTIC_REFINEMENT
];
export const STEP_ORDER_PART_7_CAUSAL_MODELING = [
  StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
  StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
  StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
  StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
  StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
  StepId.P7_5_GENERATE_FORMAL_HYPOTHESES
];
export const STEP_ORDER_PART_6_REPORT = [StepId.P6_1_GENERATE_MARKDOWN_REPORT];

export const ALL_PIPELINE_STEP_IDS_IN_ORDER: StepId[] = [
    ...STEP_ORDER_PART_NEG1,
    ...STEP_ORDER_PART_0,
    ...STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC,
    ...STEP_ORDER_PART_2_SPECIFIC_SYNCHRONIC,
    ...STEP_ORDER_PART_3_GENERIC_DIACHRONIC,
    ...STEP_ORDER_PART_4_GENERIC_SYNCHRONIC,
    ...STEP_ORDER_PART_5_REFINEMENT,
    ...STEP_ORDER_PART_7_CAUSAL_MODELING,
    ...STEP_ORDER_PART_6_REPORT,
    StepId.COMPLETE, // Represents the final state after all processing
];

export const ESSENTIAL_STEPS_FOR_AUTODOWNLOAD: StepId[] = [
  // Part 0
  StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
  // Part I
  StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  // Part II_S (Note: P2S_3 output is per phase, handled in App.tsx)
  StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
  // Part III
  StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
  // Part IV_S (Note: P4S_1_B output is per GDU, handled in App.tsx)
  StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
  // Part V
  StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
  StepId.P5_2_HOLISTIC_REFINEMENT,
  // Part VII
  StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS, // Initial DAG
  StepId.P7_3B_VALIDATE_AND_CLEAN_DAG, // Cleaned DAG
  StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
  // Part VI
  StepId.P6_1_GENERATE_MARKDOWN_REPORT,
  StepId.COMPLETE, // Final report if auto-download enabled
];

const CAUSAL_INFERENCE_GLOSSARY_TEXT = `
Causal Inference Glossary for Reference:
${JSON.stringify(
  {
    "glossary": [
      {
        "category": "Graphical Foundations",
        "terms": [
          { "term": "Structural Causal Model (SCM)", "definition": "A mathematical blueprint that pairs (i) a directed acyclic graph and (ii) structural equations that say how each variable is generated from its parents plus randomness." },
          { "term": "Directed Acyclic Graph (DAG)", "definition": "A graph whose arrows never loop back on themselves; each node is a variable and each arrow proposes a direct causal link." },
          { "term": "Node / Variable", "definition": "A circle in a DAG representing an observed or latent quantity." },
          { "term": "Directed Edge (Causal Arrow)", "definition": "An arrow X -> Y meaning 'changing X can change Y'." },
          { "term": "Causal Path", "definition": "Any chain of arrows that respects their direction (e.g., X -> M -> Y)." }
        ]
      },
      {
        "category": "Three Primitive Graph Patterns",
        "terms": [
          { "term": "Confounder", "definition": "A common cause of both treatment X and outcome Y (C -> X, C -> Y). If uncontrolled, it creates spurious association." },
          { "term": "Mediator", "definition": "A variable lying on the causal pathway from X to Y (X -> M -> Y). Explains the 'how' or 'why' of a causal effect." },
          { "term": "Collider", "definition": "A variable that is a common effect of two arrows (X -> Z <- Y). Conditioning on or selecting by a collider opens spurious association ('collider bias')." }
        ]
      },
      {
        "category": "Blocking and Connecting Paths",
        "terms": [
          { "term": "d-separation / d-connection", "definition": "A graphical rule that tells whether a set of variables Z blocks (renders independent) or opens a path between two other variables." },
          { "term": "Backdoor Path", "definition": "Any path from X to Y that starts with an arrow *into* X. Such paths transmit confounding bias." },
          { "term": "Backdoor Criterion", "definition": "A set Z satisfies it if (i) Z blocks every backdoor path from X to Y and (ii) Z contains no descendant of X. Adjusting for such a set Z allows for unbiased estimation of X's causal effect on Y." },
          { "term": "Adjustment Set", "definition": "A set of variables (e.g., confounders) that are controlled for in an analysis, typically to block backdoor paths or isolate a causal effect." }
        ]
      },
      {
        "category": "Causal Queries and Effects",
        "terms": [
          { "term": "Average Causal Effect (ACE)", "definition": "The expected difference in outcome if everyone in the population received treatment X vs. if no one did. (E[Y|do(X=1)] - E[Y|do(X=0)])." },
          { "term": "do-operator", "definition": "Pearl's notation for an intervention that sets a variable X to a specific value x, written do(X=x). It simulates an ideal experiment." },
          { "term": "Identifiability", "definition": "A causal effect is identifiable if it can be estimated from observational data alone, given the assumed causal graph." }
        ]
      },
      {
        "category": "Biases and Issues",
        "terms": [
          { "term": "Confounding Bias", "definition": "Bias due to an unmeasured or uncontrolled common cause (confounder) of X and Y." },
          { "term": "Selection Bias", "definition": "Bias that arises when selection into the study or analysis is related to both exposure and outcome." },
          { "term": "Collider Bias (M-Bias)", "definition": "Bias introduced by conditioning on a collider, which can create spurious associations between its parents." },
          { "term": "Measurement Error", "definition": "Bias due to variables being measured imperfectly." }
        ]
      }
    ]
  }, null, 2
)}
`;

const P7_BASIC_DEFINITIONS = `
Basic Causal Elements (for P7.1 and P7.2):
- **Variable:** A characteristic or attribute that can be measured or observed and can vary. (e.g., "Frequency of Imaginative Play", "Reported Emotional Intensity").
- **Causal Link:** A directional relationship where a change in one variable (the cause) is hypothesized to directly lead to a change in another variable (the effect), even if other factors are held constant. (e.g., "Increased Imaginative Play" -> "Higher Reported Creativity").
- **Phenomenological Grounding:** The justification for a variable or link based on direct descriptions or patterns observed in the micro-phenomenological interview data. This is what the interviewees describe.
- **Glossary Grounding:** The justification for a variable or link based on established theoretical constructs or definitions from the provided Causal Inference Glossary. This is how the observed phenomena relate to formal causal terms.
`;

export const STEP_CONFIGS: ConfigMap = {
  [StepId.P_NEG1_1_VARIABLE_IDENTIFICATION]: {
    id: StepId.P_NEG1_1_VARIABLE_IDENTIFICATION,
    title: "P-1.1: Variable Identification",
    part: "PartNeg1",
    isJsonOutput: true,
    getInput: (currentTranscript, _allProcessedData, _genericState, _apiKeyPresent, userDvFocus) => {
        console.log(`[P-1.1 getInput] currentTranscript:`, currentTranscript ? { id: currentTranscript.id, contentLength: currentTranscript.content?.length } : null);
        console.log(`[P-1.1 getInput] userDvFocus:`, userDvFocus);
        
        if (!currentTranscript?.content || !userDvFocus?.dv_focus || userDvFocus.dv_focus.length === 0) {
            console.error(`[P-1.1 getInput] Validation failed - transcript content: ${!!currentTranscript?.content}, userDvFocus exists: ${!!userDvFocus}, dv_focus exists: ${!!userDvFocus?.dv_focus}, dv_focus length: ${userDvFocus?.dv_focus?.length || 0}`);
            return { data: null, error: "Missing transcript content or DV focus for P-1.1." };
        }
        return {
            data: {
                filename_or_id: currentTranscript.filename || currentTranscript.id,
                raw_transcript_text_from_file: currentTranscript.content,
                dependent_variable_focus_list: userDvFocus.dv_focus,
            },
        };
    },
    generatePrompt: (input) => `You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable (or condition/grouping factor) and use the user-provided dependent variable focuses for this analysis.

Input:
- Raw text content of a single interview transcript file.
- Transcript Filename/ID: ${input.filename_or_id}
- User-specified Dependent Variable Focus (as a list of strings): ${JSON.stringify(input.dependent_variable_focus_list)}

Instructions:
1.  Identify Independent Variable (IV) / Condition:
    *   Examine the *first few lines* of the transcript. Look for a pattern like "Participant X, Condition Y (Score Z/W)" or similar identifying information that might indicate an experimental condition, grouping, or a key characteristic of this specific interview/participant.
    *   Extract this information as the \`independent_variable_details\`. If no such clear IV is present in the first few lines, mark it as "Not explicitly stated in header."
2.  Record DV Focus:
    *   The \`dependent_variable_focus\` field in your output JSON MUST be the exact list of strings provided in "User-specified Dependent Variable Focus" from the Input section above.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.filename_or_id}",
  "independent_variable_details": "The extracted IV information or 'Not explicitly stated in header.'",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus_list)}
}

BEGIN VARIABLE IDENTIFICATION FOR RAW TRANSCRIPT:
Transcript ID: ${input.filename_or_id}
User-specified Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus_list)}
Content:
${input.raw_transcript_text_from_file}
`,
  },
  [StepId.P0_1_TRANSCRIPTION_ADHERENCE]: {
    id: StepId.P0_1_TRANSCRIPTION_ADHERENCE,
    title: "P0.1: Transcription Adherence & Line Numbering",
    part: "Part0",
    isJsonOutput: true,
    getInput: (currentTranscript) => {
      if (!currentTranscript?.content) return { data: null, error: "Missing transcript content for P0.1." };
      return {
        data: {
          filename_or_id: currentTranscript.filename || currentTranscript.id,
          raw_transcript_text_from_file: currentTranscript.content,
        },
      };
    },
    generatePrompt: (input) => `You are a micro-phenomenological data preparation assistant. Your first task is to process a raw interview transcript file.
Input:
Raw text content of a single interview transcript file.
Transcript Filename/ID: ${input.filename_or_id}

Instructions:
1. Verify Transcription Conventions (as much as possible from text):
   Check if the transcript appears to be verbatim and orthographic.
   Note any apparent deviations (e.g., summarized, para-verbal/non-verbal cues missing). This is a best-effort check.
2. Automatic Line Numbering:
   Assign a unique, sequential line number to each line of the transcript. Start numbering from 1.
3. Initial Impression Log (Optional but Recommended by Paper §18):
   Read through the transcript once. Record any very initial impressions regarding evocation quality or nature of described experience. Keep brief and marked as preliminary.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.filename_or_id}",
  "line_numbered_transcript": ["1: text of line 1...", "2: text of line 2..."],
  "transcription_convention_notes": "Your notes here.",
  "initial_impressions_log": "Your brief impressions here."
}

BEGIN PROCESSING RAW TRANSCRIPT:
Transcript ID: ${input.filename_or_id}
Content:
${input.raw_transcript_text_from_file}
`,
  },
  [StepId.P0_2_REFINE_DATA_TYPES]: {
    id: StepId.P0_2_REFINE_DATA_TYPES,
    title: "P0.2: Refining Data - Identifying Information Types",
    part: "Part0",
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData) => {
      if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P0.2." };
      const p0_1_data = allProcessedData?.get(currentTranscript.id)?.p0_1_output;
      if (!p0_1_data) return { data: null, error: `Missing P0.1 output for transcript ${currentTranscript.id}` };
      return { data: p0_1_data };
    },
    generatePrompt: (input: P0_1_Output) => `You are a micro-phenomenological data preparation analyst. Your task is to refine the line-numbered transcript by identifying different types of information.
Input:
The JSON output from the previous step (Prompt 0.1) for transcript ID ${input.transcript_id}.
${JSON.stringify(input, null, 2)}

Instructions:
1. Re-read and categorize each line:
   For each numbered line, determine if it primarily contains:
    - "procedural_information": Utterances related to the interview process itself (e.g., interviewer's questions, participant's reflections on the question or process, meta-comments).
    - "experiential_content": Utterances directly describing the lived experience being investigated.
    - "ambiguous_or_mixed": Lines that are hard to categorize or contain both.
2. Tagging:
   Based on this, assign one or more \`information_tags\` to each line (e.g., ["procedural_information"], ["experiential_content"], ["procedural_information", "experiential_content"]).
3. Decision Notes (Optional):
   If a line is particularly complex or its categorization is non-obvious, add a brief \`decision_notes\` explaining your reasoning.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "refined_data_transcript": [
    {
      "line_num": 1,
      "text": "text of line 1...",
      "information_tags": ["tag1", "tag2"],
      "decision_notes": "Optional notes for line 1."
    },
    {
      "line_num": 2,
      "text": "text of line 2...",
      "information_tags": ["tag1"],
      "decision_notes": null
    }
    // ... and so on for all lines
  ]
}
`,
  },
  [StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES]: {
    id: StepId.P0_3_SELECT_PROCEDURAL_UTTERANCES,
    title: "P0.3: Select Procedural Utterances for Diachronic Analysis",
    part: "Part0",
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData) => {
      if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P0.3." };
      const p0_2_data = allProcessedData?.get(currentTranscript.id)?.p0_2_output;
      const p_neg1_1_data = allProcessedData?.get(currentTranscript.id)?.p_neg1_1_output;
      if (!p0_2_data || !p_neg1_1_data) return { data: null, error: `Missing P0.2 or P-1.1 output for transcript ${currentTranscript.id}` };
      return { data: { ...p0_2_data, p_neg1_1_output: p_neg1_1_data } };
    },
    generatePrompt: (input: P0_2_Output & { p_neg1_1_output: P_neg1_1_Output }) => `You are a micro-phenomenological analyst. Your task is to select utterances crucial for understanding the diachronic (temporal) structure of the *experience itself*, focusing on the participant's procedural account of their experience.
Input:
The JSON output from P0.2 (refined data transcript) and P-1.1 (IV/DV info) for transcript ID ${input.transcript_id}.
P0.2 Output: ${JSON.stringify({ transcript_id: input.transcript_id, refined_data_transcript: input.refined_data_transcript }, null, 2)}
P-1.1 Output: ${JSON.stringify(input.p_neg1_1_output, null, 2)}

Instructions:
1.  Focus: The goal is to isolate the participant's narrative of *how the experience unfolded*. This means selecting utterances that describe actions, steps, or stages in the experience.
2.  Selection Criteria:
    *   Prioritize lines tagged "experiential_content".
    *   From these, select utterances that indicate a sequence, action, or a part of the experiential process. These are "procedural utterances" in the context of the experience itself.
    *   Interviewer questions, participant's meta-comments on the interview *process* (unless they also reveal experiential process), or purely descriptive (static) experiential content should generally be EXCLUDED from this selection, *unless* they are essential for understanding the flow of the described experience.
    *   If a single original line was very long and contained multiple distinct procedural steps, you MAY split it and represent each as a separate selected utterance. If you do this, use a format like "LINE_NUM.SUB_INDEX" for \`original_line_num\` (e.g., "23.1", "23.2").
3.  Justification: For each selected utterance, provide a brief \`selection_justification\` explaining why it's considered procedural to the experience.
4.  Discarded Info Summary: Briefly summarize what kind of information was generally discarded (e.g., "Interviewer prompts, participant's self-corrections not directly related to experiential flow").
5.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from P-1.1 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "selected_procedural_utterances": [
    {
      "original_line_num": "string (e.g., '5' or '5.1')",
      "utterance_text": "text of the selected utterance...",
      "selection_justification": "Brief justification for selection."
    }
    // ... more utterances
  ],
  "discarded_info_summary": "Summary of discarded info.",
  "independent_variable_details": "${input.p_neg1_1_output.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.p_neg1_1_output.dependent_variable_focus)}
}
`,
  },
  [StepId.P1_1_INITIAL_SEGMENTATION]: {
    id: StepId.P1_1_INITIAL_SEGMENTATION,
    title: "P1.1: Initial Segmentation of Procedural Utterances",
    part: "PartI_Dia",
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData) => {
        if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.1." };
        const p0_3_data = allProcessedData?.get(currentTranscript.id)?.p0_3_output;
        if (!p0_3_data) return { data: null, error: `Missing P0.3 output for transcript ${currentTranscript.id}` };
        return { data: p0_3_data };
    },
    generatePrompt: (input: P0_3_Output) => `You are a micro-phenomenological analyst. Your task is to segment the selected procedural utterances based on temporal cues, focusing on the described experience's unfolding.
Input:
JSON output from P0.3 for transcript ID ${input.transcript_id}.
P0.3 Output: ${JSON.stringify(input, null, 2)}

Instructions:
1.  Focus on "Action Units": Read each selected procedural utterance. Identify "minimal action units" or "elementary acts" within them. An utterance might contain one or multiple such segments.
2.  Temporal Cues: Look for explicit or implicit temporal markers (e.g., "then", "after that", "firstly", "suddenly", sequence of verbs) that help delineate these segments. Also consider logical sequence.
3.  Segment Creation:
    *   For each original utterance, create an array of \`segments\`.
    *   Each segment should have a unique \`segment_id\` (e.g., "utt_ORIGINAL_LINE_NUM_seg_INDEX", like "utt_5.1_seg_0", "utt_5.1_seg_1"). Ensure ORIGINAL_LINE_NUM is safe for an ID (replace '.' with '_').
    *   \`segment_text\` should be the text of that minimal action unit.
    *   \`temporal_cues\` should be an array of strings listing any temporal words/phrases identified *within or at the beginning of* that specific segment that justify its distinctness or position.
4.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P0.3 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "segmented_utterances": [
    {
      "original_utterance": { // Copied from P0.3 input
        "original_line_num": "string",
        "utterance_text": "text of the original utterance...",
        "selection_justification": "Brief justification for selection."
      },
      "segments": [
        {
          "segment_id": "utt_5_1_seg_0", // Example: utt_ORIGLINE_seg_INDEX
          "segment_text": "first part of the action...",
          "temporal_cues": ["firstly", "then"]
        },
        {
          "segment_id": "utt_5_1_seg_1",
          "segment_text": "next part of the action...",
          "temporal_cues": ["after that"]
        }
      ]
    }
    // ... more segmented utterances
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
  },
  [StepId.P1_2_DIACHRONIC_UNIT_ID]: {
    id: StepId.P1_2_DIACHRONIC_UNIT_ID,
    title: "P1.2: Diachronic Unit Identification (DU)",
    part: "PartI_Dia",
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData) => {
        if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.2." };
        const p1_1_data = allProcessedData?.get(currentTranscript.id)?.p1_1_output;
        if (!p1_1_data) return { data: null, error: `Missing P1.1 output for transcript ${currentTranscript.id}` };
        return { data: p1_1_data };
    },
    generatePrompt: (input: P1_1_Output) => `You are a micro-phenomenological analyst. Your task is to group the segments from P1.1 into initial Diachronic Units (DUs). A DU represents a meaningful "moment" or "phase" in the described experience.
Input:
JSON output from P1.1 for transcript ID ${input.transcript_id}.
P1.1 Output: ${JSON.stringify(input, null, 2)}

Instructions:
1.  Review Segments: Examine all \`segments\` generated in P1.1.
2.  Group into Diachronic Units (DUs):
    *   Identify groups of one or more consecutive (or thematically related and temporally close) segments that form a coherent "moment" or "step" in the experience. These are your DUs.
    *   Each DU should have a unique \`unit_id\` (e.g., "du_1", "du_2").
    *   Provide a concise \`description\` for each DU, capturing its essence. This description should be based on the content of the source segments.
    *   List the \`source_segment_ids\` (from P1.1 segment_id) that constitute this DU. A segment should ideally belong to only one DU.
3.  Aim for a reasonable number of DUs that capture the main temporal beats of the experience. Avoid over-segmentation into too many DUs or under-segmentation into too few.
4.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P1.1 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Initial orienting and noticing the object.",
      "source_segment_ids": ["utt_5_1_seg_0", "utt_6_1_seg_0", "utt_6_1_seg_1"]
    },
    {
      "unit_id": "du_2",
      "description": "Detailed examination of the object's texture.",
      "source_segment_ids": ["utt_8_1_seg_0"]
    }
    // ... more diachronic units
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
  },
  [StepId.P1_3_REFINE_DIACHRONIC_UNITS]: {
    id: StepId.P1_3_REFINE_DIACHRONIC_UNITS,
    title: "P1.3: Refine Diachronic Units & Assign Temporal Phase",
    part: "PartI_Dia",
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData) => {
        if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.3." };
        const p1_2_data = allProcessedData?.get(currentTranscript.id)?.p1_2_output;
        if (!p1_2_data) return { data: null, error: `Missing P1.2 output for transcript ${currentTranscript.id}` };
        return { data: p1_2_data };
    },
    generatePrompt: (input: P1_2_Output) => `You are a micro-phenomenological analyst. Your task is to refine the Diachronic Units (DUs) from P1.2 and assign a temporal phase to each.
Input:
JSON output from P1.2 for transcript ID ${input.transcript_id}.
P1.2 Output: ${JSON.stringify(input, null, 2)}
User-defined Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus)}

Instructions:
1.  Review DUs: Examine the DUs identified in P1.2.
2.  Refine DUs:
    *   Consider if any DUs from P1.2 should be merged or split based on a deeper understanding of the experiential flow.
    *   The output \`refined_diachronic_units\` will be a new list. Each refined DU should have a unique \`unit_id\` (can be same as P1.2 ID if not changed, or new if merged/split).
    *   Maintain a concise \`description\`.
    *   The \`source_p1_2_du_ids\` field MUST list the \`unit_id\`(s) from the P1.2 DUs that form this refined DU.
3.  Assign Temporal Phase: For each *refined* DU, assign a \`temporal_phase\` from the following FIXED list that best describes its position in the overall experiential arc:
    *   "Beginning"
    *   "Early-Middle"
    *   "Core Event" (if there's a clear central moment)
    *   "Late-Middle"
    *   "Ending"
    *   "Reflection" (if the DU is about looking back on the experience)
    *   "Transition" (if the DU primarily marks a shift between other phases)
    *   "Other" (use sparingly, if no other category fits)
4.  Confidence: Assign a \`confidence\` score (0.0 to 1.0) for each refined DU, reflecting how clear and well-defined it seems.
5.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P1.2 MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "refined_diachronic_units": [
    {
      "unit_id": "rdu_1", // Can be same as P1.2 ID or new
      "description": "Initial orienting and noticing the object (refined).",
      "source_p1_2_du_ids": ["du_1"], // ID(s) from P1.2 DUs
      "temporal_phase": "Beginning",
      "confidence": 0.9
    },
    {
      "unit_id": "rdu_2",
      "description": "Detailed examination and interaction.",
      "source_p1_2_du_ids": ["du_2", "du_3"], // Example of merged DUs
      "temporal_phase": "Core Event",
      "confidence": 0.85
    }
    // ... more refined diachronic units
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
  },
  [StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE]: {
    id: StepId.P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
    title: "P1.4: Construct Specific Diachronic Structure (SDS)",
    part: "PartI_Dia",
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData) => {
        if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.4." };
        const p1_3_data = allProcessedData?.get(currentTranscript.id)?.p1_3_output;
        if (!p1_3_data) return { data: null, error: `Missing P1.3 output for transcript ${currentTranscript.id}` };
        return { data: p1_3_data };
    },
    generatePrompt: (input: P1_3_Output) => `You are a micro-phenomenological analyst. Your task is to construct the Specific Diachronic Structure (SDS) for this transcript based on the refined DUs and their temporal phases.
Input:
JSON output from P1.3 for transcript ID ${input.transcript_id}.
P1.3 Output: ${JSON.stringify(input, null, 2)}
User-defined Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus)}
Independent Variable details: ${input.independent_variable_details}

Instructions:
1.  Define Specific Diachronic Phases:
    *   Group the refined DUs from P1.3 by their assigned \`temporal_phase\`.
    *   For each unique temporal phase present in the P1.3 output, create a \`SpecificDiachronicPhase\` object.
    *   \`phase_name\` should be the temporal phase (e.g., "Beginning", "Core Event").
    *   \`description\` should be a brief summary of what happens in this phase, derived from the descriptions of the DUs within it.
    *   \`units_involved\` must be an array of \`unit_id\`s from P1.3 that belong to this phase.
2.  Structure Summary: Provide an overall \`summary\` of the entire Specific Diachronic Structure.
3.  Visualization Hint: Optionally, provide a \`visualization_hint\` (e.g., "Linear", "Cyclical elements present", "Branching paths noted") based on the flow of phases.
4.  IV Preliminary Observation: Based on the \`independent_variable_details\` provided in the input, make a very brief, preliminary observation IF any immediate connection seems apparent between the IV and the overall diachronic structure observed. If no connection is obvious, state "No immediate IV connection apparent at this stage." This is a speculative note.
5.  Mermaid Syntax for Gantt Chart:
    *   Generate Mermaid.js syntax for a Gantt chart representing the SDS.
    *   The Gantt chart should display the \`SpecificDiachronicPhase\` objects as tasks.
    *   The title of the Gantt chart should be descriptive, like "Specific Diachronic Structure for ${input.transcript_id}".
    *   Use the \`phase_name\` for task labels. Task IDs should be derived from \`phase_name\` (sanitized for Mermaid).
    *   Order tasks by their natural temporal progression (Beginning, Early-Middle, etc.).
    *   The duration of each phase task can be heuristically based on the number of \`units_involved\` (e.g., 1 day per unit, or a fixed small duration like 2d or 3d if number of units is fairly consistent).
    *   Ensure \`dateFormat X\` and \`axisFormat %s\` are used for relative sequencing.
    Example segment for one phase: \`Beginning Phase :bgn_phase, 0, 3d\` (label:id, start_day_index, duration_days)
6.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input P1.3 MUST be copied verbatim into the main output JSON.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "specific_diachronic_structure": {
    "summary": "Overall summary of the experience's diachronic flow.",
    "phases": [
      {
        "phase_name": "Beginning",
        "description": "Summary of the beginning phase.",
        "units_involved": ["rdu_1"] // unit_ids from P1.3
      },
      {
        "phase_name": "Core Event",
        "description": "Summary of the core event phase.",
        "units_involved": ["rdu_2", "rdu_3"]
      }
      // ... more phases
    ],
    "visualization_hint": "e.g., Linear progression",
    "iv_preliminary_observation": "Brief note on potential IV connection or N/A."
  },
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)},
  "mermaid_syntax_specific_diachronic": "gantt\\ndateFormat X\\ntitle Specific Diachronic Structure for ${input.transcript_id}\\naxisFormat %s\\n\\nsection Phases\\nBeginning :ph_beginning, 0, 2d\\nCore Event :ph_core, 2, 3d\\nEnding :ph_ending, 5, 1d"
}
`,
  },
  [StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC]: {
    id: StepId.P2S_1_GROUP_UTTERANCES_BY_TOPIC,
    title: "P2S.1: Group Utterances by Topic within a Diachronic Phase",
    part: "PartII_Sync",
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentPhaseName) => {
        if (!currentTranscript?.id || !currentPhaseName) return { data: null, error: "Missing current transcript ID or phase name for P2S.1." };
        const p0_3_data = allProcessedData?.get(currentTranscript.id)?.p0_3_output;
        const p1_4_data = allProcessedData?.get(currentTranscript.id)?.p1_4_output;
        if (!p0_3_data || !p1_4_data) return { data: null, error: `Missing P0.3 or P1.4 output for transcript ${currentTranscript.id}` };
        
        const phaseObject = p1_4_data.specific_diachronic_structure.phases.find(p => p.phase_name === currentPhaseName);
        if (!phaseObject) return { data: null, error: `Phase ${currentPhaseName} not found in P1.4 output for transcript ${currentTranscript.id}` };
        
        const rduIdsInPhase = phaseObject.units_involved;
        const p1_2_du_ids = new Set<string>();
        const p1_3_data = allProcessedData?.get(currentTranscript.id)?.p1_3_output;
        rduIdsInPhase.forEach(rduId => {
            const rdu = p1_3_data?.refined_diachronic_units.find(u => u.unit_id === rduId);
            rdu?.source_p1_2_du_ids.forEach(id => p1_2_du_ids.add(id));
        });

        const segment_ids_in_phase = new Set<string>();
        const p1_2_data = allProcessedData?.get(currentTranscript.id)?.p1_2_output;
        p1_2_du_ids.forEach(duId => {
            const du = p1_2_data?.diachronic_units.find(u => u.unit_id === duId);
            du?.source_segment_ids.forEach(id => segment_ids_in_phase.add(id));
        });

        const utterances_for_phase: SelectedUtterance[] = [];
        const p1_1_data = allProcessedData?.get(currentTranscript.id)?.p1_1_output;
        segment_ids_in_phase.forEach(segId => {
            const segContainer = p1_1_data?.segmented_utterances.find(sc => sc.segments.some(s => s.segment_id === segId));
            if (segContainer && !utterances_for_phase.some(u => u.original_line_num === segContainer.original_utterance.original_line_num && u.utterance_text === segContainer.original_utterance.utterance_text)) {
                utterances_for_phase.push(segContainer.original_utterance);
            }
        });

        if (utterances_for_phase.length === 0) return { data: null, error: `No P0.3 utterances could be mapped to phase '${currentPhaseName}' for P2S.1.` };

        return {
            data: {
                transcript_id: currentTranscript.id,
                analyzed_diachronic_unit: currentPhaseName,
                utterances_for_phase_analysis: utterances_for_phase,
                independent_variable_details: p0_3_data.independent_variable_details,
                dependent_variable_focus: p0_3_data.dependent_variable_focus,
            },
        };
    },
    generatePrompt: (input: { transcript_id: string; analyzed_diachronic_unit: string; utterances_for_phase_analysis: SelectedUtterance[]; independent_variable_details: string; dependent_variable_focus: string[]; }) => `You are a micro-phenomenological analyst. Your task is to perform the first step of Specific Synchronic Analysis (P2S.1) for a GIVEN DIACHRONIC PHASE from a single transcript. This involves grouping relevant utterances by topic.
Input:
- Transcript ID: ${input.transcript_id}
- Diachronic Phase Being Analyzed: "${input.analyzed_diachronic_unit}"
- Procedural Utterances Mapped to this Diachronic Phase:
${JSON.stringify(input.utterances_for_phase_analysis, null, 2)}
- Independent Variable details: ${input.independent_variable_details}
- User-defined Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus)}

Instructions:
1.  Focus ONLY on the provided \`utterances_for_phase_analysis\`.
2.  Identify thematic content within these utterances relevant to the \`dependent_variable_focus\`.
3.  Group utterances that share a common, fine-grained theme or topic. These are your \`synchronic_thematic_groups\`.
    *   Each group should have a concise \`group_label\` (e.g., "Visual details of X", "Internal sensation of Y").
    *   Provide a \`justification\` for forming the group.
    *   List the specific \`utterances\` (original_line_num, utterance_text copied exactly from input) that belong to this group. An utterance can belong to multiple groups if appropriate, but aim for specificity.
4.  Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_diachronic_unit": "${input.analyzed_diachronic_unit}", // The phase_name being analyzed
  "synchronic_thematic_groups": [
    {
      "group_label": "Theme A about DV1",
      "justification": "These utterances all describe aspect X of DV1.",
      "utterances": [
        {"original_line_num": "10.1", "utterance_text": "text of utterance 10.1..."},
        {"original_line_num": "12", "utterance_text": "text of utterance 12..."}
      ]
    },
    {
      "group_label": "Theme B about DV2",
      "justification": "These utterances refer to experience Y of DV2.",
      "utterances": [
        {"original_line_num": "15.2", "utterance_text": "text of utterance 15.2..."}
      ]
    }
    // ... more groups
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
  },
  [StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS]: {
    id: StepId.P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS,
    title: "P2S.2: Identify Specific Synchronic Units (ISUs)",
    part: "PartII_Sync",
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentPhaseName) => {
        if (!currentTranscript?.id || !currentPhaseName) return { data: null, error: "Missing current transcript ID or phase name for P2S.2." };
        const p2s_1_data_for_phase = allProcessedData?.get(currentTranscript.id)?.p2s_outputs_by_phase?.[currentPhaseName]?.p2s_1_output;
        const p0_3_data = allProcessedData?.get(currentTranscript.id)?.p0_3_output; // For IV/DV

        if (!p2s_1_data_for_phase || !p0_3_data) return { data: null, error: `Missing P2S.1 output for phase '${currentPhaseName}' or P0.3 data for transcript ${currentTranscript.id}` };
        
        return {
            data: {
                ...p2s_1_data_for_phase, 
                independent_variable_details: p0_3_data.independent_variable_details,
                dependent_variable_focus: p0_3_data.dependent_variable_focus,
            },
        };
    },
    generatePrompt: (input: P2S_1_Output & { independent_variable_details: string; dependent_variable_focus: string[]; }) => `You are a micro-phenomenological analyst. Your task is to identify Specific Synchronic Units (ISUs) based on the thematic groups from P2S.1 for a GIVEN DIACHRONIC PHASE.
Input:
- Transcript ID: ${input.transcript_id}
- Diachronic Phase Being Analyzed: "${input.analyzed_diachronic_unit}"
- Thematic Groups from P2S.1 for this Phase:
${JSON.stringify(input.synchronic_thematic_groups, null, 2)}
- Independent Variable details: ${input.independent_variable_details}
- User-defined Dependent Variable Focus: ${JSON.stringify(input.dependent_variable_focus)}

Instructions:
1.  Focus: Transform thematic groups into a hierarchy of Incipient Synchronic Units (ISUs). An ISU is an abstraction representing a stable element of the experience within this phase.
2.  Abstraction Process (Iterative):
    *   Start with utterances in thematic groups.
    *   Level 0 ISUs: Directly represent a recurring, specific experiential detail from one or more utterances within a thematic group.
    *   Higher-Level ISUs (Level 1, 2, etc.): Formed by abstracting/generalizing from Level 0 ISUs or other lower-level ISUs.
    *   Abstraction Operations (\`abstraction_op\`): Specify the operation used (e.g., "Generalization", "Aggregation", "Structural Resemblance", "Functional Equivalence").
3.  ISU Definition:
    *   \`unit_name\`: A unique, descriptive name for the ISU (e.g., "VisualFocusOnTexture", "FeelingOfExpansion"). This name will serve as its ID. Ensure it's stable and referenceable.
    *   \`level\`: Abstraction level (0, 1, 2...).
    *   \`intensional_definition\`: A clear, concise definition of what the ISU represents.
    *   \`utterances\`: REQUIRED for Level 0 ISUs. This array MUST NOT be empty. An ISU at Level 0 can only be defined if it is directly grounded by one or more specific utterances (copied from input P2S.1 thematic groups). Each utterance object must have \`original_line_num\` and \`utterance_text\`. For Level > 0 ISUs, this field is optional or can be empty.
    *   \`constituent_lower_units\`: REQUIRED for Level > 0 ISUs. This array MUST NOT be empty. An ISU at Level > 0 can only be defined if it is formed by abstracting from one or more existing lower-level ISUs. List the \`unit_name\` strings of these lower-level ISUs. For Level 0 ISUs, this field should be empty or omitted.
4.  Grounding First: Before defining any ISU, first identify its grounding: specific utterances for Level 0 ISUs, or constituent lower-level ISU names for Level > 0 ISUs. If sufficient grounding cannot be found, do not create the ISU.
5.  Hierarchy: The final list of \`specific_synchronic_units_hierarchy\` should include all ISUs, from Level 0 up to the highest level of abstraction achieved for this phase.
6.  Preserve IV/DV: Copy \`independent_variable_details\` and \`dependent_variable_focus\` verbatim.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_diachronic_unit": "${input.analyzed_diachronic_unit}",
  "specific_synchronic_units_hierarchy": [
    {
      "unit_name": "ISU_VisualDetail_ColorA",
      "level": 0,
      "abstraction_op": "Direct Description",
      "intensional_definition": "The specific color A was perceived.",
      "utterances": [{"original_line_num": "10.1", "utterance_text": "text..."}]
    },
    {
      "unit_name": "ISU_GeneralVisualAspects",
      "level": 1,
      "abstraction_op": "Generalization",
      "intensional_definition": "General visual characteristics were noted.",
      "constituent_lower_units": ["ISU_VisualDetail_ColorA"]
    }
    // ... more ISUs
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`,
  },
  [StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE]: {
    id: StepId.P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE,
    title: "P2S.3: Define Specific Synchronic Structure (SSS)",
    part: "PartII_Sync",
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData, _genericState, _apiKeyPresent, _userDvFocus, _allRawTranscripts, currentPhaseName?: string) => {
        if (!currentTranscript || !allProcessedData) return { data: null, error: "Missing current transcript or processed data for P2S.3" };
        const transcriptData = allProcessedData.get(currentTranscript.id);
        if (!transcriptData) return { data: null, error: `No processed data found for transcript ${currentTranscript.id}` };
        const p2s_phase_data = transcriptData.p2s_outputs_by_phase?.[currentPhaseName || ''];
        if (!p2s_phase_data?.p2s_2_output) return { data: null, error: `P2S.2 output not found for phase "${currentPhaseName}" in P2S.3` };
        return { data: p2s_phase_data.p2s_2_output }; // P2S.2 output contains ISUs with unit_names
    },
    generatePrompt: (input: P2S_2_Output) => `You are a micro-phenomenological analyst. Task: Final step of Specific Synchronic Analysis - Define the Specific Synchronic Structure (SSS) as a semantic network.
Input:
JSON output from P2S.2 (ISU hierarchy, where each ISU has a unique \`unit_name\`) for transcript ID ${input.transcript_id} and diachronic unit/phase "${input.analyzed_diachronic_unit}".
${JSON.stringify(input, null, 2)}

Instructions:
1.  Model ISUs as Network: Transform the \`specific_synchronic_units_hierarchy\` from P2S.2 into a semantic network. ISUs become nodes. Relationships (hierarchical, associative) become links.
2.  Define Nodes: Each node in \`network_nodes\` corresponds to an ISU from P2S.2.
    *   \`id\`: A unique ID for this SSS network node (e.g., "sss_node_VisualQualityVivid"). Can be based on the ISU's \`unit_name\`.
    *   \`label\`: A descriptive label for the node, typically the ISU's \`unit_name\` or \`intensional_definition\`.
    *   \`source_isu_id\`: The \`unit_name\` of the ISU from P2S.2 that this network node represents. This is crucial for traceability.
3.  Define Links: Links in \`network_links\` connect these SSS nodes.
    *   \`from\`: The \`id\` of the source SSS network node.
    *   \`to\`: The \`id\` of the target SSS network node.
    *   \`type\`: Describe the relationship (e.g., 'is_part_of', 'influences', 'is_characterized_by').
4.  Carry Forward IV/DV: Include \`independent_variable_details\` and \`dependent_variable_focus\` from input.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "transcript_id": "${input.transcript_id}",
  "analyzed_diachronic_unit": "${input.analyzed_diachronic_unit}",
  "specific_synchronic_structure": {
    "representation_type": "Semantic Network",
    "description": "Brief overall description of this SSS.",
    "network_nodes": [
      {
        "id": "sss_node_ISUName1", // Unique ID for this SSS node
        "label": "Label for ISUName1",
        "source_isu_id": "ISU_Example_Concrete" // unit_name from P2S.2
      }
      // ... more nodes
    ],
    "network_links": [
      {
        "from": "sss_node_ISUName2", // SSS node ID
        "to": "sss_node_ISUName1",   // SSS node ID
        "type": "is_part_of"
      }
      // ... more links
    ]
  },
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
Do NOT include a "mermaid_syntax_specific_synchronic" field; this will be generated by the system later.

BEGIN SPECIFIC SYNCHRONIC ANALYSIS (STEP 3 - SSS Definition) FOR:
Transcript ID: ${input.transcript_id}
Analyzed Diachronic Unit/Phase: ${input.analyzed_diachronic_unit}
DV Focus: ${JSON.stringify(input.dependent_variable_focus)}
IV Details: "${input.independent_variable_details}"`,
  },
  [StepId.P3_1_ALIGN_STRUCTURES]: {
    id: StepId.P3_1_ALIGN_STRUCTURES,
    title: "P3.1: Align Specific Structures & Consider IVs",
    part: "PartIII_GenDia",
    isJsonOutput: true,
    getInput: (_, allProcessedData, __, apiKeyPresent, userDvFocus) => {
        if (!apiKeyPresent) return { data: null, error: "API Key not set." };
        if (!allProcessedData || allProcessedData.size === 0) return { data: null, error: "No processed transcript data available for P3.1." };
        const specific_diachronic_structures: any[] = [];
        allProcessedData.forEach(data => {
            if (data.p1_4_output) { 
                specific_diachronic_structures.push({
                    transcript_id: data.id,
                    filename: data.filename,
                    independent_variable_details: data.p1_4_output.independent_variable_details, 
                    dependent_variable_focus: data.p1_4_output.dependent_variable_focus, 
                    specific_diachronic_structure: data.p1_4_output.specific_diachronic_structure
                });
            }
        });
        if (specific_diachronic_structures.length === 0) return { data: null, error: "No specific diachronic structures (P1.4 outputs) found for P3.1." };
        return { data: { all_specific_diachronic_structures: specific_diachronic_structures, global_dv_focus: userDvFocus?.dv_focus } };
    },
    generatePrompt: (input: { all_specific_diachronic_structures: any[], global_dv_focus: string[] }) => `You are a Generic Diachronic Analysis assistant. Task: Align multiple Specific Diachronic Structures (SDS) and analyze IV correlations.
Input:
An array of all P1.4 outputs (\`all_specific_diachronic_structures\`). Each element includes \`transcript_id\`, \`filename\`, \`independent_variable_details\`, \`dependent_variable_focus\`, and the \`specific_diachronic_structure\` object (which contains \`summary\`, \`phases\`, etc.).
The global \`dependent_variable_focus\` is also provided.
${JSON.stringify(input, null, 2)}

Instructions:
1.  Compare SDSs: Analyze the provided SDSs. Look for common sequences of phases, recurring patterns of DUs within phases (referenced by their IDs in \`units_involved\` within each phase), and variations in structure (e.g., missing/additional phases, different DU emphasis).
2.  Correlate with IVs: For each SDS, its \`independent_variable_details\` is provided. Systematically compare structures from transcripts with different IVs. Identify how IVs might correlate with structural variations. Note patterns (e.g., 'Participants with low scores consistently show shorter initial phases and more DUs related to uncertainty.').
3.  Summarize Findings: Report on common patterns, key differences, and observed IV correlations.
Output:
A JSON object adhering EXACTLY to the following structure:
{
  "aligned_structures_report": "Detailed comparison of structures, highlighting similarities and differences.",
  "common_patterns_summary": "Summary of common diachronic patterns observed across transcripts.",
  "key_differences": ["List of significant structural differences noted, possibly linked to IVs."],
  "dependent_variable_focus": ${JSON.stringify(input.global_dv_focus)}
}`,
  },
  [StepId.P3_2_IDENTIFY_GDUS]: {
    id: StepId.P3_2_IDENTIFY_GDUS,
    title: (() => {
      switch (P3_2_APPROACH) {
        case 'minimal_context_tsv':
        case 'zero_context_tsv':
          return "P3.2: Classify RDUs for GDU Identification";
        case 'full_context_tsv':
          return "P3.2: Classify RDUs (Full Context TSV)";
        case 'minified':
          return "P3.2: Identify GDUs (Minified JSON)";
        default:
          return "P3.2: Identify Generic Diachronic Units (GDUs)";
      }
    })(),
    part: "PartIII_GenDia",
    isJsonOutput: true,
    getInput: (() => {
      switch (P3_2_APPROACH) {
        case 'minimal_context_tsv':
        case 'zero_context_tsv':
          return getTwoPhaseP3_2_Input;
        case 'full_context_tsv':
          return getFullContextTsvP3_2_Input;
        case 'minified':
          return getMinifiedP3_2_Input;
        default:
          return getOriginalP3_2_Input;
      }
    })(),
    generatePrompt: (() => {
      switch (P3_2_APPROACH) {
        case 'minimal_context_tsv':
        case 'zero_context_tsv':
          return generateTwoPhaseP3_2_Prompt;
        case 'full_context_tsv':
          return generateFullContextTsvP3_2_Prompt;
        case 'minified':
          return generateMinifiedP3_2_Prompt;
        default:
          return generateOriginalP3_2_Prompt;
      }
    })(),
    validateAndClean: validateAndCleanP3_2_Output,
  },
  [StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE]: {
    id: StepId.P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE,
    title: "P3.3: Define Generic Diachronic Structure (GDS)",
    part: "PartIII_GenDia",
    isJsonOutput: true,
    getInput: (_, __, genericState, apiKeyPresent, userDvFocus) => {
        if (!apiKeyPresent) return { data: null, error: "API Key not set." };
        if (!genericState?.p3_1_output || !genericState?.p3_2_output) return { data: null, error: "P3.1 or P3.2 output not found for P3.3." };
        return { data: { p3_1_output: genericState.p3_1_output, p3_2_output: genericState.p3_2_output, global_dv_focus: userDvFocus?.dv_focus } };
    },
    generatePrompt: (input: { p3_1_output: P3_1_Output, p3_2_output: P3_2_Output, global_dv_focus: string[] }) => `You are a Generic Diachronic Analysis assistant. Task: Define the Generic Diachronic Structure (GDS) using GDUs and IV insights.
Input:
- P3.1 output (\`aligned_structures_report\`, etc.).
- P3.2 output (\`identified_gdus\`, where each GDU has a \`gdu_id\`).
- Global DV focus.
${JSON.stringify(input, null, 2)}

Instructions:
1.  Construct GDS: Based on \`aligned_structures_report\` (from P3.1) and \`identified_gdus\` (from P3.2), define the GDS. This includes:
    *   \`name\`: A descriptive name for the GDS.
    *   \`description\`: An overall description of the GDS.
    *   \`core_gdus\`: An array of \`gdu_id\` strings (from P3.2 input) that are essential to this GDS.
    *   \`optional_gdus\` (Optional): An array of \`gdu_id\` strings that may appear.
    *   \`typical_sequence\` (Optional): An array of \`gdu_id\` strings representing a common temporal order.
2.  Summarize IV Variants: Explain how the GDS might vary based on different IVs, drawing from previous IV notes in P3.1 and P3.2.
3.  Confidence: State your confidence (e.g., "High", "Medium", "Low") in the defined GDS.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "generic_diachronic_structure_definition": {
    "name": "GDS Name",
    "description": "Overall GDS description.",
    "core_gdus": ["GDU_Core1_id", "GDU_Core2_id"], // gdu_ids from P3.2 input
    "optional_gdus": ["GDU_Optional1_id"],
    "typical_sequence": ["GDU_Core1_id", "GDU_Optional1_id", "GDU_Core2_id"]
  },
  "variants_summary": "Summary of GDS variants based on IVs.",
  "confidence_level": "High/Medium/Low",
  "dependent_variable_focus": ${JSON.stringify(input.global_dv_focus)}
}
Do NOT include a "mermaid_syntax_generic_diachronic" field; this will be generated by the system later.`,
  },
  [StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES]: {
    id: StepId.P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES,
    title: "P4S.1.A: Identify & Group SSS Nodes for GDU",
    part: "PartIV_GenSync",
    isJsonOutput: true,
    getInput: (_, allProcessedData, genericState, apiKeyPresent, userDvFocus) => {
        if (!apiKeyPresent) return { data: null, error: "API Key not set." };
        if (!allProcessedData || allProcessedData.size === 0) return { data: null, error: "No processed transcript data available." };
        if (!genericState?.p3_2_output?.identified_gdus || genericState.p3_2_output.identified_gdus.length === 0) { return { data: null, error: "No GDUs identified from P3.2 to analyze." }; }

        const currentGDUToAnalyze = genericState.current_gdu_for_p4s_processing;
        if (!currentGDUToAnalyze) { return { data: null, error: "Current GDU for P4S analysis not set in generic state." }; }

        const gduDef = genericState.p3_2_output.identified_gdus.find(g => g.gdu_id === currentGDUToAnalyze);
        if (!gduDef) return { data: null, error: `Definition for GDU '${currentGDUToAnalyze}' not found.` };
        const contributingRefinedDuInfo = gduDef.contributing_refined_du_ids;

        console.log(`[P4S.1.A getInput] Building TSV + Mermaid input for GDU ${currentGDUToAnalyze}`);

        // Helper function to check if an ISU is grounded in utterances
        const isNodeGrounded = (isuName: string, hierarchy: P2S_2_Output['specific_synchronic_units_hierarchy'], memo: Map<string, boolean>): boolean => {
            console.log(`[P4S.1.A isNodeGrounded] Checking grounding for ISU: ${isuName}`);
            
            if (memo.has(isuName)) {
                const memoResult = memo.get(isuName)!;
                console.log(`[P4S.1.A isNodeGrounded] Found memoized result for ${isuName}: ${memoResult}`);
                return memoResult;
            }
            
            const isu = hierarchy.find(u => u.unit_name === isuName);
            if (!isu) { 
                console.log(`[P4S.1.A isNodeGrounded] ISU ${isuName} not found in hierarchy! Available ISUs: ${hierarchy.map(u => u.unit_name).join(', ')}`);
                memo.set(isuName, false); 
                return false; 
            }
            
            console.log(`[P4S.1.A isNodeGrounded] Found ISU ${isuName} - level: ${isu.level}, utterances: ${isu.utterances?.length || 0}, constituent_lower_units: ${isu.constituent_lower_units?.length || 0}`);
            
            // Check direct utterances
            if (isu.utterances && isu.utterances.length > 0) { 
                console.log(`[P4S.1.A isNodeGrounded] ✓ ISU ${isuName} is directly grounded with ${isu.utterances.length} utterances`);
                console.log(`[P4S.1.A isNodeGrounded] Utterances for ${isuName}:`, isu.utterances.map(u => `Line ${u.original_line_num}: "${u.utterance_text.substring(0, 50)}..."`));
                memo.set(isuName, true); 
                return true; 
            }
            
            // Check if no lower units (leaf node)
            if (!isu.constituent_lower_units || isu.constituent_lower_units.length === 0) { 
                console.log(`[P4S.1.A isNodeGrounded] ISU ${isuName} is a leaf node with no utterances - marking as ungrounded`);
                memo.set(isuName, false); 
                return false; 
            }
            
            // Check constituent lower units recursively
            console.log(`[P4S.1.A isNodeGrounded] ISU ${isuName} has ${isu.constituent_lower_units.length} constituent lower units: ${isu.constituent_lower_units.join(', ')}`);
            for (const lowerUnit of isu.constituent_lower_units) {
                console.log(`[P4S.1.A isNodeGrounded] Checking constituent lower unit: ${lowerUnit} for parent ${isuName}`);
                if (isNodeGrounded(lowerUnit, hierarchy, memo)) { 
                    console.log(`[P4S.1.A isNodeGrounded] ✓ ISU ${isuName} is grounded through constituent lower unit: ${lowerUnit}`);
                    memo.set(isuName, true); 
                    return true; 
                } else {
                    console.log(`[P4S.1.A isNodeGrounded] ✗ Constituent lower unit ${lowerUnit} is not grounded`);
                }
            }
            
            console.log(`[P4S.1.A isNodeGrounded] ISU ${isuName} is not grounded - no direct utterances and no grounded constituent lower units`);
            memo.set(isuName, false);
            return false;
        };

        // Phase 1: Build TSV "Parts List" and collect Mermaid data
        const tsvRows: string[] = ["transcript_id\tphase_name\tsss_node_id\tsss_node_label\tisu_definition"]; // TSV header
        const mermaidSections: string[] = [];
        const validatedTranscriptIds = new Set<string>();

        console.log(`[P4S.1.A getInput] Processing ${allProcessedData.size} transcripts for GDU ${currentGDUToAnalyze}`);
        console.log(`[P4S.1.A getInput] Contributing refined DU info:`, contributingRefinedDuInfo);

        allProcessedData.forEach(tData => {
            console.log(`[P4S.1.A getInput] Processing transcript: ${tData.id}`);
            
            const relevantRefinedDuIdsFromThisTranscript = contributingRefinedDuInfo.filter(info => info.transcript_id === tData.id).map(info => info.refined_du_id);
            console.log(`[P4S.1.A getInput] Relevant refined DU IDs for ${tData.id}:`, relevantRefinedDuIdsFromThisTranscript);
            
            if (relevantRefinedDuIdsFromThisTranscript.length === 0) {
                console.log(`[P4S.1.A getInput] No relevant refined DU IDs for transcript ${tData.id}, skipping`);
                return;
            }
            
            if (!tData.p1_4_output?.specific_diachronic_structure.phases || !tData.p2s_outputs_by_phase) {
                console.log(`[P4S.1.A getInput] Missing required data for transcript ${tData.id}: p1_4_output=${!!tData.p1_4_output}, p2s_outputs_by_phase=${!!tData.p2s_outputs_by_phase}`);
                return;
            }

            console.log(`[P4S.1.A getInput] Processing ${tData.p1_4_output.specific_diachronic_structure.phases.length} phases for transcript ${tData.id}`);
            
            tData.p1_4_output.specific_diachronic_structure.phases.forEach(phase => {
                console.log(`[P4S.1.A getInput] Processing phase: ${phase.phase_name} with units_involved:`, phase.units_involved);
                
                const phaseUsesRelevantRefinedDU = phase.units_involved.some(unitId => relevantRefinedDuIdsFromThisTranscript.includes(unitId));
                console.log(`[P4S.1.A getInput] Phase ${phase.phase_name} uses relevant refined DU: ${phaseUsesRelevantRefinedDU}`);
                
                if (!phaseUsesRelevantRefinedDU) {
                    console.log(`[P4S.1.A getInput] Phase ${phase.phase_name} does not use relevant refined DU, skipping`);
                    return;
                }

                const phaseData = tData.p2s_outputs_by_phase?.[phase.phase_name];
                console.log(`[P4S.1.A getInput] Phase data for ${phase.phase_name}:`, phaseData ? Object.keys(phaseData) : 'null');
                if (!phaseData?.p2s_3_output?.specific_synchronic_structure || !phaseData.p2s_2_output?.specific_synchronic_units_hierarchy) {
                    console.log(`[P4S.1.A getInput] Missing P2S data for phase ${phase.phase_name}: p2s_3_output=${!!phaseData?.p2s_3_output}, p2s_2_output=${!!phaseData?.p2s_2_output}`);
                    if (phaseData) {
                        console.log(`[P4S.1.A getInput] Available phase data keys for ${phase.phase_name}:`, Object.keys(phaseData));
                        if (phaseData.p2s_2_output) {
                            console.log(`[P4S.1.A getInput] P2S.2 output exists but missing specific_synchronic_units_hierarchy:`, !!phaseData.p2s_2_output.specific_synchronic_units_hierarchy);
                        }
                    }
                    return;
                }

                const sss = phaseData.p2s_3_output.specific_synchronic_structure;
                const isuHierarchy = phaseData.p2s_2_output.specific_synchronic_units_hierarchy;
                const groundingMemo = new Map<string, boolean>();
                
                console.log(`[P4S.1.A getInput] Phase ${phase.phase_name} has ${sss.network_nodes.length} SSS nodes and ${isuHierarchy.length} ISUs`);
                console.log(`[P4S.1.A getInput] ISU hierarchy for phase ${phase.phase_name}:`, isuHierarchy.map(isu => `${isu.unit_name} (level ${isu.level}, ${isu.utterances?.length || 0} utterances, ${isu.constituent_lower_units?.length || 0} lower units)`));
                console.log(`[P4S.1.A getInput] SSS nodes for phase ${phase.phase_name}:`, sss.network_nodes.map(node => `${node.id} -> ${node.source_isu_id} (${node.label})`));

                // Build Mermaid section for this transcript-phase
                const mermaidPhaseId = `${tData.id}_${phase.phase_name}`.replace(/[^a-zA-Z0-9_]/g, '_');
                const mermaidLines = [`    subgraph ${mermaidPhaseId} ["${tData.id} - ${phase.phase_name}"]`];
                
                // Process each SSS node
                let groundedNodeCount = 0;
                sss.network_nodes.forEach(node => {
                    console.log(`[P4S.1.A getInput] Processing SSS node ${node.id} with source_isu_id: ${node.source_isu_id}`);
                    const isGrounded = isNodeGrounded(node.source_isu_id, isuHierarchy, groundingMemo);
                    console.log(`[P4S.1.A getInput] SSS node ${node.id} (${node.source_isu_id}) in ${tData.id}/${phase.phase_name}: grounded=${isGrounded}`);
                    
                    if (isGrounded) {
                        groundedNodeCount++;
                        // Find the ISU definition for this node
                        const sourceIsu = isuHierarchy.find(isu => isu.unit_name === node.source_isu_id);
                        const isuDefinition = sourceIsu?.intensional_definition || "No definition available";

                        // Add to TSV
                        const tsvRow = [
                            tData.id,
                            phase.phase_name,
                            node.id,
                            node.label,
                            isuDefinition.replace(/\t/g, ' ').replace(/\n/g, ' ') // Clean for TSV
                        ].join('\t');
                        tsvRows.push(tsvRow);

                        // Add to Mermaid
                        mermaidLines.push(`        ${node.id}["${node.label}"]`);
                        
                        validatedTranscriptIds.add(tData.id);
                    } else {
                        console.log(`[P4S.1.A getInput] EXCLUDED ungrounded SSS node ${node.id} (source_isu_id: ${node.source_isu_id}) from TSV`);
                    }
                });
                
                console.log(`[P4S.1.A getInput] Phase ${phase.phase_name} summary: ${groundedNodeCount}/${sss.network_nodes.length} SSS nodes are grounded`);

                // Add SSS links to Mermaid
                sss.network_links.forEach(link => {
                    // Only include links where both nodes are grounded
                    const fromNodeGrounded = sss.network_nodes.some(n => n.id === link.from && isNodeGrounded(n.source_isu_id, isuHierarchy, groundingMemo));
                    const toNodeGrounded = sss.network_nodes.some(n => n.id === link.to && isNodeGrounded(n.source_isu_id, isuHierarchy, groundingMemo));
                    if (fromNodeGrounded && toNodeGrounded) {
                        mermaidLines.push(`        ${link.from} --> ${link.to}`);
                    }
                });

                mermaidLines.push(`    end`);
                mermaidSections.push(mermaidLines.join('\n'));
            });
        });

        // Validation checks
        console.log(`[P4S.1.A getInput] Final validation - TSV rows: ${tsvRows.length} (including header), validated transcript IDs: ${validatedTranscriptIds.size}`);
        console.log(`[P4S.1.A getInput] TSV content:`, tsvRows.slice(0, 5)); // Show first 5 rows including header
        console.log(`[P4S.1.A getInput] Validated transcripts:`, Array.from(validatedTranscriptIds));
        
        if (tsvRows.length <= 1) { // Only header row
            const errorMsg = `No utterance-grounded SSS nodes found for GDU ${currentGDUToAnalyze}. Cannot proceed with generic synchronic analysis.`;
            console.error(`[P4S.1.A getInput] ${errorMsg}`);
            console.error(`[P4S.1.A getInput] DEBUG INFO:`);
            console.error(`[P4S.1.A getInput] - Total transcripts processed: ${allProcessedData.size}`);
            console.error(`[P4S.1.A getInput] - GDU being processed: ${currentGDUToAnalyze}`);
            console.error(`[P4S.1.A getInput] - Contributing refined DU info:`, contributingRefinedDuInfo);
            console.error(`[P4S.1.A getInput] - Validated transcript IDs: ${Array.from(validatedTranscriptIds)}`);
            console.error(`[P4S.1.A getInput] - TSV rows: ${tsvRows}`);
            
            // Additional debugging: show what transcripts have relevant data
            allProcessedData.forEach(tData => {
                const relevantRefinedDuIds = contributingRefinedDuInfo.filter(info => info.transcript_id === tData.id);
                console.error(`[P4S.1.A getInput] Transcript ${tData.id}: ${relevantRefinedDuIds.length} relevant refined DUs, has p1_4_output: ${!!tData.p1_4_output}, has p2s_outputs_by_phase: ${!!tData.p2s_outputs_by_phase}`);
                if (relevantRefinedDuIds.length > 0) {
                    console.error(`[P4S.1.A getInput] - Relevant refined DU IDs for ${tData.id}:`, relevantRefinedDuIds.map(info => info.refined_du_id));
                }
            });
            
            return { data: null, error: errorMsg };
        }

        const MINIMUM_TRANSCRIPT_DIVERSITY = 2;
        if (validatedTranscriptIds.size < MINIMUM_TRANSCRIPT_DIVERSITY) {
            const errorMsg = `Insufficient transcript diversity for GDU ${currentGDUToAnalyze}: found grounded nodes from ${validatedTranscriptIds.size} transcripts (${Array.from(validatedTranscriptIds)}), require at least ${MINIMUM_TRANSCRIPT_DIVERSITY} for Generic Synchronic Structure.`;
            console.error(`[P4S.1.A getInput] ${errorMsg}`);
            return { data: null, error: errorMsg };
        }

        // Build final TSV and Mermaid strings
        const nodesTsv = tsvRows.join('\n');
        const structuresMermaid = `graph TD\n${mermaidSections.join('\n')}`;

        console.log(`[P4S.1.A getInput] Generated TSV with ${tsvRows.length - 1} nodes from ${validatedTranscriptIds.size} transcripts`);
        console.log(`[P4S.1.A getInput] Generated Mermaid with ${mermaidSections.length} phase diagrams`);

        return {
            data: {
                gdu_to_analyze_id: currentGDUToAnalyze,
                gdu_definition: gduDef.definition,
                nodes_tsv: nodesTsv,
                structures_mermaid: structuresMermaid,
                global_dv_focus: userDvFocus?.dv_focus
            }
        };
    },
    generatePrompt: (input: { gdu_to_analyze_id: string, gdu_definition: string, nodes_tsv: string, structures_mermaid: string, global_dv_focus: string[] }) => `You are a Generic Synchronic Classification assistant. Your task is to analyze a list of Specific Synchronic Structure (SSS) nodes and classify them into cross-transcript semantic groups for Generic Synchronic Structure (GSS) formation.

**CRITICAL INSTRUCTION: You MUST NOT invent, create, or hallucinate any sss_node_id that is not explicitly present in the input TSV. Every single sss_node_id in your output must be exactly copied from the input.**

## Input Data

**GDU to Analyze:** ${input.gdu_to_analyze_id}
**GDU Definition:** ${input.gdu_definition}
**Global DV Focus:** ${JSON.stringify(input.global_dv_focus)}

### Nodes TSV (Parts List)
Each row represents a validated, utterance-grounded SSS node with its semantic definition:

\`\`\`
${input.nodes_tsv}
\`\`\`

### Structures Mermaid (Assembly Diagram)
Visual context showing how these nodes relate within their original transcript-phase structures:

\`\`\`mermaid
${input.structures_mermaid}
\`\`\`

## Your Task: Node Classification

Your task is to analyze each node in the TSV and determine which cross-transcript semantic group it belongs to, if any.

**Classification Rules:**
1. **Semantic Analysis:** Use both the \`sss_node_label\` and \`isu_definition\` to understand what each node represents
2. **Cross-Transcript Requirement:** Only create groups that contain nodes from **at least 2 different transcript_ids**
3. **Semantic Similarity:** Group nodes that represent the same generic concept, even if their labels differ
4. **Exclusion Option:** If a node doesn't fit with any cross-transcript group, assign it \`group_id: "N/A"\`

## Required Output Format

You MUST return a JSON object with this exact structure:

\`\`\`json
{
  "analyzed_gdu": "${input.gdu_to_analyze_id}",
  "grouped_data": [
    {
      "sss_node_id": "(exactly copied from TSV)",
      "transcript_id": "(exactly copied from TSV)",
      "phase_name": "(exactly copied from TSV)",
      "sss_node_label": "(exactly copied from TSV)",
      "group_id": "generic_concept_name_or_N/A",
      "group_rationale": "Brief explanation of why this node belongs to this group"
    }
    // ... one object for EVERY sss_node_id from the input TSV
  ],
  "classification_notes": "Optional notes about your classification decisions"
}
\`\`\`

**VERIFICATION REQUIREMENT:** Your \`grouped_data\` array must contain exactly one object for every single \`sss_node_id\` that appears in the input TSV. Do not skip any nodes, and do not invent any new ones.`,
  },
  [StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS]: {
    id: StepId.P4S_1_B_DEFINE_GSS_FROM_GROUPS,
    title: "P4S.1.B: Define GSS from SSS Node Groups",
    part: "PartIV_GenSync",
    isJsonOutput: true,
    getInput: (_, __, genericState, apiKeyPresent, userDvFocus, ___, ____, currentGduName) => {
        console.log("[P4S.1.B getInput] Starting...");
        if (!apiKeyPresent) return { data: null, error: "API Key not set." };
        if (!currentGduName) return { data: null, error: "Current GDU for P4S.1.B analysis not set." };

        const p4s_1_a_output_for_gdu = genericState?.p4s_1_a_outputs_by_gdu?.[currentGduName];
        if (!p4s_1_a_output_for_gdu) return { data: null, error: `Missing P4S.1.A output (SSS node groups) for GDU '${currentGduName}'. Cannot proceed with P4S.1.B.` };
        
        console.log(`[P4S.1.B getInput] Found P4S.1.A output for GDU ${currentGduName} with ${p4s_1_a_output_for_gdu.sss_node_groups?.length || 0} groups.`);
        return {
            data: {
                p4s_1_a_data: p4s_1_a_output_for_gdu, // Contains analyzed_gdu, sss_node_groups, dependent_variable_focus
                global_dv_focus: userDvFocus?.dv_focus // Ensure global_dv_focus is also available if needed for consistency check
            }
        };
    },
    generatePrompt: (input: { p4s_1_a_data: P4S_1_A_Output, global_dv_focus: string[] }) => `You are a Generic Synchronic Analysis assistant. Your task is to define a Generic Synchronic Structure (GSS) for a specific GDU by abstracting from the provided groups of SSS nodes. This is step P4S.1.B.
Input:
- Data from P4S.1.A for GDU "${input.p4s_1_a_data.analyzed_gdu}":
  - Analyzed GDU ID: "${input.p4s_1_a_data.analyzed_gdu}"
  - SSS Node Groups (\`sss_node_groups\`). Each group has a rationale and a list of \`contributing_sss_nodes\` from various transcripts:
    \`\`\`json
    ${JSON.stringify(input.p4s_1_a_data.sss_node_groups, null, 2)}
    \`\`\`
  - Dependent Variable Focus from P4S.1.A: ${JSON.stringify(input.p4s_1_a_data.dependent_variable_focus)}
- Global DV Focus (for consistency check): ${JSON.stringify(input.global_dv_focus)}

Instructions:
1.  **Define Generic Categories from SSS Node Groups:** For each \`SSSNodeGroup\` in the input, define a corresponding generic category in the output's \`generic_nodes_categories\`. The category's \`label\` should be an abstraction of the \`group_rationale\`. Assign a unique \`id\` (e.g., "gss_cat_CognitiveProcessing").
2.  **Define Generic Links:** Infer relationships **between the SSS node groups** to create \`generic_network_links\` between your new generic categories.
3.  **MANDATORY: Populate Instantiation Notes with Traceability:** This is the most critical step. For EACH generic category you create, you MUST create a corresponding \`instantiation_notes\` object.
    *   The \`generic_category_id\` MUST match the ID of the generic category it describes.
    *   The \`example_specific_nodes\` array in your output **MUST** be populated **directly and exactly** from the \`contributing_sss_nodes\` array of the corresponding \`SSSNodeGroup\` from the input. Copy the \`transcript_id\`, \`sss_node_id\`, and \`phase_name\` for each contributing node. **DO NOT invent, summarize, or omit these examples.** This provides a verifiable audit trail.
4.  **Optional IV Observations:** In \`variations_notes\`, if you notice patterns in the SSS node groups that coincidentally align with different Independent Variables from the source transcripts, you may note them as incidental observations. This is not a primary focus of the analysis.
5.  **Final JSON:** Ensure the final output is a single, valid JSON object adhering to the specified structure. Do not add any text or markdown outside the JSON.

Output:
A JSON object adhering EXACTLY to the following structure. The \`example_specific_nodes\` array within each \`instantiation_notes\` object MUST NOT be empty and must be populated from the input.
{
  "analyzed_gdu": "${input.p4s_1_a_data.analyzed_gdu}",
  "generic_synchronic_structure": {
    "representation_type": "Semantic Network",
    "description": "Description of GSS for GDU '${input.p4s_1_a_data.analyzed_gdu}', derived from SSS node groups.",
    "generic_nodes_categories": [
      {"id": "gss_cat_FromGroup1", "label": "Generic Concept from SSS Group 1"}
    ],
    "generic_network_links": [
      {"from": "gss_cat_FromGroup1", "to": "gss_cat_FromGroup2", "type": "is_related_to"}
    ],
    "instantiation_notes": [
      {
        "generic_category_id": "gss_cat_FromGroup1",
        "textual_description": "This category is instantiated by specific SSS nodes related to X, as identified in SSS Group Y.",
        "example_specific_nodes": [ 
          { "transcript_id": "(from input SSSNodeGroup)", "sss_node_id": "(from input SSSNodeGroup)", "phase_name": "(from input SSSNodeGroup)" }
        ]
      }
    ]
  },
  "variations_notes": "Optional: Incidental observations about patterns that coincidentally align with IVs, if any are noticed.",
  "dependent_variable_focus": ${JSON.stringify(input.p4s_1_a_data.dependent_variable_focus)}
}
Do NOT include a "mermaid_syntax_generic_synchronic" field; this will be generated by the system later.`,
  },
  [StepId.P5_1_IV_COMPARATIVE_ANALYSIS]: {
    id: StepId.P5_1_IV_COMPARATIVE_ANALYSIS,
    title: "P5.1: IV-Centric Comparative Analysis",
    part: "PartV_Refine",
    isJsonOutput: true,
    getInput: (_, allProcessedData, genericState, apiKeyPresent) => {
        if (!apiKeyPresent) return { data: null, error: "API Key not set." };
        if (!allProcessedData || allProcessedData.size === 0) return { data: null, error: "No processed transcript data available." };
        if (!genericState?.p3_3_output || !genericState?.p4s_outputs_by_gdu) { 
            return { data: null, error: "Generic Diachronic (P3.3) or Generic Synchronic (P4S.1.B outputs by GDU) data not found." }; 
        }
        
        // Build efficient lookup map for RDU to GDU mapping
        const rduToGduMap = new Map<string, { transcript_id: string; gdu_id: string }>();
        if (genericState.p3_2_output?.identified_gdus) {
            genericState.p3_2_output.identified_gdus.forEach(gdu => {
                gdu.contributing_refined_du_ids.forEach(rdu => {
                    const key = `${rdu.transcript_id}|${rdu.refined_du_id}`;
                    rduToGduMap.set(key, { transcript_id: rdu.transcript_id, gdu_id: gdu.gdu_id });
                });
            });
        }
        
        // Group transcripts by IV condition
        const transcriptsByIv = new Map<string, Array<{id: string; filename: string; gdu_sequence: string[]}>>();
        allProcessedData.forEach(tData => {
            const iv = tData.p_neg1_1_output?.independent_variable_details;
            if (!iv) {
                console.warn(`Transcript ${tData.id} missing IV details, skipping from comparative analysis`);
                return; // Skip this transcript
            }
            if (!transcriptsByIv.has(iv)) {
                transcriptsByIv.set(iv, []);
            }
            
            // Extract GDU sequence from P3.2 output using efficient lookup
            const gduSequence: string[] = [];
            
            // Get RDUs for this transcript from P1.3 output
            const p1_3_output = tData.p1_3_output;
            if (p1_3_output?.refined_diachronic_units) {
                // Define phase order for consistent temporal sorting
                const phaseOrder: Record<string, number> = {
                    "Beginning": 0, "Start": 0, "Initial": 0,
                    "Early": 1, "Early-Middle": 1,
                    "Core": 2, "Core Event": 2, "Middle": 2, "Peak": 2,
                    "Late": 3, "Late-Middle": 3,
                    "End": 4, "Ending": 4, "Final": 4, "Conclusion": 4,
                    "Reflection": 5, "Post": 5, "After": 5,
                    "Transition": 6, "Between": 6,
                    "Other": 99
                };
                
                // Sort RDUs by temporal phase and then by unit_id for consistent ordering
                const sortedRdus = [...p1_3_output.refined_diachronic_units].sort((a, b) => {
                    const phaseA = phaseOrder[a.temporal_phase] ?? 99;
                    const phaseB = phaseOrder[b.temporal_phase] ?? 99;
                    
                    if (phaseA !== phaseB) return phaseA - phaseB;
                    return compareRduIds(a.unit_id, b.unit_id);
                });
                
                // Map each RDU to its GDU
                sortedRdus.forEach(rdu => {
                    const key = `${tData.id}|${rdu.unit_id}`;
                    const mapping = rduToGduMap.get(key);
                    if (mapping) {
                        // Only add if different from last GDU (avoid consecutive duplicates)
                        if (gduSequence.length === 0 || gduSequence[gduSequence.length - 1] !== mapping.gdu_id) {
                            gduSequence.push(mapping.gdu_id);
                        }
                    }
                });
            }
            
            transcriptsByIv.get(iv)!.push({
                id: tData.id,
                filename: tData.filename,
                gdu_sequence: gduSequence
            });
        });
        
        // Validate we have IV groups to analyze
        if (transcriptsByIv.size === 0) {
            return { data: null, error: "No transcripts with valid IV data found for comparative analysis." };
        }
        
        // Handle single IV condition gracefully
        if (transcriptsByIv.size === 1) {
            const [singleIv, transcripts] = Array.from(transcriptsByIv.entries())[0];
            console.log(`Only one IV condition found: "${singleIv}". P5.1 will provide a summary without comparison.`);
            
            // Return data that indicates single condition analysis
            const singleIvSummary = [{
                iv_condition: singleIv,
                transcript_ids: transcripts.map(t => t.id),
                gdu_sequences: transcripts.map(t => ({
                    transcript_id: t.id,
                    sequence: t.gdu_sequence
                }))
            }];
            
            return {
                data: {
                    generic_diachronic_structure: genericState.p3_3_output,
                    generic_synchronic_structures_by_gdu: genericState.p4s_outputs_by_gdu,
                    iv_group_summaries: singleIvSummary,
                    all_identified_gdus: genericState.p3_2_output?.identified_gdus || [],
                    is_single_iv_condition: true  // Flag to indicate single condition
                }
            };
        }
        
        // Prepare IV group summaries
        const ivGroupSummaries = Array.from(transcriptsByIv.entries()).map(([iv, transcripts]) => ({
            iv_condition: iv,
            transcript_ids: transcripts.map(t => t.id),
            gdu_sequences: transcripts.map(t => ({
                transcript_id: t.id,
                sequence: t.gdu_sequence
            }))
        }));
        
        // Validate that we have meaningful data to analyze
        const hasNonEmptySequences = ivGroupSummaries.some(group => 
            group.gdu_sequences.some(seq => seq.sequence.length > 0)
        );
        
        if (!hasNonEmptySequences) {
            return { data: null, error: "No GDU sequences found in any transcript. Cannot perform comparative analysis." };
        }
        
        return { 
            data: {
                generic_diachronic_structure: genericState.p3_3_output,
                generic_synchronic_structures_by_gdu: genericState.p4s_outputs_by_gdu,
                iv_group_summaries: ivGroupSummaries,
                all_identified_gdus: genericState.p3_2_output?.identified_gdus || []
            }
        };
    },
    generatePrompt: (input: P5_1_InputWithFlag) => {
        // Get actual GDU IDs for examples
        const coreGduIds = input.generic_diachronic_structure.generic_diachronic_structure_definition.core_gdus;
        const exampleSequences = coreGduIds.length >= 2 
            ? [`"${coreGduIds[0]} -> ${coreGduIds[1]}"`, `"${coreGduIds[coreGduIds.length-1]} only"`]
            : ['"[Use actual GDU sequences from data]"'];
        
        // Handle single IV condition with a different prompt
        if (input.is_single_iv_condition) {
            return `You are a phenomenological analyst. Your task is to provide a comprehensive summary of how the generic structures (GDS and GSSs) manifest in the single Independent Variable (IV) condition present in the data.

Input:
- Generic Diachronic Structure (GDS): ${JSON.stringify(input.generic_diachronic_structure, null, 2)}
- Generic Synchronic Structures (GSS) by GDU: ${JSON.stringify(input.generic_synchronic_structures_by_gdu, null, 2)}
- Single IV Condition Summary: ${JSON.stringify(input.iv_group_summaries[0], null, 2)}

Instructions:
1. Analyze the patterns in this single IV condition:
   a. **Diachronic Patterns**: Identify the common GDU sequences and structural characteristics
   b. **Synchronic Patterns**: Identify the prominent GSS categories and recurring themes

2. **Provide Summary**: Since there is only one IV condition, provide a descriptive summary of how the generic structures manifest, noting any interesting variations within this condition.

3. **Generate Visualization**: Create a simple Mermaid diagram showing the typical flow for this condition.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "analysis_summary": "Summary of how the generic structures manifest in this single IV condition (note: no comparison possible with only one condition)",
  "analysis_by_iv_group": [
    {
      "iv_condition": "${input.iv_group_summaries[0].iv_condition}",
      "transcript_ids": ${JSON.stringify(input.iv_group_summaries[0].transcript_ids)},
      "diachronic_summary": {
        "common_sequences": ${JSON.stringify(exampleSequences)},
        "key_structural_features": "Description of patterns observed"
      },
      "synchronic_summary": {
        "dominant_gss_categories": [
          { "gdu_context": "\${coreGduIds[0] || 'GDU_ID'}", "category_label": "Category name from GSS" }
        ],
        "key_thematic_features": "Description of thematic patterns"
      }
    }
  ],
  "comparative_diachronic_mermaid_syntax": "gantt\n    title Diachronic Flow for ${input.iv_group_summaries[0].iv_condition}\n    ..."
`;
        }
        
        // Original comparative prompt for multiple IV conditions
        return `You are a comparative phenomenological analyst. Your task is to perform a focused comparative analysis of the final generic structures (GDS and GSSs) across different Independent Variable (IV) groups.

Input:
- Generic Diachronic Structure (GDS): ${JSON.stringify(input.generic_diachronic_structure, null, 2)}
- Generic Synchronic Structures (GSS) by GDU: ${JSON.stringify(input.generic_synchronic_structures_by_gdu, null, 2)}
- IV Group Summaries with GDU sequences: ${JSON.stringify(input.iv_group_summaries, null, 2)}

Instructions:
1. For each IV group, analyze:
   a. **Diachronic Patterns**: Identify the most common GDU sequences and structural characteristics (e.g., common omissions, unique orderings) for the transcripts within this IV group.
   b. **Synchronic Patterns**: Identify the most prominent GSS categories and recurring themes for this IV group by examining which GSS categories appear most frequently or uniquely.

2. **Synthesize Findings**: After analyzing all groups, provide a high-level summary that directly contrasts the diachronic and synchronic patterns between the IV groups.

3. **Generate Comparative Visualization**: Create Mermaid syntax for a Comparative Diachronic Alignment diagram showing parallel timelines for each IV condition.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "analysis_summary": "High-level summary of the main contrasts found between IV groups",
  "analysis_by_iv_group": [
    {
      "iv_condition": "string",
      "transcript_ids": ["string"],
      "diachronic_summary": {
        "common_sequences": ${JSON.stringify(exampleSequences)},
        "key_structural_features": "Description of patterns like 'Frequently skips ${coreGduIds[0] || 'a GDU'}', 'Shows longer ${coreGduIds[1] || 'another GDU'} duration'"
      },
      "synchronic_summary": {
        "dominant_gss_categories": [
          { "gdu_context": "\${coreGduIds[0] || 'GDU_ID'}", "category_label": "Category name from GSS" }
        ],
        "key_thematic_features": "Description like 'Emphasis on visual details in \${coreGduIds[0] || 'first GDU'}', 'Lacks emotional expression in \${coreGduIds[1] || 'second GDU'}'"
      }
    }
  ],
  "comparative_diachronic_mermaid_syntax": "gantt\n    title Comparative Diachronic Alignment\n    ..."
}

Important: This is a meta-analysis of already-identified structures. Do not modify the original GDS or GSS structures, only analyze and compare how they manifest differently across IV conditions.`;
    },
    parseOutput: (output: any, input: P5_1_Input): P5_1_ComparativeAnalysisOutput => {
        // Validate required fields
        if (!output.analysis_summary || typeof output.analysis_summary !== 'string') {
            throw new Error("P5.1 output missing required 'analysis_summary' field");
        }
        
        if (!Array.isArray(output.analysis_by_iv_group)) {
            throw new Error("P5.1 output missing required 'analysis_by_iv_group' array");
        }
        
        // Validate each IV group analysis
        const validatedGroups = output.analysis_by_iv_group.map((group: any, index: number) => {
            if (!group.iv_condition || !Array.isArray(group.transcript_ids)) {
                throw new Error(`P5.1 IV group \${index} missing required fields`);
            }
            
            // Validate diachronic summary
            if (!group.diachronic_summary || !Array.isArray(group.diachronic_summary.common_sequences)) {
                throw new Error(`P5.1 IV group \${index} missing valid diachronic_summary`);
            }
            
            // Validate synchronic summary
            if (!group.synchronic_summary || !Array.isArray(group.synchronic_summary.dominant_gss_categories)) {
                throw new Error(`P5.1 IV group \${index} missing valid synchronic_summary`);
            }
            
            // Validate GSS categories reference actual GDUs
            group.synchronic_summary.dominant_gss_categories.forEach((cat: any) => {
                if (!cat.gdu_context || !cat.category_label) {
                    throw new Error(`P5.1 IV group \${index} has invalid GSS category`);
                }
                
                // Check if GDU exists in input
                const gduExists = input.all_identified_gdus.some(gdu => gdu.gdu_id === cat.gdu_context);
                if (!gduExists) {
                    console.warn(`P5.1 references non-existent GDU: \${cat.gdu_context}`);
                }
            });
            
            return group;
        });
        
        // Validate all input IV groups are represented
        const inputIvConditions = new Set(input.iv_group_summaries.map(g => g.iv_condition));
        const outputIvConditions = new Set(validatedGroups.map((g: any) => g.iv_condition));
        
        inputIvConditions.forEach(iv => {
            if (!outputIvConditions.has(iv)) {
                console.warn(`P5.1 output missing analysis for IV condition: \${iv}`);
            }
        });
        
        // For single IV condition, update the summary to indicate no comparison was possible
        if (inputIvConditions.size === 1 && !output.analysis_summary.toLowerCase().includes('single') && 
            !output.analysis_summary.toLowerCase().includes('one condition')) {
            console.log("P5.1: Single IV condition detected, adjusting summary.");
        }
        
        // Validate Mermaid syntax if present
        if (output.comparative_diachronic_mermaid_syntax) {
            if (!output.comparative_diachronic_mermaid_syntax.includes('gantt') && 
                !output.comparative_diachronic_mermaid_syntax.includes('graph')) {
                console.warn("P5.1 Mermaid syntax may be invalid - missing expected diagram type");
            }
        }
        
        return {
            analysis_summary: output.analysis_summary,
            analysis_by_iv_group: validatedGroups,
            comparative_diachronic_mermaid_syntax: output.comparative_diachronic_mermaid_syntax || ""
        };
    },
  },
  [StepId.P5_2_HOLISTIC_REFINEMENT]: {
    id: StepId.P5_2_HOLISTIC_REFINEMENT,
    title: "P5.2: Holistic Refinement & Insight Generation",
    part: "PartV_Refine",
    isJsonOutput: true,
    getInput: (_, allProcessedData, genericState, apiKeyPresent) => {
            if (!apiKeyPresent) return { data: null, error: "API Key not set." };
            if (!allProcessedData || allProcessedData.size === 0) return { data: null, error: "No processed transcript data available." };
            if (!genericState?.p3_3_output || !genericState?.p4s_outputs_by_gdu) { 
                return { data: null, error: "Generic Diachronic (P3.3) or Generic Synchronic (P4S.1.B outputs by GDU) data not found." }; 
            }
            // Check for P5.1 output (optional - may be missing if single IV condition or other reasons)
            const hasP51Output = !!genericState?.p5_1_output;
            if (!hasP51Output) {
                console.log("P5.1 output not found. P5.2 will proceed without IV comparative analysis context.");
            }
            
            const all_sds_outputs: any[] = [];
            allProcessedData.forEach(tData => {
                if (tData.p1_4_output) { 
                    all_sds_outputs.push({
                        transcript_id: tData.id,
                        filename: tData.filename,
                        independent_variable: tData.p_neg1_1_output?.independent_variable_details,
                        structure: tData.p1_4_output.specific_diachronic_structure
                    });
                }
            });
    
            const all_sss_outputs_by_phase_and_transcript: Array<{
                transcript_id: string; filename: string; phase: string; independent_variable?: string;
                structure: P2S_3_Output['specific_synchronic_structure'];
            }> = [];
             allProcessedData.forEach(tData => {
                if (tData.p2s_outputs_by_phase) {
                    Object.entries(tData.p2s_outputs_by_phase).forEach(([phaseName, phaseData]) => {
                        if(phaseData.p2s_3_output?.specific_synchronic_structure){
                            all_sss_outputs_by_phase_and_transcript.push({
                                transcript_id: tData.id,
                                filename: tData.filename,
                                phase: phaseName,
                                independent_variable: phaseData.p2s_3_output.independent_variable_details,
                                structure: phaseData.p2s_3_output.specific_synchronic_structure
                            });
                        }
                    });
                }
            });
            return { data: {
                generic_diachronic_structure_input: genericState.p3_3_output, 
                generic_synchronic_structures_by_gdu_input: genericState.p4s_outputs_by_gdu, // These are P4S_1_B outputs
                all_specific_diachronic_structures_input: all_sds_outputs,
                all_specific_synchronic_structures_input: all_sss_outputs_by_phase_and_transcript,
                dv_focus: genericState.p3_3_output.dependent_variable_focus,
                // NEW: Include P5.1 comparative analysis as context
                p5_1_comparative_analysis: genericState.p5_1_output
            }};
        },
    generatePrompt: (input: any) => buildDynamicP5Prompt({
        gdsName: input.generic_diachronic_structure_input?.generic_diachronic_structure_definition?.name || "Generic Diachronic Structure",
        numGss: Object.keys(input.generic_synchronic_structures_by_gdu_input || {}).length,
        numSds: input.all_specific_diachronic_structures_input?.length || 0,
        numSss: input.all_specific_synchronic_structures_input?.length || 0,
        generic_diachronic_structure_input: input.generic_diachronic_structure_input,
        generic_synchronic_structures_by_gdu_input: input.generic_synchronic_structures_by_gdu_input,
        all_specific_diachronic_structures_input: input.all_specific_diachronic_structures_input,
        all_specific_synchronic_structures_input: input.all_specific_synchronic_structures_input,
        dvFocus: input.dv_focus || [],
        p5_1_comparative_analysis: input.p5_1_comparative_analysis
    }),
  },
  [StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION]: {
    id: StepId.P7_1_CANDIDATE_VARIABLE_FORMALIZATION,
    title: "P7.1: Candidate Variable Formalization for Causal Modeling",
    part: "PartVII_Causal",
    isJsonOutput: true,
    getInput: (_, __, genericState, apiKeyPresent) => {
        if (!apiKeyPresent) return { data: null, error: "API Key not set." };
        if (!genericState?.p5_2_output) { return { data: null, error: "P5.2 (Holistic Refinement) output not found, which is required for P7.1." }; }
        return { data: { p5_output: genericState.p5_2_output } };
    },
    generatePrompt: (input: { p5_output: P5_2_RefinementOutput }) => {
        return `You are a Causal Inference Scientist tasked with the first step of building a formal model from a micro-phenomenological analysis. Your job is to translate rich, descriptive concepts into formalized variables suitable for a Structural Causal Model (SCM), ensuring traceability to their phenomenological grounding.
${CAUSAL_INFERENCE_GLOSSARY_TEXT}
Input:
The complete, refined output from the holistic analysis (P5.2). This includes \`emergent_insights\`, \`hypotheses_generated\`, \`updated_gds_object\` (the refined Generic Diachronic Structure), and \`updated_gss_outputs_by_gdu\` (refined Generic Synchronic Structures).
${JSON.stringify(input.p5_output, null, 2)}

Instructions:
1.  **Identify Core Concepts for Variables:** Review the 'emergent_insights', 'hypotheses_generated', GDS, and GSSs from the input. Identify key recurring concepts that appear to drive the phenomenon and are suitable for representation as variables in a causal model.
2.  **Grounding First - Formalize into Variables:** For each core concept:
    *   **First, identify its grounding:** Determine the specific GDU, GSS Category, P5 Insight/Hypothesis, IV, or DV_Focus it is derived from. This grounding is essential.
    *   **Then, define the variable:** Only if clear grounding is identified, create a formal variable. This involves:
        *   \`variable_id\`: Short, unique identifier (e.g., M1, Y, U). Use conventions: X/T for treatment/IV, Y for outcome/DV, M for mediator, U for unmeasured confounder.
        *   \`variable_name\`: Clear, descriptive name (e.g., "Cognitive Stance," "Phenomenological Shift").
        *   \`phenomenological_grounding\`: Textual explanation of how this variable is grounded in the phenomenological data, referencing its source.
        *   \`measurement_type\`: Proposed operationalization (e.g., 'Binary (0=Trying, 1=Allowing)', 'Continuous (0-10 Vividness Score)', 'Latent/Unmeasured').
        *   \`grounding_references\`: REQUIRED. This array MUST NOT be empty. Each variable must be explicitly linked to its source(s). Each object should have:
            *   \`type\`: 'GDU', 'GSS_Category', 'P5_Insight', 'P5_Hypothesis', 'IV', 'DV_Focus', or 'Other'.
            *   \`id\`: The specific ID of the referenced element (e.g., a GDU_ID, GSS_Category_ID, P5_Insight_ID like "Insight_1", or the name of an IV/DV_Focus).
            *   \`details\` (Optional): Brief context (e.g., the GDU_ID if type is GSS_Category and 'id' is the category ID).
3.  **No Ungrounded Variables:** A variable should only be created if it has clear, identifiable grounding references. If a concept is too vague or cannot be traced, do not formalize it as a variable at this stage.
4.  **Distinguish Observed from Latent:** Explicitly identify variables as observed or latent/unmeasured (conventionally 'U' prefix for latent variable_ids).
5.  **Self-Correction:**
    *   "Does each variable represent a distinct concept grounded in the data?"
    *   "Is the link between the formal variable and the phenomenological data (both textually and via IDs in \`grounding_references\`) explicit and unambiguous?"

Output:
A JSON object adhering EXACTLY to the following structure. The \`grounding_references\` array for each variable MUST NOT be empty.
{
  "candidate_variables": [
    {
      "variable_id": "S",
      "variable_name": "Suggestion Intervention",
      "phenomenological_grounding": "Represents the initial experimental prompt that initiates engagement, often linked to the first GDU in the GDS.",
      "measurement_type": "Categorical (e.g., 'Hands Stuck', 'Happy Birthday')",
      "grounding_references": [
        {"type": "IV", "id": "Name of IV if applicable from input", "details": "Represents the experimental condition."},
        {"type": "GDU", "id": "GDU_Initial_Orientation_ID_from_P5_GDS", "details": "Corresponds to the GDU describing initial orientation."}
      ]
    },
    {
      "variable_id": "M1",
      "variable_name": "Cognitive Stance",
      "phenomenological_grounding": "Grounded in P5 Hypothesis 'PhenoHyp_1' about 'trying vs. allowing' and the 'GSS_Category_CognitiveMode_ID' within 'GDU_Cognitive_Analysis_ID'.",
      "measurement_type": "Binary or Continuous (0=Active/Trying, 1=Passive/Allowing)",
      "grounding_references": [
        {"type": "P5_Hypothesis", "id": "PhenoHyp_1"},
        {"type": "GSS_Category", "id": "GSS_Category_CognitiveMode_ID", "details": "GDU: GDU_Cognitive_Analysis_ID"}
      ]
    }
    // ... more variables
  ],
  "rationale_summary": "Brief summary of the process used to derive these variables from the phenomenological insights and structures."
`;
    },
  },
  [StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS]: {
    id: StepId.P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS,
    title: "P7.2: Propose and Justify Pairwise Causal Links",
    part: "PartVII_Causal",
    isJsonOutput: true,
    getInput: (_, __, genericState, apiKeyPresent) => {
        if (!apiKeyPresent) return { data: null, error: "API Key not set." };
        if (!genericState?.p7_1_output) { return { data: null, error: "P7.1 (Candidate Variables) output not found, required for P7.2." }; }
        if (!genericState?.p5_2_output?.updated_gds_object || !genericState?.p5_2_output?.updated_gss_outputs_by_gdu) {
             return { data: null, error: "P5.2 refined GDS/GSS objects not found, required for P7.2 context." };
        }
        return {
          data: {
            p7_1_output: genericState.p7_1_output, 
            phenomenological_context: { 
                gds: genericState.p5_2_output.updated_gds_object,
                gss_by_gdu: genericState.p5_2_output.updated_gss_outputs_by_gdu,
                insights: genericState.p5_2_output.emergent_insights,
                pheno_hypotheses: genericState.p5_2_output.hypotheses_generated
            },
            causal_glossary: CAUSAL_INFERENCE_GLOSSARY_TEXT 
          }
        };
    },
    generatePrompt: (input: { p7_1_output: P7_1_Output, phenomenological_context: any, causal_glossary: string }) => `You are a Causal Inference Scientist. Your task is to propose potential direct causal links between pairs of formalized variables, justifying each with phenomenological evidence and causal definitions.
Input:
- Candidate Variables (from P7.1): ${JSON.stringify(input.p7_1_output.candidate_variables, null, 2)}
- Phenomenological Context (GDS, GSSs, insights, hypotheses from P5.2): ${JSON.stringify(input.phenomenological_context, null, 2)}
- Causal Glossary: ${input.causal_glossary}

Instructions:
1.  **Systematically Consider Pairs:** For every plausible pair of variables (A, B) from the \`candidate_variables\` list, consider the possibility of a Directed Edge (A -> B).
2.  **Propose Edge and Justify:** If you propose an edge exists, you MUST provide:
    *   \`source\`: The \`variable_id\` of the causal variable (A).
    *   \`target\`: The \`variable_id\` of the effect variable (B).
    *   \`justification_from_phenomenology\`: Explain WHY you believe A causes B, citing evidence from the GDS (e.g., temporal sequence of GDUs), GSSs (e.g., thematic links within a GDU's synchronic structure), P5 insights, or P5 phenomenological hypotheses. Refer to specific GDU IDs, GSS category IDs, or insight/hypothesis IDs if possible (from the \`grounding_references\` in P7.1 or known IDs from P5.2).
    *   \`justification_from_glossary\`: Refer to a term in the provided causal_glossary to support your reasoning (e.g., "This represents a direct causal link as defined by 'Directed Edge'.").
3.  **Explicitly State Non-Links:** If you believe there is NO direct causal link between a pair, state that and provide a brief reason (e.g., "No arrow from Y to M1, as the GDS shows M1 states (related to GDU_X) precede Y states (related to GDU_Z)."). This prevents omissions.
4.  **Guardrail - Avoid Overfitting:** Do not propose a link simply because two concepts appeared together. The justification must be based on a plausible generative mechanism or clear temporal ordering from the phenomenological data.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "proposed_links": [
    {
      "source": "S_varID", // variable_id from P7.1
      "target": "M1_varID", // variable_id from P7.1
      "justification_from_phenomenology": "The GDS (from P5.2 refined output) shows the GDU 'GDU_Initial_Orientation_ID' (linked to M1_varID) is a direct response to the 'Suggestion' (S_varID).",
      "justification_from_glossary": "This is a 'Directed Edge' representing a direct causal influence."
    }
    // ... more links
  ],
  "rejected_links": [
    { "source": "Y_varID", "target": "M1_varID", "reason": "Temporal precedence violation; Y is an outcome of the process involving M1." }
  ]
}`,
  },
  [StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS]: {
    id: StepId.P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS,
    title: "P7.3: Assemble DAG and Identify Primitive Patterns",
    part: "PartVII_Causal",
    isJsonOutput: true,
    getInput: (_, __, genericState, apiKeyPresent) => {
        if (!apiKeyPresent) return { data: null, error: "API Key not set." };
        if (!genericState?.p7_1_output) { return { data: null, error: "P7.1 (Candidate Variables) output not found, required for P7.3." }; }
        if (!genericState?.p7_2_output) { return { data: null, error: "P7.2 (Pairwise Links) output not found, required for P7.3." }; }
        return { data: { candidate_variables: genericState.p7_1_output.candidate_variables, proposed_links: genericState.p7_2_output.proposed_links, causal_glossary: CAUSAL_INFERENCE_GLOSSARY_TEXT } };
    },
    generatePrompt: (input: { candidate_variables: P7_1_Output['candidate_variables'], proposed_links: P7_2_ProposedLink[], causal_glossary: string }) => `You are a Causal Graph Specialist. Your task is to assemble a full DAG from a list of justified pairwise links and then identify key structural patterns using the provided glossary. Each identified primitive pattern must have a unique ID.
Input:
- Candidate Variables: ${JSON.stringify(input.candidate_variables, null, 2)} (Provides all node IDs for the DAG)
- Proposed Links: ${JSON.stringify(input.proposed_links, null, 2)}
- Causal Glossary: ${input.causal_glossary}

Instructions:
1.  **Assemble DAG Nodes & Edges:**
    *   Nodes: Create a \`nodes\` array for the \`final_dag\`. Each node object should have an \`id\` (the \`variable_id\` from candidate_variables) and optionally a \`label\` (the \`variable_name\`).
    *   Edges: Create an \`edges\` array for the \`final_dag\` from the \`proposed_links\` input. Each edge object should have \`source\`, \`target\` (both \`variable_id\`s), and an optional \`rationale\` (from P7.2 justification).
2.  **Verify Acyclicity:** Confirm that the assembled graph is a DAG (contains no cycles). If a cycle exists, report an error in \`acyclicity_check\` and, if possible, identify the variables involved in the cycle in \`cycle_detected\`.
3.  **Identify Primitive Patterns with Unique IDs:** Scan the final DAG and explicitly identify all instances of the three primitive patterns defined in the glossary. For each one you find:
    *   Assign a unique \`primitive_id\` (e.g., "MED_M1_S_Y", "CONF_U1_M1_Y", "COLL_Z_X_Y").
    *   Describe it using the formal terminology (e.g., \`node_id\`, \`path\` or \`confounds_relationship\`).
    *   Cite the \`glossary_term\`.
   (If the graph is not acyclic, state that primitive pattern analysis is compromised but attempt to identify patterns in acyclic portions if feasible).

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "final_dag": {
    "nodes": [
      {"id": "S_varID", "label": "Suggestion Intervention"},
      {"id": "M1_varID", "label": "Cognitive Stance"}
      /* ...all nodes from candidate_variables */
    ],
    "edges": [
      {"source": "S_varID", "target": "M1_varID", "rationale": "From P7.2 justification..."}
      /* ...all edges from P7.2 proposed_links */
    ]
  },
  "identified_primitives": {
    "mediators": [
      { "primitive_id": "MED_M1_S_Y", "node_id": "M1_varID", "path": "S_varID -> M1_varID -> Y_varID", "glossary_term": "Mediator" }
    ],
    "confounders": [
      { "primitive_id": "CONF_U1_M1_Y", "node_id": "U1_varID", "confounds_relationship": "M1_varID and Y_varID", "glossary_term": "Confounder" }
    ],
    "colliders": [
      { "primitive_id": "COLL_Z_X_Y", "node_id": "Z_varID", "path": "X_varID -> Z_varID <- Y_varID", "glossary_term": "Collider" }
    ]
  },
  "acyclicity_check": "Passed", // or "Failed - Cycle detected: [variables involved]"
  "cycle_detected": "(Optional) Description of cycle if detected."
}
Do NOT include a "mermaid_syntax_dag" field; this will be generated by the system later.`,
  },
  [StepId.P7_3B_VALIDATE_AND_CLEAN_DAG]: {
    id: StepId.P7_3B_VALIDATE_AND_CLEAN_DAG,
    title: "P7.3b Validate and Clean DAG",
    part: 'PartVII_Causal',
    isJsonOutput: true,
    getInput: (currentTranscript, allProcessedData, genericState) => {
      if (!genericState?.p7_3_output) {
        return { data: null, error: "No P7.3 DAG output found for validation" };
      }
      
      return {
        data: {
          preliminary_dag: genericState.p7_3_output.final_dag,
          proposed_links_context: genericState.p7_2_output?.proposed_links || [],
          acyclicity_status: genericState.p7_3_output.acyclicity_check,
          detected_cycles: genericState.p7_3_output.cycle_detected
        }
      };
    },
    generatePrompt: (input: { preliminary_dag: P7_3_Output['final_dag'], proposed_links_context: P7_2_ProposedLink[], acyclicity_status: string, detected_cycles?: string }) => `You are a causal inference expert tasked with validating and cleaning a preliminary DAG to ensure it meets mathematical requirements for causal analysis.

## Your Task

Analyze the provided preliminary DAG for cycles and complexity issues, then apply systematic resolution strategies to produce a clean, acyclic DAG suitable for causal analysis.

## Input Data

**Preliminary DAG:**
\`\`\`json
${JSON.stringify(input.preliminary_dag, null, 2)}
\`\`\`

**Proposed Links Context (Sample):**
\`\`\`json
${JSON.stringify(input.proposed_links_context?.slice(0, 5) || [], null, 2)} 
\`\`\`
(Note: This is a sample of proposed links for context; the full list might be more extensive and was used to generate the preliminary DAG.)


**Current Acyclicity Status:** ${input.acyclicity_status}
**Detected Cycles:** ${input.detected_cycles || 'None reported'}

## Resolution Strategy Framework

Apply these strategies in order of preference:

### 1. Remove Weak Links
- Identify poorly justified causal links based on the \`proposed_links_context\`.
- Look for vague language in justifications: "might", "could", "unclear."
- Remove links with correlation-only justification.
- Prioritize removal of reciprocal pairs where one direction is clearly weaker or less justified.

### 2. Aggregate Cycles into Composite Variables
- For tightly coupled variables that form meaningful feedback loops.
- Create composite variables representing coherent psychological constructs (e.g., \`[Imagination_Experience_Complex]\`).
- Ensure composite variable IDs are distinct and descriptive.
- Update edges to point to/from the new composite variable.

### 3. Time Indexing (Last Resort)
- Only for essential temporal feedback processes where explicit time ordering resolves the cycle.
- Use format: \`Variable_t1 → Variable_t2\`. Append \`_t1\`, \`_t2\`, etc., to existing variable IDs.
- Apply sparingly and with clear temporal justification from the phenomenological data.

## Analysis Process

1. **Cycle Detection**: Systematically identify all cycles in the \`preliminary_dag\`.
2. **Justification Assessment**: Evaluate strength of each link's phenomenological and theoretical justification from the (sampled) \`proposed_links_context\`.
3. **Resolution Planning**: Determine the best strategy (Remove, Aggregate, Time-Index) for each cycle identified. Document the strategy.
4. **Implementation**: Apply resolutions with detailed reasoning. If aggregating, define new composite variables. If time-indexing, define new time-indexed variable IDs.
5. **Validation**: Confirm the final DAG is acyclic and interpretable. Update node and edge lists.

## Output Requirements

Provide a comprehensive JSON response. The key for the cleaned DAG structure MUST be \`final_dag\` to ensure compatibility with downstream processes. The JSON object must contain:
- \`final_dag\`: The cleaned DAG (nodes and edges). This is the primary output.
- \`cleaning_required\`: Boolean indicating if any changes were made to the preliminary DAG.
- \`cycles_detected\`: Information about cycles found in the preliminary DAG.
- \`resolution_log\`: Detailed log explaining every action taken.
- \`composite_variables_created\`: Information about any composite variables created.
- \`time_indexed_variables_created\`: Information about any time-indexed variables created.
- \`complexity_assessment\`: Assessment of the final DAG's complexity.
- \`validation_summary\`: Summary confirming acyclicity of the \`final_dag\`.

Your output must be valid JSON adhering to the P7_3b_Output interface structure.
Ensure the primary DAG object is keyed as \`final_dag\`.
Do NOT include mermaid syntax.`,
  },
  [StepId.P7_4_ANALYZE_PATHS_AND_BIASES]: {
    id: StepId.P7_4_ANALYZE_PATHS_AND_BIASES,
    title: "P7.4: Analyze Paths and Identify Potential Biases",
    part: "PartVII_Causal",
    isJsonOutput: true,
    getInput: (_, __, genericState, apiKeyPresent) => {
        if (!apiKeyPresent) return { data: null, error: "API Key not set." };
        if (!genericState?.p7_3b_output) { return { data: null, error: "P7.3b (DAG Validation & Cleaning) output not found, required for P7.4." }; }
        return { data: { p7_3b_output: genericState.p7_3b_output, causal_glossary: CAUSAL_INFERENCE_GLOSSARY_TEXT } };
    },
    generatePrompt: (input: { p7_3b_output: P7_3b_Output, causal_glossary: string }) => `You are a Causal Analyst. Your task is to analyze the pathways in the provided DAG to identify sources of confounding and potential bias. Each path analysis and collider warning must have a unique ID.
Input:
- Final DAG & Primitives (from P7.3b, if primitives were identified; DAG from \`p7_3b_output.final_dag\`): ${JSON.stringify(input.p7_3b_output, null, 2)}
- Causal Glossary: ${input.causal_glossary}

Instructions:
1.  **Handle Acyclicity & DAG Cleaning:** If \`cleaning_required\` from P7.3b input was true, note any modifications made to achieve acyclicity (e.g., composite variables, removed links) in the \`note\` field of relevant outputs for context. The DAG you are analyzing is the \`final_dag\` from P7.3b.
2.  **Identify Backdoor Paths & Propose Adjustment Sets:** For key relationships of interest (e.g., effect of an IV on a DV, or a key mediator), systematically trace all paths.
    *   For each such relationship, create a \`path_analysis\` object with a unique \`path_analysis_id\` (e.g., "PA_M1_Y").
    *   Identify any \`backdoor_paths_found\` according to the glossary.
    *   Propose \`proposed_adjustment_sets\` (listing \`variable_id\`s) to block each backdoor path, satisfying the Backdoor Criterion. Note if variables in a set are latent/unmeasured.
3.  **Identify Collider Biases:** Review the \`final_dag\` from P7.3b.
    *   For each collider, create a \`collider_bias_warnings\` object with a unique \`collider_warning_id\` (e.g., "CBW_M1_S_U1").
    *   Describe a scenario where an analyst might mistakenly condition on it, and explain what kind of Selection Bias this would create.
4.  **Guardrail - Focus on Identification, not Estimation:** Your task is to identify biases and theoretical solutions (adjustment sets). Do not discuss statistical methods.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "path_analysis": [
    {
      "path_analysis_id": "PA_M1_Y", // Unique ID for this path analysis
      "relationship_of_interest": "Effect of M1_varID on Y_varID",
      "note": "(Optional: Add note if graph was modified for acyclicity, e.g. 'M1_varID is part of Composite_XYZ')",
      "backdoor_paths_found": [
        {
          "path": "M1_varID <- U1_varID -> Y_varID",
          "description": "This path is open and transmits confounding bias from the unmeasured confounder U1_varID."
        }
      ],
      "proposed_adjustment_sets": [
        {
          "set": ["U1_varID"], // variable_ids
          "justification": "Measuring and conditioning on U1_varID would block this backdoor path. However, U1_varID is latent."
        }
      ]
    }
    // ... more path analyses
  ],
  "collider_bias_warnings": [
     {
      "collider_warning_id": "CBW_M1_S_U1", // Unique ID for this warning
      "note": "(Optional: Add note if graph was modified for acyclicity)",
      "collider_node": "M1_varID", // variable_id of the collider
      "scenario": "An analyst might study the relationship between S_varID and U1_varID only among participants who adopted an 'allowing' stance (M1_varID=1).",
      "predicted_bias": "This would condition on a collider (M1_varID), creating a spurious association between Suggestion (S_varID) and Trait Hypnotizability (U1_varID)."
    }
    // ... more collider warnings
  ]
}`,
  },
  [StepId.P7_5_GENERATE_FORMAL_HYPOTHESES]: {
    id: StepId.P7_5_GENERATE_FORMAL_HYPOTHESES,
    title: "P7.5: Generate Formal Causal Hypotheses",
    part: "PartVII_Causal",
    isJsonOutput: true,
    getInput: (_currTx, _allProcData, genericState, _apiKey, userDvFocus) => {
        const p7_1_ok = genericState?.p7_1_output;
        const p7_3b_data = genericState?.p7_3b_output;
        const p7_3b_ok = p7_3b_data && 
                         p7_3b_data.final_dag && 
                         Array.isArray(p7_3b_data.final_dag.nodes) &&
                         Array.isArray(p7_3b_data.final_dag.edges);
        const p7_4_ok = genericState?.p7_4_output;
        const dv_focus_ok = userDvFocus?.dv_focus && userDvFocus.dv_focus.length > 0;

        if (!p7_1_ok || !p7_3b_ok || !p7_4_ok || !dv_focus_ok) {
            let missingParts = [];
            if (!p7_1_ok) missingParts.push("P7.1 output");
            if (!p7_3b_ok) {
                let p7_3b_reason = "P7.3b output (cleaned DAG)";
                if (p7_3b_data && !p7_3b_data.final_dag) p7_3b_reason += " - final_dag missing";
                else if (p7_3b_data?.final_dag && !Array.isArray(p7_3b_data.final_dag.nodes)) p7_3b_reason += " - final_dag.nodes not an array";
                else if (p7_3b_data?.final_dag && !Array.isArray(p7_3b_data.final_dag.edges)) p7_3b_reason += " - final_dag.edges not an array";
                else if (!p7_3b_data) p7_3b_reason += " - entirely missing";
                missingParts.push(p7_3b_reason);
            }
            if (!p7_4_ok) missingParts.push("P7.4 output");
            if (!dv_focus_ok) missingParts.push("DV focus");
            return { data: null, error: `Missing essential data for P7.5: ${missingParts.join(', ')}.` };
        }
        return { data: {
            p7_1_output: genericState.p7_1_output,
            p7_3b_output: genericState.p7_3b_output, 
            p7_4_output: genericState.p7_4_output,
            dv_focus: userDvFocus.dv_focus,
            p5_output: genericState.p5_2_output, 
            causal_glossary: CAUSAL_INFERENCE_GLOSSARY_TEXT
        }};
    },
    generatePrompt: (input: {p7_1_output: P7_1_Output, p7_3b_output: P7_3b_Output, p7_4_output: P7_4_Output, dv_focus: string[], p5_output?: P5_2_RefinementOutput, causal_glossary: string}) => `You are a Causal Inference Scientist. Your final task is to translate the structured causal analysis into a set of formal, testable causal hypotheses, linking them to specific structural elements identified earlier.
Input:
- Formalized Variables (P7.1): ${JSON.stringify(input.p7_1_output.candidate_variables.map((v:P7_1_CandidateVariable)=>({id:v.variable_id, name:v.variable_name})), null, 2)}
- Cleaned Causal DAG (P7.3b): Nodes: ${input.p7_3b_output.final_dag.nodes.length}, Edges: ${input.p7_3b_output.final_dag.edges.length}. Context: ${input.p7_3b_output.validation_summary}
- Path Analysis & Bias Warnings (P7.4): ${input.p7_4_output.path_analysis.length} path analyses, ${input.p7_4_output.collider_bias_warnings.length} collider warnings.
- Dependent Variable Focus: ${JSON.stringify(input.dv_focus)}
- Prior Insights/Hypotheses (P5.2 - for context): ${JSON.stringify(input.p5_output?.emergent_insights?.slice(0,2) || [], null, 2)}, ${JSON.stringify(input.p5_output?.hypotheses_generated?.slice(0,2) || [], null, 2)}
- Causal Inference Glossary: ${input.causal_glossary}

Instructions:
1.  Review all provided inputs: candidate variables, the cleaned DAG structure (from P7.3b, assume you have its edges/nodes and any composite variable definitions from its \`resolution_log\` or \`composite_variables_created\` fields), path analyses, and bias warnings.
2.  Prioritize relationships involving the Dependent Variable Focus.
3.  For each hypothesis:
    *   \`hypothesis_id\`: Unique ID (e.g., "Causal_H1").
    *   \`causal_claim\`: A clear statement of the proposed causal relationship (e.g., "Variable A directly causes Variable B").
    *   \`causal_concept\`: The type of causal relationship or structure involved (e.g., "Direct Effect", "Mediation via M", "Confounding by C", "Collider stratification bias risk").
    *   \`formal_query\`: (Optional) If applicable, express the claim as a do-calculus query (e.g., "P(Y | do(X=x))") or a conditional independence statement.
    *   \`testable_prediction\`: A specific, potentially testable prediction derived from the hypothesis and the DAG (e.g., "Controlling for Z should change the observed association between X and Y", "Intervening on X is predicted to alter Y").
    *   \`related_primitive_ids\`: (Optional) List relevant \`primitive_id\`s from P7.3 (if available and still relevant after P7.3b cleaning) or refer to elements from the P7.3b output if primitives were altered (e.g., by cycle aggregation).
    *   \`related_path_analysis_ids\`: (Optional) List relevant \`path_analysis_id\` or \`collider_warning_id\` from P7.4 that inform this hypothesis.
4.  Generate 3-5 distinct, well-grounded formal causal hypotheses. Focus on clarity, testability, and relevance to the phenomenological data as represented by the causal model components.
5.  Include an \`analysis_context_note\` summarizing the main basis for these hypotheses (e.g., "Hypotheses primarily explore direct and mediated paths to DVs, considering identified confounders from the cleaned DAG."). If the DAG required cleaning (P7.3b's \`cleaning_required\` was true), mention how this might have influenced hypothesis formulation.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "analysis_context_note": "Summary of hypothesis generation context, noting if DAG cleaning influenced this step.",
  "formal_causal_hypotheses": [
    {
      "hypothesis_id": "Causal_H1",
      "causal_claim": "Experiencing 'Early Sensory Detail' (V_sensory_detail) directly enhances the intensity of 'Emotional Peak' (V_emotion_peak).",
      "causal_concept": "Direct Causal Effect",
      "formal_query": "P(V_emotion_peak | do(V_sensory_detail=high)) > P(V_emotion_peak | do(V_sensory_detail=low))",
      "testable_prediction": "Interventions that increase early sensory detail during the experience are expected to lead to higher reported emotional peak intensity, assuming other factors are stable.",
      "related_primitive_ids": [],
      "related_path_analysis_ids": []
    }
    // ... more hypotheses
  ]
}
`,
  },
  [StepId.P6_1_GENERATE_MARKDOWN_REPORT]: {
    id: StepId.P6_1_GENERATE_MARKDOWN_REPORT,
    title: "P6.1: Generate Final Markdown Report",
    part: "PartVI_Report",
    isJsonOutput: false, // Output is a Markdown string
    getInput: (
      _currentTranscript, 
      allProcessedData,
      genericState,
      _apiKeyPresent, 
      userDvFocus,
      allRawTranscripts,
    ): { data: ReportData | null; error?: string } => { 
      if (!genericState?.p5_2_output || !genericState.p3_2_output || !genericState.p3_3_output || !allProcessedData || !allRawTranscripts || !userDvFocus ||
          !genericState.p7_1_output || !genericState.p7_5_output 
         ) {
        let missing = [];
        if (!genericState?.p5_2_output) missing.push("P5.2 output (Holistic Refinement)");
        if (!genericState?.p3_2_output) missing.push("P3.2 output (GDU Definitions)");
        if (!genericState?.p3_3_output) missing.push("P3.3 output (GDS Definition)");
        if (!allProcessedData || allProcessedData.size === 0) missing.push("Processed Transcript Data");
        if (!allRawTranscripts || allRawTranscripts.length === 0) missing.push("Raw Transcript Information");
        if (!userDvFocus) missing.push("User DV Focus");
        if (!genericState?.p7_1_output) missing.push("P7.1 output (Candidate Variables)");
        if (!genericState?.p7_3b_output && !genericState?.p7_3_output) missing.push("P7.3/P7.3b output (Causal DAG)"); 
        if (!genericState?.p7_5_output) missing.push("P7.5 output (Formal Causal Hypotheses)");
        
        return { data: null, error: `Missing essential data for report generation: ${missing.join(', ')}.` };
      }

      const all_mermaid_syntaxes: Record<string, string> = {}; 
      allProcessedData.forEach((tData: any, tId: any) => {
        if (tData.p1_4_mermaid_syntax) all_mermaid_syntaxes[`sds_${tId}`] = tData.p1_4_mermaid_syntax;
        if (tData.p2s_outputs_by_phase) {
          Object.entries(tData.p2s_outputs_by_phase).forEach(([phase, pData]) => {
            if (pData.p2s_3_mermaid_syntax) all_mermaid_syntaxes[`sss_${tId}_${phase.replace(/[^a-zA-Z0-9_]/g, '_')}`] = pData.p2s_3_mermaid_syntax;
          });
        }
      });
      if (genericState.p3_3_mermaid_syntax) all_mermaid_syntaxes['gds_main'] = genericState.p3_3_mermaid_syntax;
      if (genericState.p4s_mermaid_syntax_by_gdu) {
        Object.entries(genericState.p4s_mermaid_syntax_by_gdu).forEach(([gduId, syntax]) => {
          if (syntax) all_mermaid_syntaxes[`gss_${gduId.replace(/[^a-zA-Z0-9_]/g, '_')}`] = syntax;
        });
      }
      if (genericState.p7_3b_mermaid_syntax_dag) { 
          all_mermaid_syntaxes['cleaned_causal_dag'] = genericState.p7_3b_mermaid_syntax_dag;
      } else if (genericState.p7_3_mermaid_syntax_dag) { 
          all_mermaid_syntaxes['initial_causal_dag'] = genericState.p7_3_mermaid_syntax_dag;
      }

      const transcripts_analyzed_summary = allRawTranscripts.map(rt => {
        const tData = allProcessedData.get(rt.id);
        return {
          filename: rt.filename,
          iv_details: tData?.p_neg1_1_output?.independent_variable_details || "N/A",
          num_diachronic_phases: tData?.p1_4_output?.specific_diachronic_structure.phases.length || 0,
          num_core_gdus_related: genericState.p3_2_output?.identified_gdus.filter(gdu =>
            gdu.contributing_refined_du_ids.some(cRef => cRef.transcript_id === rt.id) &&
            genericState.p3_3_output?.generic_diachronic_structure_definition.core_gdus.includes(gdu.gdu_id)
          ).length || 0,
        };
      });

      const gds = genericState.p3_3_output.generic_diachronic_structure_definition;
      const firstGduIdForExample = gds?.core_gdus?.[0];
      const gss_structure_example_for_gdu = firstGduIdForExample ? genericState.p4s_outputs_by_gdu?.[firstGduIdForExample]?.generic_synchronic_structure : undefined;
      
      const p7_3_or_3b_dag_output_for_stats = genericState.p7_3b_output || genericState.p7_3_output;
      
      const gduUtteranceCounts = calculateGduUtteranceCounts(allProcessedData, genericState.p3_2_output);
      const gssCategoryUtteranceCounts = calculateGssCategoryUtteranceCounts(allProcessedData, genericState.p4s_outputs_by_gdu);
      const gduTransitionCounts = calculateGduTransitionCounts(allProcessedData, genericState.p3_2_output, genericState.p3_3_output);

      return {
        data: {
          p5_1_output: genericState.p5_1_output, // Optional IV comparative analysis
          p5_output: genericState.p5_2_output,
          p3_2_output: genericState.p3_2_output,
          p3_3_output: genericState.p3_3_output,
          p4s_outputs_by_gdu: genericState.p4s_outputs_by_gdu, 
          p7_1_output: genericState.p7_1_output,
          p7_3_output: genericState.p7_3_output, 
          p7_3b_output: genericState.p7_3b_output, 
          p7_5_output: genericState.p7_5_output,
          p7_3_or_3b_dag_output_for_stats, 
          all_mermaid_syntaxes,
          transcripts_analyzed_summary,
          num_gss_inputs: genericState.core_gdus_for_sync_analysis?.length || 0,
          gds_name: gds.name,
          gds_definition: gds, 
          gss_structure_example_by_gdu: gss_structure_example_for_gdu && firstGduIdForExample ? { [firstGduIdForExample]: gss_structure_example_for_gdu } : undefined, 
          user_dv_focus: userDvFocus.dv_focus,
          gdu_utterance_counts: gduUtteranceCounts,
          gss_category_utterance_counts: gssCategoryUtteranceCounts,
          gdu_transition_counts: gduTransitionCounts,
          raw_transcripts: allRawTranscripts,
        },
      };
    },
    generatePrompt: (_input: ReportData) => { 
      return "Programmatic report generation. No LLM prompt needed for this step.";
    },
  },
};

// Sanity check: Ensure all pipeline steps defined in STEP_ORDER arrays have a corresponding config in STEP_CONFIGS or are meta states.
const allActualPipelineSteps = ALL_PIPELINE_STEP_IDS_IN_ORDER.filter(id => id !== StepId.COMPLETE && id !== StepId.IDLE);
const definedStepIdsSet = new Set(Object.keys(STEP_CONFIGS));
const missingActualConfigs = allActualPipelineSteps.filter(id => !definedStepIdsSet.has(id));

if (missingActualConfigs.length > 0) {
    console.warn(`[constants.tsx] CRITICAL: Not all pipeline steps have configurations defined directly in the STEP_CONFIGS object. Missing definitions for: ${missingActualConfigs.join(', ')}. These steps WILL NOT BE RUNNABLE unless their configurations are completed and added to STEP_CONFIGS.`);
}
