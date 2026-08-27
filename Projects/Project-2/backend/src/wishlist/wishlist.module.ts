import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '../catalog/schemas/product.schema';
import { CoreModule } from '../core/core.module';
import { AddWishlistItemHandler } from './commands/handlers/add-wishlist-item.handler';
import { RemoveWishlistItemHandler } from './commands/handlers/remove-wishlist-item.handler';
import {
  WishlistItem,
  WishlistItemSchema,
} from './schemas/wishlist-item.schema';
import { WishlistController } from './wishlist.controller';
import { WishlistService } from './wishlist.service';

const COMMAND_HANDLERS = [AddWishlistItemHandler, RemoveWishlistItemHandler];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: WishlistItem.name, schema: WishlistItemSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  controllers: [WishlistController],
  providers: [WishlistService, ...COMMAND_HANDLERS],
  exports: [MongooseModule],
})
export class WishlistModule {}
