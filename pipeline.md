# µ-PATH Analysis Pipeline Documentation

**Version:** 1.9.1

## 1. Introduction

The µ-PATH (Micro-Phenomenological Analytic Threader) application employs a sophisticated, multi-stage pipeline to analyze micro-phenomenological interview transcripts. This pipeline is inspired by the methodologies of Valenzuela-Moguillansky & Vásquez-Rosati (2019) and Sheldrake & Dienes (2025). It leverages the Google Gemini API (specifically, model `gemini-2.5-flash-preview-04-17` as defined by `GEMINI_MODEL_TEXT`) through a series of structured prompts to guide the analysis.

The pipeline is designed to:
- Process multiple transcripts.
- Systematically consider user-defined Dependent Variable (DV) focuses and Independent Variables (IVs) associated with transcripts.
- Perform Specific Diachronic and Synchronic analyses per transcript.
- Synthesize findings into Generic Diachronic and Synchronic structures.
- Incorporate Causal Structure Elicitation (Part VII).
- Conclude with a holistic refinement and a comprehensive Markdown report (Part VI).

A key feature is the generation of visualizations using Mermaid.js for diachronic (Gantt charts), synchronic (flowcharts/graphs), and causal (DAG) structures, which are embedded in the final report and HTML appendix. The system also includes a JSON self-correction mechanism for API responses to enhance robustness.

This document details each part of the pipeline, the prompts used, and the iterative nature of the process.

## 2. Overall Iteration Logic

The pipeline processes transcripts and analysis stages with specific iteration patterns:

1.  **Part -1: Variable Identification:**
    *   Step `P_NEG1_1_VARIABLE_IDENTIFICATION` is executed for Transcript 1, then Transcript 2, ..., up to Transcript N.
    *   Once all transcripts have completed Part -1, the pipeline proceeds to Part 0.

2.  **Part 0: Data Preparation:**
    *   Steps `P0_1_TRANSCRIPTION_ADHERENCE`, `P0_2_REFINE_DATA_TYPES`, `P0_3_SELECT_PROCEDURAL_UTTERANCES` are executed sequentially for Transcript 1.
    *   Then, this sequence is repeated for Transcript 2, ..., up to Transcript N.
    *   Once all transcripts have completed Part 0, the pipeline proceeds to Part I.

3.  **Part I (Specific Diachronic Analysis) & Part II_S (Specific Synchronic Analysis):**
    *   For Transcript 1:
        *   Steps `P1_1_INITIAL_SEGMENTATION`, `P1_2_DIACHRONIC_UNIT_ID`, `P1_3_REFINE_DIACHRONIC_UNITS`, `P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE` (Part I) are executed sequentially.
        *   The output of `P1_4` (Specific Diachronic Structure) defines a set of diachronic phases.
        *   **Part II_S Iteration (for Transcript 1):** For each diachronic phase identified in P1.4:
            *   Steps `P2S_1_GROUP_UTTERANCES_BY_TOPIC`, `P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS`, `P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE` are executed sequentially for that phase.
    *   This entire sequence (Part I followed by iterative Part II_S for all its phases) is then repeated for Transcript 2, ..., up to Transcript N.
    *   Once all transcripts have completed Parts I and II_S (for all their respective phases), the pipeline proceeds to Part III.

4.  **Part III (Generic Diachronic Analysis):**
    *   These are global steps, executed once after all transcripts have completed Parts I and II_S.
    *   Steps `P3_1_ALIGN_STRUCTURES`, `P3_2_IDENTIFY_GDUS`, `P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE` are executed sequentially.
    *   The output of `P3_3` (Generic Diachronic Structure) identifies core Generic Diachronic Units (GDUs).

5.  **Part IV_S (Generic Synchronic Analysis):**
    *   This part is triggered after `P3_3` completes.
    *   **Part IV_S Iteration:** For each core GDU identified in P3.3:
        *   Step `P4S_1_IDENTIFY_GENERIC_SYNCHRONIC_UNITS` is executed for that GDU.
    *   Once `P4S_1` has been executed for all core GDUs, the pipeline proceeds to Part V.

6.  **Part V (Refinement):**
    *   This is a global step, executed once after Part IV_S is complete (all core GDUs processed).
    *   `P5_1_HOLISTIC_REVIEW_REFINEMENT` runs.

