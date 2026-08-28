import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { PaginationQueryDto } from '@/common/dto/pagination-query.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { TrackOrderDto } from './dto/track-order.dto';
import { OrdersService } from './orders.service';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get('track')
  @ApiOperation({
    summary: 'Public order tracking — requires the order number and its email',
  })
  track(@Query() dto: TrackOrderDto) {
    return this.ordersService.trackByOrderNumber(dto.orderNumber, dto.email);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: "The authenticated user's own orders" })
  findMine(
    @Query() query: PaginationQueryDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ordersService.findMine(userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({
    summary: 'Order detail — includes invoiceUrl once generated',
  })
  findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.ordersService.findOwned(id, userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle(WRITE_THROTTLE)
  @Post(':id/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Add every line from a past order to the customer's current cart",
  })
  async reorder(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ): Promise<void> {
    await this.ordersService.reorder(id, userId);
  }
}
