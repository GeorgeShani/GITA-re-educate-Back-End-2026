import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type {
  GiftCardDto,
  IssueGiftCardRequest,
  Paginated,
  UpdateGiftCardRequest,
} from '@/app/core/api/dto';
import { toHttpParams } from '@/app/core/api/http-params';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class AdminGiftCardsService {
  private readonly api = inject(ApiClient);

  list(isActive?: boolean, page = 1, take = 30): Observable<Paginated<GiftCardDto>> {
    return this.api.get<Paginated<GiftCardDto>>(
      '/admin/gift-cards',
      toHttpParams({ isActive, page, take }),
    );
  }

  getOne(id: string): Observable<GiftCardDto> {
    return this.api.get<GiftCardDto>(`/admin/gift-cards/${id}`);
  }

  issue(input: IssueGiftCardRequest): Observable<GiftCardDto> {
    return this.api.post<GiftCardDto>('/admin/gift-cards', input);
  }

  update(id: string, input: UpdateGiftCardRequest): Observable<GiftCardDto> {
    return this.api.patch<GiftCardDto>(`/admin/gift-cards/${id}`, input);
  }

  adjustBalance(id: string, delta: number): Observable<GiftCardDto> {
    return this.api.post<GiftCardDto>(`/admin/gift-cards/${id}/adjust-balance`, { delta });
  }
}
