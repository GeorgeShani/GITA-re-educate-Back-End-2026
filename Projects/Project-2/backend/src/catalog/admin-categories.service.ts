import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { CreateCategoryCommand } from './commands/create-category.command';
import { DeleteCategoryCommand } from './commands/delete-category.command';
import { UpdateCategoryCommand } from './commands/update-category.command';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, CategoryDocument } from './schemas/category.schema';

// Separate from the public CategoriesService — same reasoning as
// AdminProductsService: findAll/findById here aren't gated on
// isActive, so admins can see (and re-activate) a disabled category.
@Injectable()
export class AdminCategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  findAll(): Promise<CategoryDocument[]> {
    return this.categoryModel.find({}).sort({ position: 1 }).exec();
  }

  async findById(categoryId: string): Promise<CategoryDocument> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }
    return category;
  }

  create(dto: CreateCategoryDto): Promise<CategoryDocument> {
    return this.commandBus.execute(
      new CreateCategoryCommand(dto, this.correlationId()),
    );
  }

  update(
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<CategoryDocument> {
    return this.commandBus.execute(
      new UpdateCategoryCommand(categoryId, dto, this.correlationId()),
    );
  }

  delete(categoryId: string): Promise<void> {
    return this.commandBus.execute(
      new DeleteCategoryCommand(categoryId, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
