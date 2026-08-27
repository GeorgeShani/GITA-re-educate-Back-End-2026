import {
  Body,
  Controller,
  Delete,
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

import { ADMIN_ROLES } from '../common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { AddSuppressionDto } from './dto/add-suppression.dto';
import { FindEmailMessagesAdminDto } from './dto/find-email-messages-admin.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('admin-email')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.content)
@Controller('admin/email')
export class AdminEmailController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('messages')
  @ApiOperation({
    summary: 'Sent-email log, filterable by status/category/recipient',
  })
  listMessages(@Query() query: FindEmailMessagesAdminDto) {
    return this.notificationsService.listMessages(query);
  }

  @Throttle(WRITE_THROTTLE)
  @Post('messages/:id/resend')
  @ApiOperation({ summary: 'Re-send an email using its original payload' })
  resend(@Param('id', ParseObjectIdPipe) id: string) {
    return this.notificationsService.resend(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post('suppressions')
  @ApiOperation({ summary: 'Manually suppress an address' })
  addSuppression(@Body() dto: AddSuppressionDto) {
    return this.notificationsService.addSuppression(dto.email);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete('suppressions/:email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an address from the suppression list' })
  async removeSuppression(@Param('email') email: string): Promise<void> {
    await this.notificationsService.removeSuppression(email);
  }
}
