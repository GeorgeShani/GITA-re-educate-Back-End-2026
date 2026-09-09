import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AuditLogEntryDto, AuditLogQuery, Paginated } from '@/app/core/api/dto';
import { toHttpParams } from '@/app/core/api/http-params';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminAuditLogService {
  private readonly api = inject(ApiClient);

  list(query: AuditLogQuery): Observable<Paginated<AuditLogEntryDto>> {
    return this.api.get<Paginated<AuditLogEntryDto>>('/admin/audit-log', toHttpParams({ ...query }));
  }
}
