import {
  Body,
  Controller,
  Get,
  Param,
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
import { ApproveReturnDto } from './dto/approve-return.dto';
import { FindReturnsAdminDto } from './dto/find-returns-admin.dto';
import { RejectReturnDto } from './dto/reject-return.dto';
import { ReturnsService } from './returns.service';

// The RMA queue — SCOPE.md Phase 6 "Returns": approve/reject, receive,
// refund. Customer side (request + status) is ReturnsController, S10.
@ApiTags('admin-returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.commerce)
@Controller('admin/returns')
export class AdminReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Get()
  @ApiOperation({
    summary: 'The RMA queue — every return, filterable by status',
  })
  findAll(@Query() query: FindReturnsAdminDto) {
    return this.returnsService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Return detail — any return, not just your own' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.returnsService.findByIdAdmin(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a requested return' })
  approve(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: ApproveReturnDto,
  ) {
    return this.returnsService.approve(id, dto);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a requested return, with a reason' })
  reject(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: RejectReturnDto,
  ) {
    return this.returnsService.reject(id, dto.adminNote);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/receive')
  @ApiOperation({
    summary: 'Mark the returned goods received at the warehouse',
  })
  receive(@Param('id', ParseObjectIdPipe) id: string) {
    return this.returnsService.receive(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/refund')
  @ApiOperation({
    summary: 'Refund a received return — amount computed from its line items',
  })
  refund(@Param('id', ParseObjectIdPipe) id: string) {
    return this.returnsService.refund(id);
  }
}
