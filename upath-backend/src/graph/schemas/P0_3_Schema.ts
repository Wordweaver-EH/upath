import { z } from 'zod';

/**
 * Schema for individual selected utterances
 */
export const SelectedUtteranceSchema = z.object({
  original_line_num: z.string(), // Can be "X.Y" for split lines
  utterance_text: z.string(),
  selection_justification: z.string().optional()
});

/**
 * Schema for P0_3 Select Procedural Utterances output
 * Validates the selection of utterances describing temporal/procedural aspects of experience
 */
export const P0_3_Schema = z.object({
  transcript_id: z.string(),
  selected_procedural_utterances: z.array(SelectedUtteranceSchema),
  discarded_info_summary: z.string().optional(),
  independent_variable_details: z.string(),
  dependent_variable_focus: z.array(z.string())
});

export type P0_3_Output = z.infer<typeof P0_3_Schema>;
export type SelectedUtterance = z.infer<typeof SelectedUtteranceSchema>;