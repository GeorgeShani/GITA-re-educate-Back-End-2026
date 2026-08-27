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
import { CreateTaxRateDto } from './dto/create-tax-rate.dto';
import { UpdateTaxRateDto } from './dto/update-tax-rate.dto';
import { TaxService } from './tax.service';

@ApiTags('admin-tax')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.money)
@Controller('admin/tax/rates')
export class AdminTaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get()
  @ApiOperation({ summary: 'List tax rates' })
  findAll() {
    return this.taxService.findAllAdmin();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Tax rate detail' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.taxService.findByIdAdmin(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Create a tax rate' })
  create(@Body() dto: CreateTaxRateDto) {
    return this.taxService.create(dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  @ApiOperation({ summary: 'Update a tax rate' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateTaxRateDto,
  ) {
    return this.taxService.update(id, dto);
  }
}
