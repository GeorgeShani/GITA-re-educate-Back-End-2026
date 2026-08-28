// The SSE event union sent to the client — one MessageEvent per event,
// JSON-stringified as `data`. `text` events stream token-by-token;
// `confirmation_required` ends the stream and waits for a client call to
// POST /assistant/sessions/:id/confirm; `done` ends a turn that needed
// no confirmation.
export type AssistantSseEvent =
  | { type: 'text'; delta: string }
  | {
      type: 'confirmation_required';
      messageId: string;
      toolCalls: { name: string; args: Record<string, unknown> }[];
    }
  | { type: 'done' }
  | { type: 'error'; message: string };
