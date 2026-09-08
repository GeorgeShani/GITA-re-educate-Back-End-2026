import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { TaxRateDto, UpsertTaxRateRequest } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminTaxService {
  private readonly api = inject(ApiClient);

  /** Not paginated — tax.service.ts's admin findAll returns a plain array. */
  list(): Observable<TaxRateDto[]> {
    return this.api.get<TaxRateDto[]>('/admin/tax/rates');
  }

  getOne(id: string): Observable<TaxRateDto> {
    return this.api.get<TaxRateDto>(`/admin/tax/rates/${id}`);
  }

  create(input: UpsertTaxRateRequest): Observable<TaxRateDto> {
    return this.api.post<TaxRateDto>('/admin/tax/rates', input);
  }

  update(id: string, input: Partial<UpsertTaxRateRequest>): Observable<TaxRateDto> {
    return this.api.patch<TaxRateDto>(`/admin/tax/rates/${id}`, input);
  }
}
