import { z } from 'zod';

export const P0_1_Schema = z.object({
  transcript_id: z.string(),
  line_numbered_transcript: z.array(z.string()),
  transcription_convention_notes: z.string(),
  initial_impressions_log: z.string()
});

export type P0_1_Output = z.infer<typeof P0_1_Schema>;