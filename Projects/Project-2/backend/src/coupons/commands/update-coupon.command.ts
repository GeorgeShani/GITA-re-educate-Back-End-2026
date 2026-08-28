import { UpdateCouponDto } from '@/coupons/dto/update-coupon.dto';

export class UpdateCouponCommand {
  constructor(
    readonly couponId: string,
    readonly dto: UpdateCouponDto,
    readonly correlationId: string,
  ) {}
}
