import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseObjectIdPipe } from '../common/pipes/parse-object-id.pipe';
import { UsersService } from './users.service';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('upgrade-subscription')
  upgradeSubscription(@CurrentUser('email') email: string) {
    return this.usersService.upgradeSubscription(email);
  }

  @Get()
  findAll(@Query() query: FindUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseObjectIdPipe) id: string) {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseObjectIdPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('userId') currentUserId: string,
  ) {
    this.assertSelf(id, currentUserId);
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseObjectIdPipe) id: string,
    @CurrentUser('userId') currentUserId: string,
  ) {
    this.assertSelf(id, currentUserId);
    return this.usersService.remove(id);
  }

  private assertSelf(id: string, currentUserId: string) {
    if (id !== currentUserId) {
      throw new ForbiddenException('You can only manage your own account');
    }
  }
}
