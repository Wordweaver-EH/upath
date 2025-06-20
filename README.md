# µ-PATH : Micro-Phenomenological Analytic Threader

**Version:** 1.9.1 (Human-in-the-Loop Correction, State Save/Load, Mermaid.js Visualizations, Report Integration, Causal Modeling)
**Based on:**
* Valenzuela-Moguillansky, Camila, and Alejandra Vásquez-Rosati. "An analysis procedure for the micro-phenomenological interview." *Constructivist Foundations* 14.2 (2019): 123-145.
* Sheldrake, Kevin, and Zoltan Dienes. "Micro-phenomenological Interviews for Hypothesis Generation." (2025). *(Note: Adjust date/status as appropriate, e.g., "Forthcoming", "Working Paper")*

## 1. Overview

This web application automates the complex process of analyzing micro-phenomenological interview transcripts using a multi-step prompt chaining system powered by the Google Gemini API. It guides the user through data preparation, specific diachronic analysis, specific synchronic analysis (performed for all relevant diachronic phases within each transcript), generic diachronic analysis, generic synchronic analysis (generating structures for all core Generic Diachronic Units - GDUs), holistic refinement, causal structure elicitation, and final report generation. The system is designed to process multiple transcripts and synthesize findings into generic structures.

A key feature is the **visualization of complex structures using Mermaid.js**:
*   **Diachronic structures** (Specific and Generic) are displayed as Gantt charts.
*   **Synchronic structures** (Specific and Generic) are displayed as flowcharts/graph diagrams.
*   **Proposed Causal DAGs** (initial and cleaned) are displayed as directed graphs.
These visualizations are rendered directly in the UI and are also embedded within the final Markdown report for a self-contained analysis document. The system also systematically considers independent variables throughout the analysis.

**Key features include:**
*   **Human-in-the-Loop (HIL) Correction:** Users can provide natural language guidance to correct and re-run steps, with automatic invalidation of downstream data.
*   **State Management (Save/Load):** Save and load the entire application state.
*   **Integrated Causal Modeling (Part VII):** Formalizes variables, proposes links, assembles and cleans a DAG, analyzes paths/biases, and generates formal causal hypotheses.

The application is built with React, TypeScript, and Tailwind CSS for the frontend, and utilizes the `@google/genai` SDK to interact with Google's Gemini models.

## 2. Core Functionality

*   **Transcript Processing:** Accepts multiple plain text (`.txt`) interview transcripts.
*   **Human-in-the-Loop (HIL) Correction:**
    *   A "Provide Guidance & Re-run" button allows users to open a modal for the currently displayed step.
    *   Users can input natural language guidance to correct suboptimal AI outputs.
    *   Submitting guidance triggers a re-run of the step with a "meta-prompt".
    *   Downstream data dependent on the corrected step are automatically invalidated and reset.
*   **State Management (Save/Load):**
    *   Save the entire application state to a downloadable JSON file.
    *   Load a previously saved state from a JSON file.
*   **Automated Analysis Pipeline:** Employs a sequence of prompts to the Gemini API for various analysis stages.
*   **Visualizations (Mermaid.js):**
    *   **Specific Diachronic Structures (P1.4):** Gantt charts.
    *   **Specific Synchronic Structures (P2S.3):** Flowcharts (per phase).
    *   **Generic Diachronic Structure (P3.3):** Gantt chart.
    *   **Generic Synchronic Structures (P4S.1):** Flowcharts (per core GDU).
    *   **Causal DAGs (P7.3, P7.3B):** Directed graphs.
    *   Visualizations are displayed in the UI and embedded in the final Markdown report and HTML appendix.
