import { Injectable } from '@nestjs/common';
import type { FunctionDeclaration } from '@google/genai';

import { ProductsService } from '@/catalog/products.service';
import { AssistantTool } from './assistant-tool.interface';

const MAX_COMPARE = 4;

@Injectable()
export class CompareProductsTool implements AssistantTool {
  readonly mutating = false;

  readonly declaration: FunctionDeclaration = {
    name: 'compare_products',
    description: `Side-by-side comparison of 2-${MAX_COMPARE} products by slug — price, rating, and brand.`,
    parametersJsonSchema: {
      type: 'object',
      properties: {
        slugs: {
          type: 'array',
          items: { type: 'string' },
          description: `2 to ${MAX_COMPARE} product slugs`,
        },
      },
      required: ['slugs'],
    },
  };

  constructor(private readonly productsService: ProductsService) {}

  async execute(args: Record<string, unknown>): Promise<unknown> {
    const slugs = Array.isArray(args.slugs)
      ? args.slugs.filter((s): s is string => typeof s === 'string')
      : [];
    if (slugs.length < 2) {
      return { error: 'Provide at least 2 product slugs to compare' };
    }

    const products = await Promise.all(
      slugs
        .slice(0, MAX_COMPARE)
        .map((slug) => this.productsService.findBySlug(slug).catch(() => null)),
    );

    return {
      products: products.map((product, index) =>
        product
          ? {
              slug: product.slug,
              name: product.name,
              brand: product.brand,
              basePriceMinor: product.basePriceMinor,
              ratingAverage: product.ratingAverage,
              ratingCount: product.ratingCount,
            }
          : { slug: slugs[index], error: 'not found' },
      ),
    };
  }
}
