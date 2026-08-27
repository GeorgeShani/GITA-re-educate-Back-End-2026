import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CheckoutService } from './checkout.service';
import { CheckoutQuoteDto } from './dto/checkout-quote.dto';
import { PlaceOrderDto } from './dto/place-order.dto';

// Authenticated only — Order.userId is a required field (a decision
// already made in S3's schema pass), so this backend doesn't support
// guest checkout. A guest cart still has to merge into an account
// (POST /cart/merge, S8) before checking out.
@ApiTags('checkout')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Get('quote')
  @ApiOperation({
    summary:
      'Shipping options, tax, and totals for the current cart and a destination',
  })
  getQuote(
    @Query() dto: CheckoutQuoteDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.checkoutService.getQuote(userId, dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Post('place-order')
  @ApiOperation({
    summary:
      'Place the order and create a PaymentIntent — returns a clientSecret to complete payment',
  })
  placeOrder(
    @Body() dto: PlaceOrderDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.checkoutService.placeOrder(userId, dto);
  }
}
