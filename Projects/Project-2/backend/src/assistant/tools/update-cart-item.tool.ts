import { Injectable } from '@nestjs/common';
import type { FunctionDeclaration } from '@google/genai';

import { CartService } from '@/cart/cart.service';
import { ProductsService } from '@/catalog/products.service';
import {
  AssistantTool,
  AssistantToolContext,
} from './assistant-tool.interface';

@Injectable()
export class UpdateCartItemTool implements AssistantTool {
  readonly mutating = true;

  readonly declaration: FunctionDeclaration = {
    name: 'update_cart_item',
    description:
      'Change the quantity of a product already in the cart, or remove it (quantity: 0). Mutating — requires the user’s explicit confirmation.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The product slug' },
        variantSku: {
          type: 'string',
          description: 'The SKU already in the cart',
        },
        quantity: {
          type: 'integer',
          description: 'New quantity — 0 removes the line entirely',
        },
      },
      required: ['slug', 'variantSku', 'quantity'],
    },
  };

  constructor(
    private readonly productsService: ProductsService,
    private readonly cartService: CartService,
  ) {}

  async execute(
    args: Record<string, unknown>,
    ctx: AssistantToolContext,
  ): Promise<unknown> {
    if (
      typeof args.slug !== 'string' ||
      typeof args.variantSku !== 'string' ||
      typeof args.quantity !== 'number'
    ) {
      return { error: 'slug, variantSku, and quantity are required' };
    }

    const product = await this.productsService
      .findBySlug(args.slug)
      .catch(() => null);
    if (!product) {
      return { error: `No product found for slug "${args.slug}"` };
    }

    // Narrowed into their own bindings — a closure (the .find() callback
    // below) doesn't retain the typeof-guard's narrowing on args.* itself.
    const variantSku = args.variantSku.toUpperCase();
    const quantity = args.quantity;

    const { cart } = await this.cartService.resolveCart({
      userId: ctx.userId,
    });
    const line = cart.items.find(
      (item) =>
        item.productId.toString() === product.id &&
        item.variantSku === variantSku,
    );
    if (!line) {
      return {
        error: `"${args.slug}" (${args.variantSku}) isn’t in the cart`,
      };
    }
    const lineId = line._id.toString();

    const updated =
      quantity > 0
        ? await this.cartService.updateItemQuantity(cart.id, lineId, quantity)
        : await this.cartService.removeItem(cart.id, lineId);
    const summary = await this.cartService.getSummary(updated);

    return {
      updated: { slug: args.slug, variantSku, quantity },
      cart: {
        itemCount: summary.itemCount,
        subtotalMinor: summary.subtotalMinor,
      },
    };
  }
}
