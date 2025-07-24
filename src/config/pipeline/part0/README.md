# Part 0: Data Preparation

## Exact Prompt Chain

### P0.1 Prompt
```
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

### P0.2 Prompt (with parsed_lines preprocessing)
```
You are a micro-phenomenological data preparation analyst. Your task is to refine the line-numbered transcript by identifying different types of information.
Input:
The parsed transcript lines for transcript ID ${input.transcript_id}.
${JSON.stringify({ 
  transcript_id: input.transcript_id,
  parsed_lines: input.parsed_lines,
  transcription_convention_notes: input.transcription_convention_notes,
  initial_impressions_log: input.initial_impressions_log
}, null, 2)}

Instructions:
1. Re-read and categorize each parsed line:
   For each line in parsed_lines, determine if it primarily contains:
    - "procedural_information": Utterances related to the interview process itself (e.g., interviewer's questions, participant's reflections on the question or process, meta-comments).
    - "experiential_content": Utterances directly describing the lived experience being investigated.
    - "ambiguous_or_mixed": Lines that are hard to categorize or contain both.
2. Tagging:
   Based on this, assign one or more information_tags to each line (e.g., ["procedural_information"], ["experiential_content"], ["procedural_information", "experiential_content"]).
3. Decision Notes (Optional):
   If a line is particularly complex or its categorization is non-obvious, add a brief decision_notes explaining your reasoning.

