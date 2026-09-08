import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { PageDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

export interface UpsertPageRequest {
  title: string;
  slug: string;
  body: string;
  seoTitle?: string;
  seoDescription?: string;
}

/** Separate from content-pages.service.ts (the public, read-only GET /pages/:slug) — this is the admin CRUD side. */
@Service()
export class AdminPagesService {
  private readonly api = inject(ApiClient);

  list(): Observable<PageDto[]> {
    return this.api.get<PageDto[]>('/admin/pages');
  }

  getOne(id: string): Observable<PageDto> {
    return this.api.get<PageDto>(`/admin/pages/${id}`);
  }

  create(input: UpsertPageRequest): Observable<PageDto> {
    return this.api.post<PageDto>('/admin/pages', input);
  }

  update(id: string, input: Partial<UpsertPageRequest>): Observable<PageDto> {
    return this.api.patch<PageDto>(`/admin/pages/${id}`, input);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/pages/${id}`);
  }
}
