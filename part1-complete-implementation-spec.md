# Complete Implementation Specification: Part 1 Diachronic Analysis Pipeline Restructuring

## Overview

We need to restructure Part 1 of the µ-PATH pipeline from 4 steps to 5 steps with clearer separation of concerns. The new structure will provide better modularity and implement improvements identified through expert review.

## Current vs Proposed Structure

### Current Structure (4 steps):
1. P1.1: Initial Segmentation
2. P1.2: Diachronic Unit Identification 
3. P1.3: Refine Diachronic Units (includes phase assignment)
4. P1.4: Construct Specific Diachronic Structure

### Proposed Structure (5 steps):
1. P1.1: Initial Segmentation (UPDATE PROMPT)
2. P1.2: Diachronic Unit Identification (NO CHANGE)
3. P1.3: Temporal Phase Assignment (NEW STEP)
4. P1.4: Refine Diachronic Units (RENAME & UPDATE)
5. P1.5: Construct Specific Diachronic Structure (RENAME & ADD VALIDATION)

## Detailed Implementation Specifications

### Step P1.1: Initial Segmentation (UPDATE EXISTING)

**Changes Required:**
- Update the prompt to include comprehensive examples of implicit temporal markers

**Updated generatePrompt Function:**
```javascript
generatePrompt: (input: P0_3_Output) => `You are a micro-phenomenological analyst. Your task is to segment the selected procedural utterances based on temporal cues, focusing on the described experience's unfolding.

Input:
JSON output from P0.3 for transcript ID ${input.transcript_id} (showing only INCLUDED utterances).
P0.3 Output: ${JSON.stringify(input, null, 2)}

Instructions:
1. Focus on "Action Units": Read each selected procedural utterance. Identify "minimal action units" or "elementary acts" within them. An utterance might contain one or multiple such segments.

2. Temporal Cues: Look for explicit or implicit temporal markers that delineate these segments.
   
   EXPLICIT temporal markers include:
   - Time words: "then", "after", "before", "suddenly", "meanwhile", "finally"
   - Beginning markers: "at the start", "initially", "first"
   - Sequence markers: "next", "subsequently", "afterwards"
   
   IMPLICIT temporal markers include:
   - Sequence of distinct verbs: "I noticed... I felt... I realized..."
   - Progression indicators: "The sensation grew stronger", "It gradually faded", "It was building"
   - Transition markers: "My attention shifted", "The quality changed", "It transformed into"
   - Causal language (causation implies temporal sequence):
     * "Because of this, I..." (cause precedes effect)
     * "This led to..." (one thing follows another)
     * "As a result..." (consequence follows cause)
     * "Which made me..." (causal chain shows temporal flow)
     * "So I..." (therefore, subsequently)

3. Segment Creation:
   - For each original utterance, create an array of \`segments\`.
   - Each segment must have a unique \`segment_id\` (format: "utt_ORIGINAL-LINE-NUM_seg_INDEX").
   - \`segment_text\` must be the text of that minimal action unit.
   - \`temporal_cues\` must be an array of strings listing the temporal words/phrases identified *within or at the beginning of* that specific segment.

4. Preserve IV/DV: The \`independent_variable_details\` and \`dependent_variable_focus\` from the input MUST be copied verbatim into the output.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "segmented_utterances": [
    {
      "original_utterance": { /* Copied from P0.3 input */ },
      "segments": [
        {
          "segment_id": "utt_59_seg_0",
          "segment_text": "Just yeah, just I had a at the start. I had, like a brief images of... glue.",
          "temporal_cues": ["at the start"]
        }
      ]
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`
```

### Step P1.2: Diachronic Unit Identification (NO CHANGES)

**Status:** Keep exactly as is - no changes needed

**Existing generatePrompt Function:**
```javascript
generatePrompt: (input: P1_1_Output) => `You are a micro-phenomenological analyst. Your task is to group the provided segments into initial Diachronic Units (DUs). A DU represents a meaningful "moment" or "phase" in the described experience.

Input:
JSON output from P1.1 for transcript ID ${input.transcript_id}.
P1.1 Output: ${JSON.stringify(input, null, 2)}

Instructions:
1. Review all \`segments\` from the input. Use both the \`segment_text\` and the \`temporal_cues\` to understand the flow.
2. Group one or more consecutive (or thematically related) segments that form a single, coherent moment. These are your DUs.
3. For each DU you create:
   - Assign a unique \`unit_id\` (e.g., "du_1", "du_2").
   - Write a concise \`description\` that synthesizes the essence of the source segments.
   - List the \`source_segment_ids\` that constitute this DU.
4. Aim for a reasonable number of DUs that capture the main beats of the experience. The goal is to abstract away from the granularity of single segments.
5. Preserve IV/DV: Copy the \`independent_variable_details\` and \`dependent_variable_focus\` verbatim.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "transcript_id": "${input.transcript_id}",
  "diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Initial brief images of glue appeared at the start of the experience.",
      "source_segment_ids": ["utt_59_seg_0"]
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`
```

### Step P1.3: Temporal Phase Assignment (NEW STEP)

**Implementation Requirements:**
- Create new file: `src/config/pipeline/part1/temporalPhaseAssignment.ts`
- Add new types for P1_3_Input and P1_3_Output
- Implement getInput function to enrich DUs with source segment text

**New Type Definitions:**
```typescript
// Add to types.ts
export interface P1_3_Input {
  transcript_id: string;
  diachronic_units: Array<{
    unit_id: string;
    description: string;
    source_segment_ids: string[];
    // Enriched with source text by getInput
    source_segments_text?: Array<{
      segment_id: string;
      segment_text: string;
      temporal_cues: string[];
    }>;
  }>;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}

