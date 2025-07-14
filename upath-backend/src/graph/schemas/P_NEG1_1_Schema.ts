import { z } from 'zod';

export const P_NEG1_1_Schema = z.object({
  transcript_id: z.string(),
  independent_variable_details: z.string(),
  dependent_variable_focus: z.array(z.string())
});

export type P_NEG1_1_Output = z.infer<typeof P_NEG1_1_Schema>;