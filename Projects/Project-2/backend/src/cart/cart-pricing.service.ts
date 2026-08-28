import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { Product, ProductDocument } from '@/catalog/schemas/product.schema';
import { CartItem } from './schemas/cart.schema';

// CartItem itself doesn't declare _id (Mongoose adds it at runtime for
// any `@Schema({ _id: true })` subdocument) — spelled out here rather
// than casting through `unknown` at every call site.
type CartItemWithId = CartItem & { _id: Types.ObjectId };

export interface CartLineItem {
  itemId: string;
  productId: string;
  productSlug: string;
  productName: string;
  imageUrl?: string;
  variantSku: string;
  variantAttributes: Record<string, string>;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
  /** Used for shipping-rate weight tiers at checkout (S9) — 0 when the variant has no weight recorded. */
  weightGrams: number;
}

// Deliberately NOT a price snapshot on CartItem itself — SCOPE.md A9's
// cart schema comment: "a cart should reflect current pricing until
// checkout freezes it onto the order." Both CartService (GET /cart) and
// ApplyCouponHandler's minSpend check need this same current-price
// lookup, so it lives here rather than duplicated in both places.
@Injectable()
export class CartPricingService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async enrichItems(items: CartItemWithId[]): Promise<CartLineItem[]> {
    if (items.length === 0) return [];

    const productIds = [
      ...new Set(items.map((item) => item.productId.toString())),
    ];
    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .exec();
    const productById = new Map(
      products.map((product) => [product.id, product]),
    );

    const lineItems: CartLineItem[] = [];
    for (const item of items) {
      const product = productById.get(item.productId.toString());
      if (!product) continue; // deleted/unpublished since it was added — silently dropped from pricing

      const variant = product.variants.find((v) => v.sku === item.variantSku);
      const unitPriceMinor = variant?.priceMinor ?? product.basePriceMinor;

      lineItems.push({
        itemId: item._id.toString(),
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        imageUrl: product.images[0]?.url,
        variantSku: item.variantSku,
        variantAttributes: variant?.attributes ?? {},
        unitPriceMinor,
        quantity: item.quantity,
        lineTotalMinor: unitPriceMinor * item.quantity,
        weightGrams: variant?.weightGrams ?? 0,
      });
    }

    return lineItems;
  }

  async computeSubtotalMinor(items: CartItemWithId[]): Promise<number> {
    const lineItems = await this.enrichItems(items);
    return lineItems.reduce((sum, item) => sum + item.lineTotalMinor, 0);
  }
}