7.  **Part VII (Causal Structure Elicitation):**
    *   These are global steps, executed sequentially once after Part V (Refinement) is complete.
    *   Steps `P7_1_CANDIDATE_VARIABLE_FORMALIZATION`, `P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS`, `P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS`, `P7_3B_VALIDATE_AND_CLEAN_DAG`, `P7_4_ANALYZE_PATHS_AND_BIASES`, `P7_5_GENERATE_FORMAL_HYPOTHESES` are executed sequentially.

8.  **Part VI (Report Generation):**
    *   This is a global step, executed once after Part VII (Causal Structure Elicitation) is complete.
    *   `P6_1_GENERATE_MARKDOWN_REPORT` runs. If successful, the pipeline state becomes `COMPLETE`.

## 3. Detailed Pipeline Stages and Prompts

Each step involves sending a dynamically constructed prompt to the Gemini API (unless specified otherwise, like P6.1). The input for each prompt (`input` in the `generatePrompt` functions) is derived from previous step outputs, raw transcript data, and user-defined settings (like DV focus). Output format (JSON or text) is specified per step.

---

### Part -1: Variable Identification (Per Transcript)

#### Step: P_NEG1_1_VARIABLE_IDENTIFICATION
*   **Title:** P-1.1: Variable Identification
*   **Output:** JSON
*   **Input Summary:** Raw transcript content (`currentTranscript.content`), transcript ID (`currentTranscript.filename` or `currentTranscript.id`), user-specified DV focus list (`userDvFocus.dv_focus`).
*   **Prompt Template:**
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

#### Step: P0_1_TRANSCRIPTION_ADHERENCE
*   **Title:** P0.1: Transcription Adherence & Line Numbering
*   **Output:** JSON
*   **Input Summary:** Raw transcript content (`currentTranscript.content`), transcript ID (`currentTranscript.filename` or `currentTranscript.id`).
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological data preparation assistant. Your first task is to process a raw interview transcript file.
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
    ```

#### Step: P0_2_REFINE_DATA_TYPES
*   **Title:** P0.2: Refining Data - Identifying Information Types
*   **Output:** JSON
*   **Input Summary:** Output from P0.1 (`p0_1_output` for the current transcript).
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological data preparation analyst. Your task is to refine the line-numbered transcript by identifying different types of information.
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
    ```

#### Step: P0_3_SELECT_PROCEDURAL_UTTERANCES
*   **Title:** P0.3: Select Procedural Utterances for Diachronic Analysis
*   **Output:** JSON
*   **Input Summary:** Output from P0.2 (`p0_2_output`) and P-1.1 (`p_neg1_1_output`) for the current transcript.
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological analyst. Your task is to select utterances crucial for understanding the diachronic (temporal) structure of the *experience itself*, focusing on the participant's procedural account of their experience.
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
    ```

---
### Part I: Specific Diachronic Analysis (Per Transcript)

#### Step: P1_1_INITIAL_SEGMENTATION
*   **Title:** P1.1: Initial Segmentation of Procedural Utterances
*   **Output:** JSON
*   **Input Summary:** Output from P0.3 (`p0_3_output`) for the current transcript.
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological analyst. Your task is to segment the selected procedural utterances based on temporal cues, focusing on the described experience's unfolding.
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
    ```

#### Step: P1_2_DIACHRONIC_UNIT_ID
*   **Title:** P1.2: Diachronic Unit Identification (DU)
*   **Output:** JSON
*   **Input Summary:** Output from P1.1 (`p1_1_output`) for the current transcript.
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological analyst. Your task is to group the segments from P1.1 into initial Diachronic Units (DUs). A DU represents a meaningful "moment" or "phase" in the described experience.
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
    ```

#### Step: P1_3_REFINE_DIACHRONIC_UNITS
*   **Title:** P1.3: Refine Diachronic Units & Assign Temporal Phase
*   **Output:** JSON
*   **Input Summary:** Output from P1.2 (`p1_2_output`) for the current transcript.
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological analyst. Your task is to refine the Diachronic Units (DUs) from P1.2 and assign a temporal phase to each.
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
    ```

