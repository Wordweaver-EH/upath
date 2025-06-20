# µ-PATH Application TODO List

## I. Core Functionality & UX (Active Development Focus)

### Human-in-the-Loop (HIL) Correction
- [ ] **Advanced HIL - Direct JSON Edit:** Allow users to directly edit the JSON output of a step as part of the HIL guidance.
- [ ] **Advanced HIL - Structured Guidance:** Allow users to provide more structured HIL input (e.g., specifying which JSON path to change, or providing diffs).
- [ ] **HIL Context Specificity:** Improve the logic for finding the `relevantEntry` in `promptHistory` for HIL to be more specific for per-phase (P2S) and per-GDU (P4S) steps. Consider storing phase/GDU context in `PromptHistoryEntry`.
- [ ] **HIL Visual Diffing:** Implement a visual diff view (e.g., side-by-side) for `originalPrompt` and `previousResponse` within the HIL modal to make it easier for users to spot issues and formulate guidance.

### UI/UX Enhancements
- [ ] **Interactive Pipeline Navigation:** Enhance the pipeline overview to allow users to more easily jump to a specific step *for a specific transcript/phase/GDU* where applicable.
- [ ] **Improved Display for Long Outputs:** Better handling/truncation/scrolling for very long text or JSON in the main output display and HIL modal.
- [ ] **Batch Processing Management:** Design a better UI for managing and tracking progress across multiple transcripts, especially when not using full autorun (e.g., selecting a subset of transcripts for a specific part).
- [ ] **User Feedback Mechanisms:** Incorporate ways for users to provide general feedback or report issues encountered during use.
- [ ] **Enhanced Error Reporting:** Provide more user-friendly and contextual error messages. Suggest potential causes or next steps where possible.

### Visualization & Reporting
- [ ] **Mermaid Diagram Robustness & Theming:**
    - [ ] Continuously monitor and ensure `htmlLabels: false` is effective for all diagram types and configurations to prevent unexpected HTML label rendering.
    - [ ] Verify consistent theme application (light/dark) across all Mermaid diagram types and ensure dynamic updates are smooth.
- [ ] **Report Customization:** Allow users some level of customization for the final Markdown report (e.g., selecting which sections or diagrams to include).

### Performance
- [ ] **Lazy Loading:** Implement lazy loading for large datasets (e.g., prompt history, report sections) to improve initial load time and responsiveness.

## II. Backend & API Interaction
- [ ] **Refined API Error Handling:** Implement more granular retry logic or user notifications for specific API error codes (e.g., rate limits, temporary server issues).
- [ ] **Configuration Export:** Allow users to export the current prompt configurations (perhaps as a JSON or text file).

## III. Development & Maintenance
- [ ] **Comprehensive Testing:**
    - [ ] Develop unit tests for key utility functions (e.g., `visualizationHelper.ts`, `tsvHelper.ts`).
    - [ ] Implement integration tests for core pipeline logic and state transitions.
    - [ ] Explore End-to-End (E2E) testing for critical user flows.
- [ ] **Documentation Review:**
    - [ ] Regularly review and update `pipeline.md` to accurately reflect any changes in step logic, inputs, or outputs.
    - [ ] Ensure `README.md` is kept current with major features and usage instructions.
- [ ] **Dependency Audit:** Periodically review and update dependencies.

## IV. Traceability Improvements (Largely Implemented - Ongoing Refinement)

The following items represent significant traceability enhancements that have been integrated into the `types.ts` definitions and AI prompt generation logic in `constants.tsx`. Ongoing work involves ensuring these are robustly handled by the AI and consistently applied.

-   **P1.1 (Initial Segmentation) → P1.2 (Diachronic Unit ID)**
    *   **Status:** [x] Implemented.
    *   **Details:** P1.1 segments get `segment_id`. P1.2 DUs use `source_segment_ids` referencing P1.1 `segment_id`s.
-   **P1.2 (Diachronic Unit ID) → P1.3 (Refine Diachronic Units)**
    *   **Status:** [x] Implemented.
    *   **Details:** P1.3 refined DUs use `source_p1_2_du_ids` to link to P1.2 DUs.
-   **P2S.2 (Identify Specific Synchronic Units) → P2S.3 (Define Specific Synchronic Structure)**
    *   **Status:** [x] Implemented.
    *   **Details:** P2S.3 SSS network nodes use `source_isu_id` to link to P2S.2 ISUs (via `unit_name`).
-   **P1.3 (Refined DUs from all transcripts) → P3.2 (Identify GDUs)**
    *   **Status:** [x] Implemented.
    *   **Details:** P3.2 GDUs use `contributing_refined_du_ids: Array<{ transcript_id: string; refined_du_id: string; }>` to link to P1.3 refined DUs.
-   **P4S.1 (Identify Generic Synchronic Units - GSS Instantiation)**
    *   **Status:** [x] Implemented.
    *   **Details:** P4S.1 instantiation notes use `example_specific_nodes: Array<{ transcript_id: string; sss_node_id: string; phase_name?: string }>` to link GSS categories to specific SSS nodes.
-   **P5.1 (Holistic Review & Refinement)**
    *   **Status:** [x] Implemented.
    *   **Details:** P5.1 output includes `updated_gds_object` and `updated_gss_outputs_by_gdu` (full refined GDS and GSS objects).
-   **P7.1 (Candidate Variable Formalization)**
    *   **Status:** [x] Implemented.
    *   **Details:** P7.1 candidate variables include `grounding_references` for structured links to GDU, GSS categories, P5 insights/hypotheses.
-   **P7.3 (Assemble DAG) & P7.4 (Analyze Paths) Output Identifiers**
    *   **Status:** [x] Implemented.
    *   **Details:** Elements in P7.3 (primitives) and P7.4 (path analyses, collider warnings) are assigned unique IDs (`primitive_id`, `path_analysis_id`, `collider_warning_id`).
-   **P7.5 (Generate Formal Causal Hypotheses)**
    *   **Status:** [x] Implemented.
    *   **Details:** P7.5 formal hypotheses use `related_primitive_ids` and `related_path_analysis_ids` to link to P7.3/P7.4 elements.

### Guiding Principles for Implementation (Self-Correction for Prompts)

When implementing these changes by modifying AI prompts:

1.  **"Which earlier object(s) did you rely on?"** – If it’s more than one, the output field should be an array of IDs.
2.  **"Will a downstream script have to string-match to recover that link?"** – If yes, add an explicit ID-based field.
3.  **"Could an ID change because of merge/split/renaming?"** – If yes, store all contributing source IDs, not just a single potentially changed one. Ensure a clear path from the original ID to the new ID if transformations occur.

By systematically adding these "breadcrumb" fields, a more robust and machine-navigable lineage from utterance to final hypothesis can be achieved.
