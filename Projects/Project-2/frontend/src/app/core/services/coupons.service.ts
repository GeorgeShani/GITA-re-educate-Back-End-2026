import { httpResource } from '@angular/common/http';
import { Service, inject } from '@angular/core';

import type { FeaturedCouponDto } from '@/app/core/api/dto';
import { API_BASE_URL } from '@/app/core/services/api-client';

/**
 * Public read side of coupons — currently just the one storefront-wide
 * promo the sale banner advertises. Admin CRUD lives in
 * admin-coupons.service.ts; this is deliberately separate the same way
 * blog.service.ts/admin-blog.service.ts split public reads from admin
 * writes.
 */
@Service()
export class CouponsService {
  private readonly baseUrl = inject(API_BASE_URL);

  featuredCouponResource() {
    return httpResource<FeaturedCouponDto | null>(() => `${this.baseUrl}/coupons/featured`);
  }
}
