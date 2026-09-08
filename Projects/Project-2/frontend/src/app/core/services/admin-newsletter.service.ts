import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdminNewsletterQuery, NewsletterSubscriberDto, Paginated } from '@/app/core/api/dto';
import { API_BASE_URL, ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminNewsletterService {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listSubscribers(query: AdminNewsletterQuery): Observable<Paginated<NewsletterSubscriberDto>> {
    return this.api.get<Paginated<NewsletterSubscriberDto>>(
      '/admin/newsletter/subscribers',
      toParams({ ...query }),
    );
  }

  /** JSON export — same auth-header-needs-HttpClient reasoning as admin-orders.service.ts's packing slip. */
  exportSubscribersBlob(): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/admin/newsletter/subscribers/export`, { responseType: 'blob' });
  }
}

function toParams(
  query: Record<string, string | number | boolean | undefined>,
): Record<string, string | number | boolean> {
  return Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined)) as Record<
    string,
    string | number | boolean
  >;
}
