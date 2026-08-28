import { Injectable } from '@nestjs/common';
import type { FunctionDeclaration } from '@google/genai';

import { ProductsService } from '@/catalog/products.service';
import { AssistantTool } from './assistant-tool.interface';

@Injectable()
export class GetProductTool implements AssistantTool {
  readonly mutating = false;

  readonly declaration: FunctionDeclaration = {
    name: 'get_product',
    description:
      'Full detail for one product by slug, including its variants (with SKUs) and stock-relevant fields.',
    parametersJsonSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'The product slug' },
      },
      required: ['slug'],
    },
  };

  constructor(private readonly productsService: ProductsService) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    if (typeof args.slug !== 'string') {
      return { error: 'slug is required' };
    }

    const product = await this.productsService
      .findBySlug(args.slug)
      .catch(() => null);
    if (!product) {
      return { error: `No product found for slug "${args.slug}"` };
    }

    return {
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      description: product.description,
      basePriceMinor: product.basePriceMinor,
      compareAtPriceMinor: product.compareAtPriceMinor,
      ratingAverage: product.ratingAverage,
      ratingCount: product.ratingCount,
      variants: product.variants
        .filter((variant) => variant.isActive)
        .map((variant) => ({
          sku: variant.sku,
          attributes: variant.attributes,
          priceMinor: variant.priceMinor ?? product.basePriceMinor,
        })),
    };
  }
}
