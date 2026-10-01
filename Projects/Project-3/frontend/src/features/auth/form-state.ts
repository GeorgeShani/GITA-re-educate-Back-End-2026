/**
 * What a form action hands back. `values` repopulate the fields after a refusal (never a password), so a typo costs one
 * correction, not a retype.
 */
export type FormState =
  | { status: "idle" }
  | {
      status: "error";
      messages: string[];
      values: Record<string, string>;
      /** The refusal was "not activated yet": offer to send the link again. */
      needsActivation?: boolean;
    }
  | { status: "sent"; email: string };

export const IDLE: FormState = { status: "idle" };