#### Step: P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE
*   **Title:** P1.4: Construct Specific Diachronic Structure (SDS)
*   **Output:** JSON
*   **Input Summary:** Output from P1.3 (`p1_3_output`) for the current transcript.
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological analyst. Your task is to construct the Specific Diachronic Structure (SDS) for this transcript based on the refined DUs and their temporal phases.
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
    ```

---
### Part II_S: Specific Synchronic Analysis (Per Transcript, Per Diachronic Phase from P1.4)

#### Step: P2S_1_GROUP_UTTERANCES_BY_TOPIC
*   **Title:** P2S.1: Group Utterances by Topic within a Diachronic Phase
*   **Output:** JSON
*   **Input Summary:** Current transcript ID, current diachronic phase name (`currentPhaseName`), selected procedural utterances from P0.3 that map to this phase (traced via P1.1, P1.2, P1.3, P1.4), IV/DV details from P0.3.
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological analyst. Your task is to perform the first step of Specific Synchronic Analysis (P2S.1) for a GIVEN DIACHRONIC PHASE from a single transcript. This involves grouping relevant utterances by topic.
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
    ```

#### Step: P2S_2_IDENTIFY_SPECIFIC_SYNCHRONIC_UNITS
*   **Title:** P2S.2: Identify Specific Synchronic Units (ISUs)
*   **Output:** JSON
*   **Input Summary:** Output from P2S.1 for the current transcript and phase (`p2s_1_output`), IV/DV details.
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological analyst. Your task is to identify Specific Synchronic Units (ISUs) based on the thematic groups from P2S.1 for a GIVEN DIACHRONIC PHASE.
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
    *   \`utterances\`: (Optional, primarily for Level 0 ISUs) Array of specific utterances (copied from input P2S.1 thematic groups) that ground this ISU. Each utterance object must have \`original_line_num\` and \`utterance_text\`.
    *   \`constituent_lower_units\`: (For Level > 0 ISUs) Array of \`unit_name\` strings of the lower-level ISUs it abstracts from.
4.  Hierarchy: The final list of \`specific_synchronic_units_hierarchy\` should include all ISUs, from Level 0 up to the highest level of abstraction achieved for this phase.
5.  Preserve IV/DV: Copy \`independent_variable_details\` and \`dependent_variable_focus\` verbatim.

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
    ```

#### Step: P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE
*   **Title:** P2S.3: Define Specific Synchronic Structure (SSS)
*   **Output:** JSON
*   **Input Summary:** Output from P2S.2 for the current transcript and phase (`p2s_2_output`).
*   **Prompt Template:**
    ```text
    You are a micro-phenomenological analyst. Task: Final step of Specific Synchronic Analysis - Define the Specific Synchronic Structure (SSS) as a semantic network.
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
IV Details: "${input.independent_variable_details}"
    ```

---
### Part III: Generic Diachronic Analysis (Global)

#### Step: P3_1_ALIGN_STRUCTURES
*   **Title:** P3.1: Align Specific Structures & Consider IVs
*   **Output:** JSON
*   **Input Summary:** All P1.4 outputs (`all_specific_diachronic_structures`), global DV focus.
*   **Prompt Template:**
    ```text
    You are a Generic Diachronic Analysis assistant. Task: Align multiple Specific Diachronic Structures (SDS) and analyze IV correlations.
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
}
    ```

#### Step: P3_2_IDENTIFY_GDUS
*   **Title:** P3.2: Identify Generic Diachronic Units (GDUs)
*   **Output:** JSON
*   **Input Summary:** P3.1 output (`p3_1_output`), all P1.3 outputs (`all_refined_dus_with_iv_and_ids`), global DV focus.
*   **Prompt Template:**
    ```text
    You are a Generic Diachronic Analysis assistant. Task: Identify Generic Diachronic Units (GDUs) from refined DUs across transcripts, considering IVs and ensuring traceability.
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
    *   \`iv_variation_notes\` (Optional): Observations on how the manifestation of this GDU (e.g., frequency, specific content of its DUs) varies with the \`independent_variable_details\` of the supporting transcripts.
    *   \`contributing_refined_du_ids\`: An array of objects, where each object specifies a \`transcript_id\` and the \`refined_du_id\` (this is the \`unit_id\` from the P1.3 \`refined_diachronic_units\` object) that contributes to this GDU. This is crucial for traceability.
3.  Criteria: Briefly state the criteria used for GDU abstraction and identification.

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
  "dependent_variable_focus": ${JSON.stringify(input.global_dv_focus)}
}
    ```

