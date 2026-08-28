import { CreateCouponDto } from '@/coupons/dto/create-coupon.dto';

export class CreateCouponCommand {
  constructor(
    readonly dto: CreateCouponDto,
    readonly correlationId: string,
  ) {}
}
