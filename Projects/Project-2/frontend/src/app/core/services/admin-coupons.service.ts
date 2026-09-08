import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { CouponDto, Paginated, UpsertCouponRequest } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminCouponsService {
  private readonly api = inject(ApiClient);

  list(isActive?: boolean, page = 1, take = 30): Observable<Paginated<CouponDto>> {
    return this.api.get<Paginated<CouponDto>>(
      '/admin/coupons',
      toParams({ isActive, page, take }),
    );
  }

  getOne(id: string): Observable<CouponDto> {
    return this.api.get<CouponDto>(`/admin/coupons/${id}`);
  }

  create(input: UpsertCouponRequest): Observable<CouponDto> {
    return this.api.post<CouponDto>('/admin/coupons', input);
  }

  update(id: string, input: Partial<UpsertCouponRequest>): Observable<CouponDto> {
    return this.api.patch<CouponDto>(`/admin/coupons/${id}`, input);
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
