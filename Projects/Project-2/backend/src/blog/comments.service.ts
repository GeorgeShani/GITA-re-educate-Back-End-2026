import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '@/catalog/products.service';
import { ApproveCommentCommand } from './commands/approve-comment.command';
import { RejectCommentCommand } from './commands/reject-comment.command';
import { ReplyToCommentCommand } from './commands/reply-to-comment.command';
import { FindCommentsAdminDto } from './dto/find-comments-admin.dto';
import { Comment, CommentDocument } from './schemas/comment.schema';

@Injectable()
export class CommentsService {
  constructor(
    @InjectModel(Comment.name)
    private readonly commentModel: Model<CommentDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async findAll(
    query: FindCommentsAdminDto,
  ): Promise<PaginatedResult<CommentDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<CommentDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.postId) filter.postId = new Types.ObjectId(query.postId);

    const [items, total] = await Promise.all([
      this.commentModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.commentModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async findById(commentId: string): Promise<CommentDocument> {
    const comment = await this.commentModel.findById(commentId).exec();
    if (!comment) {
      throw new NotFoundException(`Comment with id ${commentId} not found`);
    }
    return comment;
  }

  approve(commentId: string): Promise<CommentDocument> {
    return this.commandBus.execute(
      new ApproveCommentCommand(commentId, this.correlationId()),
    );
  }

  reject(commentId: string): Promise<CommentDocument> {
    return this.commandBus.execute(
      new RejectCommentCommand(commentId, this.correlationId()),
    );
  }

  reply(
    parentCommentId: string,
    body: string,
    adminUserId: string,
    adminEmail: string,
  ): Promise<CommentDocument> {
    return this.commandBus.execute(
      new ReplyToCommentCommand(
        parentCommentId,
        body,
        adminUserId,
        adminEmail,
        this.correlationId(),
      ),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
