import { z } from 'zod';

/**
 * Schema for individual refined transcript lines
 */
export const RefinedLineSchema = z.object({
  line_num: z.number(),
  text: z.string(),
  information_tags: z.array(z.string()),
  decision_notes: z.string().nullable().optional()
});

/**
 * Schema for P0_2 Refine Data Types output
 * Validates the categorization of transcript lines into information types
 */
export const P0_2_Schema = z.object({
  transcript_id: z.string(),
  refined_data_transcript: z.array(RefinedLineSchema)
});

export type P0_2_Output = z.infer<typeof P0_2_Schema>;
export type RefinedLine = z.infer<typeof RefinedLineSchema>;