import { ConflictException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '@/core/bus/transactional-command.handler';
import { OutboxRepository } from '@/core/outbox/outbox.repository';
import { CouponCreatedEvent } from '@/coupons/events/coupon-created.event';
import { Coupon, CouponDocument } from '@/coupons/schemas/coupon.schema';
import { CreateCouponCommand } from '@/coupons/commands/create-coupon.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(CreateCouponCommand)
export class CreateCouponHandler
  extends TransactionalCommandHandler<CreateCouponCommand>
  implements ICommandHandler<CreateCouponCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: CreateCouponCommand): Promise<CouponDocument> {
    const { dto } = command;

    try {
      return await this.withTransaction(async (session) => {
        const [coupon] = await this.couponModel.create(
          [
            {
              code: dto.code,
              type: dto.type,
              value: dto.value,
              minSpendMinor: dto.minSpendMinor ?? 0,
              productIds: (dto.productIds ?? []).map(
                (id) => new Types.ObjectId(id),
              ),
              categoryIds: (dto.categoryIds ?? []).map(
                (id) => new Types.ObjectId(id),
              ),
              perUserLimit: dto.perUserLimit,
              globalLimit: dto.globalLimit,
              allowStacking: dto.allowStacking ?? false,
              startsAt: new Date(dto.startsAt),
              endsAt: dto.endsAt ? new Date(dto.endsAt) : undefined,
              isActive: dto.isActive ?? true,
            },
          ],
          { session },
        );

        await this.outboxRepository.write(
          new CouponCreatedEvent(coupon.id, coupon.code, command.correlationId),
          session,
        );

        return coupon;
      });
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A coupon with code "${dto.code}" already exists`,
        );
      }
      throw error;
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
