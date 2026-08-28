import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { ProductCreatedEvent } from '@/catalog/events/product-created.event';
import { Category, CategoryDocument } from '@/catalog/schemas/category.schema';
import { Product, ProductDocument } from '@/catalog/schemas/product.schema';
import { CreateProductCommand } from '@/catalog/commands/create-product.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(CreateProductCommand)
export class CreateProductHandler
  extends TransactionalCommandHandler<CreateProductCommand>
  implements ICommandHandler<CreateProductCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: CreateProductCommand): Promise<ProductDocument> {
    const { dto } = command;

    const categoryExists = await this.categoryModel.exists({
      _id: dto.categoryId,
    });
    if (!categoryExists) {
      throw new NotFoundException(
        `Category with id ${dto.categoryId} not found`,
      );
    }

    try {
      return await this.withTransaction(async (session) => {
        const [product] = await this.productModel.create(
          [
            {
              name: dto.name,
              slug: dto.slug,
              brand: dto.brand,
              description: dto.description,
              tags: dto.tags ?? [],
              categoryId: new Types.ObjectId(dto.categoryId),
              basePriceMinor: dto.basePriceMinor,
              compareAtPriceMinor: dto.compareAtPriceMinor,
              images: dto.images ?? [],
              variants: dto.variants ?? [],
              careInstructions: dto.careInstructions,
              specSheetUrl: dto.specSheetUrl,
              isFeatured: dto.isFeatured ?? false,
              publishedAt: dto.publish ? new Date() : null,
              seoTitle: dto.seoTitle,
              seoDescription: dto.seoDescription,
              seoOgImageUrl: dto.seoOgImageUrl,
            },
          ],
          { session },
        );

        await this.outboxRepository.write(
          new ProductCreatedEvent(
            product.id,
            product.name,
            command.correlationId,
          ),
          session,
        );

        return product;
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A product with slug "${dto.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === MONGO_DUPLICATE_KEY_ERROR
    );
  }
}
