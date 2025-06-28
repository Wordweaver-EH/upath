# µ-PATH Analysis Pipeline Documentation

**Version:** 1.10.0

## 1. Introduction

The µ-PATH (Micro-Phenomenological Analytic Threader) application employs a sophisticated, multi-stage pipeline to analyze micro-phenomenological interview transcripts. This pipeline is inspired by the methodologies of Valenzuela-Moguillansky & Vásquez-Rosati (2019) and Sheldrake & Dienes (2025). It leverages the Google Gemini API (specifically, model `gemini-2.5-flash-preview-04-17`) through a series of structured prompts to guide the analysis.

The pipeline is designed to:
- Process multiple transcripts concurrently.
- Systematically consider user-defined Dependent Variable (DV) focuses and Independent Variables (IVs).
- Perform Specific Diachronic and Synchronic analyses per transcript.
- Synthesize findings into Generic Diachronic and Synchronic structures.
- Incorporate a dedicated IV-centric comparative analysis and a full Causal Structure Elicitation workflow.
- Conclude with a holistic refinement and a comprehensive, programmatically generated Markdown report.

A key feature is the generation of visualizations using Mermaid.js for diachronic (Gantt charts), synchronic (flowcharts/graphs), and causal (DAG) structures. The system also includes a robust JSON self-correction mechanism for API responses.

This document details each part of the pipeline, the prompts used, and the iterative nature of the process.

## 2. Overall Iteration Logic

The pipeline processes transcripts and analysis stages with specific iteration patterns:

1.  **Part -1: Variable Identification:**
    *   Step `P_NEG1_1_VARIABLE_IDENTIFICATION` is executed for Transcript 1, then Transcript 2, ..., up to Transcript N.
    *   Once all transcripts have completed Part -1, the pipeline proceeds to Part 0.

2.  **Part 0: Data Preparation:**
    *   Steps `P0_1`, `P0_2`, and `P0_3` are executed sequentially for Transcript 1.
    *   This sequence is then repeated for Transcript 2, ..., up to Transcript N.
    *   Once all transcripts have completed Part 0, the pipeline proceeds to Part I.

3.  **Part I (Specific Diachronic) & Part II_S (Specific Synchronic):**
    *   For **each transcript** (from 1 to N):
        *   **Part I:** Steps `P1_1` through `P1_4` are executed sequentially. The output of `P1_4` defines the diachronic phases for this transcript.
        *   **Part II_S (Iteration):** For **each diachronic phase** identified in P1.4 for the current transcript:
            *   Steps `P2S_1`, `P2S_2`, and `P2S_3` are executed sequentially for that phase.
    *   Only after all transcripts have fully completed both Part I and Part II_S (for all their respective phases) does the pipeline proceed to Part III.

4.  **Part III (Generic Diachronic):**
    *   These are **global steps**, executed once after all transcripts have been processed through Part II_S.
    *   Steps `P3_1`, `P3_2`, and `P3_3` are executed sequentially. The output of `P3_3` identifies the core Generic Diachronic Units (GDUs).

5.  **Part IV_S (Generic Synchronic):**
    *   This is a **global, iterative part** that runs after `P3_3` is complete.
    *   For **each core GDU** identified in P3.3:
        *   Step `P4S_1_A` (Identify & Group SSS Nodes) is executed.
        *   Step `P4S_1_B` (Define GSS from Groups) is executed.
    *   Once all core GDUs have been processed through Part IV_S, the pipeline proceeds to Part V.

6.  **Part V (Refinement), Part VII (Causal Modeling), Part VI (Report):**
    *   These are all **global parts**, executed sequentially after the previous part is complete.
    *   Part V (`P5_1`, `P5_2`) runs.
    *   Part VII (`P7_1` through `P7_5`) runs.
    *   Part VI (`P6_1`) runs, and if successful, the pipeline state becomes `COMPLETE`.

## 3. Detailed Pipeline Stages and Prompts

Each step involves sending a dynamically constructed prompt to the Gemini API (unless specified otherwise). The input for each prompt (`input` in the `generatePrompt` functions) is derived from previous step outputs, raw transcript data, and user-defined settings.

---

### Part -1: Variable Identification (Per Transcript)

#### Step: `P_NEG1_1_VARIABLE_IDENTIFICATION`
*   **Title:** P-1.1: Variable Identification
*   **Purpose:** To extract the Independent Variable (IV) details and confirm the Dependent Variable (DV) focus for a single transcript.
*   **Output:** JSON
*   **Prompt:**
    ```text
    You are a data extraction assistant for micro-phenomenological research. Your task is to process the beginning of a raw interview transcript to identify a potential independent variable (or condition/grouping factor) and use the user-provided dependent variable focuses for this analysis.

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
    ```

---

### Part 0: Data Preparation (Per Transcript)

*(Prompts for P0.1, P0.2, and P0.3 are omitted for brevity as they are correctly represented in the old file and are standard data prep steps. The key output is from P0.3, which selects procedural utterances.)*

---

### Part I: Specific Diachronic Analysis (Per Transcript)

*(Prompts for P1.1, P1.2, P1.3, and P1.4 are omitted for brevity. They correctly build up the Specific Diachronic Structure, culminating in P1.4 which identifies the diachronic phases and generates a Mermaid Gantt chart.)*

---

### Part II_S: Specific Synchronic Analysis (Per Transcript, Per Phase)

*(Prompts for P2S.1, P2S.2, and P2S.3 are omitted for brevity. This part iterates for each phase identified in P1.4 for a given transcript, building a Specific Synchronic Structure and a Mermaid flowchart for each.)*

