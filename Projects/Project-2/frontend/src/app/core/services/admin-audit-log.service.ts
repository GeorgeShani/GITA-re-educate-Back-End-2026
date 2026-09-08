import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AuditLogEntryDto, AuditLogQuery, Paginated } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminAuditLogService {
  private readonly api = inject(ApiClient);

  list(query: AuditLogQuery): Observable<Paginated<AuditLogEntryDto>> {
    return this.api.get<Paginated<AuditLogEntryDto>>('/admin/audit-log', toParams({ ...query }));
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
