import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '@/catalog/products.service';
import { AdjustGiftCardBalanceCommand } from './commands/adjust-gift-card-balance.command';
import { IssueGiftCardCommand } from './commands/issue-gift-card.command';
import { UpdateGiftCardCommand } from './commands/update-gift-card.command';
import { FindGiftCardsAdminDto } from './dto/find-gift-cards-admin.dto';
import { IssueGiftCardDto } from './dto/issue-gift-card.dto';
import { UpdateGiftCardDto } from './dto/update-gift-card.dto';
import { GiftCard, GiftCardDocument } from './schemas/gift-card.schema';

@Injectable()
export class GiftCardsService {
  constructor(
    @InjectModel(GiftCard.name)
    private readonly giftCardModel: Model<GiftCardDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async findAll(
    query: FindGiftCardsAdminDto,
  ): Promise<PaginatedResult<GiftCardDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<GiftCardDocument> = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const [items, total] = await Promise.all([
      this.giftCardModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.giftCardModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async findById(giftCardId: string): Promise<GiftCardDocument> {
    const giftCard = await this.giftCardModel.findById(giftCardId).exec();
    if (!giftCard) {
      throw new NotFoundException(`Gift card with id ${giftCardId} not found`);
    }
    return giftCard;
  }

  issue(dto: IssueGiftCardDto): Promise<GiftCardDocument> {
    return this.commandBus.execute(
      new IssueGiftCardCommand(dto, this.correlationId()),
    );
  }

  update(
    giftCardId: string,
    dto: UpdateGiftCardDto,
  ): Promise<GiftCardDocument> {
    return this.commandBus.execute(
      new UpdateGiftCardCommand(giftCardId, dto, this.correlationId()),
    );
  }

  adjustBalance(giftCardId: string, delta: number): Promise<GiftCardDocument> {
    return this.commandBus.execute(
      new AdjustGiftCardBalanceCommand(giftCardId, delta, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
