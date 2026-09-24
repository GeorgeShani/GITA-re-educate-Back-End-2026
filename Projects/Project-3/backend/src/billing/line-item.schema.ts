import { z } from 'zod';
import type { LineItem } from './calculator.js';

/**
 * `Invoice.lineItems` is `jsonb`: what a query returns is untyped by definition,
 * and an invoice is the one record that must never be silently mis-shaped. Every
 * read parses it through this. `line-item.schema.spec.ts` feeds it real
 * calculator output, so the schema and the calculator cannot drift apart.
 */
export const lineItemSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('seat'),
    description: z.string(),
    userId: z.string(),
    activeDays: z.number().int().nonnegative(),
    periodDays: z.number().int().positive(),
    unitCents: z.number().int(),
    amountCents: z.number().int(),
  }),
  z.object({
    kind: z.literal('plan_base'),
    description: z.string(),
    billedDays: z.number().int().nonnegative(),
    periodDays: z.number().int().positive(),
    unitCents: z.number().int(),
    amountCents: z.number().int(),
  }),
  z.object({
    kind: z.literal('overage'),
    description: z.string(),
    files: z.number().int().positive(),
    unitCents: z.number().int(),
    amountCents: z.number().int(),
  }),
]);

export const lineItemsSchema = z.array(lineItemSchema);

/**
 * The return type is the compile-time half of the no-drift guarantee: if the
 * schema stops being assignable to `LineItem[]`, this stops compiling.
 */
export function parseLineItems(stored: unknown): LineItem[] {
  return lineItemsSchema.parse(stored);
}
