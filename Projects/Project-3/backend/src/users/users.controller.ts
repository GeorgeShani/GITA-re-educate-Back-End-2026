import { Body, Controller, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/auth/current-user.decorator.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { UpdateMeDto } from './dto/update-me.dto.js';
import { UserProfileDto } from './dto/user-profile.dto.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Roles('admin', 'employee')
  @Patch('me')
  @ApiOkResponse({ type: UserProfileDto })
  async updateMe(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateMeDto,
  ): Promise<UserProfileDto> {
    return UserProfileDto.from(await this.users.updateFullName(userId, dto.fullName));
  }
}