#### Step: P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE
*   **Title:** P3.3: Define Generic Diachronic Structure (GDS)
*   **Output:** JSON
*   **Input Summary:** P3.1 output (`p3_1_output`), P3.2 output (`p3_2_output`), global DV focus.
*   **Prompt Template:**
    ```text
    You are a Generic Diachronic Analysis assistant. Task: Define the Generic Diachronic Structure (GDS) using GDUs and IV insights.
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
Do NOT include a "mermaid_syntax_generic_diachronic" field; this will be generated by the system later.
    ```

---
### Part IV_S: Generic Synchronic Analysis (Global, Per Core GDU from P3.3)

#### Step: P4S_1_IDENTIFY_GENERIC_SYNCHRONIC_UNITS
*   **Title:** P4S.1: Identify Generic Synchronic Units/Categories & Structure (GSS)
*   **Output:** JSON
*   **Input Summary:** GDU ID and definition to analyze (`currentGDUToAnalyze`, `gdu_definition`), all relevant SSSs from P2S.3 outputs (`all_relevant_specific_synchronic_structures`), global DV focus.
*   **Prompt Template:**
    ```text
    You are a Generic Synchronic Analysis assistant. Task: For a given Generic Diachronic Unit (GDU), define its Generic Synchronic Structure (GSS) by abstracting from relevant Specific Synchronic Structures (SSSs) and considering IV influences. Ensure traceability of GSS categories back to specific SSS nodes.
Input:
- GDU to Analyze (ID): "${input.gdu_to_analyze_id}"
- GDU Definition: "${input.gdu_definition}"
- Array of SSSs (\`all_relevant_specific_synchronic_structures\`). Each SSS includes its \`transcript_id\`, \`filename\`, \`diachronic_phase_analyzed\`, \`independent_variable_details\`, and \`specific_synchronic_structure\` (which contains \`network_nodes\` each with an \`id\` and \`label\`, and \`network_links\`).
- Global DV Focus: ${JSON.stringify(input.global_dv_focus)}
${JSON.stringify({all_relevant_specific_synchronic_structures_sample: input.all_relevant_specific_synchronic_structures.slice(0,1)}, null, 2)} (Sample of SSS structure, full list provided to LLM)

Instructions:
1.  Compare SSSs for the GDU: Analyze the provided SSSs related to "${input.gdu_to_analyze_id}". Identify common nodes, link types, and structural patterns.
2.  Define Generic Node Categories & Links for GSS:
    *   \`generic_nodes_categories\`: Abstract commonalities into generic node categories. Each category must have a unique \`id\` (e.g., "gss_cat_Quality") and a \`label\`.
    *   \`generic_network_links\`: Define links between these generic category IDs (\`from\`, \`to\`) with a \`type\`.
3.  Provide Instantiation Notes for Traceability:
    *   For each generic category in your GSS, create an \`instantiation_notes\` entry.
    *   Each note must have \`generic_category_id\` (the \`id\` of the GSS category it refers to).
    *   Include a \`textual_description\` (e.g., "This category was instantiated as 'Vividness' in T1/PhaseA, 'Clarity' in T2/PhaseB").
    *   CRUCIALLY, include \`example_specific_nodes\`: an array of objects, where each object details a specific SSS node that exemplifies this GSS category. Each object should have:
        *   \`transcript_id\`: The ID of the transcript from which the SSS node comes.
        *   \`sss_node_id\`: The \`id\` of the specific node from the SSS's \`network_nodes\`.
        *   \`phase_name\`: The \`diachronic_phase_analyzed\` associated with that SSS.
4.  Note IV Influence: How do SSSs for this GDU vary based on the IVs of their source transcripts? How does this translate to variations in the GSS? Record in \`variations_notes\`.
5.  Construct GSS: Define the GSS as a network of generic categories and links, with the detailed instantiation notes.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "analyzed_gdu": "${input.gdu_to_analyze_id}",
  "generic_synchronic_structure": {
    "representation_type": "Semantic Network",
    "description": "Description of GSS for '${input.gdu_to_analyze_id}'.",
    "generic_nodes_categories": [
      {"id": "gss_cat_Quality", "label": "Perceptual Quality"}
      // ... more generic categories
    ],
    "generic_network_links": [
      {"from": "gss_cat_Quality", "to": "gss_cat_Modality", "type": "is_attribute_of"}
      // ... more generic links
    ],
    "instantiation_notes": [
      {
        "generic_category_id": "gss_cat_Quality",
        "textual_description": "Instantiated as vividness, clarity, intensity in specific experiences.",
        "example_specific_nodes": [
          { "transcript_id": "transcript_A_id", "sss_node_id": "sss_node_vividness_in_txA_phase2", "phase_name": "Phase2_Sensing" },
          { "transcript_id": "transcript_B_id", "sss_node_id": "sss_node_clarity_in_txB_phase1", "phase_name": "Phase1_Recollection" }
        ]
      }
      // ... more instantiation notes
    ]
  },
  "variations_notes": "Summary of GSS variations linked to IVs.",
  "dependent_variable_focus": ${JSON.stringify(input.global_dv_focus)}
}
Do NOT include a "mermaid_syntax_generic_synchronic" field; this will be generated by the system later.
    ```

