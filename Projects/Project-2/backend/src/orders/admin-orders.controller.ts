import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';

import { ADMIN_ROLES } from '@/common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { AdminOrdersService } from './admin-orders.service';
import { FindOrdersAdminDto } from './dto/find-orders-admin.dto';
import { IssueRefundDto } from './dto/issue-refund.dto';
import { ShipOrderDto } from './dto/ship-order.dto';
import { InvoicePdfService } from './invoice-pdf.service';

@ApiTags('admin-orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.commerce)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly adminOrdersService: AdminOrdersService,
    private readonly invoicePdfService: InvoicePdfService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List orders, filterable by status' })
  findAll(@Query() query: FindOrdersAdminDto) {
    return this.adminOrdersService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Order detail — any order, not just your own' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminOrdersService.findById(id);
  }

  @Get(':id/packing-slip')
  @ApiOperation({ summary: 'Printable packing slip (PDF)' })
  async packingSlip(
    @Param('id', ParseObjectIdPipe) id: string,
    @Res() res: Response,
  ): Promise<void> {
    const order = await this.adminOrdersService.findById(id);
    const buffer = await this.invoicePdfService.generatePackingSlip(order);
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="packing-slip-${order.orderNumber}.pdf"`,
      })
      .send(buffer);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/ship')
  @ApiOperation({ summary: 'Mark an order shipped — must be CONFIRMED first' })
  ship(@Param('id', ParseObjectIdPipe) id: string, @Body() dto: ShipOrderDto) {
    return this.adminOrdersService.ship(id, dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/deliver')
  @ApiOperation({
    summary: 'Mark an order delivered — must be SHIPPED first',
  })
  markDelivered(@Param('id', ParseObjectIdPipe) id: string) {
    return this.adminOrdersService.markDelivered(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/refund')
  @ApiOperation({
    summary: 'Issue a refund — omit amountMinor for a full refund',
  })
  refund(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: IssueRefundDto,
  ) {
    return this.adminOrdersService.refund(id, dto);
  }
}