---

### Part III: Generic Diachronic Analysis (Global)

*(Prompt for P3.1 is omitted for brevity. It compares all specific structures.)*

#### Step: `P3_2_IDENTIFY_GDUS`
*   **Title:** P3.2: Identify Generic Diachronic Units (GDUs)
*   **Purpose:** To cluster Refined Diachronic Units (RDUs) from all transcripts into Generic Diachronic Units (GDUs).
*   **Note on Implementation:** This step has multiple implementation strategies controlled by the `REACT_APP_P3_2_APPROACH` environment variable. The default ('original') is a large JSON prompt, while others ('minified', 'minimal_context_tsv', etc.) use more token-efficient, two-phase architectures (LLM for classification, programmatic for aggregation). The following is the prompt for the `minimal_context_tsv` approach.
*   **Output:** JSON
*   **Prompt (Example: `minimal_context_tsv` approach):**
    ```text
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
• Output nothing except the JSON object.
    ```

*(Prompt for P3.3 is omitted for brevity. It defines the overall Generic Diachronic Structure and generates a Mermaid Gantt chart.)*

---

### Part IV_S: Generic Synchronic Analysis (Global, Per Core GDU)

#### Step: `P4S_1_A_IDENTIFY_AND_GROUP_SSS_NODES`
*   **Title:** P4S.1.A: Identify & Group SSS Nodes for GDU
*   **Purpose:** For a single GDU, collect all associated Specific Synchronic Structure (SSS) nodes from all transcripts and classify them into semantic, cross-transcript groups.
*   **Output:** JSON
*   **Prompt:**
    ```text
    You are a Generic Synchronic Classification assistant. Your task is to analyze a list of Specific Synchronic Structure (SSS) nodes and classify them into cross-transcript semantic groups for Generic Synchronic Structure (GSS) formation.

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

**VERIFICATION REQUIREMENT:** Your \`grouped_data\` array must contain exactly one object for every single \`sss_node_id\` that appears in the input TSV. Do not skip any nodes, and do not invent any new ones.
    ```

#### Step: `P4S_1_B_DEFINE_GSS_FROM_GROUPS`
*   **Title:** P4S.1.B: Define GSS from SSS Node Groups
*   **Purpose:** To take the classified groups from P4S.1.A and construct the final Generic Synchronic Structure (GSS), including a Mermaid diagram.
*   **Output:** JSON
*   **Prompt:** *(Prompt omitted for brevity, it instructs the model to abstract the classified groups into generic categories and links, ensuring traceability back to the specific SSS nodes.)*

---

### Part V: Refinement (Global)

#### Step: `P5_1_IV_COMPARATIVE_ANALYSIS`
*   **Title:** P5.1: IV-Centric Comparative Analysis
*   **Purpose:** To perform a focused comparison of how the generic structures manifest across different Independent Variable (IV) groups.
*   **Output:** JSON
*   **Prompt:** *(Prompt omitted for brevity, it instructs the model to analyze diachronic and synchronic patterns for each IV group and synthesize the findings.)*

#### Step: `P5_2_HOLISTIC_REFINEMENT`
*   **Title:** P5.2: Holistic Refinement & Insight Generation
*   **Purpose:** To perform a final review of all generic structures in light of the specific data and the IV analysis, refining them and generating high-level insights and hypotheses.
*   **Output:** JSON
*   **Prompt:** *(This step uses a dynamic prompt builder (`buildDynamicP5Prompt`) that constructs the prompt and a detailed exemplar JSON based on the specific GDUs present in the analysis, ensuring the model's output is well-structured and relevant.)*

---

### Part VII: Causal Structure Elicitation (Global)

*(This part consists of 6 sequential global steps that formalize the phenomenological findings into a causal model. Prompts for P7.1, P7.2, P7.3, P7.3b, P7.4, and P7.5 guide the model to identify variables, propose links, assemble a DAG, clean the DAG, analyze for bias, and generate formal hypotheses. P7.3 and P7.3B generate Mermaid DAG diagrams.)*

---

### Part VI: Report Generation (Global)

#### Step: `P6_1_GENERATE_MARKDOWN_REPORT`
*   **Title:** P6.1: Generate Final Markdown Report
*   **Purpose:** To synthesize all findings from the entire pipeline into a comprehensive, human-readable Markdown report.
*   **Process:** This step is **programmatic**, not an LLM call. The `generateMarkdownReportProgrammatically` function in `utils/reportHelper.ts` assembles the final report from all available data, embedding Mermaid diagrams directly.

---

### 4. Ancillary Processes

#### Detailed Analysis Appendix
*   **Trigger:** Manual button ("DL Appendix").
*   **Output:** An **HTML file** (`appendix_detailed_analyses.html`).
*   **Content:** This file provides a transcript-by-transcript breakdown of specific analyses, including annotated transcripts, individual SDS and SSS diagrams, and quantitative summaries. It serves as a detailed reference for the synthesized findings in the main report.

#### Inter-Rater Reliability (IRR) Analysis
*   **Note:** The IRR module operates independently of the formal analysis pipeline. It is designed to compare two completed analysis runs (saved as JSON state files).
*   **Workflow:**
    1.  Load two analysis runs.
    2.  Detect if GDU sets differ.
    3.  If they differ, use an LLM to generate semantic mappings between GDUs.
    4.  Allow for human validation of the mappings.
    5.  Trace utterances to GDU assignments in both runs.
    6.  Calculate Krippendorff's Alpha coefficient.
    7.  Generate a detailed disagreement report.