---
### Part V: Refinement (Global)

#### Step: P5_1_HOLISTIC_REVIEW_REFINEMENT
*   **Title:** P5.1: Holistic Review & Refinement
*   **Output:** JSON
*   **Input Summary:** P3.3 output (`generic_diachronic_structure_input`), all P4S.1 outputs by GDU (`generic_synchronic_structures_by_gdu_input`), all P1.4 outputs (`all_specific_diachronic_structures_input`), all P2S.3 outputs (`all_specific_synchronic_structures_input`), DV focus.
*   **Prompt Template:**
    ```text
    You are a senior micro-phenomenological researcher. Task: Perform a holistic review of all generated structures, refine them, synthesize IV observations, generate insights/hypotheses, and output the *complete, updated GDS and GSS objects*.
Input:
- \`generic_diachronic_structure_input\`: The P3.3 output containing the GDS definition.
- \`generic_synchronic_structures_by_gdu_input\`: A map of GDU_ID to P4S.1 outputs (each containing a GSS definition and instantiation notes).
- \`all_specific_diachronic_structures_input\`: Array of all P1.4 specific diachronic structures.
- \`all_specific_synchronic_structures_input\`: Array of all P2S.3 specific synchronic structures.
- \`dv_focus\`: The dependent variable focus list.
${JSON.stringify({ gds_name: input.generic_diachronic_structure_input?.generic_diachronic_structure_definition?.name, num_gss_inputs: Object.keys(input.generic_synchronic_structures_by_gdu_input || {}).length, num_sds_inputs: input.all_specific_diachronic_structures_input?.length, num_sss_inputs: input.all_specific_synchronic_structures_input?.length, dv_focus: input.dv_focus }, null, 2)} (Summary of extensive input provided to LLM)

Instructions:
1.  **Review & Refine Generic Structures:**
    *   Examine all structures (GDS, GSSs, SDSs, SSSs) for consistency, coherence, and accuracy.
    *   Propose refinements to the GDS (from \`generic_diachronic_structure_input.generic_diachronic_structure_definition\`) and each GSS (from \`generic_synchronic_structures_by_gdu_input[GDU_ID].generic_synchronic_structure\`) based on the full dataset of specific structures.
    *   Ensure diachronic structures reflect experiential timelines and synchronic structures detail the 'what' of those moments.
2.  **Output Updated Generic Structures:**
    *   \`updated_gds_object\`: Provide the *complete, refined* GDS object, adhering to the \`GenericDiachronicStructureDefinition\` type.
    *   \`updated_gss_outputs_by_gdu\`: Provide a map where keys are GDU_IDs and values are the *complete, refined* GSS objects (matching the type of \`P4S_1_Output['generic_synchronic_structure']\`).
3.  **Refinement Log, Insights, Hypotheses:**
    *   \`refinement_log\`: Document key observations, adjustments made to generic structures, and justifications.
    *   \`emergent_insights\`: List new understandings from viewing all data holistically. (Consider adding unique IDs like "Insight_1" for P7.1 traceability).
    *   \`hypotheses_generated\`: Formulate testable phenomenological hypotheses. (Consider adding unique IDs like "PhenoHyp_1" for P7.1 traceability).
4.  **Synthesize IV Impact:** Consolidate all IV-related observations. How do IVs consistently affect diachronic and synchronic aspects across the dataset? This can be part of the textual summaries or refinement log.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "final_refined_generic_diachronic_structure_summary": "Textual summary of GDS after review, noting key refinements.",
  "final_refined_generic_synchronic_structures_summary": {
    "GDU_ID_1": "Textual summary of GSS for GDU_ID_1 after review.",
    "GDU_ID_2": "..."
  },
  "updated_gds_object": { /* Complete GenericDiachronicStructureDefinition object */
    "name": "Refined GDS Name", "description": "...", "core_gdus": [], "optional_gdus": [], "typical_sequence": []
  },
  "updated_gss_outputs_by_gdu": { /* GDU_ID -> complete refined P4S_1_Output['generic_synchronic_structure'] object */
    "GDU_ID_1": { "representation_type": "Semantic Network", "description": "...", "generic_nodes_categories": [], "generic_network_links": [], "instantiation_notes": [] }
  },
  "refinement_log": [
    {"observation": "Initial GDU_X was too broad.", "adjustment_made": "Split GDU_X into GDU_Xa and GDU_Xb in updated_gds_object.", "justification": "Improves specificity based on SSS review."}
  ],
  "emergent_insights": ["Insight_1: Insight text...", "Insight_2: Insight text..."],
  "hypotheses_generated": ["PhenoHyp_1: Hypothesis text...", "PhenoHyp_2: Hypothesis text..."]
}
    ```

