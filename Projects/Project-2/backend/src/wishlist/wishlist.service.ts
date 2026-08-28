import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { Product, ProductDocument } from '@/catalog/schemas/product.schema';
import { AddWishlistItemCommand } from './commands/add-wishlist-item.command';
import { RemoveWishlistItemCommand } from './commands/remove-wishlist-item.command';
import {
  WishlistItem,
  WishlistItemDocument,
} from './schemas/wishlist-item.schema';

// .lean()'s default inferred type is the schema's own class fields only —
// createdAt/updatedAt come from baseSchemaOptions' `timestamps: true` at
// runtime but aren't declared on the WishlistItem class, so TS doesn't
// know about them unless the lean generic says so explicitly.
interface WishlistItemLean {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  productId: Types.ObjectId;
  createdAt: Date;
}

export interface WishlistEntry {
  productId: string;
  addedAt: Date;
  product: {
    name: string;
    slug: string;
    brand?: string;
    basePriceMinor: number;
    compareAtPriceMinor?: number;
    image?: { url: string; alt: string };
  } | null; // null when the product was deleted/unpublished out from under the wishlist entry
}

// Read side is a plain query, not a command — GET /wishlist has nothing to
// coordinate transactionally, same convention as Cart's own summary reads.
@Injectable()
export class WishlistService {
  constructor(
    @InjectModel(WishlistItem.name)
    private readonly wishlistItemModel: Model<WishlistItemDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async findMine(userId: string): Promise<WishlistEntry[]> {
    const items = await this.wishlistItemModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .lean<WishlistItemLean[]>();

    if (items.length === 0) return [];

    const productIds = items.map((item) => item.productId);
    const products = await this.productModel
      .find({ _id: { $in: productIds } })
      .select('name slug brand basePriceMinor compareAtPriceMinor images')
      .lean();
    const productById = new Map(
      products.map((product) => [product._id.toString(), product]),
    );

    return items.map((item) => {
      const product = productById.get(item.productId.toString());
      const primaryImage = product?.images
        ?.slice()
        .sort((a, b) => a.position - b.position)[0];

      return {
        productId: item.productId.toString(),
        addedAt: item.createdAt,
        product: product
          ? {
              name: product.name,
              slug: product.slug,
              brand: product.brand,
              basePriceMinor: product.basePriceMinor,
              compareAtPriceMinor: product.compareAtPriceMinor,
              image: primaryImage
                ? { url: primaryImage.url, alt: primaryImage.alt }
                : undefined,
            }
          : null,
      };
    });
  }

  async add(userId: string, productId: string): Promise<void> {
    await this.commandBus.execute(
      new AddWishlistItemCommand(userId, productId, this.correlationId()),
    );
  }

  async remove(userId: string, productId: string): Promise<void> {
    await this.commandBus.execute(
      new RemoveWishlistItemCommand(userId, productId, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
