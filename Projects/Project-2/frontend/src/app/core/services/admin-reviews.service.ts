import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdminReviewDto, AdminReviewQuery, Paginated } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminReviewsService {
  private readonly api = inject(ApiClient);

  list(query: AdminReviewQuery): Observable<Paginated<AdminReviewDto>> {
    return this.api.get<Paginated<AdminReviewDto>>('/admin/reviews', toParams({ ...query }));
  }

  getOne(id: string): Observable<AdminReviewDto> {
    return this.api.get<AdminReviewDto>(`/admin/reviews/${id}`);
  }

  approve(id: string): Observable<AdminReviewDto> {
    return this.api.post<AdminReviewDto>(`/admin/reviews/${id}/approve`, {});
  }

  reject(id: string): Observable<AdminReviewDto> {
    return this.api.post<AdminReviewDto>(`/admin/reviews/${id}/reject`, {});
  }

  reply(id: string, reply: string): Observable<AdminReviewDto> {
    return this.api.post<AdminReviewDto>(`/admin/reviews/${id}/reply`, { reply });
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
