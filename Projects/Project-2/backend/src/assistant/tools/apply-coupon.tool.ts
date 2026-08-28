import { Injectable } from '@nestjs/common';
import type { FunctionDeclaration } from '@google/genai';

import { CartService } from '../../cart/cart.service';
import {
  AssistantTool,
  AssistantToolContext,
} from './assistant-tool.interface';

@Injectable()
export class ApplyCouponTool implements AssistantTool {
  readonly mutating = true;

  readonly declaration: FunctionDeclaration = {
    name: 'apply_coupon',
    description:
      'Apply a discount coupon code to the cart. Mutating — requires the user’s explicit confirmation.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The coupon code, e.g. "WELCOME10"',
        },
      },
      required: ['code'],
    },
  };

  constructor(private readonly cartService: CartService) {}

  async execute(
    args: Record<string, unknown>,
    ctx: AssistantToolContext,
  ): Promise<unknown> {
    if (typeof args.code !== 'string') {
      return { error: 'code is required' };
    }

    const { cart } = await this.cartService.resolveCart({
      userId: ctx.userId,
    });
    const updated = await this.cartService.applyCoupon(cart.id, args.code);
    const summary = await this.cartService.getSummary(updated);

    return {
      couponCode: summary.couponCode,
      cart: {
        itemCount: summary.itemCount,
        subtotalMinor: summary.subtotalMinor,
      },
    };
  }
}
