import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ADMIN_ROLES } from '../common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CouponsService } from './coupons.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { FindCouponsAdminDto } from './dto/find-coupons-admin.dto';
import { UpdateCouponDto } from './dto/update-coupon.dto';

@ApiTags('admin-coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.money)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private readonly couponsService: CouponsService) {}

  @Get()
  @ApiOperation({ summary: 'List coupons' })
  findAll(@Query() query: FindCouponsAdminDto) {
    return this.couponsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Coupon detail' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.couponsService.findById(id);
  }

  @Get(':id/usage')
  @ApiOperation({
    summary: 'Redemption count, total discount, unique customers',
  })
  usageReport(@Param('id', ParseObjectIdPipe) id: string) {
    return this.couponsService.usageReport(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Create a coupon' })
  create(@Body() dto: CreateCouponDto) {
    return this.couponsService.create(dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a coupon — set isActive: false to deactivate',
  })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateCouponDto,
  ) {
    return this.couponsService.update(id, dto);
  }
}
