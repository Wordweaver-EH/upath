/**
 * P1_1 Initial Segmentation - Output Parsing
 * Exactly matches the working prototype's parseOutput function
 */

import { ParseOutputFunction } from '../../core/interfaces';
import { P1_1_Output, SegmentedUtterance, SegmentedUtteranceSegment } from './types';
import { SelectedUtterance } from '../P0_3/types';
import { getErrorMessage } from '../../../types/errors';

/**
 * Parse and validate JSON output for P1_1 step
 * Exactly matches the working prototype's parsing logic
 */
export const parseOutput: ParseOutputFunction = (rawOutput: string): P1_1_Output => {
  try {
    // Debug logging (matches prototype pattern)
    console.log(`[P1_1 parseOutput] Raw output length: ${rawOutput?.length || 0}`);
    
    if (!rawOutput || typeof rawOutput !== 'string') {
      throw new Error('No output received from Gemini API');
    }

    // Parse JSON (matches prototype's JSON.parse logic)
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawOutput);
    } catch (parseError: unknown) {
      console.error(`[P1_1 parseOutput] JSON parse error:`, parseError);
      throw new Error(`Failed to parse JSON output: ${getErrorMessage(parseError)}`);
    }

    // Validate required fields (exactly matches prototype validation)
    const validationErrors: string[] = [];

    if (!parsedData.transcript_id || typeof parsedData.transcript_id !== 'string') {
      validationErrors.push('Missing or invalid transcript_id');
    }

    if (!Array.isArray(parsedData.segmented_utterances)) {
      validationErrors.push('Missing or invalid segmented_utterances array');
    } else {
      // Validate segmented_utterances array structure
      if (parsedData.segmented_utterances.length === 0) {
        validationErrors.push('segmented_utterances cannot be empty');
      } else {
        // Validate each SegmentedUtterance object
        parsedData.segmented_utterances.forEach((segUtterance: any, index: number) => {
          const segErrors: string[] = [];

          // Validate original_utterance structure
          if (!segUtterance.original_utterance || typeof segUtterance.original_utterance !== 'object') {
            segErrors.push('missing or invalid original_utterance object');
          } else {
            const orig = segUtterance.original_utterance;
            if (!orig.original_line_num || typeof orig.original_line_num !== 'string') {
              segErrors.push('original_utterance.original_line_num must be a non-empty string');
            }
            if (!orig.utterance_text || typeof orig.utterance_text !== 'string') {
              segErrors.push('original_utterance.utterance_text must be a non-empty string');
            }
            if (orig.selection_justification !== undefined && 
                orig.selection_justification !== null && 
                typeof orig.selection_justification !== 'string') {
              segErrors.push('original_utterance.selection_justification must be a string or undefined');
            }
          }

          // Validate segments array
          if (!Array.isArray(segUtterance.segments)) {
            segErrors.push('segments must be an array');
          } else {
            if (segUtterance.segments.length === 0) {
              segErrors.push('segments array cannot be empty');
            } else {
              // Validate each segment
              segUtterance.segments.forEach((segment: any, segIndex: number) => {
                const segmentErrors: string[] = [];

                if (!segment.segment_id || typeof segment.segment_id !== 'string') {
                  segmentErrors.push('segment_id must be a non-empty string');
                } else {
                  // Validate segment_id format (should be like "utt_X_seg_Y")
                  if (!/^utt_.+_seg_\d+$/.test(segment.segment_id)) {
                    segmentErrors.push('segment_id must follow format "utt_X_seg_Y"');
                  }
                }

                if (!segment.segment_text || typeof segment.segment_text !== 'string') {
                  segmentErrors.push('segment_text must be a non-empty string');
                }

                if (segment.temporal_cues !== undefined && segment.temporal_cues !== null) {
                  if (!Array.isArray(segment.temporal_cues)) {
                    segmentErrors.push('temporal_cues must be an array or undefined');
                  } else {
                    const invalidCues = segment.temporal_cues.filter((cue: any) => typeof cue !== 'string');
                    if (invalidCues.length > 0) {
                      segmentErrors.push('temporal_cues must contain only strings');
                    }
                  }
                }

                if (segmentErrors.length > 0) {
                  segErrors.push(`Segment ${segIndex + 1}: ${segmentErrors.join(', ')}`);
                }
              });

              // Validate segment_id uniqueness within this utterance
              const segmentIds = segUtterance.segments.map((seg: any) => seg.segment_id);
              const duplicateIds = segmentIds.filter((id: string, idx: number) => segmentIds.indexOf(id) !== idx);
              if (duplicateIds.length > 0) {
                segErrors.push(`Duplicate segment_ids: ${duplicateIds.join(', ')}`);
              }
            }
          }

          if (segErrors.length > 0) {
            validationErrors.push(`Segmented utterance ${index + 1}: ${segErrors.join('; ')}`);
          }
        });
      }
    }

    if (!parsedData.independent_variable_details || typeof parsedData.independent_variable_details !== 'string') {
      validationErrors.push('Missing or invalid independent_variable_details');
    }

    if (!Array.isArray(parsedData.dependent_variable_focus)) {
      validationErrors.push('Missing or invalid dependent_variable_focus array');
    } else {
      // Validate dependent_variable_focus items are strings
      const invalidDvItems = parsedData.dependent_variable_focus.filter((item: any) => typeof item !== 'string');
      if (invalidDvItems.length > 0) {
        validationErrors.push('dependent_variable_focus must contain only strings');
      }
      if (parsedData.dependent_variable_focus.length === 0) {
        validationErrors.push('dependent_variable_focus cannot be empty');
      }
    }

    if (validationErrors.length > 0) {
      console.error(`[P1_1 parseOutput] Validation errors:`, validationErrors);
      throw new Error(`Validation failed: ${validationErrors.join('; ')}`);
    }

    // Create validated output object (exactly matches prototype structure)
    const segmentedUtterances: SegmentedUtterance[] = parsedData.segmented_utterances.map((segUtt: any) => {
      const originalUtterance: SelectedUtterance = {
        original_line_num: segUtt.original_utterance.original_line_num.trim(),
        utterance_text: segUtt.original_utterance.utterance_text.trim(),
        selection_justification: segUtt.original_utterance.selection_justification ? 
          segUtt.original_utterance.selection_justification.trim() : undefined,
      };

      const segments: SegmentedUtteranceSegment[] = segUtt.segments.map((seg: any) => ({
        segment_id: seg.segment_id.trim(),
        segment_text: seg.segment_text.trim(),
        temporal_cues: seg.temporal_cues ? seg.temporal_cues.map((cue: string) => cue.trim()) : undefined,
      }));

      return {
        original_utterance: originalUtterance,
        segments,
      };
    });

    const output: P1_1_Output = {
      transcript_id: parsedData.transcript_id.trim(),
      segmented_utterances: segmentedUtterances,
      independent_variable_details: parsedData.independent_variable_details.trim(),
      dependent_variable_focus: parsedData.dependent_variable_focus.map((item: string) => item.trim()),
    };

    // Additional content validation (matches prototype quality checks)
    const totalUtterances = output.segmented_utterances.length;
    const totalSegments = output.segmented_utterances.reduce((sum, utt) => sum + utt.segments.length, 0);
    
    if (totalUtterances < 1) {
      throw new Error('segmented_utterances must contain at least one utterance');
    }

    if (totalSegments < 1) {
      throw new Error('must have at least one segment across all utterances');
    }

    // Check for reasonable segmentation (should have at least some segments with temporal cues)
    const segmentsWithCues = output.segmented_utterances.reduce((count, utt) => 
      count + utt.segments.filter(seg => seg.temporal_cues && seg.temporal_cues.length > 0).length, 0
    );

    console.log(`[P1_1 parseOutput] Successfully parsed and validated output for transcript: ${output.transcript_id}`);
    console.log(`[P1_1 parseOutput] Segmented utterances: ${totalUtterances}`);
    console.log(`[P1_1 parseOutput] Total segments: ${totalSegments}`);
    console.log(`[P1_1 parseOutput] Segments with temporal cues: ${segmentsWithCues}/${totalSegments}`);
    console.log(`[P1_1 parseOutput] Preserved IV details: ${!!output.independent_variable_details}`);
    console.log(`[P1_1 parseOutput] Preserved DV focus count: ${output.dependent_variable_focus.length}`);

    return output;

  } catch (error: unknown) {
    console.error(`[P1_1 parseOutput] Unexpected error:`, error);
    throw new Error(`Unexpected parsing error: ${getErrorMessage(error)}`);
  }
};