import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { RequestReturnRequest, ReturnDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class ReturnsService {
  private readonly api = inject(ApiClient);

  request(input: RequestReturnRequest): Observable<ReturnDto> {
    return this.api.post<ReturnDto>('/returns', input);
  }

  listMine(): Observable<ReturnDto[]> {
    return this.api.get<ReturnDto[]>('/returns');
  }

  getOne(id: string): Observable<ReturnDto> {
    return this.api.get<ReturnDto>(`/returns/${id}`);
  }
}
