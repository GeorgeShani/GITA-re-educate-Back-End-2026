import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { PaymentFailedEvent } from '../../events/payment-failed.event';
import { PaymentSucceededEvent } from '../../events/payment-succeeded.event';
import { Payment, PaymentDocument } from '../../schemas/payment.schema';
import { PaymentStatus } from '../../enums/payment-status.enum';
import { RecordPaymentResultCommand } from '../record-payment-result.command';

@CommandHandler(RecordPaymentResultCommand)
export class RecordPaymentResultHandler
  extends TransactionalCommandHandler<RecordPaymentResultCommand>
  implements ICommandHandler<RecordPaymentResultCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    private readonly outboxRepository: OutboxRepository,
    private readonly eventBus: EventBus,
  ) {
    super(connection);
  }

  async execute(command: RecordPaymentResultCommand): Promise<void> {
    const payment = await this.paymentModel.findOne({
      providerPaymentIntentId: command.providerPaymentIntentId,
    });

    // Unknown intent, or already resolved — a redelivered webhook is
    // exactly this second case, and Stripe redelivers on anything short
    // of a 2xx, so this idempotency check is load-bearing, not defensive
    // paranoia.
    if (!payment || payment.status !== PaymentStatus.INTENT_CREATED) {
      return;
    }

    const event = await this.withTransaction(async (session) => {
      payment.status = command.succeeded
        ? PaymentStatus.SUCCEEDED
        : PaymentStatus.FAILED;
      if (!command.succeeded) {
        payment.failureReason = command.failureReason;
      }
      await payment.save({ session });

      const domainEvent = command.succeeded
        ? new PaymentSucceededEvent(
            payment.id,
            payment.orderId.toString(),
            command.correlationId,
          )
        : new PaymentFailedEvent(
            payment.id,
            payment.orderId.toString(),
            command.failureReason ?? 'unknown',
            command.correlationId,
          );

      await this.outboxRepository.write(domainEvent, session);
      return domainEvent;
    });

    // Published to the in-process EventBus only after the transaction
    // commits — CheckoutSaga (S9) reacts to this to dispatch
    // ConfirmOrderCommand / CancelOrderCommand. This is deliberately
    // separate from the outbox write above: EventBus is for synchronous
    // same-process orchestration (SCOPE.md B2's "three mechanisms"
    // table lists it as its own row, in-process/sync, distinct from the
    // outbox's durable cross-process delivery), not a replacement for it.
    this.eventBus.publish(event);
  }
}
