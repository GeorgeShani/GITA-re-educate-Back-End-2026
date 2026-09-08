import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { SavedPaymentMethodDto, SetupIntentResultDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

@Service()
export class PaymentMethodsService {
  private readonly api = inject(ApiClient);

  /** A clientSecret for Stripe Elements to collect and save a new card against. */
  createSetupIntent(): Observable<SetupIntentResultDto> {
    return this.api.post<SetupIntentResultDto>('/payments/methods/setup-intent', {});
  }

  list(): Observable<SavedPaymentMethodDto[]> {
    return this.api.get<SavedPaymentMethodDto[]>('/payments/methods');
  }

  detach(paymentMethodId: string): Observable<void> {
    return this.api.delete<void>(`/payments/methods/${paymentMethodId}`);
  }
}
