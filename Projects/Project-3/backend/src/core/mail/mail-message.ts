import { z } from 'zod';

/** Links go into an email body; only http(s) is ever legitimate there. */
const httpUrl = z.url({ protocol: /^https?$/ });

/**
 * One schema per template. These are the `send_email` task's payload: a task
 * row is `jsonb`, so what the runner reads back is untyped and must be parsed
 * before a template renders against it. A producer that forgets a variable
 * fails here, at the boundary, instead of sending an email with a blank link.
 */
export const mailMessageSchema = z.discriminatedUnion('template', [
  z.object({
    template: z.literal('activation'),
    to: z.string().email(),
    vars: z.object({ companyName: z.string(), activationUrl: httpUrl }),
  }),
  z.object({
    template: z.literal('invite'),
    to: z.string().email(),
    vars: z.object({
      fullName: z.string(),
      companyName: z.string(),
      inviteUrl: httpUrl,
    }),
  }),
  z.object({
    template: z.literal('password_reset'),
    to: z.string().email(),
    vars: z.object({ fullName: z.string(), resetUrl: httpUrl }),
  }),
  z.object({
    template: z.literal('password_changed'),
    to: z.string().email(),
    vars: z.object({ fullName: z.string() }),
  }),
  z.object({
    template: z.literal('invoice_finalized'),
    to: z.string().email(),
    vars: z.object({
      companyName: z.string(),
      periodStart: z.string(),
      periodEnd: z.string(),
      totalFormatted: z.string(),
      invoiceUrl: httpUrl,
    }),
  }),
  z.object({
    template: z.literal('quota_threshold'),
    to: z.string().email(),
    vars: z.object({
      companyName: z.string(),
      threshold: z.number().int(),
      headline: z.string(),
      detail: z.string(),
      billingUrl: httpUrl,
    }),
  }),
]);

export type MailMessage = z.infer<typeof mailMessageSchema>;
export type MailTemplateName = MailMessage['template'];

export interface RenderedEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}
