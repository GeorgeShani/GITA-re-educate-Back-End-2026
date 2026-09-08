import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { DashboardSummaryDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminDashboardService {
  private readonly api = inject(ApiClient);

  getSummary(from?: string, to?: string): Observable<DashboardSummaryDto> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to) params['to'] = to;
    return this.api.get<DashboardSummaryDto>('/admin/dashboard', params);
  }
}
