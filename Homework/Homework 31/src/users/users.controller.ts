import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WRITE_THROTTLE } from '../common/constants/throttle.constant';
import { PHOTO_UPLOAD_OPTIONS } from '../common/constants/upload.constant';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FindUsersDto } from './dto/find-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Throttle(WRITE_THROTTLE)
  @Post('upgrade-subscription')
  upgradeSubscription(@CurrentUser('email') email: string) {
    return this.usersService.upgradeSubscription(email);
  }

  @Get()
  findAll(@Query() query: FindUsersDto) {
    return this.usersService.findAll(query);
  }

  @Get('gender-stats')
  getGenderStats() {
    return this.usersService.getGenderStatistics();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUserDto: UpdateUserDto,
    @CurrentUser('userId') currentUserId: number,
  ) {
    this.assertSelf(id, currentUserId);
    return this.usersService.update(id, updateUserDto);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') currentUserId: number,
  ) {
    this.assertSelf(id, currentUserId);
    return this.usersService.remove(id);
  }

  @Throttle(WRITE_THROTTLE)
  @Post(':id/photo')
  @UseInterceptors(FileInterceptor('photo', PHOTO_UPLOAD_OPTIONS))
  uploadProfilePhoto(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') currentUserId: number,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    this.assertSelf(id, currentUserId);

    if (!file) {
      throw new BadRequestException(
        'No photo file provided (expected multipart field "photo")',
      );
    }

    return this.usersService.setProfilePhoto(id, file);
  }

  @Throttle(WRITE_THROTTLE)
  @Delete(':id/photo')
  removeProfilePhoto(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('userId') currentUserId: number,
  ) {
    this.assertSelf(id, currentUserId);
    return this.usersService.removeProfilePhoto(id);
  }

  private assertSelf(id: number, currentUserId: number) {
    if (id !== currentUserId) {
      throw new ForbiddenException('You can only manage your own account');
    }
  }
}
