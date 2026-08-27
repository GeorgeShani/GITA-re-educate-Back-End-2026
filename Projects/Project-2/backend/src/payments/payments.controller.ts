import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Inject,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { IsString } from 'class-validator';
import { ClsService } from 'nestjs-cls';

import { RecordPaymentResultCommand } from './commands/record-payment-result.command';
import { PAYMENT_PROVIDER_TOKEN } from './providers/payment-provider.interface';
import type { PaymentProvider } from './providers/payment-provider.interface';

class MockFailDto {
  @IsString()
  reason!: string;
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly paymentProvider: PaymentProvider,
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
  ) {}

  @Post('webhooks/stripe')
  @ApiExcludeEndpoint() // provider-dictated contract, not a client-facing API surface
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string | undefined,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody?.toString('utf8');
    if (!rawBody) {
      throw new BadRequestException('Missing request body');
    }

    const event = this.paymentProvider.parseWebhookEvent(rawBody, signature);

    if (event.type === 'payment_intent.succeeded') {
      await this.commandBus.execute(
        new RecordPaymentResultCommand(
          event.paymentIntentId,
          true,
          undefined,
          this.correlationId(),
        ),
      );
    } else if (event.type === 'payment_intent.payment_failed') {
      await this.commandBus.execute(
        new RecordPaymentResultCommand(
          event.paymentIntentId,
          false,
          event.failureReason ?? 'Payment failed',
          this.correlationId(),
        ),
      );
    }
    // Other event types (e.g. payment_intent.created, .canceled) are
    // acknowledged but not acted on — nothing in the checkout saga needs them.

    return { received: true };
  }

  // Dev-only simulation of the two webhook outcomes above, so the full
  // checkout saga (stock decrement, coupon redemption, order
  // confirmation/cancellation) can be exercised with PAYMENT_PROVIDER=mock
  // and no real Stripe account. Same guard pattern as the mail dev-safety
  // gate — refuses outside development, not just "usually harmless".
  @Post('mock/:providerPaymentIntentId/succeed')
  @ApiOperation({ summary: '[dev only] Simulate a successful mock payment' })
  async simulateMockSuccess(
    @Param('providerPaymentIntentId') providerPaymentIntentId: string,
  ): Promise<void> {
    this.assertMockModeAllowed();
    await this.commandBus.execute(
      new RecordPaymentResultCommand(
        providerPaymentIntentId,
        true,
        undefined,
        this.correlationId(),
      ),
    );
  }

  @Post('mock/:providerPaymentIntentId/fail')
  @ApiOperation({ summary: '[dev only] Simulate a failed mock payment' })
  async simulateMockFailure(
    @Param('providerPaymentIntentId') providerPaymentIntentId: string,
    @Body() dto: MockFailDto,
  ): Promise<void> {
    this.assertMockModeAllowed();
    await this.commandBus.execute(
      new RecordPaymentResultCommand(
        providerPaymentIntentId,
        false,
        dto.reason,
        this.correlationId(),
      ),
    );
  }

  private assertMockModeAllowed(): void {
    if (this.configService.get<string>('NODE_ENV') === 'production') {
      throw new ForbiddenException(
        'Mock payment endpoints are disabled in production',
      );
    }
    if (this.configService.get<string>('PAYMENT_PROVIDER') !== 'mock') {
      throw new ForbiddenException(
        'Mock payment endpoints require PAYMENT_PROVIDER=mock',
      );
    }
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
