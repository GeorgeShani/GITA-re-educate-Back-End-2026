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

import { ADMIN_ROLES } from '@/common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { Roles } from '@/common/decorators/roles.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { AdjustGiftCardBalanceDto } from './dto/adjust-gift-card-balance.dto';
import { FindGiftCardsAdminDto } from './dto/find-gift-cards-admin.dto';
import { IssueGiftCardDto } from './dto/issue-gift-card.dto';
import { UpdateGiftCardDto } from './dto/update-gift-card.dto';
import { GiftCardsService } from './gift-cards.service';

// Issuance/management only — redemption at checkout is a separate,
// not-yet-built cart/checkout change (see gift-card.schema.ts's own
// comment on how balanceMinor is meant to be spent).
@ApiTags('admin-gift-cards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.money)
@Controller('admin/gift-cards')
export class AdminGiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  @Get()
  @ApiOperation({ summary: 'List gift cards' })
  findAll(@Query() query: FindGiftCardsAdminDto) {
    return this.giftCardsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Gift card detail' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.giftCardsService.findById(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Issue a new gift card — code is generated' })
  issue(@Body() dto: IssueGiftCardDto) {
    return this.giftCardsService.issue(dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  @ApiOperation({ summary: 'Update expiry or deactivate a gift card' })
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateGiftCardDto,
  ) {
    return this.giftCardsService.update(id, dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/adjust-balance')
  @ApiOperation({ summary: 'Manual balance correction' })
  adjustBalance(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: AdjustGiftCardBalanceDto,
  ) {
    return this.giftCardsService.adjustBalance(id, dto.delta);
  }
}