*   **Dependent Variable (DV) Focus:** User-specified DVs guide analysis.
*   **Integrated Independent Variable (IV) Consideration:** Systematically considers IVs.
*   **Configurable Model Parameters:** `temperature` and optional `seed`.
*   **Step-by-Step Execution & Autorun:** Manual or automated progression through the pipeline.
*   **Run Step/Retry Failed Step:** Re-execute steps, with options for new seeds on parsing failures.
*   **Progress Tracking:** Visual feedback on processing status.
*   **Input/Output Display:** Collapsible sections for API inputs, rendered diagrams, and JSON/text outputs.
*   **Data Download:**
    *   Intermediate and final outputs (JSON/TSV/Text/Markdown).
    *   **Selective Autodownload Option:** For essential analysis steps.
    *   **Output Directory Prefix:** User-configurable.
    *   The final comprehensive report is generated in Markdown, including embedded Mermaid diagrams.
    *   Prompt history download (JSON/TSV).
    *   **Detailed Appendix Generation:**
        *   **HTML Appendix:** Generates `appendix_detailed_analyses.html` with comprehensive per-transcript analyses, embedded (interactive) Mermaid diagrams, and quantitative summaries.
        *   **Markdown Appendix (Simplified):** Generates `appendix_detailed_analyses.md`.
*   **Error Handling & Self-Correction:** Displays errors; includes JSON parsing self-correction.
*   **Token & Runtime Tracking:** Displays estimated token counts and session runtime.
*   **Theme Customization:** Light/Dark mode.

## 3. Analysis Pipeline

The application implements a detailed analysis pipeline:

**Per-Transcript Analysis:**

1.  **Part -1: Variable Identification** (`P_NEG1_1_VARIABLE_IDENTIFICATION`)
2.  **Part 0: Data Preparation** (`P0_1` to `P0_3`)
    *   `P0_3_SELECT_PROCEDURAL_UTTERANCES` **(Essential for Autodownload)**
3.  **Part I: Specific Diachronic Analysis** (`P1_1` to `P1_4`)
    *   `P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE`: Builds Specific Diachronic Structure. **(Mermaid Diagram Generated - Gantt; Essential for Autodownload)**
4.  **Part II_S: Specific Synchronic Analysis** (`P2S_1` to `P2S_3` - Iterated for each diachronic phase from P1.4)
    *   `P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE`: Defines Specific Synchronic Structure (SSS). **(Mermaid Diagram Generated per phase - Flowchart; Essential for Autodownload - JSON output per phase)**

**Cross-Transcript (Generic) Analysis:**

5.  **Part III: Generic Diachronic Analysis** (`P3_1` to `P3_3`)
    *   `P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE`: Defines Generic Diachronic Structure(s). **(Mermaid Diagram Generated - Gantt; Essential for Autodownload)**
6.  **Part IV_S: Generic Synchronic Analysis** (`P4S_1` - Iterated for each core GDU from P3.3)
    *   `P4S_1_IDENTIFY_GENERIC_SYNCHRONIC_UNITS`: Defines Generic Synchronic Structure (GSS). **(Mermaid Diagram Generated per GDU - Flowchart; Essential for Autodownload - JSON output per GDU)**
7.  **Part V: Refinement** (`P5_1`)
    *   `P5_1_HOLISTIC_REVIEW_REFINEMENT` **(Essential for Autodownload)**
8.  **Part VII: Causal Structure Elicitation** (`P7_1` to `P7_5`)
    *   `P7_1_CANDIDATE_VARIABLE_FORMALIZATION`
    *   `P7_2_PROPOSE_PAIRWISE_CAUSAL_LINKS`
    *   `P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS` **(Mermaid Diagram Generated - Graph)**
    *   `P7_3B_VALIDATE_AND_CLEAN_DAG` **(Mermaid Diagram Generated - Graph; Essential for Autodownload)**
    *   `P7_4_ANALYZE_PATHS_AND_BIASES`
    *   `P7_5_GENERATE_FORMAL_HYPOTHESES` **(Essential for Autodownload)**
9.  **Part VI: Report Generation** (`P6_1`)
    *   `P6_1_GENERATE_MARKDOWN_REPORT`: Synthesizes all findings into a comprehensive Markdown report, including embedded Mermaid diagrams. **(Essential for Autodownload)**

## 4. Setup and Usage

### 4.1. API Key Configuration (Crucial!)

This application requires a Google Gemini API key. **It MUST be pre-configured as an environment variable `process.env.API_KEY`.**

### 4.2. Running the Application

Standard web application build/run process. Ensure `API_KEY` is set.

### 4.3. Workflow

