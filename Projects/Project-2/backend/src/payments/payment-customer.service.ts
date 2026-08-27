import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { UsersService } from '../users/users.service';
import { PAYMENT_PROVIDER_TOKEN } from './providers/payment-provider.interface';
import type { PaymentProvider } from './providers/payment-provider.interface';

// Stripe Customers (or their mock equivalent) are created lazily, on
// first request that needs one, not at registration — most shoppers
// never save a card (SCOPE.md user.schema.ts note on stripeCustomerId).
@Injectable()
export class PaymentCustomerService {
  constructor(
    @Inject(PAYMENT_PROVIDER_TOKEN)
    private readonly paymentProvider: PaymentProvider,
    private readonly usersService: UsersService,
  ) {}

  async getOrCreateCustomerId(userId: string): Promise<string> {
    const user = await this.usersService.findByIdWithStripeCustomerId(userId);
    if (!user) {
      throw new NotFoundException(`User with id ${userId} not found`);
    }
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    const customerId = await this.paymentProvider.createCustomer(user.email);
    await this.usersService.setStripeCustomerId(userId, customerId);
    return customerId;
  }
}
