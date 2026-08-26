import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';

import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { CartIdentity, CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { ApplyCouponDto } from './dto/apply-coupon.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

const GUEST_CART_COOKIE = 'gct';
const GUEST_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Every mutating route resolves the cart fresh from cookie/auth state
// rather than trusting a cart id from the client — a cart id in the
// request body would let one guest read or edit another guest's cart
// just by guessing an id.
@ApiTags('cart')
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'The current cart — guest (via cookie) or authenticated',
  })
  async getCart(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') userId?: string,
  ) {
    const { cart, newGuestToken } = await this.cartService.resolveCart(
      this.identity(req, userId),
    );
    this.maybeSetGuestCookie(res, newGuestToken);
    return this.cartService.getSummary(cart);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post('items')
  @ApiOperation({ summary: 'Add an item to the cart' })
  async addItem(
    @Body() dto: AddCartItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') userId?: string,
  ) {
    const { cart, newGuestToken } = await this.cartService.resolveCart(
      this.identity(req, userId),
    );
    this.maybeSetGuestCookie(res, newGuestToken);
    const updated = await this.cartService.addItem(cart.id, dto);
    return this.cartService.getSummary(updated);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Patch('items/:itemId')
  @ApiOperation({ summary: 'Change a line item quantity' })
  async updateItem(
    @Param('itemId', ParseObjectIdPipe) itemId: string,
    @Body() dto: UpdateCartItemDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') userId?: string,
  ) {
    const { cart, newGuestToken } = await this.cartService.resolveCart(
      this.identity(req, userId),
    );
    this.maybeSetGuestCookie(res, newGuestToken);
    const updated = await this.cartService.updateItemQuantity(
      cart.id,
      itemId,
      dto.quantity,
    );
    return this.cartService.getSummary(updated);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Delete('items/:itemId')
  @ApiOperation({ summary: 'Remove a line item' })
  async removeItem(
    @Param('itemId', ParseObjectIdPipe) itemId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') userId?: string,
  ) {
    const { cart, newGuestToken } = await this.cartService.resolveCart(
      this.identity(req, userId),
    );
    this.maybeSetGuestCookie(res, newGuestToken);
    const updated = await this.cartService.removeItem(cart.id, itemId);
    return this.cartService.getSummary(updated);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Post('coupon')
  @ApiOperation({ summary: 'Apply a coupon code' })
  async applyCoupon(
    @Body() dto: ApplyCouponDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') userId?: string,
  ) {
    const { cart, newGuestToken } = await this.cartService.resolveCart(
      this.identity(req, userId),
    );
    this.maybeSetGuestCookie(res, newGuestToken);
    const updated = await this.cartService.applyCoupon(cart.id, dto.code);
    return this.cartService.getSummary(updated);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Throttle(WRITE_THROTTLE)
  @Delete('coupon')
  @ApiOperation({ summary: 'Remove the applied coupon' })
  async removeCoupon(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') userId?: string,
  ) {
    const { cart, newGuestToken } = await this.cartService.resolveCart(
      this.identity(req, userId),
    );
    this.maybeSetGuestCookie(res, newGuestToken);
    const updated = await this.cartService.removeCoupon(cart.id);
    return this.cartService.getSummary(updated);
  }

  // Real auth required (not optional) — merging only makes sense once
  // there's a genuine authenticated user to merge into.
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('merge')
  @ApiOperation({
    summary:
      "Fold the guest cart (if any) into the authenticated user's cart — call right after login/register",
  })
  async merge(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser('userId') userId: string,
  ) {
    const guestToken = req.signedCookies[GUEST_CART_COOKIE] as
      string | undefined;
    if (guestToken) {
      await this.cartService.mergeGuestCart(guestToken, userId);
      res.clearCookie(GUEST_CART_COOKIE);
    }

    const { cart } = await this.cartService.resolveCart({ userId });
    return this.cartService.getSummary(cart);
  }

  private identity(req: Request, userId?: string): CartIdentity {
    if (userId) return { userId };
    const guestToken = req.signedCookies[GUEST_CART_COOKIE] as
      string | undefined;
    return { guestToken };
  }

  private maybeSetGuestCookie(res: Response, token?: string): void {
    if (!token) return;
    res.cookie(GUEST_CART_COOKIE, token, {
      httpOnly: true,
      signed: true,
      maxAge: GUEST_COOKIE_MAX_AGE_MS,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
}
