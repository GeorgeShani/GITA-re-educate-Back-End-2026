import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  AdminOrderQuery,
  IssueRefundRequest,
  OrderDto,
  Paginated,
  ShipOrderRequest,
} from '@/app/core/api/dto';
import { toHttpParams } from '@/app/core/api/http-params';
import { API_BASE_URL, ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminOrdersService {
  private readonly api = inject(ApiClient);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(query: AdminOrderQuery): Observable<Paginated<OrderDto>> {
    return this.api.get<Paginated<OrderDto>>('/admin/orders', toHttpParams({ ...query }));
  }

  getOne(id: string): Observable<OrderDto> {
    return this.api.get<OrderDto>(`/admin/orders/${id}`);
  }

  ship(id: string, input: ShipOrderRequest): Observable<OrderDto> {
    return this.api.post<OrderDto>(`/admin/orders/${id}/ship`, input);
  }

  markDelivered(id: string): Observable<OrderDto> {
    return this.api.post<OrderDto>(`/admin/orders/${id}/deliver`, {});
  }

  refund(id: string, input: IssueRefundRequest): Observable<unknown> {
    return this.api.post(`/admin/orders/${id}/refund`, input);
  }

  /**
   * A plain <a href> can't carry the Authorization header this route
   * needs (JWT via header, no auth cookie — see api-client.ts's own
   * comment) — fetched as a blob through HttpClient (auth.interceptor.ts
   * attaches the header to every HttpClient request) and opened from an
   * object URL instead.
   */
  getPackingSlipBlob(id: string): Observable<Blob> {
    return this.http.get(`${this.baseUrl}/admin/orders/${id}/packing-slip`, { responseType: 'blob' });
  }
}
