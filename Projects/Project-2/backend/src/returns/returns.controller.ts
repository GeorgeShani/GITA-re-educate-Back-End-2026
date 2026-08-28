import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { WRITE_THROTTLE } from '@/common/constants/throttle.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '@/common/pipes/parse-object-id.pipe';
import { RequestReturnDto } from './dto/request-return.dto';
import { ReturnsService } from './returns.service';

// Customer side only (request + status) — approval/rejection is an admin
// action, out of scope per SCOPE.md Phase 6 (see returns.schema.ts).
@ApiTags('returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Throttle(WRITE_THROTTLE)
  @Post()
  @ApiOperation({ summary: 'Request a return for one or more order lines' })
  async request(
    @Body() dto: RequestReturnDto,
    @CurrentUser('userId') userId: string,
  ) {
    return this.returnsService.request(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: "The current user's return requests" })
  async findMine(@CurrentUser('userId') userId: string) {
    return this.returnsService.findMine(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'A single return request, by id' })
  async findOne(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.returnsService.findOwned(id, userId);
  }
}