1.  **Set Dependent Variable (DV) Focus**.
2.  **Configure Model Parameters (Optional)**.
3.  **Set Output Directory Name (Optional)**.
4.  **Enable Autodownload (Optional)**.
5.  **Upload Transcripts OR Load State**.
6.  **Run Analysis**: "Autorun All Steps" or "Next Step."
7.  **Monitor Progress**.
8.  **Review Outputs & Visualizations**.
9.  **Human-in-the-Loop Correction (Optional)**.
10. **Save State (Optional)**.
11. **Generate Detailed Appendix (Optional):** Use 'DL Appendix' button for HTML or Markdown versions.

## 5. Output Formats

*   **JSON:** Most structured data. Application state.
*   **TSV:** For `P0_1`, `P0_2`, `P0_3` outputs, prompt history.
*   **Markdown:** Final report from `P6_1` (with embedded Mermaid). Simplified appendix.
*   **HTML:** Detailed appendix (`appendix_detailed_analyses.html`) with interactive Mermaid diagrams.
*   **Text (.txt):** Simple string outputs.
*   **Mermaid Syntax (In-App Rendering & Report/Appendix):** Diagrams rendered in browser and embedded.

## 6. Technical Details

*   **Frontend:** React 19, TypeScript, Tailwind CSS
*   **API Interaction:** `@google/genai` SDK (Model: `gemini-2.5-flash-preview-04-17`).
*   **Markdown Rendering:** `marked` library.
*   **Data Visualization:** `Mermaid.js` (version 11+).
*   **State Versioning:** `APP_VERSION` field in saved state.

## 7. Project File Structure (Key Files)

*   `index.html`, `index.tsx`, `App.tsx`, `README.md`
*   `components/`: Contains UI components.
*   `services/geminiService.ts`
*   `utils/`: Helper functions for TSV, visualizations, HTML, reports.
*   `constants.tsx`: Pipeline configuration, prompts, icons.
*   `types.ts`: Core data structures.
*   `metadata.json`
*   `pipeline.md` (Detailed pipeline documentation)

## 8. Troubleshooting & Notes

*   **API Key Missing:** Ensure `process.env.API_KEY` is set.
*   **State File Compatibility:** Check `APP_VERSION`.
*   **Mermaid Diagram Errors:** Check console; raw syntax available in JSON/report.
*   **Viewing Markdown/HTML Report Diagrams:** Use a compatible viewer (e.g., GitHub, VS Code with extensions, modern browser for HTML).
*   **Essential Steps for Autodownload (JSON/TSV/Text/Markdown data):**
    *   `P0_3_SELECT_PROCEDURAL_UTTERANCES`
    *   `P1_4_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE`
    *   `P2S_3_DEFINE_SPECIFIC_SYNCHRONIC_STRUCTURE` (per phase)
    *   `P3_3_DEFINE_GENERIC_DIACHRONIC_STRUCTURE`
    *   `P4S_1_IDENTIFY_GENERIC_SYNCHRONIC_UNITS` (per GDU)
    *   `P5_1_HOLISTIC_REVIEW_REFINEMENT`
    *   `P7_3_ASSEMBLE_DAG_AND_IDENTIFY_PATTERNS` (initial DAG)
    *   `P7_3B_VALIDATE_AND_CLEAN_DAG` (cleaned DAG)
    *   `P7_5_GENERATE_FORMAL_HYPOTHESES`
    *   `P6_1_GENERATE_MARKDOWN_REPORT` (or `COMPLETE` which uses P6.1 output)
    *   *Note: For steps producing diagrams, the primary data output is autodownloaded. Mermaid syntax is stored for UI/report embedding.*

## 9. Citation

This tool is based on the methodologies described in:

*   Valenzuela-Moguillansky, Camila, and Alejandra Vásquez-Rosati. "An analysis procedure for the micro-phenomenological interview." *Constructivist Foundations* 14.2 (2019): 123-145.
*   Sheldrake, Kevin, and Zoltan Dienes. *Micro-phenomenological Interviews for Hypothesis Generation.* 2025. (Adjust specific date/status as appropriate, e.g., "Forthcoming March 21", "Working Paper")

Please cite these works if you use insights or structures derived from this application in your research.