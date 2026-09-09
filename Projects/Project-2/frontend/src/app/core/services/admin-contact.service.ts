import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdminContactMessageDto, AdminContactQuery, Paginated } from '@/app/core/api/dto';
import { toHttpParams } from '@/app/core/api/http-params';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminContactService {
  private readonly api = inject(ApiClient);

  list(query: AdminContactQuery): Observable<Paginated<AdminContactMessageDto>> {
    return this.api.get<Paginated<AdminContactMessageDto>>('/admin/contact', toHttpParams({ ...query }));
  }

  markRead(id: string): Observable<AdminContactMessageDto> {
    return this.api.patch<AdminContactMessageDto>(`/admin/contact/${id}/read`, {});
  }
}
