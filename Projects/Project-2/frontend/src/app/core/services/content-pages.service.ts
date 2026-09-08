import { httpResource } from '@angular/common/http';
import { Service, inject } from '@angular/core';

import type { PageDto } from '@/app/core/api/dto';
import { API_BASE_URL } from '@/app/core/services/api-client';

/**
 * Named `content-pages` (not `pages`) to avoid any confusion with Angular's
 * own routing vocabulary. Backend admin CRUD doesn't exist for these
 * (page.schema.ts: "these are seeded directly") — read-only by design.
 */
@Service()
export class ContentPagesService {
  private readonly baseUrl = inject(API_BASE_URL);

  pageResource(slug: () => string | undefined) {
    return httpResource<PageDto>(() => {
      const value = slug();
      return value ? { url: `${this.baseUrl}/pages/${value}` } : undefined;
    });
  }
}
