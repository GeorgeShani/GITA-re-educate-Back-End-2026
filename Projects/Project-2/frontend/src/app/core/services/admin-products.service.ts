import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdminProductQuery, Paginated, ProductDto, UpsertProductRequest } from '@/app/core/api/dto';
import { toHttpParams } from '@/app/core/api/http-params';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminProductsService {
  private readonly api = inject(ApiClient);

  list(query: AdminProductQuery): Observable<Paginated<ProductDto>> {
    return this.api.get<Paginated<ProductDto>>('/admin/products', toHttpParams({ ...query }));
  }

  getOne(id: string): Observable<ProductDto> {
    return this.api.get<ProductDto>(`/admin/products/${id}`);
  }

  create(input: UpsertProductRequest): Observable<ProductDto> {
    return this.api.post<ProductDto>('/admin/products', input);
  }

  update(id: string, input: Partial<UpsertProductRequest>): Observable<ProductDto> {
    return this.api.patch<ProductDto>(`/admin/products/${id}`, input);
  }

  delete(id: string): Observable<void> {
    return this.api.delete<void>(`/admin/products/${id}`);
  }
}
