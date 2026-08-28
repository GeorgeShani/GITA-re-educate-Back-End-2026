import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { Order, OrderDocument } from '@/orders/schemas/order.schema';
import { PaymentIntentCreatedEvent } from '@/payments/events/payment-intent-created.event';
import { PAYMENT_PROVIDER_TOKEN } from '@/payments/providers/payment-provider.interface';
import type { PaymentProvider } from '@/payments/providers/payment-provider.interface';
import { Payment, PaymentDocument } from '@/payments/schemas/payment.schema';
import { PaymentStatus } from '@/payments/enums/payment-status.enum';
import { CreatePaymentIntentCommand } from '@/payments/commands/create-payment-intent.command';

export interface CreatePaymentIntentResult {
  payment: PaymentDocument;
  clientSecret: string;
}

@CommandHandler(CreatePaymentIntentCommand)
export class CreatePaymentIntentHandler
  extends TransactionalCommandHandler<CreatePaymentIntentCommand>
  implements ICommandHandler<CreatePaymentIntentCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Payment.name)
    private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly paymentProvider: PaymentProvider,
    private readonly outboxRepository: OutboxRepository,
    private readonly configService: ConfigService,
  ) {
    super(connection);
  }

  async execute(
    command: CreatePaymentIntentCommand,
  ): Promise<CreatePaymentIntentResult> {
    const order = await this.orderModel.findById(command.orderId);
    if (!order) {
      throw new NotFoundException(`Order with id ${command.orderId} not found`);
    }

    // Deterministic per order — a retried checkout request reuses the
    // same Stripe PaymentIntent rather than creating a duplicate. A
    // genuine retry-with-a-different-card flow would need its own fresh
    // key; not built here (not in the storefront backend plan's scope).
    const idempotencyKey = order.id;

    // The side effect happens BEFORE the transaction opens — SCOPE.md's
    // rule is "never do side effects inside a command handler['s
    // transaction]"; this external Stripe call can't be rolled back, so
    // it stays outside withTransaction() entirely.
    const intentResult = await this.paymentProvider.createPaymentIntent({
      amountMinor: order.totalMinor,
      currency: order.currency,
      idempotencyKey,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    });

    const provider = this.configService.get<'stripe' | 'mock'>(
      'PAYMENT_PROVIDER',
      'mock',
    );

    return this.withTransaction(async (session) => {
      const [payment] = await this.paymentModel.create(
        [
          {
            orderId: order._id,
            provider,
            providerPaymentIntentId: intentResult.providerPaymentIntentId,
            amountMinor: order.totalMinor,
            currency: order.currency,
            status: PaymentStatus.INTENT_CREATED,
            idempotencyKey,
          },
        ],
        { session },
      );

      order.paymentId = payment._id;
      await order.save({ session });

      await this.outboxRepository.write(
        new PaymentIntentCreatedEvent(
          payment.id,
          order.id,
          command.correlationId,
        ),
        session,
      );

      return { payment, clientSecret: intentResult.clientSecret };
    });
  }
}
