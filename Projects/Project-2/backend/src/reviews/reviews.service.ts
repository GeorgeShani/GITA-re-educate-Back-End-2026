import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '../catalog/products.service';
import { SubmitReviewCommand } from './commands/submit-review.command';
import { CreateReviewDto } from './dto/create-review.dto';
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
        this.cls.get<string>('correlationId'),
      ),
    );
  }
}
