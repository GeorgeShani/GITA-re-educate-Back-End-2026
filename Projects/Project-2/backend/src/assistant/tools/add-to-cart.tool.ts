import { Injectable } from '@nestjs/common';
import type { FunctionDeclaration } from '@google/genai';

import { CartService } from '../../cart/cart.service';
import { ProductsService } from '../../catalog/products.service';
import {
  AssistantTool,
  AssistantToolContext,
} from './assistant-tool.interface';

@Injectable()
export class AddToCartTool implements AssistantTool {
  readonly mutating = true;

  readonly declaration: FunctionDeclaration = {
    name: 'add_to_cart',
    description:
      'Add a product variant to the current user’s cart. Mutating — requires the user’s explicit confirmation before it actually runs.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The product slug' },
        variantSku: {
          type: 'string',
          description: 'A SKU from get_product’s variants list',
        },
        quantity: {
          type: 'integer',
          description: 'Quantity to add (default 1)',
        },
      },
      required: ['slug', 'variantSku'],
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
    if (typeof args.slug !== 'string' || typeof args.variantSku !== 'string') {
      return { error: 'slug and variantSku are required' };
    }

    const product = await this.productsService
      .findBySlug(args.slug)
      .catch(() => null);
    if (!product) {
      return { error: `No product found for slug "${args.slug}"` };
    }

    const quantity = typeof args.quantity === 'number' ? args.quantity : 1;
    const { cart } = await this.cartService.resolveCart({
      userId: ctx.userId,
    });
    const updated = await this.cartService.addItem(cart.id, {
      productId: product.id,
      variantSku: args.variantSku,
      quantity,
    });
    const summary = await this.cartService.getSummary(updated);

    return {
      added: { slug: args.slug, variantSku: args.variantSku, quantity },
      cart: {
        itemCount: summary.itemCount,
        subtotalMinor: summary.subtotalMinor,
      },
    };
  }
}