---
### Part VII: Causal Structure Elicitation (Global)

#### Step: P7_1_CANDIDATE_VARIABLE_FORMALIZATION
*   **Title:** P7.1: Candidate Variable Formalization for Causal Modeling
*   **Output:** JSON
*   **Input Summary:** P5.1 output (`p5_output`).
*   **Prompt Template:**
    ```text
    You are a Causal Inference Scientist tasked with the first step of building a formal model from a micro-phenomenological analysis. Your job is to translate rich, descriptive concepts into formalized variables suitable for a Structural Causal Model (SCM), ensuring traceability to their phenomenological grounding.

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

Input:
The complete, refined output from the holistic analysis (P5.1). This includes \`emergent_insights\`, \`hypotheses_generated\`, \`updated_gds_object\` (the refined Generic Diachronic Structure), and \`updated_gss_outputs_by_gdu\` (refined Generic Synchronic Structures).
${JSON.stringify(input.p5_output, null, 2)}

Instructions:
1.  **Identify Core Concepts:** Read through the 'emergent_insights', 'hypotheses_generated', GDS, and GSSs from the input. Identify key recurring concepts that appear to drive the phenomenon.
2.  **Formalize into Variables:** For each core concept, define a formal variable. This involves:
    *   \`variable_id\`: Short, unique identifier (e.g., M1, M2, Y, U). Use conventions: X/T for treatment/IV, Y for outcome/DV, M for mediator, U for unmeasured confounder.
    *   \`variable_name\`: Clear, descriptive name (e.g., "Cognitive Stance," "Phenomenological Shift").
    *   \`phenomenological_grounding\`: Textual explanation of how this variable is grounded in the phenomenological data.
    *   \`measurement_type\`: Proposed operationalization (e.g., 'Binary (0=Trying, 1=Allowing)', 'Continuous (0-10 Vividness Score)', 'Latent/Unmeasured').
    *   \`grounding_references\` (Optional but STRONGLY RECOMMENDED): An array of objects to provide structured links. Each object should have:
        *   \`type\`: 'GDU', 'GSS_Category', 'P5_Insight', 'P5_Hypothesis', 'IV', 'DV_Focus', or 'Other'.
        *   \`id\`: The specific ID of the referenced element (e.g., a GDU_ID from \`updated_gds_object.core_gdus\`, a GSS_Category_ID from a node in \`updated_gss_outputs_by_gdu[GDU_ID].generic_nodes_categories\`, an insight ID like "Insight_1" from \`emergent_insights\`, or the name of an IV/DV_Focus).
        *   \`details\` (Optional): Brief context (e.g., the GDU_ID if type is GSS_Category and 'id' is the category ID).
3.  **Distinguish Observed from Latent:** Explicitly identify variables as observed or latent/unmeasured (conventionally 'U' prefix for latent variable_ids).
4.  **Self-Correction:**
    *   "Does each variable represent a distinct concept?"
    *   "Is the link between the formal variable and the phenomenological data (both textually and via IDs) clear?"

Output:
A JSON object adhering EXACTLY to the following structure:
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
}
    ```

