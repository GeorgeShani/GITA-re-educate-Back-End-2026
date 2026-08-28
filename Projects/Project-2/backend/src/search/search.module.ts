import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Product, ProductSchema } from '@/catalog/schemas/product.schema';
import { AtlasSearchProvider } from './providers/atlas-search.provider';
import { SEARCH_PROVIDER_TOKEN } from './search-provider.interface';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Product.name, schema: ProductSchema }]),
  ],
  providers: [
    AtlasSearchProvider,
    { provide: SEARCH_PROVIDER_TOKEN, useExisting: AtlasSearchProvider },
  ],
  exports: [SEARCH_PROVIDER_TOKEN],
})
export class SearchModule {}
