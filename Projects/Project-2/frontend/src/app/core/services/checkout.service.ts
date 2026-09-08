import { Service, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import type { CheckoutQuoteDto, PlaceOrderRequest, PlaceOrderResultDto } from '@/app/core/api/dto';
import { ApiClient } from '@/app/core/services/api-client';

/**
 * Stateless on purpose — unlike CartService, nothing here is worth caching
 * as component state. A quote is only ever valid for the address it was
 * requested with, and placing an order is a one-shot action whose result
 * (order + clientSecret) the checkout page holds itself.
 */
@Service()
export class CheckoutService {
  private readonly api = inject(ApiClient);

  getQuote(countryCode: string, region?: string): Observable<CheckoutQuoteDto> {
    return this.api.get<CheckoutQuoteDto>(
      '/checkout/quote',
      region ? { countryCode, region } : { countryCode },
    );
  }

  /** Creates the Order AND its PaymentIntent in one call — see checkout.service.ts on the backend. */
  placeOrder(payload: PlaceOrderRequest): Observable<PlaceOrderResultDto> {
    return this.api.post<PlaceOrderResultDto>('/checkout/place-order', payload);
  }
}