#### Step: P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS
*   **Title:** P7.2: Propose and Justify Pairwise Causal Links
*   **Output:** JSON
*   **Input Summary:** P7.1 output (`p7_1_output`), P5.1 output for phenomenological context (`phenomenological_context`), Causal Glossary.
*   **Prompt Template:**
    ```text
    You are a Causal Inference Scientist. Your task is to propose potential direct causal links between pairs of formalized variables, justifying each with phenomenological evidence and causal definitions.
Input:
- Candidate Variables (from P7.1): ${JSON.stringify(input.p7_1_output.candidate_variables, null, 2)}
- Phenomenological Context (GDS, GSSs, insights, hypotheses from P5.1): ${JSON.stringify(input.phenomenological_context, null, 2)}
- Causal Glossary: ${input.causal_glossary}

Instructions:
1.  **Systematically Consider Pairs:** For every plausible pair of variables (A, B) from the \`candidate_variables\` list, consider the possibility of a Directed Edge (A -> B).
2.  **Propose Edge and Justify:** If you propose an edge exists, you MUST provide:
    *   \`source\`: The \`variable_id\` of the causal variable (A).
    *   \`target\`: The \`variable_id\` of the effect variable (B).
    *   \`justification_from_phenomenology\`: Explain WHY you believe A causes B, citing evidence from the GDS (e.g., temporal sequence of GDUs), GSSs (e.g., thematic links within a GDU's synchronic structure), P5 insights, or P5 phenomenological hypotheses. Refer to specific GDU IDs, GSS category IDs, or insight/hypothesis IDs if possible (from the \`grounding_references\` in P7.1 or known IDs from P5.1).
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
      "justification_from_phenomenology": "The GDS (from P5.1 refined output) shows the GDU 'GDU_Initial_Orientation_ID' (linked to M1_varID) is a direct response to the 'Suggestion' (S_varID).",
      "justification_from_glossary": "This is a 'Directed Edge' representing a direct causal influence."
    }
    // ... more links
  ],
  "rejected_links": [
    { "source": "Y_varID", "target": "M1_varID", "reason": "Temporal precedence violation; Y is an outcome of the process involving M1." }
  ]
}
    ```

#### Step: P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS
*   **Title:** P7.3: Assemble DAG and Identify Primitive Patterns
*   **Output:** JSON
*   **Input Summary:** P7.1 output (`candidate_variables`), P7.2 output (`proposed_links`), Causal Glossary.
*   **Prompt Template:**
    ```text
    You are a Causal Graph Specialist. Your task is to assemble a full DAG from a list of justified pairwise links and then identify key structural patterns using the provided glossary. Each identified primitive pattern must have a unique ID.
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
Do NOT include a "mermaid_syntax_dag" field; this will be generated by the system later.
    ```

#### Step: P7_3B_VALIDATE_AND_CLEAN_DAG
*   **Title:** P7.3b Validate and Clean DAG
*   **Output:** JSON
*   **Input Summary:** P7.3 output (`preliminary_dag`, `acyclicity_status`, `detected_cycles`), P7.2 output (`proposed_links_context`).
*   **Prompt Template:**
    ```text
    You are a causal inference expert tasked with validating and cleaning a preliminary DAG to ensure it meets mathematical requirements for causal analysis.

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

Provide a comprehensive JSON response with:
- Clean final DAG (nodes and edges)
- Detailed resolution log explaining every action taken.
- Information about composite variables created.
- Information about time-indexed variables created.
- Assessment of remaining complexity.
- Validation summary confirming acyclicity.

Your output must be valid JSON following the P7_3b_Output interface structure. Focus on preserving theoretically important causal relationships while ensuring mathematical validity. Do NOT include mermaid syntax.
    ```

#### Step: P7_4_ANALYZE_PATHS_AND_BIASES
*   **Title:** P7.4: Analyze Paths and Identify Potential Biases
*   **Output:** JSON
*   **Input Summary:** P7.3b output (`p7_3b_output`), Causal Glossary.
*   **Prompt Template:**
    ```text
    You are a Causal Analyst. Your task is to analyze the pathways in the provided DAG to identify sources of confounding and potential bias. Each path analysis and collider warning must have a unique ID.
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
}
    ```

