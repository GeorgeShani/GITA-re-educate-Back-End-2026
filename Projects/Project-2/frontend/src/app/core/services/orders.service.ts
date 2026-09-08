import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { OrderDto, Paginated, TrackingInfoDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class OrdersService {
  private readonly api = inject(ApiClient);

  listMine(page = 1, take = 30): Observable<Paginated<OrderDto>> {
    return this.api.get<Paginated<OrderDto>>('/orders', { page, take });
  }

  getOrder(id: string): Observable<OrderDto> {
    return this.api.get<OrderDto>(`/orders/${id}`);
  }

  /** Adds every line from a past order to the current cart. Returns 204, so refresh CartService afterward. */
  reorder(id: string): Observable<void> {
    return this.api.post<void>(`/orders/${id}/reorder`, {});
  }

  /** Public — no auth. Requires the order's own email, per the backend's own comment. */
  track(orderNumber: string, email: string): Observable<TrackingInfoDto> {
    return this.api.get<TrackingInfoDto>('/orders/track', { orderNumber, email });
  }
}
