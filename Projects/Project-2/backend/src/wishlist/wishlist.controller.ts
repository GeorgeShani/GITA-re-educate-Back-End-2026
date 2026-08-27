import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { WishlistService } from './wishlist.service';

@ApiTags('wishlist')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wishlist')
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  @ApiOperation({ summary: "The current user's wishlist" })
  async findMine(@CurrentUser('userId') userId: string) {
    return this.wishlistService.findMine(userId);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':productId')
  @ApiOperation({ summary: 'Add a product to the wishlist (idempotent)' })
  async add(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.wishlistService.add(userId, productId);
    return this.wishlistService.findMine(userId);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete(':productId')
  @ApiOperation({ summary: 'Remove a product from the wishlist (idempotent)' })
  async remove(
    @Param('productId', ParseObjectIdPipe) productId: string,
    @CurrentUser('userId') userId: string,
  ) {
    await this.wishlistService.remove(userId, productId);
    return this.wishlistService.findMine(userId);
  }
}
