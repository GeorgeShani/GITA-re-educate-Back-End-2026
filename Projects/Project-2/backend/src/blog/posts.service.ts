import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '../catalog/products.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreatePostCommand } from './commands/create-post.command';
import { DeletePostCommand } from './commands/delete-post.command';
import { UpdatePostCommand } from './commands/update-post.command';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { Post, PostDocument } from './schemas/post.schema';

// Admin surface only — the public blog read API is S11's own scope
// (see the plan). Verifiable independently through this service's own
// findAll/findById in the meantime.
@Injectable()
export class PostsService {
  constructor(
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async findAll(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<PostDocument>> {
    const { page = 1, take = 30 } = query;

    const [items, total] = await Promise.all([
      this.postModel
        .find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.postModel.countDocuments({}),
    ]);

    return { items, total, page, take };
  }

  async findById(postId: string): Promise<PostDocument> {
    const post = await this.postModel.findById(postId).exec();
    if (!post) {
      throw new NotFoundException(`Post with id ${postId} not found`);
    }
    return post;
  }

  create(dto: CreatePostDto, authorId: string): Promise<PostDocument> {
    return this.commandBus.execute(
      new CreatePostCommand(dto, authorId, this.correlationId()),
    );
  }

  update(postId: string, dto: UpdatePostDto): Promise<PostDocument> {
    return this.commandBus.execute(
      new UpdatePostCommand(postId, dto, this.correlationId()),
    );
  }

  delete(postId: string): Promise<void> {
    return this.commandBus.execute(
      new DeletePostCommand(postId, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
