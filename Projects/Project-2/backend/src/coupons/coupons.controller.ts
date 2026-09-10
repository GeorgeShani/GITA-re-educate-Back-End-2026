import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CouponsService } from './coupons.service';

/**
 * Public, unauthenticated — no admin-coupons.controller.ts auth guard
 * here. Same "one dedicated public read surface next to the admin one"
 * shape as blog.controller.ts/public-blog.service.ts.
 */
@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get('featured')
  @ApiOperation({
    summary: 'The active storefront-wide promo, if one is running',
  })
  findFeatured() {
    return this.couponsService.findFeatured();
  }
}
