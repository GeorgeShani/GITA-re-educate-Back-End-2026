import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdminCategoryDto, UpsertCategoryRequest } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminCategoriesService {
  private readonly api = inject(ApiClient);

  /** Flat, sorted by position — not paginated (admin-categories.service.ts returns a plain array). */
  list(): Observable<AdminCategoryDto[]> {
    return this.api.get<AdminCategoryDto[]>('/admin/categories');
  }

  getOne(id: string): Observable<AdminCategoryDto> {
    return this.api.get<AdminCategoryDto>(`/admin/categories/${id}`);
  }

  create(input: UpsertCategoryRequest): Observable<AdminCategoryDto> {
    return this.api.post<AdminCategoryDto>('/admin/categories', input);
  }

  update(id: string, input: Partial<UpsertCategoryRequest>): Observable<AdminCategoryDto> {
    return this.api.patch<AdminCategoryDto>(`/admin/categories/${id}`, input);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/categories/${id}`);
  }
}
