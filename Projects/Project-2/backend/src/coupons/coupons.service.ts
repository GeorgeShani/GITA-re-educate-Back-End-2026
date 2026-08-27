import { Injectable, NotFoundException } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model, Types } from 'mongoose';
import { ClsService } from 'nestjs-cls';

import { PaginatedResult } from '../catalog/products.service';
import { CreateCouponCommand } from './commands/create-coupon.command';
import { UpdateCouponCommand } from './commands/update-coupon.command';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { FindCouponsAdminDto } from './dto/find-coupons-admin.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';
import {
  CouponRedemption,
  CouponRedemptionDocument,
} from './schemas/coupon-redemption.schema';
import { Coupon, CouponDocument } from './schemas/coupon.schema';

export interface CouponUsageReport {
  redemptionCount: number;
  totalDiscountMinor: number;
  uniqueCustomers: number;
}

@Injectable()
export class CouponsService {
  constructor(
    @InjectModel(Coupon.name)
    private readonly couponModel: Model<CouponDocument>,
    @InjectModel(CouponRedemption.name)
    private readonly redemptionModel: Model<CouponRedemptionDocument>,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  async findAll(
    query: FindCouponsAdminDto,
  ): Promise<PaginatedResult<CouponDocument>> {
    const { page = 1, take = 30 } = query;
    const filter: QueryFilter<CouponDocument> = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive;

    const [items, total] = await Promise.all([
      this.couponModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * take)
        .limit(take)
        .exec(),
      this.couponModel.countDocuments(filter),
    ]);

    return { items, total, page, take };
  }

  async findById(couponId: string): Promise<CouponDocument> {
    const coupon = await this.couponModel.findById(couponId).exec();
    if (!coupon) {
      throw new NotFoundException(`Coupon with id ${couponId} not found`);
    }
    return coupon;
  }

  /** Wires up the read side of a ledger ConfirmOrderHandler has been writing correctly since S9. */
  async usageReport(couponId: string): Promise<CouponUsageReport> {
    const [result] = await this.redemptionModel.aggregate<{
      redemptionCount: number;
      totalDiscountMinor: number;
      uniqueCustomers: number[];
    }>([
      { $match: { couponId: new Types.ObjectId(couponId) } },
      {
        $group: {
          _id: null,
          redemptionCount: { $sum: 1 },
          totalDiscountMinor: { $sum: '$discountAppliedMinor' },
          uniqueCustomers: { $addToSet: '$userId' },
        },
      },
    ]);

    return {
      redemptionCount: result?.redemptionCount ?? 0,
      totalDiscountMinor: result?.totalDiscountMinor ?? 0,
      uniqueCustomers: result?.uniqueCustomers.length ?? 0,
    };
  }

  create(dto: CreateCouponDto): Promise<CouponDocument> {
    return this.commandBus.execute(
      new CreateCouponCommand(dto, this.correlationId()),
    );
  }

  update(couponId: string, dto: UpdateCouponDto): Promise<CouponDocument> {
    return this.commandBus.execute(
      new UpdateCouponCommand(couponId, dto, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
