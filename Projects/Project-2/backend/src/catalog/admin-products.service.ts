import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from './products.service';
import { CreateProductCommand } from './commands/create-product.command';
import { DeleteProductCommand } from './commands/delete-product.command';
import { UpdateProductCommand } from './commands/update-product.command';
import { CreateProductDto } from './dto/create-product.dto';
import { FindProductsAdminDto } from './dto/find-products-admin.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { Product, ProductDocument } from './schemas/product.schema';

// Separate from the public ProductsService on purpose — findAll here has
// no publishedAt gate, so a bug here can never leak a draft through the
// shopper-facing read path (they're different methods entirely, not a
// shared one with a bypass flag).
@Injectable()
export class AdminProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async findAll(
    query: FindProductsAdminDto,
  ): Promise<PaginatedResult<ProductDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<ProductDocument> = {};
    if (query.category) filter.categoryId = new Types.ObjectId(query.category);
    if (query.brand) filter.brand = query.brand;
    if (query.isPublished !== undefined) {
      filter.publishedAt = query.isPublished ? { $ne: null } : null;
    }

    const [items, total] = await Promise.all([
      this.productModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async findById(productId: string): Promise<ProductDocument> {
    const product = await this.productModel.findById(productId).exec();
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }
    return product;
  }

  create(dto: CreateProductDto): Promise<ProductDocument> {
    return this.commandBus.execute(
      new CreateProductCommand(dto, this.correlationId()),
    );
  }

  update(productId: string, dto: UpdateProductDto): Promise<ProductDocument> {
    return this.commandBus.execute(
      new UpdateProductCommand(productId, dto, this.correlationId()),
    );
  }

  delete(productId: string): Promise<void> {
    return this.commandBus.execute(
      new DeleteProductCommand(productId, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
