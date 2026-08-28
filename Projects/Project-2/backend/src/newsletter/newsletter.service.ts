import { BadRequestException, Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '@/catalog/products.service';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { ConfirmNewsletterSubscriptionCommand } from './commands/confirm-newsletter-subscription.command';
import { verifyNewsletterToken } from './newsletter-token.util';
import {
  NewsletterSubscriber,
  NewsletterSubscriberDocument,
} from './schemas/newsletter-subscriber.schema';

@Injectable()
export class NewsletterService {
  constructor(
    @InjectModel(NewsletterSubscriber.name)
    private readonly subscriberModel: Model<NewsletterSubscriberDocument>,
    private readonly commandBus: CommandBus,
    private readonly configService: ConfigService,
    private readonly cls: ClsService,
  ) {}

  /** Idempotent, and deliberately silent on "already subscribed" — never confirms or denies an address's status to an unauthenticated caller. */
  async subscribe(email: string): Promise<void> {
    const normalized = email.toLowerCase();
    await this.subscriberModel.updateOne(
      { email: normalized },
      {
        $setOnInsert: {
          email: normalized,
          confirmedAt: null,
          unsubscribedAt: null,
        },
      },
      { upsert: true },
    );
  }

  confirm(email: string, token: string): Promise<NewsletterSubscriberDocument> {
    this.assertValidToken(email, token);
    return this.commandBus.execute(
      new ConfirmNewsletterSubscriptionCommand(
        email.toLowerCase(),
        this.correlationId(),
      ),
    );
  }

  async unsubscribe(email: string, token: string): Promise<void> {
    this.assertValidToken(email, token);
    await this.subscriberModel.updateOne(
      { email: email.toLowerCase() },
      { unsubscribedAt: new Date() },
    );
  }

  async findAllAdmin(
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<NewsletterSubscriberDocument>> {
    const { page = 1, take = 30 } = query;

    const [items, total] = await Promise.all([
      this.subscriberModel
        .find({})
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.subscriberModel.countDocuments({}),
    ]);

    return { items, total, page, take };
  }

  /** Plain JSON, not CSV — confirmed, still-subscribed addresses only. */
  exportAll(): Promise<NewsletterSubscriberDocument[]> {
    return this.subscriberModel
      .find({ confirmedAt: { $ne: null }, unsubscribedAt: null })
      .sort({ confirmedAt: -1 })
      .exec();
  }

  private assertValidToken(email: string, token: string): void {
    const secret = this.configService.getOrThrow<string>('COOKIE_SECRET');
    if (!verifyNewsletterToken(email, token, secret)) {
      throw new BadRequestException('Invalid or expired link');
    }
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
