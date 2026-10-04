import { z } from 'zod';

const stepOutcomes = z.array(
  z.object({
    step: z.string(),
    label: z.string(),
    changed: z.number(),
    skipped: z.string().nullable(),
    notes: z.array(z.string()),
  }),
);

/** A job's stored `steps` (jsonb), read back through its schema: never trusted, and empty until the job has run. */
export function stepOutcomesOf(value: unknown): z.infer<typeof stepOutcomes> {
  const parsed = stepOutcomes.safeParse(value);
  return parsed.success ? parsed.data : [];
}
