import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdminShippingZoneDto, UpsertShippingZoneRequest } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminShippingService {
  private readonly api = inject(ApiClient);

  /** Not paginated — shipping.service.ts's admin findAll returns a plain array. */
  list(): Observable<AdminShippingZoneDto[]> {
    return this.api.get<AdminShippingZoneDto[]>('/admin/shipping/zones');
  }

  getOne(id: string): Observable<AdminShippingZoneDto> {
    return this.api.get<AdminShippingZoneDto>(`/admin/shipping/zones/${id}`);
  }

  create(input: UpsertShippingZoneRequest): Observable<AdminShippingZoneDto> {
    return this.api.post<AdminShippingZoneDto>('/admin/shipping/zones', input);
  }

  update(id: string, input: Partial<UpsertShippingZoneRequest>): Observable<AdminShippingZoneDto> {
    return this.api.patch<AdminShippingZoneDto>(`/admin/shipping/zones/${id}`, input);
  }
}
