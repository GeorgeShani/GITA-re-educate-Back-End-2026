import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { SubmitContactMessageRequest } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class ContactService {
  private readonly api = inject(ApiClient);

  submit(input: SubmitContactMessageRequest): Observable<void> {
    return this.api.post<void>('/contact', input);
  }
}
