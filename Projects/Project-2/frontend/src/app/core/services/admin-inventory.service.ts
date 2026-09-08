import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { AdjustStockRequest, AdminInventoryItemDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminInventoryService {
  private readonly api = inject(ApiClient);

  listAll(): Observable<AdminInventoryItemDto[]> {
    return this.api.get<AdminInventoryItemDto[]>('/admin/inventory');
  }

  listLowStock(): Observable<AdminInventoryItemDto[]> {
    return this.api.get<AdminInventoryItemDto[]>('/admin/inventory/low-stock');
  }

  adjust(itemId: string, input: AdjustStockRequest): Observable<AdminInventoryItemDto> {
    return this.api.post<AdminInventoryItemDto>(`/admin/inventory/${itemId}/adjust`, input);
  }
}