Output:
A JSON object adhering EXACTLY to the following structure, with NO additional explanations or markdown:
{
  "transcript_id": "${input.transcript_id}",
  "refined_data_transcript": [
    {
      "line_num": 1,
      "speaker": "P1",
      "text": "text content without line number or speaker prefix",
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

### P0.3 Prompt
```
You are a micro-phenomenological analyst. Your task is to evaluate ALL utterances from the refined data transcript and determine which are crucial for understanding the diachronic (temporal) structure of the *experience itself*. The sequence and content of the described experience is of importance rather than the order it was reported in in the interview. 
Input:
The JSON output from P0.2 (refined data transcript) and P-1.1 (IV/DV info) for transcript ID ${input.transcript_id}.
P0.2 Output: ${JSON.stringify(input, null, 2)}

Instructions:
1.  Temporal Structure: Focus only on utterances that reveal the temporal unfolding of the lived experience.
2.  Procedural Priority: Interviewer questions and meta-comments should be **excluded**, UNLESS they provide irreplaceable context for understanding the timing of a participant's description. A question like "And what happened next?" is almost always excluded if the participant's answer contains a temporal marker like "Next, I...".
3.  Evaluation Criteria for EACH utterance: Ask yourself: "Is this a **direct, concrete description** of the singular experience, or is it a generalization, theory, or conversational filler?"
    *   **INCLUDE** only direct descriptions of actions, sensations, or cognitions within the specific event.
    *   **EXCLUDE** participant's theories about *why* something happened.
    *   **EXCLUDE** participant's generalizations about what they *usually* do or feel.
    *   **EXCLUDE** judgments about the experience (e.g., "that was weird").
    *   An utterance must contribute to the temporal map and phenomenological content of the experience to be included.
4.  IMPORTANT: Output minified JSON with no unnecessary whitespace. Be extremely concise.
5.  Preserve IV/DV: The independent_variable_details and dependent_variable_focus from P-1.1 MUST be copied verbatim into the output.

Output:
A MINIFIED JSON object (no extra whitespace) adhering EXACTLY to the following structure:
{"transcript_id":"${input.transcript_id}","selected_procedural_utterances":[{"original_line_num":"1","speaker":"P1","utterance_text":"full text...","selection_justification":"brief reason here","included":false},{"original_line_num":"2","speaker":"Kevin Sheldrake","utterance_text":"full text...","selection_justification":"another brief reason","included":true}],"independent_variable_details":"${input.p_neg1_1_output.independent_variable_details}","dependent_variable_focus":${JSON.stringify(input.p_neg1_1_output.dependent_variable_focus)}}
```

## Overview

Part 0 performs **Data Preparation** on raw interview transcripts, transforming them into a structured format suitable for micro-phenomenological analysis. This part ensures transcripts are properly formatted, tagged with information types, and filtered to include only utterances relevant to understanding the temporal unfolding of experience. Part 0 processes each transcript independently and sequentially.

## Architecture

### Processing Model
- **Part Iteration**: Part 0 is configured with `iteration: 'per-transcript'` in the pipeline structure
- **Transcript Processing**: Each transcript is processed through all three steps before moving to the next
- **Sequential Execution**: Transcripts are processed one at a time (not in parallel)
- **Foundation for Analysis**: Creates the structured data that all subsequent parts depend on

### Data Flow
```
Raw Transcript File → Part 0:
  └─ Transcript 1: P0.1 → P0.2 → P0.3
  └─ Transcript 2: P0.1 → P0.2 → P0.3
  └─ ... 
  └─ Transcript N: P0.1 → P0.2 → P0.3
  └─ (all transcripts complete) → Move to Part 1
```

### Dependency Chain
- P0.1 takes raw transcript content
- P0.2 requires P0.1 output
- P0.3 requires both P0.2 output AND P-1.1 output (IV/DV information)

## Steps

### P0.1: Transcription Adherence & Line Numbering

**Purpose**: Validates transcription conventions and adds line numbers to enable precise referencing throughout the pipeline.

**Input**: Raw transcript content from file

**Processing**:
1. Verifies transcription appears verbatim and orthographic
2. Notes any deviations (summarization, missing para-verbal cues)
3. Assigns sequential line numbers starting from 1
4. Records initial impressions about evocation quality (optional but recommended)

**Output** (`P0_1_Output`):
```typescript
{
  transcript_id: string,              // Filename or ID
  line_numbered_transcript: [         // Array of numbered lines
    "1: First line of transcript...",
    "2: Speaker: Their utterance...",
    // ...
  ],
  transcription_convention_notes: string,  // Adherence notes
  initial_impressions_log: string         // Brief preliminary impressions
}
```

### P0.2: Refining Data - Identifying Information Types

**Purpose**: Parses line-numbered transcript to extract speakers and tag information types in each utterance.

**Input**: P0.1 output (line-numbered transcript)

**Processing**:
1. TypeScript preprocessing:
   - Attempts preliminary parsing of line numbers and speakers
   - Creates a helper structure for the LLM
   - This is just a hint - the LLM does the actual parsing
2. LLM processing extracts and refines:
   - Line number (from format "N: ...")
   - Speaker (if present, e.g., "P1:", "Kevin Sheldrake:")
   - Text content (cleaned of line numbers and speaker prefixes)
3. LLM tags each line with information types:
   - `procedural_information`: Interview process utterances (questions, meta-comments)
   - `experiential_content`: Direct descriptions of lived experience
   - `ambiguous_or_mixed`: Lines containing both types or hard to categorize
4. LLM provides optional decision notes for complex categorizations

**Special Processing**:
- TypeScript provides preliminary parsing hints, but LLM makes final decisions
- Speaker identification is done by the LLM based on transcript patterns
- Original line structure preserved while adding metadata

**Output** (`P0_2_Output`):
```typescript
{
  transcript_id: string,
  refined_data_transcript: [
    {
      line_num: number,
      speaker?: string,              // Optional, if identified
      text: string,                  // The utterance text
      information_tags: string[],    // e.g., ["procedural_information", "experiential_content"]
      decision_notes?: string        // Optional categorization reasoning
    }
  ]
}
```

### P0.3: Select Procedural Utterances for Diachronic Analysis

**Purpose**: Evaluates all utterances and selects those crucial for understanding temporal structure and phenomenological content, marking them for inclusion in subsequent analysis. Focuses on the experience itself, not the interview sequence.

**Input**: 
- P0.2 output (refined data transcript)
- P-1.1 output (IV/DV information)

**Processing**:
1. Evaluates EACH utterance for temporal and phenomenological relevance
2. Focuses on the sequence of the actual experience (not interview order)
3. INCLUDES only:
   - Direct, concrete descriptions of actions, sensations, or cognitions
   - Utterances revealing temporal unfolding of the experience
   - Content contributing to both temporal map AND phenomenological content
4. EXCLUDES:
   - Participant theories about why something happened
   - Generalizations about usual behaviors  
   - Judgments about the experience
   - Redundant procedural questions (unless irreplaceable context)
5. Marks each utterance as `included: true/false` with justification
6. Preserves IV/DV information from P-1.1

**Special Notes**:
- Output is MINIFIED JSON (no whitespace) for efficiency
- Despite the field name "selected_procedural_utterances", this step evaluates ALL utterances
- Procedural utterances are typically EXCLUDED unless providing unique temporal context
- Focus is on concrete descriptions of singular experience
- The name is historical - the step filters for both temporal and phenomenological relevance

**Output** (`P0_3_Output`):
```typescript
{
  transcript_id: string,
  selected_procedural_utterances: [
    {
      original_line_num: string,     // e.g., "5"
      speaker?: string,
      utterance_text: string,        // Full text
      selection_justification: string, // Why included/excluded
      included: boolean              // true = process in Part 1
    }
  ],
  independent_variable_details: string,  // From P-1.1
  dependent_variable_focus: string[]     // From P-1.1
}
```

## Key Concepts

### Information Types (P0.2)
- **Procedural Information**: Questions, instructions, interview management
- **Experiential Content**: Direct descriptions of lived experience  
- **Ambiguous or Mixed**: Contains both types or unclear categorization

### Temporal Relevance (P0.3)
- Not all experiential content is temporally relevant
- Procedural utterances can be crucial for temporal understanding
- Focus on what helps reconstruct the experience's unfolding
- Context matters as much as content

### Line Numbering Convention
- Sequential from 1
- Format: "N: content"
- Preserved throughout pipeline for traceability
- Original line numbers used in all references

## State Management

### Storage Structure
```typescript
processedData.get(transcriptId) = {
  p0_1_output?: P0_1_Output,
  p0_1_error?: string,
  p0_2_output?: P0_2_Output,
  p0_2_error?: string,
  p0_3_output?: P0_3_Output,
  p0_3_error?: string,
  // ... other fields
}
```

### Critical Dependencies
- P0.3 requires BOTH P0.2 and P-1.1 outputs
- IV/DV information must be preserved through P0.3
- Line numbers must remain consistent for traceability

## Common Issues & Solutions

### Issue: "Missing P0.2 or P-1.1 output"
**Cause**: P0.3 can't find required dependencies
**Solution**: Ensure Part -1 completed and P0.2 succeeded

### Issue: Speaker detection failures
**Cause**: Unusual transcript formatting
**Solution**: Check speaker format matches patterns (e.g., "Name:", "P1:")

### Issue: Minified JSON parsing errors
**Cause**: P0.3 outputs minified JSON that may be hard to debug
**Solution**: Use JSON formatter to inspect, check for proper escaping

### Issue: All utterances marked as excluded
**Cause**: Too strict interpretation of temporal relevance
**Solution**: Remember procedural utterances that provide temporal context should be included

### Issue: Line number mismatches
**Cause**: Parsing errors in P0.1 or P0.2
**Solution**: Verify line format is consistent "N: text"

## Error Handling

### Step Failures
- Each step can produce either output or error (stored in `p0_X_error` fields)
- Subsequent steps cannot proceed without required inputs
- P0.3 has dual dependency - needs both P0.2 AND P-1.1
- Errors typically include:
  - Missing dependencies: "Missing P0.2 or P-1.1 output for transcript X"
  - Invalid data: "Missing transcript content for P0.1"
  - Parse failures: JSON parsing errors from AI responses

### Edge Cases
- **Empty transcripts**: Produce empty arrays but valid structure
- **No speakers identified**: `speaker` field remains undefined
- **Single-line transcripts**: Still processed through all steps
- **No temporally relevant content**: P0.3 may mark all as `included: false`
- **Malformed line numbers**: P0.2 handles gracefully, preserves original

## Integration with Other Parts

### From Part -1
- Receives IV/DV information crucial for analysis focus
- P0.3 requires P-1.1 output to preserve research context

### To Part 1
- Only utterances marked `included: true` in P0.3 are processed
- Line numbers enable precise reference back to original
- Information tags could inform analysis (though currently Part 1 uses raw text)

### Data Preservation
- Original line numbers maintained throughout pipeline
- Speaker information preserved for context
- IV/DV focus carries through to guide analysis

## Best Practices

1. **Preserve Original Format**: Don't modify transcript content, only add metadata
2. **Consistent Line Numbering**: Critical for traceability - never renumber
3. **Liberal Inclusion**: When in doubt about temporal relevance, include
4. **Clear Justifications**: P0.3 justifications help debug selection decisions
5. **Speaker Validation**: Check speaker detection logic for your transcript format
6. **Minified Output**: P0.3 uses minified JSON - validate carefully

## Special Processing Notes

### P0.2 Preliminary Parsing
- TypeScript code attempts preliminary parsing to help the LLM:
  - Participant IDs: `/^[A-Z]\d+$/` (e.g., "P1", "A2")
  - Full names: `/^[A-Z][a-z]+ [A-Z][a-z]+$/` (e.g., "Kevin Sheldrake")
  - Fallback: Any text < 30 characters before a colon
- This is just a hint - the LLM makes the final speaker determination
- LLM may identify speakers the regex misses or correct false positives

### P0.3 Minified JSON
- Output specifically requested as minified (no whitespace)
- Reduces token usage for large transcripts
- May require special handling in parsing/debugging

### Information Tag Assignment
- Multiple tags can apply to single utterance
- Tags are suggestive, not restrictive
- Primary purpose is documentation, not filtering

## Implementation Pattern

All Part 0 steps follow the `StepConfig` interface:
- `getInput`: Validates dependencies and prepares input data
- `generatePrompt`: Constructs the AI prompt with input data
- `isJsonOutput: true`: Ensures JSON response parsing
- Exported via `index.ts` for pipeline integration

## Development Notes

- Part 0 is the only part that works with raw transcript text
- Line numbering in P0.1 is critical - all references depend on it
- P0.2's speaker detection may need adjustment for different transcript formats
- P0.3's selection criteria directly impacts how much data flows through pipeline
- Consider P0.3 selection carefully - excluded content is lost to analysis
- Information tags from P0.2 are currently preserved but not used in later steps