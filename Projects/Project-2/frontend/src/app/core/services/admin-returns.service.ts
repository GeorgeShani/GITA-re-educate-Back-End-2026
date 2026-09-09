import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdminReturnQuery, Paginated, ReturnDto } from '@/app/core/api/dto';
import { toHttpParams } from '@/app/core/api/http-params';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminReturnsService {
  private readonly api = inject(ApiClient);

  list(query: AdminReturnQuery): Observable<Paginated<ReturnDto>> {
    return this.api.get<Paginated<ReturnDto>>('/admin/returns', toHttpParams({ ...query }));
  }

  getOne(id: string): Observable<ReturnDto> {
    return this.api.get<ReturnDto>(`/admin/returns/${id}`);
  }

  approve(id: string, adminNote?: string): Observable<ReturnDto> {
    return this.api.post<ReturnDto>(`/admin/returns/${id}/approve`, { adminNote });
  }

  reject(id: string, adminNote: string): Observable<ReturnDto> {
    return this.api.post<ReturnDto>(`/admin/returns/${id}/reject`, { adminNote });
  }

  receive(id: string): Observable<ReturnDto> {
    return this.api.post<ReturnDto>(`/admin/returns/${id}/receive`, {});
  }

  refund(id: string): Observable<ReturnDto> {
    return this.api.post<ReturnDto>(`/admin/returns/${id}/refund`, {});
  }
}
