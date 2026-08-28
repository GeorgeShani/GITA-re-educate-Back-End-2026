import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';

import { AssistantSseEvent } from './assistant-sse-event';

/** Bridges AssistantService's async-generator turn loop to the Observable<MessageEvent> @Sse() expects. */
export function toSseObservable(
  generator: AsyncGenerator<AssistantSseEvent>,
): Observable<MessageEvent> {
  return new Observable<MessageEvent>((subscriber) => {
    void (async () => {
      try {
        for await (const event of generator) {
          subscriber.next({ data: event });
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}
