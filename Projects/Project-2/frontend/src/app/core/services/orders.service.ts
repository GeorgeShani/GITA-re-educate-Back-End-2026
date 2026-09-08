import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { OrderDto, TrackingInfoDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class OrdersService {
  private readonly api = inject(ApiClient);

  getOrder(id: string): Observable<OrderDto> {
    return this.api.get<OrderDto>(`/orders/${id}`);
  }

  /** Public — no auth. Requires the order's own email, per the backend's own comment. */
  track(orderNumber: string, email: string): Observable<TrackingInfoDto> {
    return this.api.get<TrackingInfoDto>('/orders/track', { orderNumber, email });
  }
}
