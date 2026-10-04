import { z } from 'zod';

/**
 * A cleaning recipe: an ordered list of steps, each one small and checkable. Every step names its column in the header's own
 * words (matched without regard to case or surrounding spaces, like a quality rule), and a step about a column the file does
 * not have is skipped, not failed: a recipe saved for a dataset must survive a file that drops a column.
 */
const column = z.string().trim().min(1).max(200);

export const stepSchema = z.discriminatedUnion('step', [
  /** Spaces at the start and end of a cell, and runs of spaces inside it. One column, or every column. */
  z.object({ step: z.literal('trim_whitespace'), column: column.optional() }),
  /** The header row: trimmed, runs of spaces collapsed. */
  z.object({ step: z.literal('tidy_headers') }),
  z.object({ step: z.literal('drop_empty_rows') }),
  /** Rows identical to an earlier row; the first of each is kept. */
  z.object({ step: z.literal('drop_duplicate_rows') }),
  z.object({
    step: z.literal('standardise_dates'),
    column,
    /** How `03/04/2026` is read when it could be either: day first (4 March) or month first (3 April). */
    order: z.enum(['dmy', 'mdy']).default('dmy'),
  }),
  z.object({
    step: z.literal('parse_numbers'),
    column,
    /** The mark between a number's whole and fractional parts: `1.234,50` writes it `,`. */
    decimal: z.enum(['.', ',']).default('.'),
  }),
  z.object({
    step: z.literal('replace_values'),
    /** One column, or every column when absent. */
    column: column.optional(),
    values: z.array(z.string().trim().min(1).max(100)).min(1).max(50),
    with: z.string().max(200).default(''),
  }),
  z.object({ step: z.literal('fill_empty'), column, value: z.string().max(200) }),
  z.object({ step: z.literal('change_case'), column, mode: z.enum(['upper', 'lower', 'title']) }),
  z.object({ step: z.literal('rename_column'), column, to: column }),
  z.object({ step: z.literal('drop_column'), column }),
  z.object({
    step: z.literal('mask_column'),
    column,
    /** `redact` replaces the value, `last4` keeps its last four characters, `hash` makes a stable fingerprint (same value, same fingerprint). */
    mode: z.enum(['redact', 'last4', 'hash']),
  }),
]);
export type Step = z.infer<typeof stepSchema>;
export type StepKind = Step['step'];
export const STEP_KINDS = stepSchema.options.map((option) => option.shape.step.value);

export const MAX_STEPS = 50;

export const recipeSchema = z.object({ steps: z.array(stepSchema).min(1).max(MAX_STEPS) });
export type Recipe = z.infer<typeof recipeSchema>;