#### Step: P7_5_GENERATE_FORMAL_HYPOTHESES
*   **Title:** P7.5: Generate Formal Causal Hypotheses
*   **Output:** JSON
*   **Input Summary:** P7.1 output (`p7_1_output`), P7.3b output (`p7_3b_output`), P7.4 output (`p7_4_output`), DV focus (`userDvFocus.dv_focus`), P5.1 output (`p5_output` for context), Causal Glossary.
*   **Prompt Template:**
    ```text
    You are a Causal Inference Scientist. Your final task is to translate the structured causal analysis into a set of formal, testable causal hypotheses, linking them to specific structural elements identified earlier.
Input:
- Formalized Variables (P7.1): ${JSON.stringify(input.p7_1_output.candidate_variables.map((v:P7_1_CandidateVariable)=>({id:v.variable_id, name:v.variable_name})), null, 2)}
- Cleaned Causal DAG (P7.3b): Nodes: ${input.p7_3b_output.final_dag.nodes.length}, Edges: ${input.p7_3b_output.final_dag.edges.length}. Context: ${input.p7_3b_output.validation_summary}
- Path Analysis & Bias Warnings (P7.4): ${input.p7_4_output.path_analysis.length} path analyses, ${input.p7_4_output.collider_bias_warnings.length} collider warnings.
- Dependent Variable Focus: ${JSON.stringify(input.dv_focus)}
- Prior Insights/Hypotheses (P5.1 - for context): ${JSON.stringify(input.p5_output?.emergent_insights?.slice(0,2) || [], null, 2)}, ${JSON.stringify(input.p5_output?.hypotheses_generated?.slice(0,2) || [], null, 2)}
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
    ```

---
### Part VI: Report Generation (Global)

#### Step: P6_1_GENERATE_MARKDOWN_REPORT
*   **Title:** P6.1: Generate Final Markdown Report
*   **Output:** Markdown Text (string)
*   **Input Summary:** This step is programmatic. It uses the `ReportData` interface, which includes P5.1 output, P3.2, P3.3, P4S.1 (by GDU) outputs, P7.1, P7.3b (or P7.3), P7.5 outputs, all Mermaid syntaxes, transcript summaries, DV focus, quantitative summaries (GDU/GSS utterance counts, GDU transition counts), and raw transcript info.
*   **Prompt Template:**
    ```text
    Programmatic report generation. No LLM prompt needed for this step.
    ```
    *(The actual report is generated by `generateMarkdownReportProgrammatically` in `utils/reportHelper.ts` using the `ReportData` input.)*

---

## 4. Ancillary Data Exports

Beyond the main report, the application offers additional data export capabilities for deeper dives or alternative analysis.

### Detailed Analysis Appendix

*   **Trigger:** Manual button ("DL Appendix").
*   **Output:** An **HTML file** (`appendix_detailed_analyses.html`) or a simplified Markdown version.
*   **Content (HTML Version):** This file provides a comprehensive breakdown of specific analyses for *each* processed transcript. For each transcript, it typically includes:
    *   The transcript's filename and identified Independent Variable (IV) details.
    *   An **annotated version of the transcript**, where lines are color-coded or styled based on their procedural nature or the temporal phase they primarily belong to. Hovering over lines can reveal detailed trace information (P0.3 utterance, P1.1 segments, P1.2 DU, P1.3 Refined DU, P1.4 Phase, P2S.1 Thematic Groups, P2S.2 ISUs).
    *   **Specific Diachronic Structure Data:**
        *   The Mermaid.js diagram for the Specific Diachronic Structure (Gantt chart), if generated.
    *   **Specific Synchronic Analysis Data:**
        *   The Mermaid.js diagram(s) for the Specific Synchronic Structure(s) (flowcharts/graphs), if generated for any of the diachronic phases.
    *   **Generic Structures Section:** Includes diagrams for GDS, GSSs (per core GDU), and the Causal DAG.
    *   **Quantitative Summaries:** Tables for GDU vs. Utterances, GSS Category vs. Utterances, and GDU Transitions.
*   **Purpose:** This HTML appendix serves as a valuable interactive detailed reference, complementing the main report by providing granular, transcript-specific data and visualizations in one place. It is particularly useful for reviewing the foundational analyses that contribute to the generic structures and final insights. Embedded Mermaid diagrams are rendered and interactive within the HTML. The Markdown version is a more basic representation.