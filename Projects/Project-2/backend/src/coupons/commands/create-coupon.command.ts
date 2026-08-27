import { CreateCouponDto } from '../dto/create-coupon.dto';

export class CreateCouponCommand {
  constructor(
    readonly dto: CreateCouponDto,
    readonly correlationId: string,
  ) {}
}
