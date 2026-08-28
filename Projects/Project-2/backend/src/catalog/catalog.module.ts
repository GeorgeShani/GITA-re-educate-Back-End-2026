import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { MongooseModule } from '@nestjs/mongoose';

import { CoreModule } from '@/core/core.module';
import { SearchModule } from '@/search/search.module';
import { AdminCategoriesController } from './admin-categories.controller';
import { AdminCategoriesService } from './admin-categories.service';
import { AdminProductsController } from './admin-products.controller';
import { AdminProductsService } from './admin-products.service';
import { CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';
import { CreateCategoryHandler } from './commands/handlers/create-category.handler';
import { CreateProductHandler } from './commands/handlers/create-product.handler';
import { DeleteCategoryHandler } from './commands/handlers/delete-category.handler';
import { DeleteProductHandler } from './commands/handlers/delete-product.handler';
import { UpdateCategoryHandler } from './commands/handlers/update-category.handler';
import { UpdateProductHandler } from './commands/handlers/update-product.handler';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Category, CategorySchema } from './schemas/category.schema';
import { Product, ProductSchema } from './schemas/product.schema';

const COMMAND_HANDLERS = [
  CreateProductHandler,
  UpdateProductHandler,
  DeleteProductHandler,
  CreateCategoryHandler,
  UpdateCategoryHandler,
  DeleteCategoryHandler,
];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
    SearchModule,
  ],
  controllers: [
    ProductsController,
    CategoriesController,
    AdminProductsController,
    AdminCategoriesController,
  ],
  providers: [
    ProductsService,
    CategoriesService,
    AdminProductsService,
    AdminCategoriesService,
    ...COMMAND_HANDLERS,
  ],
  exports: [ProductsService, CategoriesService, MongooseModule],
})
export class CatalogModule {}
