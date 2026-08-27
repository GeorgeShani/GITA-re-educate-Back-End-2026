import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
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
import { CreateShippingZoneDto } from './dto/create-shipping-zone.dto';
import { UpdateShippingZoneDto } from './dto/update-shipping-zone.dto';
import { ShippingService } from './shipping.service';

@ApiTags('admin-shipping')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.money)
@Controller('admin/shipping/zones')
export class AdminShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @Get()
  @ApiOperation({ summary: 'List shipping zones' })
  findAll() {
    return this.shippingService.findAllAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Shipping zone detail' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.shippingService.findByIdAdmin(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Create a shipping zone' })
  create(@Body() dto: CreateShippingZoneDto) {
    return this.shippingService.create(dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  @ApiOperation({
    summary:
      'Update a shipping zone — rates, when sent, replace the whole list',
  })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateShippingZoneDto,
  ) {
    return this.shippingService.update(id, dto);
  }
}
