import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { TagDto } from './dto/tag.dto';
import { Tag, TagDocument } from './schemas/tag.schema';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@Injectable()
export class TagsService {
  constructor(
    @InjectModel(Tag.name) private readonly tagModel: Model<TagDocument>,
  ) {}

  findAll(): Promise<TagDocument[]> {
    return this.tagModel.find({}).sort({ name: 1 }).exec();
  }

  async create(dto: TagDto): Promise<TagDocument> {
    try {
      return await this.tagModel.create({ name: dto.name.toLowerCase() });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(`A tag named "${dto.name}" already exists`);
      }
      throw error;
    }
  }

  async delete(tagId: string): Promise<void> {
    const result = await this.tagModel.deleteOne({ _id: tagId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Tag with id ${tagId} not found`);
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
