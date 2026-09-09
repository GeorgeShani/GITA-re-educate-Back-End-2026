import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdminEmailQuery, EmailMessageDto, Paginated } from '@/app/core/api/dto';
import { toHttpParams } from '@/app/core/api/http-params';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminEmailService {
  private readonly api = inject(ApiClient);

  listMessages(query: AdminEmailQuery): Observable<Paginated<EmailMessageDto>> {
    return this.api.get<Paginated<EmailMessageDto>>('/admin/email/messages', toHttpParams({ ...query }));
  }

  resend(id: string): Observable<EmailMessageDto> {
    return this.api.post<EmailMessageDto>(`/admin/email/messages/${id}/resend`, {});
  }

  /** No GET list exists for suppressions (backend never built one) — add/remove by exact address only. */
  addSuppression(email: string): Observable<void> {
    return this.api.post<void>('/admin/email/suppressions', { email });
  }

  removeSuppression(email: string): Observable<void> {
    return this.api.delete<void>(`/admin/email/suppressions/${encodeURIComponent(email)}`);
  }
}
