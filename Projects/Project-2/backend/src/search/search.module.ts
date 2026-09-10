import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '@/catalog/schemas/product.schema';
import { AtlasSearchProvider } from './providers/atlas-search.provider';
import { MongoTextSearchProvider } from './providers/mongo-text-search.provider';
import { SEARCH_PROVIDER_TOKEN } from './search-provider.interface';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  providers: [
    AtlasSearchProvider,
    MongoTextSearchProvider,
    {
      provide: SEARCH_PROVIDER_TOKEN,
      // Atlas Search needs its `products_search` index provisioned through
      // the Atlas UI/API (SCOPE.md B3 gotcha #6) — a genuine out-of-band
      // step. Until `SEARCH_PROVIDER=atlas` is set with that in place, the
      // Mongo `$text` provider backs search on any cluster with no setup.
      useFactory: (
        atlas: AtlasSearchProvider,
        mongo: MongoTextSearchProvider,
      ): AtlasSearchProvider | MongoTextSearchProvider =>
        process.env.SEARCH_PROVIDER === 'atlas' ? atlas : mongo,
      inject: [AtlasSearchProvider, MongoTextSearchProvider],
    },
  ],
  exports: [SEARCH_PROVIDER_TOKEN],
})
export class SearchModule {}
