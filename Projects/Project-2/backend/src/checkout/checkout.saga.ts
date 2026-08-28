import { Injectable } from '@nestjs/common';
import { ICommand, ofType, Saga } from '@nestjs/cqrs';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { CancelOrderCommand } from '@/orders/commands/cancel-order.command';
import { ConfirmOrderCommand } from '@/orders/commands/confirm-order.command';
import { PaymentFailedEvent } from '@/payments/events/payment-failed.event';
import { PaymentSucceededEvent } from '@/payments/events/payment-succeeded.event';

// SCOPE.md B2's checkout saga, #1. Unlike PlaceOrderCommand ->
// CreatePaymentIntentCommand (explicitly sequenced by CheckoutService in
// the same HTTP request — see checkout.service.ts for why), this half
// is genuinely event-driven: a Stripe webhook arrives on its own
// schedule, entirely decoupled from any request of ours, so reacting to
// PaymentSucceededEvent/PaymentFailedEvent via the in-process EventBus
// is the right fit for @Saga() rather than an artificial constraint.
@Injectable()
export class CheckoutSaga {
  @Saga()
  paymentSucceeded = (events$: Observable<unknown>): Observable<ICommand> =>
    events$.pipe(
      ofType(PaymentSucceededEvent),
      map(
        (event) => new ConfirmOrderCommand(event.orderId, event.correlationId),
      ),
    );

  @Saga()
  paymentFailed = (events$: Observable<unknown>): Observable<ICommand> =>
    events$.pipe(
      ofType(PaymentFailedEvent),
      map(
        (event) =>
          new CancelOrderCommand(
            event.orderId,
            `payment_failed: ${event.failureReason}`,
            event.correlationId,
          ),
      ),
    );
}
