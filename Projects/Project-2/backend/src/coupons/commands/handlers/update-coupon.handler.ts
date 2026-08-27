import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { TransactionalCommandHandler } from '../../../core/bus/transactional-command.handler';
import { OutboxRepository } from '../../../core/outbox/outbox.repository';
import { CouponUpdatedEvent } from '../../events/coupon-updated.event';
import { Coupon, CouponDocument } from '../../schemas/coupon.schema';
import { UpdateCouponCommand } from '../update-coupon.command';

const MONGO_DUPLICATE_KEY_ERROR = 11000;

@CommandHandler(UpdateCouponCommand)
export class UpdateCouponHandler
  extends TransactionalCommandHandler<UpdateCouponCommand>
  implements ICommandHandler<UpdateCouponCommand>
{
  constructor(
    @InjectConnection() connection: Connection,
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    private readonly outboxRepository: OutboxRepository,
  ) {
    super(connection);
  }

  async execute(command: UpdateCouponCommand): Promise<CouponDocument> {
    const { dto } = command;

    try {
      return await this.withTransaction(async (session) => {
        const coupon = await this.couponModel
          .findById(command.couponId)
          .session(session);
        if (!coupon) {
          throw new NotFoundException(
            `Coupon with id ${command.couponId} not found`,
          );
        }

        if (dto.code !== undefined) coupon.code = dto.code;
        if (dto.type !== undefined) coupon.type = dto.type;
        if (dto.value !== undefined) coupon.value = dto.value;
        if (dto.minSpendMinor !== undefined) {
          coupon.minSpendMinor = dto.minSpendMinor;
        }
        if (dto.productIds !== undefined) {
          coupon.productIds = dto.productIds.map(
            (id) => new Types.ObjectId(id),
          );
        }
        if (dto.categoryIds !== undefined) {
          coupon.categoryIds = dto.categoryIds.map(
            (id) => new Types.ObjectId(id),
          );
        }
        if (dto.perUserLimit !== undefined)
          coupon.perUserLimit = dto.perUserLimit;
        if (dto.globalLimit !== undefined) coupon.globalLimit = dto.globalLimit;
        if (dto.allowStacking !== undefined) {
          coupon.allowStacking = dto.allowStacking;
        }
        if (dto.startsAt !== undefined)
          coupon.startsAt = new Date(dto.startsAt);
        if (dto.endsAt !== undefined) coupon.endsAt = new Date(dto.endsAt);
        if (dto.isActive !== undefined) coupon.isActive = dto.isActive;

        await coupon.save({ session });

        await this.outboxRepository.write(
          new CouponUpdatedEvent(coupon.id, command.correlationId),
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
