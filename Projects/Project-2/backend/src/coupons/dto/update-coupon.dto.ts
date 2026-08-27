import { PartialType } from '@nestjs/swagger';

import { CreateCouponDto } from './create-coupon.dto';

// Every field optional — PATCH semantics, including isActive to
// deactivate a coupon without deleting its redemption history.
export class UpdateCouponDto extends PartialType(CreateCouponDto) {}
