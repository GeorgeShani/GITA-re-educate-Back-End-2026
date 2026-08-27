import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { ProductUpdatedEvent } from '../../events/product-updated.event';
import { Category, CategoryDocument } from '../../schemas/category.schema';
import { Product, ProductDocument } from '../../schemas/product.schema';
import { UpdateProductCommand } from '../update-product.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler
  extends TransactionalCommandHandler<UpdateProductCommand>
  implements ICommandHandler<UpdateProductCommand>
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

  async execute(command: UpdateProductCommand): Promise<ProductDocument> {
    const { dto } = command;

    if (dto.categoryId) {
      const categoryExists = await this.categoryModel.exists({
        _id: dto.categoryId,
      });
      if (!categoryExists) {
        throw new NotFoundException(
          `Category with id ${dto.categoryId} not found`,
        );
      }
    }

    try {
      return await this.withTransaction(async (session) => {
        const product = await this.productModel
          .findById(command.productId)
          .session(session);
        if (!product) {
          throw new NotFoundException(
            `Product with id ${command.productId} not found`,
          );
        }

        if (dto.name !== undefined) product.name = dto.name;
        if (dto.slug !== undefined) product.slug = dto.slug;
        if (dto.brand !== undefined) product.brand = dto.brand;
        if (dto.description !== undefined)
          product.description = dto.description;
        if (dto.tags !== undefined) product.tags = dto.tags;
        if (dto.categoryId !== undefined) {
          product.categoryId = new Types.ObjectId(dto.categoryId);
        }
        if (dto.basePriceMinor !== undefined) {
          product.basePriceMinor = dto.basePriceMinor;
        }
        if (dto.compareAtPriceMinor !== undefined) {
          product.compareAtPriceMinor = dto.compareAtPriceMinor;
        }
        // Replace, not merge — see update-product.dto.ts's comment.
        if (dto.images !== undefined) product.images = dto.images;
        if (dto.variants !== undefined) product.variants = dto.variants;
        if (dto.careInstructions !== undefined) {
          product.careInstructions = dto.careInstructions;
        }
        if (dto.specSheetUrl !== undefined) {
          product.specSheetUrl = dto.specSheetUrl;
        }
        if (dto.isFeatured !== undefined) product.isFeatured = dto.isFeatured;
        if (dto.seoTitle !== undefined) product.seoTitle = dto.seoTitle;
        if (dto.seoDescription !== undefined) {
          product.seoDescription = dto.seoDescription;
        }
        if (dto.seoOgImageUrl !== undefined) {
          product.seoOgImageUrl = dto.seoOgImageUrl;
        }
        // Idempotent either direction — publishing an already-published
        // product doesn't reset its publishedAt to "now".
        if (dto.publish === true && !product.publishedAt) {
          product.publishedAt = new Date();
        } else if (dto.publish === false) {
          product.publishedAt = null;
        }

        await product.save({ session });

        await this.outboxRepository.write(
          new ProductUpdatedEvent(product.id, command.correlationId),
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
