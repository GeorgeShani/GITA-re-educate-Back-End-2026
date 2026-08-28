import { Injectable } from '@nestjs/common';
import type { FunctionDeclaration } from '@google/genai';

import { InventoryService } from '@/inventory/inventory.service';
import { ProductsService } from '@/catalog/products.service';
import { AssistantTool } from './assistant-tool.interface';

@Injectable()
export class CheckStockTool implements AssistantTool {
  readonly mutating = false;

  readonly declaration: FunctionDeclaration = {
    name: 'check_stock',
    description: 'Live stock availability for one product variant.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The product slug' },
        variantSku: {
          type: 'string',
          description: 'A SKU from get_product’s variants list',
        },
      },
      required: ['slug', 'variantSku'],
    },
  };

  constructor(
    private readonly productsService: ProductsService,
    private readonly inventoryService: InventoryService,
  ) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    if (typeof args.slug !== 'string' || typeof args.variantSku !== 'string') {
      return { error: 'slug and variantSku are required' };
    }
    // Own bindings — a closure (the .catch() callbacks below) doesn't
    // retain the typeof-guard's narrowing on args.* itself.
    const slug = args.slug;
    const variantSku = args.variantSku;

    const product = await this.productsService
      .findBySlug(slug)
      .catch(() => null);
    if (!product) {
      return { error: `No product found for slug "${slug}"` };
    }

    return this.inventoryService
      .checkStock(product.id, variantSku)
      .catch((error: unknown) => ({
        error:
          error instanceof Error
            ? error.message
            : `No inventory record for ${slug}/${variantSku}`,
      }));
  }
}
