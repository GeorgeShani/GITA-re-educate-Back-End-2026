import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PostCategoryDto } from './dto/post-category.dto';
import {
  PostCategory,
  PostCategoryDocument,
} from './schemas/post-category.schema';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

// A flat lookup (name+slug, no tree) — plain CRUD, no CQRS, same
// reasoning as UsersService.addAddress: nothing reacts to "a blog
// category was created."
@Injectable()
export class PostCategoriesService {
  constructor(
    @InjectModel(PostCategory.name)
    private readonly postCategoryModel: Model<PostCategoryDocument>,
  ) {}

  findAll(): Promise<PostCategoryDocument[]> {
    return this.postCategoryModel.find({}).sort({ name: 1 }).exec();
  }

  async create(dto: PostCategoryDto): Promise<PostCategoryDocument> {
    try {
      return await this.postCategoryModel.create({
        name: dto.name,
        slug: dto.slug.toLowerCase(),
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A post category with slug "${dto.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(
    categoryId: string,
    dto: PostCategoryDto,
  ): Promise<PostCategoryDocument> {
    try {
      const category = await this.postCategoryModel
        .findByIdAndUpdate(
          categoryId,
          { name: dto.name, slug: dto.slug.toLowerCase() },
          { new: true },
        )
        .exec();
      if (!category) {
        throw new NotFoundException(
          `Post category with id ${categoryId} not found`,
        );
      }
      return category;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A post category with slug "${dto.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  async delete(categoryId: string): Promise<void> {
    const result = await this.postCategoryModel
      .deleteOne({ _id: categoryId })
      .exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(
        `Post category with id ${categoryId} not found`,
      );
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
