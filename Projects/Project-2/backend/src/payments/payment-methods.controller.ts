import {
  Controller,
  Delete,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { PaymentCustomerService } from './payment-customer.service';
import { PAYMENT_PROVIDER_TOKEN } from './providers/payment-provider.interface';
import type { PaymentProvider } from './providers/payment-provider.interface';

@ApiTags('payment-methods')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments/methods')
export class PaymentMethodsController {
  constructor(
    private readonly paymentCustomerService: PaymentCustomerService,
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly paymentProvider: PaymentProvider,
  ) {}

  @Throttle(WRITE_THROTTLE)
  @Post('setup-intent')
  @ApiOperation({
    summary:
      'A client secret for Stripe Elements to collect and save a new card against',
  })
  async createSetupIntent(@CurrentUser('userId') userId: string) {
    const customerId =
      await this.paymentCustomerService.getOrCreateCustomerId(userId);
    return this.paymentProvider.createSetupIntent(customerId);
  }

  @Get()
  @ApiOperation({ summary: "The current user's saved cards" })
  async list(@CurrentUser('userId') userId: string) {
    const customerId =
      await this.paymentCustomerService.getOrCreateCustomerId(userId);
    return this.paymentProvider.listPaymentMethods(customerId);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete(':paymentMethodId')
  @ApiOperation({ summary: 'Remove a saved card' })
  async detach(
    @Param('paymentMethodId') paymentMethodId: string,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    const customerId =
      await this.paymentCustomerService.getOrCreateCustomerId(userId);
    // Confirm the card actually belongs to this user's customer before
    // detaching — a provider payment-method id is otherwise just a
    // guessable string, and Stripe's detach call doesn't check ownership.
    const methods = await this.paymentProvider.listPaymentMethods(customerId);
    if (!methods.some((method) => method.id === paymentMethodId)) {
      throw new NotFoundException(
        `Payment method ${paymentMethodId} not found`,
      );
    }
    await this.paymentProvider.detachPaymentMethod(paymentMethodId);
  }
}
