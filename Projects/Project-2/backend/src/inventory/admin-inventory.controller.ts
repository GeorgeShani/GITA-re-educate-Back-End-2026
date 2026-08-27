import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { ADMIN_ROLES } from '../common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { InventoryService } from './inventory.service';

@ApiTags('admin-inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.catalog)
@Controller('admin/inventory')
export class AdminInventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'Every inventory item — stock by variant' })
  findAll() {
    return this.inventoryService.findAllAdmin();
  }

  @Get('low-stock')
  @ApiOperation({ summary: 'Items at or below their low-stock threshold' })
  findLowStock() {
    return this.inventoryService.findLowStock();
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/adjust')
  @ApiOperation({
    summary: 'Manual stock correction, with a reason recorded on the ledger',
  })
  adjust(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AdjustStockDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.inventoryService.adjustStock(
      id,
      dto.delta,
      dto.reasonCode,
      dto.note,
      userId,
    );
  }
}
