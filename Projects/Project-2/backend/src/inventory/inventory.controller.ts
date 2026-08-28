import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { CheckStockQueryDto } from './dto/check-stock-query.dto';
import { CreateBackInStockRequestDto } from './dto/create-back-in-stock-request.dto';
import { InventoryService } from './inventory.service';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('stock')
  @ApiOperation({ summary: 'Check available stock for a product variant' })
  checkStock(@Query() query: CheckStockQueryDto) {
    return this.inventoryService.checkStock(query.productId, query.variantSku);
  }

  @Throttle(WRITE_THROTTLE)
  @Post('back-in-stock-requests')
  @ApiOperation({
    summary:
      'Sign up for a back-in-stock email — works for guests, no auth required',
  })
  requestBackInStock(@Body() dto: CreateBackInStockRequestDto) {
    return this.inventoryService.requestBackInStock(dto);
  }
}
