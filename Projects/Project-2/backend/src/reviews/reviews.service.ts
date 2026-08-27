import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '../catalog/products.service';
import { ApproveReviewCommand } from './commands/approve-review.command';
import { RejectReviewCommand } from './commands/reject-review.command';
import { ReplyToReviewCommand } from './commands/reply-to-review.command';
import { SubmitReviewCommand } from './commands/submit-review.command';
import { CreateReviewDto } from './dto/create-review.dto';
import { FindReviewsAdminDto } from './dto/find-reviews-admin.dto';
import { FindReviewsDto } from './dto/find-reviews.dto';
import { Review, ReviewDocument } from './schemas/review.schema';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name)
    private readonly reviewModel: Model<ReviewDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async findApproved(
    query: FindReviewsDto,
  ): Promise<PaginatedResult<ReviewDocument>> {
    const { page = 1, take = 30 } = query;
    const filter = {
      productId: new Types.ObjectId(query.productId),
      status: 'approved' as const,
    };

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.reviewModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  submit(dto: CreateReviewDto, userId: string): Promise<ReviewDocument> {
    return this.commandBus.execute(
      new SubmitReviewCommand(
        dto.productId,
        userId,
        dto.rating,
        dto.title,
        dto.body,
        dto.photoPublicIds ?? [],
        this.correlationId(),
      ),
    );
  }

  async findAllAdmin(
    query: FindReviewsAdminDto,
  ): Promise<PaginatedResult<ReviewDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<ReviewDocument> = {};
    if (query.status) filter.status = query.status;
    if (query.productId) filter.productId = new Types.ObjectId(query.productId);

    const [items, total] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.reviewModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async findByIdAdmin(reviewId: string): Promise<ReviewDocument> {
    const review = await this.reviewModel.findById(reviewId).exec();
    if (!review) {
      throw new NotFoundException(`Review with id ${reviewId} not found`);
    }
    return review;
  }

  approve(reviewId: string): Promise<ReviewDocument> {
    return this.commandBus.execute(
      new ApproveReviewCommand(reviewId, this.correlationId()),
    );
  }

  reject(reviewId: string): Promise<ReviewDocument> {
    return this.commandBus.execute(
      new RejectReviewCommand(reviewId, this.correlationId()),
    );
  }

  reply(reviewId: string, reply: string): Promise<ReviewDocument> {
    return this.commandBus.execute(
      new ReplyToReviewCommand(reviewId, reply, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
