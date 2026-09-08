/**
 * Fetch-based SSE client — NOT EventSource. The assistant's stream lives
 * behind POST + an Authorization header (backend/src/assistant/
 * assistant.controller.ts), and native EventSource supports neither: it's
 * GET-only and can't set custom headers. `fetch()` + a `ReadableStream`
 * reader + a hand-rolled SSE frame parser is the only way to consume it.
 *
 * Frame shape, confirmed live against the real backend (@nestjs/common's
 * @Sse() writer): each event is one or more lines ending in `\n\n`, with
 * an optional leading `id: N` line and the payload on one or more `data:`
 * lines (multi-line data per the SSE spec joins with `\n`). This service
 * only ever sees `data:` — id/event/retry lines aren't meaningful here
 * (assistant.service.ts's own try/catch keeps every frame's `data` on the
 * one documented AssistantSseEvent JSON shape; see its comment for the
 * inconsistent frame shape that existed before that fix).
 */
export class SseHttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'SseHttpError';
  }
}

export interface SseRequestOptions {
  url: string;
  body: unknown;
  accessToken: string | null;
  signal?: AbortSignal;
}

export async function* streamSse<T>(options: SseRequestOptions): AsyncGenerator<T> {
  const response = await fetch(options.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    credentials: 'include',
    body: JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body: unknown = await response.json();
      const candidate = (body as { message?: unknown } | null)?.message;
      if (typeof candidate === 'string') message = candidate;
    } catch {
      // Body wasn't JSON — keep the generic message above.
    }
    throw new SseHttpError(response.status, message);
  }
  if (!response.body) {
    throw new Error('No response body for an SSE stream.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line; normalize CRLF first so
      // that boundary check is a single, reliable pattern.
      buffer = buffer.replace(/\r\n/g, '\n');

      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);

        const dataLines = frame
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''));
        if (dataLines.length === 0) continue;

        yield JSON.parse(dataLines.join('\n')) as T;
      }
    }
  } finally {
    reader.releaseLock();
  }
}
