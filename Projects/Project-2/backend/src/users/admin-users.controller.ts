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
import { CommandBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ClsService } from 'nestjs-cls';

import { ADMIN_ROLES } from '../common/constants/admin-roles.constant';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { SetUserBannedCommand } from './commands/set-user-banned.command';
import { UpdateUserRolesCommand } from './commands/update-user-roles.command';
import { FindUsersAdminDto } from './dto/find-users-admin.dto';
import { SetUserBannedDto } from './dto/set-user-banned.dto';
import { UpdateUserRolesDto } from './dto/update-user-roles.dto';
import { UsersService } from './users.service';

// Admin-only, no delegation to MANAGER/SUPPORT/EDITOR — role assignment
// and bans are the one area ADMIN_ROLES.people doesn't share.
@ApiTags('admin-users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES.people)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly commandBus: CommandBus,
    private readonly cls: ClsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List customers, searchable by email' })
  findAll(@Query() query: FindUsersAdminDto) {
    return this.usersService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Customer detail' })
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.findById(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id/roles')
  @ApiOperation({ summary: 'Replace a user’s roles' })
  updateRoles(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: UpdateUserRolesDto,
  ) {
    return this.commandBus.execute(
      new UpdateUserRolesCommand(id, dto.roles, this.correlationId()),
    );
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/ban')
  @ApiOperation({
    summary: 'Ban or unban a customer — banning revokes every session',
  })
  setBanned(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() dto: SetUserBannedDto,
  ) {
    return this.commandBus.execute(
      new SetUserBannedCommand(id, dto.banned, this.correlationId()),
    );
  }

  private correlationId(): string {
    return this.cls.get<string>('correlationId');
  }
}