export interface P1_3_Output {
  transcript_id: string;
  phased_diachronic_units: Array<{
    unit_id: string;
    description: string;
    source_segment_ids: string[];
    phase_type: string;
  }>;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}
```

**Complete Step Configuration:**
```javascript
import { StepId, P1_2_Output, P1_1_Output } from '../../../../types';
import { StepConfig } from '../types';

export const P1_3_TEMPORAL_PHASE_ASSIGNMENT_CONFIG: StepConfig = {
  id: StepId.P1_3_TEMPORAL_PHASE_ASSIGNMENT,
  title: "P1.3: Temporal Phase Assignment",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.3." };
    
    const transcriptData = allProcessedData?.get(currentTranscript.id);
    const p1_2_data = transcriptData?.p1_2_output;
    const p1_1_data = transcriptData?.p1_1_output;
    
    if (!p1_2_data) return { data: null, error: `Missing P1.2 output for transcript ${currentTranscript.id}` };
    if (!p1_1_data) return { data: null, error: `Missing P1.1 output for transcript ${currentTranscript.id}` };
    
    // Enrich DUs with source segment text for context
    const enrichedDUs = p1_2_data.diachronic_units.map(du => {
      const sourceSegments = du.source_segment_ids.map(segId => {
        // Find the segment in P1.1 output
        for (const uttData of p1_1_data.segmented_utterances) {
          const segment = uttData.segments.find(s => s.segment_id === segId);
          if (segment) return segment;
        }
        return null;
      }).filter(Boolean);
      
      return {
        ...du,
        source_segments_text: sourceSegments
      };
    });
    
    return {
      data: {
        ...p1_2_data,
        diachronic_units: enrichedDUs
      }
    };
  },
  generatePrompt: (input: P1_3_Input) => `You are a micro-phenomenological analyst. Your task is to assign a temporal phase to each Diachronic Unit (DU). This is a categorization step only.

Input:
A list of DUs for transcript ID ${input.transcript_id}. Each DU includes a synthesized \`description\` and the raw \`source_segments_text\` it was derived from.
Input DUs: ${JSON.stringify(input.diachronic_units, null, 2)}

Instructions:
1. For each DU, read both its \`description\` and the detailed \`source_segments_text\` to get the full context.
2. Assign a \`phase_type\` from the FIXED list below that best describes the temporal quality of the DU.
3. **Indexing Rule:** For \`Development\`, \`Peak\`, and \`Transition\`, you MUST add a sequential index if the type is repeated (e.g., "Development_1", "Development_2"). \`Onset\` and \`Conclusion\` must be used only once.
4. Do NOT merge, split, or change the DUs. Simply copy each DU and add the \`phase_type\` key.
5. Preserve IV/DV.

**Phase Vocabulary:**
- \`Onset\`: The very beginning of the experience.
- \`Development_n\`: A period where the experience is unfolding or being sustained.
- \`Peak_n\`: A moment of maximal intensity or a key realization.
- \`Transition_n\`: A moment that marks a clear shift between other phases.
- \`Conclusion\`: The final moment of the experience.
- \`Reflection\`: A period of meta-commentary or looking back on the experience.

Output:
A JSON object adhering EXACTLY to the following structure:
{
  "transcript_id": "${input.transcript_id}",
  "phased_diachronic_units": [
    {
      "unit_id": "du_1",
      "description": "Initial brief images of glue appeared at the start of the experience.",
      "source_segment_ids": ["utt_59_seg_0"],
      "phase_type": "Onset"
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`
};
```

### Step P1.4: Refine Diachronic Units (RENAME & UPDATE EXISTING P1.3)

**Changes Required:**
1. Rename file from `refineDiachronicUnits.ts` to `refineDiachronicUnitsWithinPhases.ts`
2. Update to work with phase-grouped DUs
3. Add `merge_justification` field
4. Update prompt with sophisticated merging logic

**Updated Type Definitions:**
```typescript
// Update in types.ts
export interface P1_4_Output {
  transcript_id: string;
  refined_diachronic_units: Array<{
    unit_id: string;
    description: string;
    source_du_ids: string[];
    merge_justification?: string; // NEW: Required when multiple DUs are merged
    phase: {
      sequence_id: number;
      phase_type: string;
    };
  }>;
  independent_variable_details: string;
  dependent_variable_focus: string[];
}
```

**Updated Step Configuration:**
```javascript
export const P1_4_REFINE_DIACHRONIC_UNITS_CONFIG: StepConfig = {
  id: StepId.P1_4_REFINE_DIACHRONIC_UNITS,
  title: "P1.4: Refine Diachronic Units (RDU)",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.4." };
    
    const transcriptData = allProcessedData?.get(currentTranscript.id);
    const p1_3_data = transcriptData?.p1_3_output;
    const p1_1_data = transcriptData?.p1_1_output;
    
    if (!p1_3_data) return { data: null, error: `Missing P1.3 output for transcript ${currentTranscript.id}` };
    if (!p1_1_data) return { data: null, error: `Missing P1.1 output for transcript ${currentTranscript.id}` };
    
    // Group DUs by phase_type for processing
    const dusByPhase = {};
    p1_3_data.phased_diachronic_units.forEach(du => {
      if (!dusByPhase[du.phase_type]) {
        dusByPhase[du.phase_type] = [];
      }
      
      // Enrich each DU with its source segments and temporal cues
      const enrichedDU = {
        ...du,
        source_segments_with_cues: du.source_segment_ids.map(segId => {
          for (const uttData of p1_1_data.segmented_utterances) {
            const segment = uttData.segments.find(s => s.segment_id === segId);
            if (segment) return segment;
          }
          return null;
        }).filter(Boolean)
      };
      
      dusByPhase[du.phase_type].push(enrichedDU);
    });
    
    return { data: { ...p1_3_data, dusByPhase } };
  },
  generatePrompt: (input: any) => {
    // This will be called once per phase group
    const phaseType = input.phase_type;
    const dusInPhase = input.diachronic_units_in_phase;
    
    return `You are a micro-phenomenological analyst. Your task is to refine a group of Diachronic Units (DUs) that have all been assigned the same temporal phase: "${phaseType}".

**Core Objective:** Determine if any of these DUs describe the same single experiential moment and should be merged. Your decision MUST be grounded in the provided source text and temporal cues.

Input:
A list of DUs, all belonging to the phase: "${phaseType}". Each DU includes its synthesized description and the original source segments with their identified temporal cues.
Input DUs: ${JSON.stringify(dusInPhase, null, 2)}

Instructions:
1. **Ground Your Analysis:** For each DU, carefully review not only its synthesized \`description\` but also the raw \`source_segments_with_cues\`. The original text and cues are the primary source of truth.

2. **Compare DUs:** If two or more DUs are clearly describing different facets of the **same, unified moment**, you MUST merge them into a single Refined Diachronic Unit (RDU).

3. **Respect Sequence:** If the DUs describe **distinct, sequential moments**, you MUST keep them separate. The presence of temporal cues like 'then', 'after', or a clear logical progression in the source text is strong evidence that the moments are sequential.

4. **Create Final RDUs:** Create a final list of RDUs for this phase. For each RDU:
   - Assign a new, unique \`unit_id\` (e.g., "rdu_1", "rdu_2").
   - Write a new, synthesized \`description\` that accurately reflects the merged (or unmerged) content.
   - List all \`source_du_ids\` from the input that constitute this RDU.
   - If you merged multiple DUs, provide a \`merge_justification\` explaining why they represent the same moment.
   - Create a final \`phase\` object containing the \`sequence_id\` (its final chronological position within the overall experience) and the \`phase_type\`.

5. Preserve IV/DV.

---
**Merging Guidelines & Heuristics**

**MERGE DUs when they describe:**
- **Different Sensory Aspects of the Same Instant:** (e.g., a DU for "seeing the flash" and a DU for "hearing the bang" that happen simultaneously).
- **Multiple Perspectives on a Single Moment:** (e.g., a DU for "feeling surprised" and a DU for "heart racing" that describe the same instant of reaction).
- **Redundant Descriptions:** (e.g., a DU for "the warmth was spreading" and another for "I felt the heat expanding" if they refer to the same continuous sensation).

**KEEP DUs SEPARATE when they describe:**
- **Clear Sequential Steps:** (e.g., a DU for "I first noticed the resistance" and another for "then I decided to pull harder"). The temporal cue 'then' indicates sequence.
- **Different Instances of a Similar Experience:** (e.g., a DU for "I felt a wave of doubt" and another DU later in the same phase for "another wave of doubt came over me").
- **Cause and Effect:** (e.g., a DU for "I focused my attention" and a DU for "the feeling then became clearer"). The word 'then' implies a sequence.

---

Output:
A JSON object containing the list of refined RDUs for this phase.
{
  "transcript_id": "${input.transcript_id}",
  "refined_diachronic_units": [
    {
      "unit_id": "rdu_1",
      "description": "The participant's initial experience was characterized by brief, fading images of glue accompanied by a sense of anticipation.",
      "source_du_ids": ["du_1", "du_2"],
      "merge_justification": "Merged du_1 and du_2 as they describe the visual and emotional facets of the same opening moment",
      "phase": { "sequence_id": 1, "phase_type": "Onset" }
    }
  ],
  "independent_variable_details": "${input.independent_variable_details}",
  "dependent_variable_focus": ${JSON.stringify(input.dependent_variable_focus)}
}
`;
  }
};
```

### Step P1.5: Construct Specific Diachronic Structure (RENAME & ADD VALIDATION)

**Changes Required:**
1. Rename from P1.4 to P1.5
2. Keep existing table generation logic
3. Add validation logic to check sequence coherence

**Updated Step Configuration:**
```javascript
export const P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE_CONFIG: StepConfig = {
  id: StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE,
  title: "P1.5: Construct Specific Diachronic Structure (SDS)",
  part: "PartI_Dia",
  isJsonOutput: true,
  getInput: (currentTranscript, allProcessedData) => {
    if (!currentTranscript?.id) return { data: null, error: "Missing current transcript ID for P1.5." };
    
    const transcriptData = allProcessedData?.get(currentTranscript.id);
    const p1_4_data = transcriptData?.p1_4_output;
    
    if (!p1_4_data) return { data: null, error: `Missing P1.4 output for transcript ${currentTranscript.id}` };
    
    // Validate the RDU sequence
    const validationErrors = [];
    
    // Check for duplicate single-use phases
    const phaseTypes = p1_4_data.refined_diachronic_units.map(rdu => rdu.phase.phase_type);
    const onsetCount = phaseTypes.filter(p => p === 'Onset').length;
    const conclusionCount = phaseTypes.filter(p => p === 'Conclusion').length;
    
    if (onsetCount > 1) validationErrors.push("Multiple 'Onset' phases detected");
    if (conclusionCount > 1) validationErrors.push("Multiple 'Conclusion' phases detected");
    
    // Check sequence IDs are consecutive
    const sequenceIds = p1_4_data.refined_diachronic_units.map(rdu => rdu.phase.sequence_id).sort((a, b) => a - b);
    for (let i = 0; i < sequenceIds.length - 1; i++) {
      if (sequenceIds[i + 1] !== sequenceIds[i] + 1) {
        validationErrors.push(`Non-consecutive sequence IDs: ${sequenceIds[i]} -> ${sequenceIds[i + 1]}`);
      }
    }
    
    // Check logical phase progression
    const phaseProgression = p1_4_data.refined_diachronic_units
      .sort((a, b) => a.phase.sequence_id - b.phase.sequence_id)
      .map(rdu => rdu.phase.phase_type);
    
    if (phaseProgression.length > 0 && phaseProgression[0] !== 'Onset') {
      validationErrors.push("Experience should start with 'Onset' phase");
    }
    
    return { 
      data: {
        ...p1_4_data,
        validation_errors: validationErrors
      }
    };
  },
  // This step is programmatic - no LLM prompt needed
  generatePrompt: null,
  processStep: (input) => {
    // Programmatically generate the structure summary and prepare for display
    const rdus = input.refined_diachronic_units;
    
    // Group RDUs by phase for summary
    const phaseGroups = {};
    rdus.forEach(rdu => {
      const phaseType = rdu.phase.phase_type;
      if (!phaseGroups[phaseType]) {
        phaseGroups[phaseType] = [];
      }
      phaseGroups[phaseType].push(rdu);
    });
    
    // Create phase summary
    const phases = Object.entries(phaseGroups).map(([phaseType, rdusInPhase]) => ({
      phase_name: phaseType,
      description: rdusInPhase.map(rdu => rdu.description).join('; '),
      units_involved: rdusInPhase.flatMap(rdu => rdu.source_du_ids)
    }));
    
    return {
      transcript_id: input.transcript_id,
      specific_diachronic_structure: {
        summary: `Experience unfolded through ${rdus.length} distinct moments across ${Object.keys(phaseGroups).length} phases.`,
        phases,
        validation_errors: input.validation_errors || [],
        visualization_hint: "Linear progression with clear phase transitions"
      },
      refined_diachronic_units: rdus,
      independent_variable_details: input.independent_variable_details,
      dependent_variable_focus: input.dependent_variable_focus
    };
  }
};
```

## Implementation Checklist

### 1. Type Updates (types.ts)
- [ ] Add P1_3_Input and P1_3_Output interfaces
- [ ] Update P1_4_Output to include merge_justification field
- [ ] Add validation_errors to P1_5 structure

### 2. File Changes
- [ ] Update `initialSegmentation.ts` - enhance prompt with temporal marker examples
- [ ] Create `temporalPhaseAssignment.ts` - new P1.3 step
- [ ] Rename `refineDiachronicUnits.ts` to `refineDiachronicUnitsWithinPhases.ts`
- [ ] Update newly renamed file with phase-grouped logic and merge justifications
- [ ] Update `constructSpecificDiachronicStructure.ts` - add validation logic

### 3. Constants Updates
- [ ] Add StepId.P1_3_TEMPORAL_PHASE_ASSIGNMENT
- [ ] Update StepId.P1_4_REFINE_DIACHRONIC_UNITS (was P1_3)
- [ ] Update StepId.P1_5_CONSTRUCT_SPECIFIC_DIACHRONIC_STRUCTURE (was P1_4)
- [ ] Update STEP_ORDER_PART_1_SPECIFIC_DIACHRONIC array
- [ ] Update STEP_CONFIGS to include all 5 steps

### 4. Pipeline Store Updates
- [ ] Add p1_3_output to TranscriptProcessedData type
- [ ] Update stepIdToDataKeyPrefix mapping
- [ ] Ensure data flow handles 5 steps

### 5. UI Updates
- [ ] Ensure PipelineStepGrid handles renamed P1.5 (was P1.4)
- [ ] Update tooltip components to show merge_justification when present
- [ ] Display validation errors in P1.5 if any exist

### 6. Migration Strategy
- [ ] Create migration function to handle existing data
- [ ] Map old p1_3_output to new p1_4_output
- [ ] Generate placeholder p1_3_output for existing data

## Testing Plan

1. Test with fresh transcripts through all 5 steps
2. Test with existing data to ensure migration works
3. Verify merge justifications appear in tooltips
4. Check validation errors display properly
5. Ensure comparative table still works in P1.5

## Risk Mitigation

1. **Backward Compatibility**: Migration function will map old data structure
2. **Data Loss Prevention**: Old data preserved, new fields added
3. **UI Consistency**: Minimal changes to user-facing components
4. **Pipeline Integrity**: Other parts (2-7) continue to reference correct outputs