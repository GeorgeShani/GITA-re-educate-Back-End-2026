import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '#/common/auth/roles.decorator.js';
import { mapPageData } from '#/common/pagination/paginate.js';
import { toDto } from '#/common/response/to-dto.js';
import {
  MarkedReadDto,
  NotificationDto,
  NotificationPageDto,
  UnreadCountDto,
} from './dto/notification.dto.js';
import { NotificationsQueryDto } from './dto/notifications-query.dto.js';
import { NotificationsService } from './notifications.service.js';

/**
 * Your own inbox. Any signed-in person, session only: no route here declares `@RequireScopes`, so an
 * API key cannot read it (see `ScopesGuard`). A colleague's notification is a 404, never a 403.
 */
@ApiTags('notifications')
@ApiBearerAuth()
@Roles('admin', 'employee')
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @ApiOkResponse({ type: NotificationPageDto })
  async list(@Query() query: NotificationsQueryDto): Promise<NotificationPageDto> {
    return toDto(NotificationPageDto, mapPageData(await this.notifications.list(query), NotificationDto.from));
  }

  @Get('unread-count')
  @ApiOkResponse({ type: UnreadCountDto })
  async unreadCount(): Promise<UnreadCountDto> {
    return toDto(UnreadCountDto, { count: await this.notifications.unreadCount() });
  }

  // Declared before `:id/read`, so `read-all` is never taken for an id.
  @Post('read-all')
  @HttpCode(200)
  @ApiOkResponse({ type: MarkedReadDto })
  async readAll(): Promise<MarkedReadDto> {
    return toDto(MarkedReadDto, { updated: await this.notifications.markAllRead() });
  }

  @Post(':id/read')
  @HttpCode(200)
  @ApiOkResponse({ type: NotificationDto })
  async read(@Param('id', ParseUUIDPipe) id: string): Promise<NotificationDto> {
    return NotificationDto.from(await this.notifications.markRead(id));
  }
}
