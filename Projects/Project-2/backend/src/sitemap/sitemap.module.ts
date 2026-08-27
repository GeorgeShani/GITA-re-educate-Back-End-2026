import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { Post, PostSchema } from '../blog/schemas/post.schema';
import { Product, ProductSchema } from '../catalog/schemas/product.schema';
import { Page, PageSchema } from '../pages/schemas/page.schema';
import { SitemapController } from './sitemap.controller';
import { SitemapService } from './sitemap.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Post.name, schema: PostSchema },
      { name: Page.name, schema: PageSchema },
    ]),
  ],
  controllers: [SitemapController],
  providers: [SitemapService],
})
export class SitemapModule {}
