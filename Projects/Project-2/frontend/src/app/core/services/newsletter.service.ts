import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { NewsletterSubscriberDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

/**
 * `confirm`/`unsubscribe` are GET, not POST — newsletter.controller.ts's
 * own comment: "works as a plain email link with no JS". No confirmation/
 * unsubscribe email actually sends yet (no MJML template for either), so
 * these two only do anything real when reached with a genuine token —
 * there's no way to trigger one from this app itself yet.
 */
@Service()
export class NewsletterService {
  private readonly api = inject(ApiClient);

  subscribe(email: string): Observable<void> {
    return this.api.post<void>('/newsletter/subscribe', { email });
  }

  confirm(email: string, token: string): Observable<NewsletterSubscriberDto> {
    return this.api.get<NewsletterSubscriberDto>('/newsletter/confirm', { email, token });
  }

  unsubscribe(email: string, token: string): Observable<void> {
    return this.api.get<void>('/newsletter/unsubscribe', { email, token });
  }
}
