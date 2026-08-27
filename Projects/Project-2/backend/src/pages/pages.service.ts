import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { PageDto } from './dto/page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { Page, PageDocument } from './schemas/page.schema';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

// Static CMS pages (about/shipping/returns/privacy/terms/FAQ) — no
// author, category, or publish/draft concept, so plain CRUD rather
// than CQRS+outbox, same reasoning as PostCategoriesService/TagsService.
// Public read is S11's scope, same as blog.
@Injectable()
export class PagesService {
  constructor(
    @InjectModel(Page.name) private readonly pageModel: Model<PageDocument>,
  ) {}

  findAll(): Promise<PageDocument[]> {
    return this.pageModel.find({}).sort({ title: 1 }).exec();
  }

  async findById(pageId: string): Promise<PageDocument> {
    const page = await this.pageModel.findById(pageId).exec();
    if (!page) {
      throw new NotFoundException(`Page with id ${pageId} not found`);
    }
    return page;
  }

  async create(dto: PageDto): Promise<PageDocument> {
    try {
      return await this.pageModel.create({
        title: dto.title,
        slug: dto.slug.toLowerCase(),
        body: dto.body,
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A page with slug "${dto.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  async update(pageId: string, dto: UpdatePageDto): Promise<PageDocument> {
    const page = await this.findById(pageId);

    if (dto.title !== undefined) page.title = dto.title;
    if (dto.slug !== undefined) page.slug = dto.slug.toLowerCase();
    if (dto.body !== undefined) page.body = dto.body;
    if (dto.seoTitle !== undefined) page.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) {
      page.seoDescription = dto.seoDescription;
    }

    try {
      await page.save();
      return page;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A page with slug "${dto.slug}" already exists`,
        );
      }
      throw error;
    }
  }

  async delete(pageId: string): Promise<void> {
    const result = await this.pageModel.deleteOne({ _id: pageId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Page with id ${pageId} not found`);
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
