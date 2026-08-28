import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { escapeRegExp } from '@/common/utils/escape-regexp.util';
import { Category, CategoryDocument } from './schemas/category.schema';

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string;
  imageUrl?: string;
  children: CategoryTreeNode[];
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async findTree(): Promise<CategoryTreeNode[]> {
    const categories = await this.categoryModel
      .find({ isActive: true })
      .sort({ position: 1 })
      .exec();
    return this.buildTree(categories, null);
  }

  async findBySlug(slug: string): Promise<CategoryDocument> {
    const category = await this.categoryModel
      .findOne({ slug, isActive: true })
      .exec();
    if (!category) {
      throw new NotFoundException(`Category "${slug}" not found`);
    }
    return category;
  }

  /**
   * The category itself plus every descendant, via the materialized
   * path prefix — SCOPE.md Phase 3 ($graphLookup is the documented
   * fallback if this ever falls short). Used for "show products in this
   * category, including subcategories."
   */
  async findSelfAndDescendantIds(
    categoryId: string,
  ): Promise<Types.ObjectId[]> {
    const category = await this.categoryModel.findById(categoryId).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${categoryId} not found`);
    }

    const descendants = await this.categoryModel
      .find({ path: new RegExp(`^${escapeRegExp(category.path)}`) })
      .exec();

    return descendants.map((descendant) => descendant._id);
  }

  private buildTree(
    categories: CategoryDocument[],
    parentId: Types.ObjectId | null,
  ): CategoryTreeNode[] {
    return categories
      .filter(
        (category) => String(category.parentId ?? null) === String(parentId),
      )
      .map((category) => ({
        id: category.id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        children: this.buildTree(categories, category._id),
      }));
  }
}
